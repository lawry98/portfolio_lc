/**
 * `PetRig` adapter (T4, ticket "placeholder bot + rig adapter") —
 * `createPetRig()` implements the fixed `PetRig` interface (`types.ts`,
 * Task 1) over a `RigSource`. Two implementations share this one interface:
 * this placeholder adapter (GSAP-faked clips, since the procedural bot has
 * no baked `THREE.AnimationClip`s — `RigSource.clips` is always `{}` for it,
 * see `placeholderBot.ts`) and the future GLB/`AnimationMixer` adapter
 * (T-GLB, deliberately not built here — `update()`'s doc comment below is
 * the seam it fills in).
 *
 * **Clip motion** (`play()`) animates the placeholder's internal "pose"
 * group — looked up off `source.scene` by `POSE_GROUP_NAME`, falling back
 * to the root itself if a `RigSource` doesn't provide one — rather than the
 * returned root directly. See `placeholderBot.ts`'s module doc comment
 * ("Root vs. pose split") for why: the root is Task 4's world-placement
 * handle (re-positioned every tick to track the headline anchor), while
 * `pose` is where this rig's own squash/bob/lean tweens live, so the two
 * never fight over the same node's transform.
 *
 * **No plugins registered** — every clip below uses GSAP's bundled core
 * eases (`power*`, `sine`, `back`, `bounce`); nothing here needs
 * `gsap.registerPlugin()`.
 *
 * **Tween scoping** — this module keeps direct references to every
 * tween/timeline it creates (`currentTimeline`, the two `quickTo` setters)
 * rather than a `gsap.context()`, per the brief's explicit either/or
 * ("`gsap.context()` or keep references"); `dispose()` kills all of them.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { POSE_GROUP_NAME } from './placeholderBot';
import type { ClipName, ClipPlayOptions, PetRig, RigSource } from './types';

// --- Look-at tuning (brief 3b: "clamp yaw to ±0.35 rad (gentle pitch
// clamp)"). Yaw is the brief's fixed number; pitch is deliberately gentler
// since a large vertical eye swing reads oddly on a mostly-flat visor. ---
const EYE_YAW_CLAMP_RAD = 0.35;
const EYE_PITCH_CLAMP_RAD = 0.16;
const LOOK_QUICK_TO_VARS = { duration: 0.3, ease: 'power3' };

/** `setGlow(true, ...)` emissive intensity (brief 3b: "~0.6 on / 0 off"). */
const GLOW_ON_INTENSITY = 0.6;

// ---------------------------------------------------------------------------
// Clip-motion tuning — every value is a fraction of the bot's own body
// height (or a radian angle, or a duration in seconds), since these animate
// the `pose` group nested inside a root already scaled by `unitPx`
// (`placeholderBot.ts`) — one set of fractions reads correctly at any
// headline size. Hand-picked; free to retune visually (placeholder only).
// ---------------------------------------------------------------------------

const IDLE_BOB_AMPLITUDE = 0.035;
const IDLE_BOB_DURATION = 1.6;

/**
 * Hop's apex height, as a fraction of the bot's own body height — also the
 * R-T4-10 shadow-retune reference (see `shadow.ts`'s `MAX_HOVER_HEIGHT`
 * comment, calibrated against this same fraction at a representative
 * headline `unitPx`). Reused by `Wake`'s jump too (both are "jump" beats).
 */
const HOP_APEX_FRACTION = 0.5;
const HOP_ANTICIPATION_DURATION = 0.08;
const HOP_RISE_DURATION = 0.15;
const HOP_FALL_DURATION = 0.15;
const HOP_RECOVER_DURATION = 0.12;
const HOP_SQUASH_SCALE_Y = 0.85;
const HOP_SQUASH_SCALE_XZ = 1.12;
const HOP_STRETCH_SCALE_Y = 1.15;
const HOP_STRETCH_SCALE_XZ = 0.9;

const DASH_LEAN_RAD = -0.18;
const DASH_LEAN_DURATION = 0.1;
const DASH_SCALE_XZ = 0.94;
const DASH_SCALE_Y = 1.06;
const DASH_VIBRATE_AMPLITUDE = 0.02;
const DASH_VIBRATE_DURATION = 0.05;

