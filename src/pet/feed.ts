/**
 * `createFeeder()` — the animated executor of T5's feeding loop (SPEC §6
 * "toss-to-feed 3D glyphs"). Composes Task 1's pure pieces (`glyphs.ts`'s
 * `createGlyphQueue()`/`makeGlyph()`) with GSAP toss/dash/eat choreography
 * and Task 2's FSM (`fsm.ts`): `feed(x,y)` tosses a glyph and enqueues it;
 * an `fsm.onEnter` subscription drives the actual dash/eat motion and fires
 * the `REACHED`/`ATE` events the FSM needs to advance
 * (`dashing`→`eating`→`idle`) — the FSM decides state, this module executes
 * it (SPEC §4.3's "decide vs. execute" split, same shape as the T4
 * FSM/createBytePet relationship).
 *
 * **Root-position ownership (R-T5-6):** while Byte is `dashing`/`eating`,
 * THIS module owns `rig.object3d.position` (and, transiently, its
 * `rotation.z` bank) — `createBytePet`'s `onTick` (Task 4) stops pinning the
 * root to the headline anchor for exactly those two states. **On `ATE`,
 * this module deliberately does NOT tween Byte back to its idle anchor** —
 * it leaves the root wherever eating finished (the food spot) and lets
 * `createBytePet`'s own onTick "reacquire" tween (Task 4, the recommended
 * owner per the T5 plan's R-T5-6) glide it home with no snap. This is the
 * one thing Task 4 must honor: exactly one owner of the return leg.
 *
 * **Reduced motion** (`deps.prefersReducedMotion()`, read fresh at every
 * decision point so a live OS toggle is honored per-feed): every arc/hop
 * becomes an instant placement or a plain opacity fade (never `autoAlpha`,
 * matching `createBytePet.ts`'s own material-fade convention — there is no
 * DOM `visibility` concern for a three.js material). `rig.play('Dash')`/
 * `rig.play('Eat')` are skipped entirely under reduced motion (not just
 * their arc/hop) — `Dash`'s pose clip (`rig.ts`) is an infinite
 * `repeat:-1` vibrate loop, exactly the "continuous motion a reduced-motion
 * user can't stop" the project's global constraint forbids, and skipping
 * both preserves `createBytePet.ts`'s own documented invariant that NOTHING
 * calls `rig.play()` while reduced motion is active, so `pose` stays at
 * identity for the whole reduced-motion lifetime (see its `playUnlessReduced`
 * doc comment). `REACHED`/`ATE` still fire — via a zero-delay
 * `gsap.delayedCall` ("next tick"), never a synchronous `fsm.send()` inside
 * this module's own `fsm.onEnter` callback, so a reduced-motion feed can
 * never recurse through the FSM's listener loop while the outer transition
 * is still dispatching.
 *
 * **Tween bookkeeping** mirrors `createBytePet.ts`'s `liveTweens` registry
 * exactly (explicit references, not a bare `gsap.context()`): every tween/
 * timeline this module creates is tracked in one `Set`, killed exhaustively
 * in `dispose()`. Two extra small registries close the loop for **every**
 * mesh this module ever adds to the scene, independent of tween completion
 * (`dispose()` must catch anything killed mid-flight, since `.kill()` never
 * fires `onComplete`): `liveGlyphMeshes` (every tossed glyph still owed a
 * disposal — via eating, popping, or the `dispose()` sweep) and
 * `liveParticles` (every still-bursting particle). Particles share ONE
 * `particleGeometry` (created once, disposed once) but each gets its OWN
 * cloned-fresh `MeshBasicMaterial` — sized so a per-particle opacity fade
 * never bleeds into a sibling particle from an overlapping burst.
 *
 * **No `fsm.onEnter` unsubscribe** — `PetFSM` (`types.ts`, T2) exposes no
 * unsubscribe path. Acceptable per the brief: this module's lifetime ==
 * the FSM's == `createBytePet`'s (mirrors `SceneHandle.onTick`'s identical
 * "no per-callback unsubscribe" precedent, PROGRESS.md).
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { createGlyphQueue, GLYPH_KINDS, makeGlyph } from './glyphs';
import type { GlyphKind } from './glyphs';
import type { ClipName, PetFSM, PetRig, PetState, SceneHandle } from './types';
import type { SoundEngine } from './sound/SoundEngine';

// ---------------------------------------------------------------------------
// Public contract (brief 3a).
// ---------------------------------------------------------------------------

export interface FeederDeps {
  /** Read fresh at every decision point — reflects `createBytePet`'s live `reducedActive`. */
  prefersReducedMotion: () => boolean;
  /** Headline font-size (px) — sizes tossed glyphs/particles proportionally, same convention `placeholderBot.ts` uses for Byte itself. */
  unitPx: number;
  /**
   * T7 sound seam (R7-1): the engine the feeder plays toss/eat cues through
   * (`spawnPop` on a toss, `eatA`/`eatB` on the two chomps). `createBytePet`
   * always supplies this — its own resolved `SoundEngine` (the injected engine
   * or the `silentSoundEngine` no-op) — so it is non-optional here. Only the
   * `SoundEngine.play` interface is touched; the feeder never knows the engine.
   */
  sound: SoundEngine;
}

