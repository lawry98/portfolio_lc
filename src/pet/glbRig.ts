/**
 * `createGlbRig()` — the real-model `PetRig` (T-GLB). Implements the shared
 * `PetRig` contract (`types.ts`) over the `RigSource` that `glbLoader.ts`
 * maps out of `byte.glb`, so `createBytePet`/`feed.ts` drive the delivered
 * Byte exactly the way they drive the procedural placeholder (`rig.ts`).
 *
 * **Structure:** `object3d` (left at identity — the swappable rig above it
 * owns world placement and the `unitPx` scale) → `pose` (a consumer-owned
 * unit group this rig never animates, R-GLB-6) → a content group scaled by
 * `1 / GLB_MODEL_HEIGHT` → the glTF scene. The model is authored 1.8 units
 * tall, so the rig comes out one unit tall like the placeholder, and every
 * `unitPx`-relative distance in `createBytePet`/`feed.ts` reads the same for
 * either rig.
 *
 * **Clips** (TICKETS T-GLB row 11) play through one `AnimationMixer`:
 * `LOOPING_CLIPS` loop, every other clip plays once, clamps on its last
 * frame and hands back to `Idle`, and every change crossfades over
 * `CLIP_CROSSFADE_S`. `ClipPlayOptions.loop` forces a one-shot to repeat;
 * `onComplete` fires on the mixer's `finished` event, only for the action
 * that is still current, so an interrupted one-shot never completes (the
 * placeholder's killed timelines behave the same). A missing clip holds
 * whatever is playing, warns once per name and completes on the next
 * `update()` (row 12).
 *
 * **Look** (row 4): a half-strength head turn on the `Head` bone plus an eye
 * slide across the visor, applied AFTER `mixer.update()` each frame because
 * every clip keys the head. R-GLB-1: the mixer only writes a bone when its
 * mixed value changed (`PropertyMixer.apply`), so the head's base rotation
 * is restored before every update — a plain post-multiply would compound
 * through clamped one-shots, still poses and reduced motion. The look is
 * damped here rather than by `gsap.quickTo` (R-GLB-8): it has to be applied
 * inside `update()` anyway, and it creates no tweens.
 *
 * **Blink** squashes `EyeL`/`EyeR` — never `Head`, which the clips own.
 * **Materials** follow D-11 (row 10): `Body` takes the theme colour, `Glow`
 * the accent at `GLOW_ON_INTENSITY × level` (overriding the 1.86 the loader
 * reads from `KHR_materials_emissive_strength`), `Visor` stays as authored,
 * and `setOpacity` fades all three. `Glow` also carries a small depth bias
 * (`GLOW_DEPTH_BIAS`) so the eyes resolve over the visor at the page camera's
 * depth precision.
 *
 * No GSAP here: the mixer and the look both advance inside `update(dt)`,
 * which `createBytePet` calls from its single `gsap.ticker`-driven `onTick`.
 */
import * as THREE from 'three';
import {
  applyOpacity,
  EYE_CLOSED_SCALE_Y,
  EYE_OPEN_SCALE_Y,
  EYE_PITCH_CLAMP_RAD,
  EYE_YAW_CLAMP_RAD,
  GLOW_ON_INTENSITY,
  LOOPING_CLIPS,
} from './rig';
import type { ClipName, ClipPlayOptions, PetRig, RigSource } from './types';

/** byte.glb's authored height in model units (ASSET_SPEC §2; `glbAsset.test.ts` asserts it against the real file). The content is scaled by its inverse. */
export const GLB_MODEL_HEIGHT = 1.8;

/** Crossfade length for every clip change (TICKETS T-GLB row 11). */
export const CLIP_CROSSFADE_S = 0.2;

/**
 * Depth bias on the `Glow` material (T-GLB QA fix, D-22): the eyes sit only 0.01 model units in
 * front of the visor (≈ 0.7 px at 1.25 × a 104 px headline), below the page camera's depth
 * resolution at Byte's distance (≈ 1.7 px: near 0.1, 24-bit depth), so they z-fought with it.
 * Pulling `Glow` toward the camera by a few depth units resolves the eyes (and the chest light,
 * which shares the material) cleanly over the surfaces they sit on.
 */
export const GLOW_DEPTH_BIAS = { factor: -1, units: -4 } as const;

/** Row 4: the head turns at half the look's clamped yaw/pitch… */
const HEAD_TURN_STRENGTH = 0.5;
/** …while the eyes slide across the visor at 0.8× of it, up to these model-unit offsets at the clamps. */
const EYE_SLIDE_STRENGTH = 0.8;
const EYE_SLIDE_X = 0.07;
const EYE_SLIDE_Y = 0.045;

