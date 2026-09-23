/**
 * `PetRig` adapter (T4, ticket "placeholder bot + rig adapter") —
 * `createPetRig()` implements the fixed `PetRig` interface (`types.ts`,
 * Task 1) over a `RigSource`. Two implementations share this one interface:
 * this placeholder adapter (GSAP-faked clips, since the procedural bot has
 * no baked `THREE.AnimationClip`s — `RigSource.clips` is always `{}` for it,
 * see `placeholderBot.ts`) and the future GLB/`AnimationMixer` adapter
 * (`glbRig.ts`, T-GLB).
 *
 * **Shared constants (T-GLB, R-GLB-10):** the look clamps, the glow
 * intensity, the blink squash, the looping-clip set and `applyOpacity` are
 * exported for `glbRig.ts`/`swapRig.ts`, so both rigs share one source of
 * truth.
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
// since a large vertical eye swing reads oddly on a mostly-flat visor.
// Exported (T-GLB) so glbRig.ts's head turn + eye slide use the same clamps
// (TICKETS T-GLB row 4, "the rig's existing clamps"). ---
export const EYE_YAW_CLAMP_RAD = 0.35;
export const EYE_PITCH_CLAMP_RAD = 0.16;
const LOOK_QUICK_TO_VARS = { duration: 0.3, ease: 'power3' };

/** Full glow emissive intensity (brief 3b: "~0.6 on / 0 off") — `setGlowLevel(1, …)`. Exported (T-GLB) so the GLB rig's Glow matches. */
export const GLOW_ON_INTENSITY = 0.6;

/**
 * Editor-authentic hard-step blink (brief 4d): `setBlink(true)` squashes the
 * eye's `scale.y` to `EYE_CLOSED_SCALE_Y`, `setBlink(false)` restores
 * `EYE_OPEN_SCALE_Y`. Moved here from createBytePet.ts (T-GLB) so each rig
 * owns its own eyes; createBytePet keeps only the cadence. Shared with
 * glbRig.ts.
 */
export const EYE_OPEN_SCALE_Y = 1;
export const EYE_CLOSED_SCALE_Y = 0.06;

/**
 * Clips that loop until another clip replaces them (TICKETS T-GLB row 11);
 * every other `ClipName` plays once. The GSAP fakes below already behave
 * this way (Idle/Sleep repeat forever, Dash vibrates forever); glbRig.ts
 * picks LoopRepeat/LoopOnce from this set and swapRig.ts uses it to decide
 * which clip survives a swap (R-GLB-9).
 */
export const LOOPING_CLIPS: ReadonlySet<ClipName> = new Set<ClipName>(['Idle', 'Dash', 'Sleep']);

/** Name of the consumer-owned group `createPetRig` inserts directly under the source root (`PetRig.pose`, T-GLB, R-GLB-6). */
export const RIG_POSE_GROUP_NAME = 'byte-rig-pose';

// ---------------------------------------------------------------------------
// Clip-motion tuning — every value is a fraction of the bot's own TOTAL
// height (feet to antenna tip, ~1 normalized unit — `placeholderBot.ts`'s
// "Total height sanity check" — NOT the smaller `BODY_HEIGHT` sub-const
// there) (or a radian angle, or a duration in seconds), since these animate
// the `pose` group nested inside a root already scaled by `unitPx`
// (`placeholderBot.ts`) — one set of fractions reads correctly at any
// headline size. Hand-picked; free to retune visually (placeholder only).
// ---------------------------------------------------------------------------

const IDLE_BOB_AMPLITUDE = 0.035;
const IDLE_BOB_DURATION = 1.6;

/**
 * Hop's apex height, as a fraction of the bot's own TOTAL height (feet to
 * antenna tip, ~1 normalized unit — see the "Clip-motion tuning" note above;
 * NOT the smaller `BODY_HEIGHT` sub-const in `placeholderBot.ts`) — also the
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

/**
 * T-GLB row 6: the two chomps SQUASH-PEAK on the delivered Eat clip's bites
 * — the same beats feed.ts lands the glyph on (`EAT_BITE_1_S`/`EAT_BITE_2_S`
 * there; echoed by hand, the cross-file-constant convention shadow.ts
 * uses). Each chomp squashes down over `EAT_CHOMP_DURATION` into its bite,
 * then recovers over the same.
 */