export interface Feeder {
  /** Tosses a glyph at screen point `(x, y)` (a click/tap) and enqueues it. */
  feed(x: number, y: number): void;
  /** Delegates to the pure queue's live (tossed, not yet eaten) glyph count. */
  liveCount(): number;
  /** Delegates to the pure queue's eaten-total fan-out. */
  onEat(cb: (total: number) => void): void;
  /** Kills every tracked tween and disposes every still-live glyph/particle. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Tunables — glyph appearance (R-T5-10). Hand-picked, free to retune
// visually — same spirit as rig.ts/shadow.ts's own constants.
// ---------------------------------------------------------------------------

/** Rendered glyph height range, as a fraction of `deps.unitPx` (brief: "~0.4-0.6 x unitPx"). */
const GLYPH_SCALE_MIN = 0.4;
const GLYPH_SCALE_MAX = 0.6;

/** Warm "digital candy" accent — distinct from Byte's own mint glow
 *  (`DEFAULT_GLOW_ACCENT`, scene.ts) and neutral clay body, so a tossed
 *  glyph reads as food rather than blending into Byte. Reused for the
 *  eat-burst particles below so the "spark" ties back to what was eaten. */
const GLYPH_ACCENT_COLOR = 0xffa94d;

// ---------------------------------------------------------------------------
// Tunables — toss (brief 3b): spawn-above, up-then-down parabola + spin +
// landing squash. Height/drift offsets scale with `deps.unitPx` (the
// glyph's own size context); `TOSS_DURATION`/`TOSS_SPIN_TURNS`/bank angle
// below are exact brief numbers, not tunable fractions.
// ---------------------------------------------------------------------------

const TOSS_DURATION = 0.45;
/** Fraction of `TOSS_DURATION` spent still rising (to the apex) before falling. */
const TOSS_RISE_FRACTION = 0.35;
/** How far above the landing spot the glyph spawns, and how much further it rises before falling — both fractions of `deps.unitPx`. */
const TOSS_SPAWN_HEIGHT_FRACTION = 1.1;
const TOSS_APEX_EXTRA_FRACTION = 0.4;
/** Lateral spawn offset (either side, random) so the fall reads as a genuine arc, not a straight vertical drop. */
const TOSS_X_DRIFT_FRACTION = 0.35;
/** Full turns of spin during the toss — an even count so the glyph lands visually upright (brief: "a full turn or two"). */
const TOSS_SPIN_TURNS = 2;
/** Landing squash: brief flatten-and-widen, then a `back.out` recover past identity. */
const TOSS_LAND_SQUASH_XZ = 1.3;
const TOSS_LAND_SQUASH_Y = 0.65;
const TOSS_SQUASH_DURATION = 0.09;
const TOSS_RECOVER_DURATION = 0.14;
/** Reduced motion: instant placement + a quick opacity fade-in (plain `opacity`, not `autoAlpha` — see module doc comment). */
const TOSS_REDUCED_FADE_DURATION = 0.15;

/** Cap-pop "pop away" — quick scale-to-0 before dispose (brief 3b); instant under reduced motion. */
const POP_AWAY_DURATION = 0.18;

// ---------------------------------------------------------------------------
// Tunables — dash (brief 3c / top-level task: "380-600ms scaled by
// distance", "bank +-0.21rad/+-12deg", "slight overshoot"). Duration/bank
// are exact brief numbers; `DASH_REFERENCE_DISTANCE` (the distance at which
// duration saturates to the max) is a fixed viewport-scale px constant —
// like `PROXIMITY_PX` in createBytePet.ts, NOT `unitPx`-scaled, since dash
// distance is about cursor-to-Byte screen geometry, not headline size.
// ---------------------------------------------------------------------------

const DASH_MIN_DURATION = 0.38;
const DASH_MAX_DURATION = 0.6;
const DASH_REFERENCE_DISTANCE = 640;
const DASH_BANK_RAD = 0.21;
/** Fraction of the dash spent banking IN; the remainder eases back to 0 by arrival ("eased back to 0 near arrival"). */
const DASH_BANK_RISE_FRACTION = 0.3;
/** Mild overshoot-then-settle on arrival (brief: "back.out ease or a tiny past-target-then-settle"). */
const DASH_ARRIVAL_EASE = 'back.out(1.25)';

// ---------------------------------------------------------------------------
// Tunables — eat (brief 3c: "two chomps"). T-GLB row 6: the two bites land on
// the delivered Eat clip's head-nod peaks (TICKETS T-GLB clip-beat table;
// `glbAsset.test.ts` asserts them against byte.glb) — the glyph reaches the
// midpoint on bite 1 and is swallowed on bite 2, and each eat blip fires ON
// its bite (R-GLB-11). rig.ts's placeholder `Eat` fake squash-peaks on the
// same two beats; the two modules stay numerically in lockstep by hand (the
// cross-file-constant-echo convention shadow.ts uses against rig.ts).
// ---------------------------------------------------------------------------

const EAT_BITE_1_S = 0.33;
const EAT_BITE_2_S = 0.6;
/** How far toward `mouthWorld()` (and how much scale is lost) by the end of chomp 1. */
const EAT_MIDPOINT_FRACTION = 0.5;
const EAT_MID_SCALE_FRACTION = 0.55;

// ---------------------------------------------------------------------------
// Tunables — eat-burst particles (brief 3c: "4-6 particles ... burst
// outward + fade"; reduced: "0-2 and instant"). Geometry is sized off
// `deps.unitPx` (same size-context reasoning as the toss offsets above).
// ---------------------------------------------------------------------------

const PARTICLE_COLOR = GLYPH_ACCENT_COLOR;
const PARTICLE_RADIUS_FRACTION = 0.045;
const PARTICLE_SEGMENTS = 6;
const PARTICLE_COUNT_MIN = 4;
const PARTICLE_COUNT_MAX = 6;
const PARTICLE_COUNT_REDUCED = 2;
const PARTICLE_BURST_DURATION = 0.4;
/** Burst travel distance range, as a fraction of `deps.unitPx`. */
const PARTICLE_BURST_MIN_FRACTION = 0.5;
const PARTICLE_BURST_MAX_FRACTION = 1.1;
/** Reduced motion: a plain, position-less opacity fade (the project's sanctioned "hops/dashes become fades" idiom). */
const PARTICLE_REDUCED_FADE_DURATION = 0.2;

// ---------------------------------------------------------------------------
// Tunables — "satisfied wiggle" (brief 3c: welcome polish, skip under
// reduce). A ROOT-level uniform-scale pulse, RELATIVE to the root's resting
// scalar (`deps.unitPx` — `placeholderBot.ts` does `root.scale.setScalar(
// unitPx)` once at construction, and nothing else ever writes
// `rig.object3d.scale` afterward, so it stays exactly `unitPx` on every axis
// until this pulse runs). `SATISFIED_WIGGLE_SCALE` is a MULTIPLIER of that
// resting scalar, not an absolute target — `rig.object3d.scale` rests at
// `unitPx` (typically 48-128), never at 1.
// ---------------------------------------------------------------------------

const SATISFIED_WIGGLE_SCALE = 1.08;
const SATISFIED_WIGGLE_UP_DURATION = 0.12;
const SATISFIED_WIGGLE_DOWN_DURATION = 0.18;

/**
 * States `fsm.send('FEED')` is legal from (fsm.ts) — `maybeStartProcessing()`'s
 * gate. T8 task 5: `traveling` accepts FEED too — a feed begun mid-trip runs
 * the exact same dash/eat choreography below (the feeder never forks on
 * *why* it's dashing/eating), and fsm.ts's own `feedFromTraveling` fork routes
 * its `ATE` back to `traveling` (a happy 360° spin, no retype — see
 * `createBytePet.ts`'s `dispatch`) instead of `retyping`.
 */
const FEED_ACCEPTING_STATES: ReadonlySet<PetState> = new Set<PetState>([
  'idle',
  'curious',
  'invited',
  'traveling',
]);

// ---------------------------------------------------------------------------
// Small shared point types (world-space, CSS-px units per scene.ts's convention).
// ---------------------------------------------------------------------------

interface Point2 {
  x: number;
  y: number;
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

// ---------------------------------------------------------------------------
// Pure-ish module-level helpers (no closure state — mirrors glyphs.ts's own
// "stateless helpers at module scope" split).
// ---------------------------------------------------------------------------

function randomGlyphKind(): GlyphKind {
  return GLYPH_KINDS[Math.floor(Math.random() * GLYPH_KINDS.length)];
}

/** `makeGlyph()` always returns a single `MeshStandardMaterial` (glyphs.ts) — narrowed here once per call site that needs to touch it. */
function materialOf(mesh: THREE.Mesh): THREE.MeshStandardMaterial {
  return mesh.material as THREE.MeshStandardMaterial;
}

/** Frees a glyph mesh's own geometry + material (array-aware, mirrors scene.ts's/rig.ts's disposal convention even though a glyph's material is always singular in practice). */
function disposeGlyphMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
  } else {
    material.dispose();
  }
}