const EAT_CHOMP_SCALE_Y = 0.82;
const EAT_CHOMP_SCALE_XZ = 1.1;
const EAT_CHOMP_DURATION = 0.1;

const SLEEP_SETTLE_Y = -0.05;
const SLEEP_SCALE_Y = 0.92;
const SLEEP_BREATH_DURATION = 1.3;

const WAKE_JUMP_HEIGHT = 0.3;
const WAKE_JUMP_DURATION = 0.12;
const WAKE_LAND_DURATION = 0.16;
const WAKE_SHAKE_RAD = 0.12;
const WAKE_SHAKE_DURATION = 0.05;
const WAKE_SHAKE_REPEATS = 5;

const PEEK_RISE = 0.15;
const PEEK_TILT_RAD = 0.22;
const PEEK_SCALE_Y = 1.05;
const PEEK_SCALE_XZ = 0.97;
const PEEK_RISE_DURATION = 0.35;
const PEEK_HOLD_DURATION = 0.5;
const PEEK_SETTLE_DURATION = 0.3;

/**
 * Frees GPU resources for every geometry/material reachable from `root` — a
 * small local mirror of `scene.ts`'s duck-typed disposal pattern
 * (`disposeObject3D`/`disposeMaterial` there aren't exported, so this rig
 * owns a scoped copy for the placeholder's own meshes; brief 3b: "reuse the
 * disposal pattern from scene.ts, or dispose the specific geo/mats created
 * in 3a"). Unlike that version, there's no texture-slot sweep: `Body`/`Glow`
 * (`placeholderBot.ts`) set no texture maps.
 */
function disposeBotResources(root: THREE.Object3D): void {
  root.traverse((child) => {
    const { geometry, material } = child as unknown as {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    geometry?.dispose();
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material?.dispose();
    }
  });
}

/**
 * Implements `PetRig` (`types.ts`) over `source`. For T4, `source` is always
 * `createPlaceholderBot()`'s output (empty `clips`), so `play()` is
 * GSAP-faked in-place motion rather than an `AnimationMixer` clip.
 */