const EAT_BITE_TIMES_S: readonly number[] = [0.33, 0.6];
const EAT_CHOMP_SCALE_Y = 0.82;
const EAT_CHOMP_SCALE_XZ = 1.1;
const EAT_CHOMP_DURATION = 0.1;

const SLEEP_SETTLE_Y = -0.05;
const SLEEP_SCALE_Y = 0.92;
const SLEEP_BREATH_DURATION = 1.3;

/**
 * T-GLB row 6 (R-GLB-17): the Wake fake follows the delivered clip — it
 * starts from the Sleep fake's slump (the clip "starts from the Sleep
 * pose"), jolts up over 0.20–0.33 s, lands, and shakes until 0.90 s (the clip
 * is settled by 1.18 s; the FSM's wake window is its full 1.25 s).
 */
const WAKE_JOLT_START_S = 0.2;
const WAKE_JUMP_HEIGHT = 0.3;
const WAKE_JUMP_DURATION = 0.13;
const WAKE_LAND_DURATION = 0.16;
const WAKE_SHAKE_RAD = 0.12;
const WAKE_SHAKE_REPEATS = 5;
const WAKE_SHAKE_END_S = 0.9;
/** One shake leg: the yoyo's 1 + `WAKE_SHAKE_REPEATS` legs fill the jolt's top (0.33 s) → `WAKE_SHAKE_END_S` exactly. */
const WAKE_SHAKE_DURATION =
  (WAKE_SHAKE_END_S - (WAKE_JOLT_START_S + WAKE_JUMP_DURATION)) / (WAKE_SHAKE_REPEATS + 1);

/**
 * T-GLB row 6: the Peek fake follows the delivered clip — it rises through
 * 0.1–0.7 s, peers until 1.3 s, and settles over 1.3–1.6 s, inside the
 * 1.667 s the FSM now holds `peeking` (createBytePet's `PEEK_MS`). The
 * canvas swaps (behind at 0.2 s, back in front at 1.45 s) are createBytePet's.
 * The shape is unchanged — retimed, not reshaped (R-GLB-17).
 */
const PEEK_RISE = 0.15;
const PEEK_TILT_RAD = 0.22;
const PEEK_SCALE_Y = 1.05;
const PEEK_SCALE_XZ = 0.97;
const PEEK_RISE_START_S = 0.1;
const PEEK_RISE_DURATION = 0.6;
const PEEK_SETTLE_START_S = 1.3;
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
 * Sets `opacity` on every material and flips `transparent` to match
 * (`a < 1`) — shared by both rigs' `setOpacity` (T-GLB). R-GLB-2: three@0.185
 * bakes `#define OPAQUE` (alpha forced to 1) into a non-transparent
 * material's program and never recompiles just because `transparent`
 * changed, so a flip must also set `needsUpdate` — without it the fade is
 * invisible (the pre-T-GLB reduced-motion peek fade never actually faded,
 * for exactly this reason). Set only on a real flip, never on every frame
 * of a fade, so a fade costs one recompile (cached by three after the first).
 */
export function applyOpacity(materials: readonly THREE.Material[], a: number): void {
  const transparent = a < 1;
  for (const material of materials) {
    material.opacity = a;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
  }
}

/**
 * Implements `PetRig` (`types.ts`) over `source`. For T4, `source` is always
 * `createPlaceholderBot()`'s output (empty `clips`), so `play()` is
 * GSAP-faked in-place motion rather than an `AnimationMixer` clip.
 */