// ---------------------------------------------------------------------------
// createFeeder()
// ---------------------------------------------------------------------------

type Trackable = ReturnType<typeof gsap.timeline> | ReturnType<typeof gsap.to>;

export function createFeeder(
  rig: PetRig,
  scene: SceneHandle,
  fsm: PetFSM,
  deps: FeederDeps,
): Feeder {
  const queue = createGlyphQueue<THREE.Mesh>();

  // --- Tween bookkeeping (mirrors createBytePet.ts's liveTweens exactly) ---
  const liveTweens = new Set<Trackable>();
  function track<T extends Trackable>(tween: T): T {
    liveTweens.add(tween);
    const existing = tween.eventCallback('onComplete');
    tween.eventCallback('onComplete', () => {
      liveTweens.delete(tween);
      existing?.();
    });
    return tween;
  }
  function killTracked<T extends Trackable>(tween: T | null): null {
    if (tween) {
      liveTweens.delete(tween);
      tween.kill();
    }
    return null;
  }

  // --- Per-glyph metadata + "every mesh this module owes a disposal" sets.
  // `landingById`/`tossTweenByGlyph` are cleaned up as soon as an entry
  // leaves the pure queue for any reason; `liveGlyphMeshes`/`liveParticles`
  // stay populated until the mesh is ACTUALLY removed+disposed (whichever
  // of eating/popping/dispose() gets there first), so dispose() has an
  // authoritative sweep list regardless of what animation phase a tween was
  // killed mid-flight. ---
  const landingById = new Map<number, Point2>();
  const liveGlyphMeshes = new Set<THREE.Mesh>();
  const liveParticles = new Set<THREE.Mesh>();
  const tossTweenByGlyph = new Map<THREE.Mesh, ReturnType<typeof gsap.timeline>>();

  // Shared across every particle this feeder ever bursts — created once,
  // disposed once in dispose(). Each particle still gets its OWN material
  // (see the module doc comment) so per-particle opacity fades don't bleed
  // into a sibling from an overlapping burst.
  const particleGeometry = new THREE.SphereGeometry(
    deps.unitPx * PARTICLE_RADIUS_FRACTION,
    PARTICLE_SEGMENTS,
    PARTICLE_SEGMENTS,
  );

  // Single named slots (not just liveTweens membership) so a fresh dash/eat
  // can defensively kill a stale predecessor before starting — mirrors
  // rig.ts's own `currentTimeline?.kill()` at the top of `play()`.
  let dashTween: ReturnType<typeof gsap.timeline> | null = null;
  let eatTween: ReturnType<typeof gsap.timeline> | null = null;

  function killTossTween(glyph: THREE.Mesh): void {
    const tween = tossTweenByGlyph.get(glyph);
    if (tween) {
      tossTweenByGlyph.delete(glyph);
      killTracked(tween);
    }
  }

  function disposeLiveGlyph(mesh: THREE.Mesh): void {
    liveGlyphMeshes.delete(mesh);
    scene.frontLayer.remove(mesh);
    disposeGlyphMesh(mesh);
  }

  /** Plays a clip UNLESS reduced motion is active — mirrors createBytePet.ts's
   *  own `playUnlessReduced` (a separate local copy; the two modules don't
   *  share this cross-cutting helper). Gating BOTH Dash and Eat this way
   *  (not just their position/scale arcs) is load-bearing, not cosmetic —
   *  see the module doc comment's reduced-motion paragraph. */
  function playUnlessReduced(clip: ClipName): void {
    if (!deps.prefersReducedMotion()) {
      rig.play(clip);
    }
  }

  /** Schedules `fn` for gsap's NEXT ticker pass (never synchronously inside
   *  the caller's own `fsm.onEnter` callback) — see the module doc comment's
   *  "no recursive fsm.send" note. */
  function fireOnNextTick(fn: () => void): void {
    track(gsap.delayedCall(0, fn));
  }

  function maybeStartProcessing(): void {
    if (FEED_ACCEPTING_STATES.has(fsm.state()) && queue.next()) {
      fsm.send('FEED');
    }
  }

  // --- Toss (brief 3b) -------------------------------------------------

  function tossGlyphIn(glyph: THREE.Mesh, landing: Point2, targetScale: number): void {
    const drift = (Math.random() < 0.5 ? -1 : 1) * TOSS_X_DRIFT_FRACTION * deps.unitPx;
    const spawnX = landing.x + drift;
    const spawnY = landing.y + TOSS_SPAWN_HEIGHT_FRACTION * deps.unitPx;
    const apexY = spawnY + TOSS_APEX_EXTRA_FRACTION * deps.unitPx;

    glyph.position.set(spawnX, spawnY, 0);
    glyph.scale.setScalar(targetScale);

    const riseDuration = TOSS_DURATION * TOSS_RISE_FRACTION;
    const fallDuration = TOSS_DURATION - riseDuration;

    const tl = gsap.timeline({ onComplete: () => tossTweenByGlyph.delete(glyph) });
    tl.to(glyph.position, { x: landing.x, duration: TOSS_DURATION, ease: 'power1.inOut' }, 0);
    tl.to(glyph.position, { y: apexY, duration: riseDuration, ease: 'power1.out' }, 0);
    tl.to(
      glyph.position,
      { y: landing.y, duration: fallDuration, ease: 'power2.in' },
      riseDuration,
    );
    tl.to(
      glyph.rotation,
      { z: Math.PI * 2 * TOSS_SPIN_TURNS, duration: TOSS_DURATION, ease: 'power1.out' },
      0,
    );
    tl.to(
      glyph.scale,
      {
        x: targetScale * TOSS_LAND_SQUASH_XZ,
        y: targetScale * TOSS_LAND_SQUASH_Y,
        z: targetScale * TOSS_LAND_SQUASH_XZ,
        duration: TOSS_SQUASH_DURATION,
        ease: 'power2.out',
      },
      TOSS_DURATION,
    );
    tl.to(
      glyph.scale,
      {
        x: targetScale,
        y: targetScale,
        z: targetScale,
        duration: TOSS_RECOVER_DURATION,
        ease: 'back.out(2)',
      },
      TOSS_DURATION + TOSS_SQUASH_DURATION,
    );

    tossTweenByGlyph.set(glyph, track(tl));
  }

  function popAway(mesh: THREE.Mesh): void {
    // The popped glyph might still be mid-toss (a rapid 4th click can evict
    // the very entry a still-airborne 3rd toss just created) — kill that
    // competing position/scale tween before starting (or skipping to) this
    // one's own.
    killTossTween(mesh);
    if (deps.prefersReducedMotion()) {
      disposeLiveGlyph(mesh);
      return;
    }
    track(
      gsap.to(mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: POP_AWAY_DURATION,
        ease: 'power2.in',
        onComplete: () => disposeLiveGlyph(mesh),
      }),
    );
  }

  function feed(x: number, y: number): void {
    const glyph = makeGlyph(randomGlyphKind());
    materialOf(glyph).color.set(GLYPH_ACCENT_COLOR);

    const glyphScale = gsap.utils.random(GLYPH_SCALE_MIN, GLYPH_SCALE_MAX) * deps.unitPx;
    const clickWorld = scene.worldFromScreen(x, y);
    // Byte's resting baseline y (read live, per the brief) — every glyph
    // lands on this same y for a clean horizontal dash. Self-consistent
    // across a whole feeding session: the dash only ever moves the root
    // toward a landing point that itself was sampled from the root's own
    // (then-resting) y, so the baseline never drifts feed-to-feed.
    const landing: Point2 = { x: clickWorld.x, y: rig.object3d.position.y };

    scene.addToFront(glyph);
    liveGlyphMeshes.add(glyph);

    // T7 (R7-1): one `spawnPop` per tossed glyph, before the motion-mode split
    // so it fires exactly once in BOTH modes (a toss always happens on feed()).
    deps.sound.play('spawnPop');

    if (deps.prefersReducedMotion()) {
      glyph.position.set(landing.x, landing.y, 0);
      glyph.scale.setScalar(glyphScale);
      const material = materialOf(glyph);
      material.transparent = true;
      material.opacity = 0;
      track(
        gsap.to(material, {
          opacity: 1,
          duration: TOSS_REDUCED_FADE_DURATION,
          ease: 'power1.out',
        }),
      );
    } else {
      tossGlyphIn(glyph, landing, glyphScale);
    }

    const { entry, popped } = queue.add(glyph);
    landingById.set(entry.id, landing);

    if (popped) {
      landingById.delete(popped.id);
      popAway(popped.glyph);
    }

    maybeStartProcessing();
  }

  // --- Dash (brief 3c, R-T5-5) -------------------------------------------

  function handleEnterDashing(): void {
    dashTween = killTracked(dashTween);

    const target = queue.next();
    if (!target) {
      // Defensive — shouldn't happen (maybeStartProcessing only sends FEED
      // when queue.next() exists) — beat through so the FSM can't wedge.
      fireOnNextTick(() => fsm.send('REACHED'));
      return;
    }

    const root = rig.object3d;
    const landing = landingById.get(target.id) ?? { x: root.position.x, y: root.position.y };

    playUnlessReduced('Dash');

    // `createBytePet.ts`'s dispatch() unconditionally calls clearLean() (a
    // rotation.z tween back to 0) on every non-'curious' state entry,
    // INCLUDING this one — it fires as a separate fsm.onEnter listener for
    // the same 'dashing' transition, so its tween can be actively starting
    // at the exact moment this one does. Kill outright rather than relying
    // on listener-registration order: whichever runs second would otherwise
    // fight the first for control of the same property every frame.
    gsap.killTweensOf(root.rotation, 'z');

    if (deps.prefersReducedMotion()) {
      root.position.set(landing.x, landing.y, 0);
      root.rotation.z = 0;
      fireOnNextTick(() => fsm.send('REACHED'));
      return;
    }

    const distance = Math.hypot(landing.x - root.position.x, landing.y - root.position.y);
    const duration = gsap.utils.clamp(
      DASH_MIN_DURATION,
      DASH_MAX_DURATION,
      gsap.utils.mapRange(
        0,
        DASH_REFERENCE_DISTANCE,
        DASH_MIN_DURATION,
        DASH_MAX_DURATION,
        distance,
      ),
    );
    // Bank leans the top of Byte toward the direction of travel — same
    // sign convention as createBytePet.ts's applyCuriousLean (negative
    // rotation.z leans right, per three.js's rotation handedness).
    const bankSign = landing.x - root.position.x >= 0 ? -1 : 1;
    const bankTarget = bankSign * DASH_BANK_RAD;
    const bankRiseDuration = duration * DASH_BANK_RISE_FRACTION;

    const tl = gsap.timeline({ onComplete: () => fsm.send('REACHED') });
    tl.to(root.position, { x: landing.x, y: landing.y, duration, ease: DASH_ARRIVAL_EASE }, 0);
    tl.to(root.rotation, { z: bankTarget, duration: bankRiseDuration, ease: 'power2.out' }, 0);
    tl.to(
      root.rotation,
      { z: 0, duration: duration - bankRiseDuration, ease: 'power2.inOut' },
      bankRiseDuration,
    );
    dashTween = track(tl);
  }

  // --- Eat (brief 3c, R-T5-5) ----------------------------------------------

  function spawnParticleBurst(origin: Point3): void {
    const reduced = deps.prefersReducedMotion();
    const count = reduced
      ? PARTICLE_COUNT_REDUCED
      : PARTICLE_COUNT_MIN +
        Math.floor(Math.random() * (PARTICLE_COUNT_MAX - PARTICLE_COUNT_MIN + 1));

    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color: PARTICLE_COLOR, transparent: true });
      const mesh = new THREE.Mesh(particleGeometry, material);
      mesh.position.set(origin.x, origin.y, origin.z);
      scene.addToFront(mesh);
      liveParticles.add(mesh);

      const cleanup = (): void => {
        liveParticles.delete(mesh);
        scene.frontLayer.remove(mesh);
        material.dispose();
      };

      if (reduced) {
        track(
          gsap.to(material, {
            opacity: 0,
            duration: PARTICLE_REDUCED_FADE_DURATION,
            ease: 'power1.out',
            onComplete: cleanup,
          }),
        );
        continue;
      }

      const angle = Math.random() * Math.PI * 2;
      const distance =
        gsap.utils.random(PARTICLE_BURST_MIN_FRACTION, PARTICLE_BURST_MAX_FRACTION) * deps.unitPx;
      const tl = gsap.timeline({ onComplete: cleanup });
      tl.to(
        mesh.position,
        {
          x: origin.x + Math.cos(angle) * distance,
          y: origin.y + Math.sin(angle) * distance,
          duration: PARTICLE_BURST_DURATION,
          ease: 'power2.out',
        },
        0,
      );
      tl.to(
        mesh.scale,
        { x: 0, y: 0, z: 0, duration: PARTICLE_BURST_DURATION, ease: 'power1.in' },
        0,
      );
      tl.to(material, { opacity: 0, duration: PARTICLE_BURST_DURATION, ease: 'power1.in' }, 0);
      track(tl);
    }
  }

  function playSatisfiedWiggle(): void {
    if (deps.prefersReducedMotion()) {
      return;
    }
    const scale = rig.object3d.scale;
    // The root's definitive resting scalar (placeholderBot.ts:
    // `root.scale.setScalar(unitPx)`) — NOT the live `scale.x`, which could
    // be read mid-tween. SATISFIED_WIGGLE_SCALE is a multiplier of this, so
    // the pulse always returns to exactly `unitPx` on every axis, never 1.
    const base = deps.unitPx;
    const peak = base * SATISFIED_WIGGLE_SCALE;
    const tl = gsap.timeline();
    tl.to(scale, {
      x: peak,
      y: peak,
      z: peak,
      duration: SATISFIED_WIGGLE_UP_DURATION,
      ease: 'power2.out',
    });
    tl.to(scale, {
      x: base,
      y: base,
      z: base,
      duration: SATISFIED_WIGGLE_DOWN_DURATION,
      ease: 'power2.inOut',
    });
    track(tl);
  }

  function finishEating(id: number, glyph: THREE.Mesh, mouthWorld: Point3): void {
    spawnParticleBurst(mouthWorld);
    queue.markEaten(id); // fires onEat(total)
    landingById.delete(id);
    disposeLiveGlyph(glyph);
  }

  function handleEnterEating(): void {
    eatTween = killTracked(eatTween);

    // NOTE (known, accepted edge case): a rapid extra toss CAN evict — via
    // glyphs.ts's cap-pop — the very entry Byte just dashed to (dashing
    // only protects a target from eviction once markEating() below runs,
    // not for the whole dash). If that happens, queue.next() here simply
    // resolves to whatever real glyph is now oldest instead — the counter
    // still increments correctly and a real, visible glyph is eaten; the
    // only cost is Byte's eat animation may start from a different glyph's
    // position than the one it visually dashed toward. Rare (requires a 4th
    // toss landing mid-dash onto the oldest of 3 already-live glyphs) and
    // cosmetic only — see the task-3 report for the full analysis.
    const target = queue.next();
    if (!target) {
      fireOnNextTick(() => fsm.send('ATE'));
      return;
    }

    queue.markEating(target.id);
    const glyph = target.glyph;
    killTossTween(glyph); // see popAway's identical guard — same rapid-click race.
    playUnlessReduced('Eat');
    const mouth = rig.mouthWorld();

    if (deps.prefersReducedMotion()) {
      // "Vanishes into the mouth without a hop" — no lingering tiny-scale
      // mesh, just an immediate, full teardown. T7: one `eatA` blip stands in
      // for the two full-motion chomps (discrete cues fire in BOTH modes).
      finishEating(target.id, glyph, mouth);
      deps.sound.play('eatA');
      fireOnNextTick(() => fsm.send('ATE'));
      return;
    }

    const start = glyph.position.clone();
    const mid: Point3 = {
      x: start.x + (mouth.x - start.x) * EAT_MIDPOINT_FRACTION,
      y: start.y + (mouth.y - start.y) * EAT_MIDPOINT_FRACTION,
      z: start.z + (mouth.z - start.z) * EAT_MIDPOINT_FRACTION,
    };
    const baseScale = glyph.scale.x; // uniform since toss always setScalar()s it.
    const midScale = baseScale * EAT_MID_SCALE_FRACTION;

    const tl = gsap.timeline({
      onComplete: () => {
        finishEating(target.id, glyph, mouth);
        playSatisfiedWiggle();
        fsm.send('ATE');
      },
    });
    const bite2Duration = EAT_BITE_2_S - EAT_BITE_1_S;
    // Bite 1 (0 -> EAT_BITE_1_S): partway to the mouth, partway shrunk.
    tl.to(
      glyph.position,
      { x: mid.x, y: mid.y, z: mid.z, duration: EAT_BITE_1_S, ease: 'power1.in' },
      0,
    );
    tl.to(
      glyph.scale,
      { x: midScale, y: midScale, z: midScale, duration: EAT_BITE_1_S, ease: 'power1.in' },
      0,
    );
    // Bite 2 (EAT_BITE_1_S -> EAT_BITE_2_S): the rest of the way into the mouth, gone.
    tl.to(
      glyph.position,
      { x: mouth.x, y: mouth.y, z: mouth.z, duration: bite2Duration, ease: 'power2.in' },
      EAT_BITE_1_S,
    );
    tl.to(
      glyph.scale,
      { x: 0, y: 0, z: 0, duration: bite2Duration, ease: 'power2.in' },
      EAT_BITE_1_S,
    );
    // T7 (R7-1) + T-GLB (R-GLB-11): each eat blip lands ON its bite — `eatA` as
    // bite 1 closes, `eatB` as bite 2 swallows the glyph (the same moment the
    // burst + satisfied wiggle fire from `onComplete`). `tl.call` fires at its
    // absolute timeline position regardless of insertion order.
    tl.call(() => deps.sound.play('eatA'), [], EAT_BITE_1_S);
    tl.call(() => deps.sound.play('eatB'), [], EAT_BITE_2_S);
    eatTween = track(tl);
  }

  // --- FSM subscription (brief 3c) -----------------------------------------

  fsm.onEnter((state) => {
    switch (state) {
      case 'dashing':
        handleEnterDashing();
        break;
      case 'eating':
        handleEnterEating();
        break;
      case 'idle':
        maybeStartProcessing();
        break;
      default:
        break;
    }
  });

  // --- Public handle (brief 3a/3d) ------------------------------------------

  function liveCount(): number {
    return queue.liveCount();
  }

  function onEat(cb: (total: number) => void): void {
    queue.onEat(cb);
  }

  function dispose(): void {
    dashTween = null;
    eatTween = null;
    tossTweenByGlyph.clear();

    liveTweens.forEach((tween) => tween.kill());
    liveTweens.clear();

    liveGlyphMeshes.forEach((mesh) => {
      scene.frontLayer.remove(mesh);
      disposeGlyphMesh(mesh);
    });
    liveGlyphMeshes.clear();
    landingById.clear();

    liveParticles.forEach((mesh) => {
      scene.frontLayer.remove(mesh);
      (mesh.material as THREE.MeshBasicMaterial).dispose();
    });
    liveParticles.clear();

    particleGeometry.dispose();
  }

  return { feed, liveCount, onEat, dispose };
}