/** Look smoothing time constant (s) — R-GLB-8: ≈ the placeholder's `quickTo(0.3 s, power3)` feel. */
const LOOK_SMOOTHING_S = 0.12;

interface CurrentClip {
  clip: ClipName;
  action: THREE.AnimationAction;
  onComplete: (() => void) | undefined;
}

/** Frees every geometry, material, material texture and skinned-mesh skeleton under `root` — each shared material once. */
function disposeModel(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.skeleton.dispose(); // F2: the skeleton's bone-matrix texture otherwise leaks
    }
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    child.geometry.dispose();
    const list: THREE.Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material];
    list.forEach((material) => materials.add(material));
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) {
        value.dispose();
      }
    });
    material.dispose();
  });
}

export function createGlbRig(source: RigSource): PetRig {
  const object3d = new THREE.Group();
  object3d.name = 'byte-glb';
  const pose = new THREE.Group();
  pose.name = 'byte-glb-pose';
  const content = new THREE.Group();
  content.name = 'byte-glb-content';
  content.scale.setScalar(1 / GLB_MODEL_HEIGHT);
  content.add(source.scene);
  pose.add(content);
  object3d.add(pose);

  // Skinned bounds are computed from the bind pose and don't follow the
  // animation, so a culled skinned mesh can blink out mid-clip.
  source.scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.frustumCulled = false;
    }
  });

  // QA fix: lift the Glow surfaces (eyes + chest light) over the visor/body they sit on.
  if (source.glow) {
    source.glow.polygonOffset = true;
    source.glow.polygonOffsetFactor = GLOW_DEPTH_BIAS.factor;
    source.glow.polygonOffsetUnits = GLOW_DEPTH_BIAS.units;
  }

  const head = source.eye; // the mapper's `Eye`, else `Head` — byte.glb has no `Eye`, so the Head bone
  const eyes = source.eyes ?? [];
  const eyeRest = eyes.map((eye) => eye.position.clone());
  const torsoRestY = source.torso?.position.y ?? 0;
  const materials: THREE.Material[] =
    source.materials ??
    [source.body, source.glow].filter((m): m is THREE.MeshStandardMaterial => m !== undefined);

  const mixer = new THREE.AnimationMixer(source.scene);
  let current: CurrentClip | null = null;
  /** Row 12: `onComplete`s of missing clips, fired on the next `update()`. */
  const dueCompletions: Array<() => void> = [];
  const warnedMissing = new Set<ClipName>();

  // R-GLB-1: the head's un-looked rotation, re-captured after every mixer update.
  const headBase = new THREE.Quaternion();
  if (head) {
    headBase.copy(head.quaternion);
  }
  const lookTarget = { x: 0, y: 0 };
  let hasLookTarget = false;
  const look = { yaw: 0, pitch: 0 };
  const tmpOrigin = new THREE.Vector3();
  const tmpWorldScale = new THREE.Vector3();
  const tmpLookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const tmpLookQuat = new THREE.Quaternion();
  const tmpMouth = new THREE.Vector3();

  function startClip(clip: ClipName, animation: THREE.AnimationClip, opts: ClipPlayOptions): void {
    const action = mixer.clipAction(animation);
    const loops = LOOPING_CLIPS.has(clip) || opts.loop === true;
    if (current?.action === action && loops && action.isRunning()) {
      return; // already looping this clip — a restart would snap it back to frame 0
    }
    // R-GLB-1: a first `play()` saves the head's rotation as the binding's
    // original state; hand it the un-looked base, not last frame's turned head.
    if (head) {
      head.quaternion.copy(headBase);
    }
    action.reset();
    action.setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loops;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.play();
    if (current && current.action !== action) {
      current.action.crossFadeTo(action, CLIP_CROSSFADE_S, false);
    }
    current = { clip, action, onComplete: loops ? undefined : opts.onComplete };
  }

  mixer.addEventListener('finished', (event) => {
    if (!current || event.action !== current.action) {
      return; // a superseded one-shot finishing mid-fade never completes
    }
    const { clip, onComplete } = current;
    current.onComplete = undefined;
    const idle = source.clips.Idle;
    if (idle && clip !== 'Idle') {
      startClip('Idle', idle, {});
    }
    onComplete?.();
  });

  function play(clip: ClipName, opts: ClipPlayOptions = {}): void {
    const animation = source.clips[clip];
    if (!animation) {
      if (!warnedMissing.has(clip)) {
        warnedMissing.add(clip);
        console.warn(`[byte] byte.glb has no "${clip}" clip; holding the current pose.`);
      }
      if (opts.onComplete) {
        dueCompletions.push(opts.onComplete);
      }
      return;
    }
    startClip(clip, animation, opts);
  }

  function setLook(x: number, y: number): void {
    lookTarget.x = x;
    lookTarget.y = y;
    hasLookTarget = true;
  }

  /**
   * The same aim math as the placeholder's `setLook` (see `rig.ts`): yaw/pitch
   * from the cursor's offset against Byte's rendered height (world scale,
   * R-GLB-7) as the "distance in front", clamped, then smoothed (R-GLB-8).
   * The head takes half of it, layered after the mixer; the eyes slide by
   * the rest.
   */
  function applyLook(dt: number): void {
    let yawTarget = 0;
    let pitchTarget = 0;
    if (hasLookTarget) {
      (head ?? object3d).getWorldPosition(tmpOrigin);
      const depth = object3d.getWorldScale(tmpWorldScale).x || 1;
      yawTarget = THREE.MathUtils.clamp(
        Math.atan2(lookTarget.x - tmpOrigin.x, depth),
        -EYE_YAW_CLAMP_RAD,
        EYE_YAW_CLAMP_RAD,
      );
      pitchTarget = THREE.MathUtils.clamp(
        Math.atan2(-(lookTarget.y - tmpOrigin.y), depth),
        -EYE_PITCH_CLAMP_RAD,
        EYE_PITCH_CLAMP_RAD,
      );
    }
    const k = 1 - Math.exp(-dt / LOOK_SMOOTHING_S);
    look.yaw += (yawTarget - look.yaw) * k;
    look.pitch += (pitchTarget - look.pitch) * k;

    if (head) {
      tmpLookEuler.set(look.pitch * HEAD_TURN_STRENGTH, look.yaw * HEAD_TURN_STRENGTH, 0);
      head.quaternion.multiply(tmpLookQuat.setFromEuler(tmpLookEuler));
    }
    const slideX = (look.yaw / EYE_YAW_CLAMP_RAD) * EYE_SLIDE_X * EYE_SLIDE_STRENGTH;
    const slideY = -(look.pitch / EYE_PITCH_CLAMP_RAD) * EYE_SLIDE_Y * EYE_SLIDE_STRENGTH;
    eyes.forEach((eye, i) => {
      eye.position.set(eyeRest[i].x + slideX, eyeRest[i].y + slideY, eyeRest[i].z);
    });
  }

  function update(dt: number): void {
    if (dueCompletions.length > 0) {
      dueCompletions.splice(0).forEach((cb) => cb());
    }
    if (head) {
      head.quaternion.copy(headBase); // undo last frame's look layer (R-GLB-1)
    }
    mixer.update(dt);
    if (head) {
      headBase.copy(head.quaternion);
    }
    applyLook(dt);
  }

  function setBlink(closed: boolean): void {
    const scaleY = closed ? EYE_CLOSED_SCALE_Y : EYE_OPEN_SCALE_Y;
    eyes.forEach((eye) => {
      eye.scale.y = scaleY;
    });
  }

  function setBodyColor(color: THREE.ColorRepresentation): void {
    source.body?.color.set(color);
  }

  function setGlowLevel(level: number, accent: THREE.ColorRepresentation): void {
    if (!source.glow) {
      return;
    }
    source.glow.emissive.set(accent);
    source.glow.emissiveIntensity = GLOW_ON_INTENSITY * level;
  }

  function setGlow(on: boolean, accent: THREE.ColorRepresentation): void {
    setGlowLevel(on ? 1 : 0, accent);
  }

  function setOpacity(a: number): void {
    applyOpacity(materials, a);
  }

  /** `Torso`'s lift above its rest (0.22 u in byte.glb) as a fraction of the height, plus any consumer `pose` offset; 0 without a Torso (row 12). */
  function hoverHeight(): number {
    const lift = source.torso ? (source.torso.position.y - torsoRestY) / GLB_MODEL_HEIGHT : 0;
    return pose.position.y + lift;
  }

  /** The `Mouth` locator's world position; without one, glyphs converge on the head (row 12), then the root. */
  function mouthWorld(): { x: number; y: number; z: number } {
    (source.mouth ?? head ?? object3d).getWorldPosition(tmpMouth);
    return { x: tmpMouth.x, y: tmpMouth.y, z: tmpMouth.z };
  }

  function dispose(): void {
    mixer.stopAllAction();
    mixer.uncacheRoot(source.scene);
    current = null;
    dueCompletions.length = 0;
    disposeModel(source.scene);
  }

  return {
    object3d,
    pose,
    play,
    setLook,
    setBodyColor,
    setGlow,
    setGlowLevel,
    setOpacity,
    setBlink,
    hoverHeight,
    mouthWorld,
    update,
    dispose,
  };
}