export function createPetRig(source: RigSource): PetRig {
  const pose = source.scene.getObjectByName(POSE_GROUP_NAME) ?? source.scene;

  let currentTimeline: ReturnType<typeof gsap.timeline> | null = null;

  // Created once (brief 3b: "create the quickTo tweens once; call them per
  // update"); `null` when the source has no eye node to drive (defensive —
  // the placeholder always provides one, but `RigSource.eye` is optional
  // per the shared Task 1 contract, e.g. for a future GLB missing the node).
  const setYaw = source.eye ? gsap.quickTo(source.eye.rotation, 'y', LOOK_QUICK_TO_VARS) : null;
  const setPitch = source.eye ? gsap.quickTo(source.eye.rotation, 'x', LOOK_QUICK_TO_VARS) : null;

  const tmpBotWorld = new THREE.Vector3();
  const tmpMouthWorld = new THREE.Vector3();

  function buildIdle(): ReturnType<typeof gsap.timeline> {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(pose.position, {
      y: IDLE_BOB_AMPLITUDE,
      duration: IDLE_BOB_DURATION,
      ease: 'sine.inOut',
    });
    return tl;
  }

  /** Quick up-down jump with anticipation squat + landing squash/recover. */
  function buildHop(): ReturnType<typeof gsap.timeline> {
    const tAnticEnd = HOP_ANTICIPATION_DURATION;
    const tRiseEnd = tAnticEnd + HOP_RISE_DURATION;
    const tFallEnd = tRiseEnd + HOP_FALL_DURATION;

    const tl = gsap.timeline();
    tl.to(
      pose.scale,
      {
        y: HOP_SQUASH_SCALE_Y,
        x: HOP_SQUASH_SCALE_XZ,
        z: HOP_SQUASH_SCALE_XZ,
        duration: tAnticEnd,
        ease: 'power2.in',
      },
      0,
    );
    tl.to(
      pose.position,
      { y: HOP_APEX_FRACTION, duration: HOP_RISE_DURATION, ease: 'power2.out' },
      tAnticEnd,
    );
    tl.to(
      pose.scale,
      {
        y: HOP_STRETCH_SCALE_Y,
        x: HOP_STRETCH_SCALE_XZ,
        z: HOP_STRETCH_SCALE_XZ,
        duration: HOP_RISE_DURATION,
        ease: 'power2.out',
      },
      tAnticEnd,
    );
    tl.to(pose.position, { y: 0, duration: HOP_FALL_DURATION, ease: 'power2.in' }, tRiseEnd);
    tl.to(
      pose.scale,
      {
        y: HOP_SQUASH_SCALE_Y,
        x: HOP_SQUASH_SCALE_XZ,
        z: HOP_SQUASH_SCALE_XZ,
        duration: HOP_FALL_DURATION,
        ease: 'power2.in',
      },
      tRiseEnd,
    );
    tl.to(
      pose.scale,
      { y: 1, x: 1, z: 1, duration: HOP_RECOVER_DURATION, ease: 'back.out(2)' },
      tFallEnd,
    );
    return tl;
  }

  /** Forward lean held for the clip's lifetime, then a symmetric vibrate loop. */
  function buildDash(): ReturnType<typeof gsap.timeline> {
    const tl = gsap.timeline();
    tl.to(pose.rotation, { z: DASH_LEAN_RAD, duration: DASH_LEAN_DURATION, ease: 'power2.out' }, 0);
    tl.to(
      pose.scale,
      {
        x: DASH_SCALE_XZ,
        y: DASH_SCALE_Y,
        z: DASH_SCALE_XZ,
        duration: DASH_LEAN_DURATION,
        ease: 'power2.out',
      },
      0,
    );
    // `.set()` first so the vibrate below is an exact, symmetric ±amplitude
    // loop regardless of whatever `pose.position.x` happened to be left at
    // by the previously-playing clip.
    tl.set(pose.position, { x: -DASH_VIBRATE_AMPLITUDE }, DASH_LEAN_DURATION);
    tl.to(
      pose.position,
      {
        x: DASH_VIBRATE_AMPLITUDE,
        duration: DASH_VIBRATE_DURATION,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      },
      DASH_LEAN_DURATION,
    );
    // No outer `repeat` needed — the vibrate tween above already runs
    // forever, which is enough to make the whole timeline never complete.
    return tl;
  }

  /** Two quick chomp scale-pulses, back to identity between and after. */
  function buildEat(): ReturnType<typeof gsap.timeline> {
    const chompDown = { y: EAT_CHOMP_SCALE_Y, x: EAT_CHOMP_SCALE_XZ, z: EAT_CHOMP_SCALE_XZ };
    const chompUp = { y: 1, x: 1, z: 1 };
    const secondChompStart = EAT_CHOMP_DURATION * 2;

    const tl = gsap.timeline();
    tl.to(pose.scale, { ...chompDown, duration: EAT_CHOMP_DURATION, ease: 'power2.out' }, 0);
    tl.to(
      pose.scale,
      { ...chompUp, duration: EAT_CHOMP_DURATION, ease: 'power2.in' },
      EAT_CHOMP_DURATION,
    );
    tl.to(
      pose.scale,
      { ...chompDown, duration: EAT_CHOMP_DURATION, ease: 'power2.out' },
      secondChompStart,
    );
    tl.to(
      pose.scale,
      { ...chompUp, duration: EAT_CHOMP_DURATION, ease: 'power2.in' },
      secondChompStart + EAT_CHOMP_DURATION,
    );
    return tl;
  }

  /** Settles low + flattens, then breathes slowly forever via yoyo. */
  function buildSleep(): ReturnType<typeof gsap.timeline> {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(
      pose.position,
      { y: SLEEP_SETTLE_Y, duration: SLEEP_BREATH_DURATION, ease: 'sine.inOut' },
      0,
    );
    tl.to(pose.scale, { y: SLEEP_SCALE_Y, duration: SLEEP_BREATH_DURATION, ease: 'sine.inOut' }, 0);
    return tl;
  }

  /** Startled jump (reusing Hop's stretch feel), lands, then shakes a few times. */
  function buildWake(): ReturnType<typeof gsap.timeline> {
    const tJumpEnd = WAKE_JUMP_DURATION;
    // +1 for the shake tween's initial play, on top of its `repeat`s.
    const tShakeEnd = tJumpEnd + WAKE_SHAKE_DURATION * (WAKE_SHAKE_REPEATS + 1);

    const tl = gsap.timeline();
    tl.to(
      pose.position,
      { y: WAKE_JUMP_HEIGHT, duration: WAKE_JUMP_DURATION, ease: 'power3.out' },
      0,
    );
    tl.to(
      pose.scale,
      {
        y: HOP_STRETCH_SCALE_Y,
        x: HOP_STRETCH_SCALE_XZ,
        z: HOP_STRETCH_SCALE_XZ,
        duration: WAKE_JUMP_DURATION,
        ease: 'power3.out',
      },
      0,
    );
    tl.to(pose.position, { y: 0, duration: WAKE_LAND_DURATION, ease: 'bounce.out' }, tJumpEnd);
    tl.to(
      pose.scale,
      { y: 1, x: 1, z: 1, duration: WAKE_LAND_DURATION, ease: 'power2.out' },
      tJumpEnd,
    );
    tl.to(
      pose.rotation,
      {
        z: WAKE_SHAKE_RAD,
        duration: WAKE_SHAKE_DURATION,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: WAKE_SHAKE_REPEATS,
      },
      tJumpEnd,
    );
    // `WAKE_SHAKE_REPEATS` is odd, so the yoyo above (1 initial play + 5
    // repeats = 6 total legs, an even count) already lands back on whatever
    // `rotation.z` was when the shake started — 0 in every real transition
    // (Wake always follows Sleep, which never touches `rotation.z`). This
    // `.set()` is a cheap explicit safety net for the general case (`play()`
    // is callable in any order), placed at `tShakeEnd` — the shake's actual
    // last frame — rather than the earlier `tLandEnd`: a `.set()` positioned
    // mid-shake would just be overwritten by the shake's very next frame and
    // never actually take effect.
    tl.set(pose.rotation, { z: 0 }, tShakeEnd);
    return tl;
  }

  /** Rises + tilts back to "peer up", holds, then settles back down. */
  function buildPeek(): ReturnType<typeof gsap.timeline> {
    const tHoldEnd = PEEK_RISE_DURATION + PEEK_HOLD_DURATION;

    const tl = gsap.timeline();
    tl.to(pose.position, { y: PEEK_RISE, duration: PEEK_RISE_DURATION, ease: 'power2.out' }, 0);
    tl.to(pose.rotation, { x: PEEK_TILT_RAD, duration: PEEK_RISE_DURATION, ease: 'power2.out' }, 0);
    tl.to(
      pose.scale,
      {
        y: PEEK_SCALE_Y,
        x: PEEK_SCALE_XZ,
        z: PEEK_SCALE_XZ,
        duration: PEEK_RISE_DURATION,
        ease: 'power2.out',
      },
      0,
    );
    tl.to(pose.position, { y: 0, duration: PEEK_SETTLE_DURATION, ease: 'power2.in' }, tHoldEnd);
    tl.to(pose.rotation, { x: 0, duration: PEEK_SETTLE_DURATION, ease: 'power2.in' }, tHoldEnd);
    tl.to(
      pose.scale,
      { y: 1, x: 1, z: 1, duration: PEEK_SETTLE_DURATION, ease: 'power2.in' },
      tHoldEnd,
    );
    return tl;
  }

  const CLIP_BUILDERS: Record<ClipName, () => ReturnType<typeof gsap.timeline>> = {
    Idle: buildIdle,
    Hop: buildHop,
    Dash: buildDash,
    Eat: buildEat,
    Sleep: buildSleep,
    Wake: buildWake,
    Peek: buildPeek,
  };

  function play(clip: ClipName, opts: ClipPlayOptions = {}): void {
    currentTimeline?.kill();

    const timeline = CLIP_BUILDERS[clip]();
    if (opts.loop) {
      // Generic override for any clip, one-shot or not: an already-infinite
      // clip (Idle/Dash/Sleep) no-ops here; a one-shot clip (Hop/Eat/
      // Wake/Peek) repeats its whole sequence forever instead.
      timeline.repeat(-1);
    }
    if (opts.onComplete) {
      timeline.eventCallback('onComplete', opts.onComplete);
    }
    currentTimeline = timeline;
  }

  /**
   * Aims `source.eye` at world point `(x, y, 0)` from the bot's world
   * position, clamping yaw/pitch, via the `quickTo` setters created above.
   * No-ops if the source has no eye (defensive; see the `setYaw`/`setPitch`
   * comment).
   *
   * The cursor target and the bot both live on the z=0 plane (`scene.ts`'s
   * "1 world unit == 1 CSS px at z=0" convention — `createBytePet` derives
   * `x, y` via `worldFromScreen`, and the bot's own world z is 0 too), so a
   * *literal* 3D aim (`atan2(dx, dz)` using the bot's actual world z) is
   * degenerate: `dz` is ~0 in practice regardless of how far the cursor is,
   * which swings the angle to a full ±90° (immediately clamped) for *any*
   * nonzero horizontal offset, however small — a hard snap, not a gentle
   * track (confirmed empirically while building this: every off-center
   * cursor position clamped yaw to the max). Instead, this treats the eye as
   * already facing generally toward the viewer/cursor plane and uses the
   * bot's own rendered size (`scale.x`, == `unitPx` — `placeholderBot.ts`
   * scales the whole root by it once) as a believable "distance in front"
   * reference, so yaw/pitch ramp up smoothly with the cursor offset and
   * clamp only once it's roughly a bot-height or more away — proportional
   * at any headline size, since it scales with that same `unitPx`.
   */
  function setLook(x: number, y: number): void {
    if (!source.eye || !setYaw || !setPitch) {
      return;
    }

    source.scene.getWorldPosition(tmpBotWorld);
    const dx = x - tmpBotWorld.x;
    const dy = y - tmpBotWorld.y;
    const referenceDepth = source.scene.scale.x || 1; // guards a degenerate zero/unset scale

    const yaw = gsap.utils.clamp(
      -EYE_YAW_CLAMP_RAD,
      EYE_YAW_CLAMP_RAD,
      Math.atan2(dx, referenceDepth),
    );
    const pitch = gsap.utils.clamp(
      -EYE_PITCH_CLAMP_RAD,
      EYE_PITCH_CLAMP_RAD,
      Math.atan2(dy, referenceDepth),
    );

    setYaw(yaw);
    setPitch(pitch);
  }

  function setBodyColor(color: THREE.ColorRepresentation): void {
    source.body?.color.set(color);
  }

  function setGlow(on: boolean, accent: THREE.ColorRepresentation): void {
    if (!source.glow) {
      return;
    }
    source.glow.emissive.set(accent);
    source.glow.emissiveIntensity = on ? GLOW_ON_INTENSITY : 0;
  }

  function mouthWorld(): { x: number; y: number; z: number } {
    if (!source.mouth) {
      // Guard only — the placeholder always provides a mouth node (brief 3b).
      return { x: 0, y: 0, z: 0 };
    }
    source.mouth.getWorldPosition(tmpMouthWorld);
    return { x: tmpMouthWorld.x, y: tmpMouthWorld.y, z: tmpMouthWorld.z };
  }

  /**
   * No-op for the placeholder: `quickTo` and every clip timeline above
   * self-drive off `gsap.ticker` independently of this call, and there is
   * no `AnimationMixer` yet to advance. Kept as an explicit method (not
   * omitted) so this is the one seam the future GLB rig fills in with
   * `mixer.update(dt)` (T-GLB) without changing the `PetRig` call site in
   * `createBytePet`.
   */
  function update(dt: number): void {
    // Intentionally unread — see doc comment above. `void` (rather than a
    // `_dt`-style unused-param name) satisfies both `tsc`'s
    // `noUnusedParameters` and this project's `@typescript-eslint/
    // no-unused-vars` (whose default `args: 'after-used'` still flags a
    // *sole* unused parameter regardless of a leading underscore) while
    // keeping the parameter named `dt`, matching `PetRig.update`'s own
    // signature (`types.ts`) for anyone hovering this implementation.
    void dt;
  }

  function dispose(): void {
    currentTimeline?.kill();
    currentTimeline = null;
    setYaw?.tween.kill();
    setPitch?.tween.kill();
    disposeBotResources(source.scene);
  }

  return {
    object3d: source.scene,
    play,
    setLook,
    setBodyColor,
    setGlow,
    mouthWorld,
    update,
    dispose,
  };
}