export function createPetRig(source: RigSource): PetRig {
  const pose = source.scene.getObjectByName(POSE_GROUP_NAME) ?? source.scene;

  // T-GLB `PetRig.pose` (R-GLB-6): a unit group directly under the root that
  // this rig never animates — consumers own its scale/position (the entrance
  // drop-in, the reduced-motion peek rise). Everything the source hung off
  // the root moves inside it, so the clip-driven `pose` above nests below it
  // and `play()`'s identity resets can never reach a consumer's value.
  const consumerPose = new THREE.Group();
  consumerPose.name = RIG_POSE_GROUP_NAME;
  while (source.scene.children.length > 0) {
    consumerPose.add(source.scene.children[0]);
  }
  source.scene.add(consumerPose);

  /** Every material `setOpacity` fades — the source's own list, else its Body + Glow. */
  const ownedMaterials: THREE.Material[] =
    source.materials ??
    [source.body, source.glow].filter((m): m is THREE.MeshStandardMaterial => m !== undefined);

  let currentTimeline: ReturnType<typeof gsap.timeline> | null = null;

  // Created once (brief 3b: "create the quickTo tweens once; call them per
  // update"); `null` when the source has no eye node to drive (defensive —
  // the placeholder always provides one, but `RigSource.eye` is optional
  // per the shared Task 1 contract, e.g. for a future GLB missing the node).
  const setYaw = source.eye ? gsap.quickTo(source.eye.rotation, 'y', LOOK_QUICK_TO_VARS) : null;
  const setPitch = source.eye ? gsap.quickTo(source.eye.rotation, 'x', LOOK_QUICK_TO_VARS) : null;

  const tmpBotWorld = new THREE.Vector3();
  const tmpWorldScale = new THREE.Vector3();
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

  /** Two chomp squash-pulses, each peaking on one of the Eat clip's bites (T-GLB row 6). */
  function buildEat(): ReturnType<typeof gsap.timeline> {
    const chompDown = { y: EAT_CHOMP_SCALE_Y, x: EAT_CHOMP_SCALE_XZ, z: EAT_CHOMP_SCALE_XZ };
    const chompUp = { y: 1, x: 1, z: 1 };

    const tl = gsap.timeline();
    for (const bite of EAT_BITE_TIMES_S) {
      tl.to(
        pose.scale,
        { ...chompDown, duration: EAT_CHOMP_DURATION, ease: 'power2.out' },
        bite - EAT_CHOMP_DURATION,
      );
      tl.to(pose.scale, { ...chompUp, duration: EAT_CHOMP_DURATION, ease: 'power2.in' }, bite);
    }
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

  /** Still slumped from Sleep, then a startled jolt (Hop's stretch feel), a landing, and a shake — on the Wake clip's beats (T-GLB row 6). */
  function buildWake(): ReturnType<typeof gsap.timeline> {
    const tJumpEnd = WAKE_JOLT_START_S + WAKE_JUMP_DURATION;
    // +1 for the shake tween's initial play, on top of its `repeat`s.
    const tShakeEnd = tJumpEnd + WAKE_SHAKE_DURATION * (WAKE_SHAKE_REPEATS + 1);

    const tl = gsap.timeline();
    // `play()` has just reset `pose` to identity; hold the Sleep fake's slump
    // until the jolt, so Byte doesn't pop upright 0.2 s early (R-GLB-17).
    tl.set(pose.position, { y: SLEEP_SETTLE_Y }, 0);
    tl.set(pose.scale, { y: SLEEP_SCALE_Y }, 0);
    tl.to(
      pose.position,
      { y: WAKE_JUMP_HEIGHT, duration: WAKE_JUMP_DURATION, ease: 'power3.out' },
      WAKE_JOLT_START_S,
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
      WAKE_JOLT_START_S,
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

  /** Rises + tilts back to "peer up", holds, then settles back down — on the Peek clip's beats (T-GLB row 6). */
  function buildPeek(): ReturnType<typeof gsap.timeline> {
    const tl = gsap.timeline();
    const rise = { duration: PEEK_RISE_DURATION, ease: 'power2.out' };
    const settle = { duration: PEEK_SETTLE_DURATION, ease: 'power2.in' };
    tl.to(pose.position, { y: PEEK_RISE, ...rise }, PEEK_RISE_START_S);
    tl.to(pose.rotation, { x: PEEK_TILT_RAD, ...rise }, PEEK_RISE_START_S);
    tl.to(
      pose.scale,
      { y: PEEK_SCALE_Y, x: PEEK_SCALE_XZ, z: PEEK_SCALE_XZ, ...rise },
      PEEK_RISE_START_S,
    );
    tl.to(pose.position, { y: 0, ...settle }, PEEK_SETTLE_START_S);
    tl.to(pose.rotation, { x: 0, ...settle }, PEEK_SETTLE_START_S);
    tl.to(pose.scale, { y: 1, x: 1, z: 1, ...settle }, PEEK_SETTLE_START_S);
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

    // Every clip builder above hand-authors its tweens assuming `pose`
    // starts at identity, and most only touch a subset of its channels
    // (e.g. Idle/Sleep touch only `position.y`/`scale.y`; Peek resets
    // `rotation.x` but not `.z`; Hop never touches `rotation` at all). A
    // *killed* timeline freezes `pose` wherever it was, so without this
    // reset a channel a previous clip left non-identity (e.g. Dash's
    // `rotation.z`/`scale`) would silently persist through every later clip
    // that never happens to touch that same channel — found via review: the
    // FSM's idle→dashing→idle feed path left Byte permanently leaning +
    // squashed after the very first feed. `gsap.set()` is an instant,
    // zero-duration snap (acceptable for a placeholder clip cut) and only
    // ever targets `pose`'s own position/rotation/scale — never `source.eye`
    // (a separate node `pose` merely parents; its own local rotation/scale,
    // driven by `setLook`/Task 4's future blink, is untouched by resetting
    // its parent's transform).
    gsap.set(pose.position, { x: 0, y: 0, z: 0 });
    gsap.set(pose.rotation, { x: 0, y: 0, z: 0 });
    gsap.set(pose.scale, { x: 1, y: 1, z: 1 });

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
   * bot's own rendered size — its WORLD scale, == `unitPx` (T-GLB, R-GLB-7:
   * `unitPx` now lives on the swappable rig's root above this one, so the
   * root's own local scale is 1 and reading it would collapse the depth to
   * 1, pinning every look at its clamps) — as a believable "distance in
   * front" reference, so yaw/pitch ramp up smoothly with the cursor offset and
   * clamp only once it's roughly a bot-height or more away — proportional
   * at any headline size, since it scales with that same `unitPx`.
   *
   * Yaw and pitch use opposite-signed deltas on purpose: for an object whose
   * local forward is `(0,0,1)`, three.js's right-handed rotation convention
   * means a *positive* `rotation.y` swings that forward vector toward world
   * `+x` (screen-right — matches `+dx` directly), but a *positive*
   * `rotation.x` swings it toward world `-y` (screen-*down*) — the opposite
   * sign from `+dy` (cursor above the bot). Negating `dy` for the pitch
   * `atan2` (only) corrects for that, so a cursor below the bot (`dy < 0`)
   * yields a positive pitch that tilts the eye down toward it, and a cursor
   * above yields a negative pitch that tilts it up.
   */
  function setLook(x: number, y: number): void {
    if (!source.eye || !setYaw || !setPitch) {
      return;
    }

    source.scene.getWorldPosition(tmpBotWorld);
    const dx = x - tmpBotWorld.x;
    const dy = y - tmpBotWorld.y;
    const referenceDepth = source.scene.getWorldScale(tmpWorldScale).x || 1; // guards a degenerate zero/unset scale

    const yaw = gsap.utils.clamp(
      -EYE_YAW_CLAMP_RAD,
      EYE_YAW_CLAMP_RAD,
      Math.atan2(dx, referenceDepth),
    );
    const pitch = gsap.utils.clamp(
      -EYE_PITCH_CLAMP_RAD,
      EYE_PITCH_CLAMP_RAD,
      Math.atan2(-dy, referenceDepth),
    );

    setYaw(yaw);
    setPitch(pitch);
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
    applyOpacity(ownedMaterials, a);
  }

  function setBlink(closed: boolean): void {
    if (source.eye) {
      source.eye.scale.y = closed ? EYE_CLOSED_SCALE_Y : EYE_OPEN_SCALE_Y;
    }
  }

  /**
   * Lift above the ground as a fraction of the bot's height: the
   * clip-driven `pose`'s y (the Hop/Peek/Wake/Sleep fakes) plus the consumer
   * pose's (the reduced-motion peek rise). A source with no pose group
   * animates its root instead, whose position is world placement rather than
   * lift, so that case counts only the consumer pose.
   */
  function hoverHeight(): number {
    const clipLift = pose === source.scene ? 0 : pose.position.y;
    return consumerPose.position.y + clipLift;
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
    pose: consumerPose,
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
