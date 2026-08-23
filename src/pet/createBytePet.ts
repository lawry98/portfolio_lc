/**
 * `createBytePet()` — the public module (SPEC §4.4) that assembles Byte into
 * a living pet: scene + ticker + rig + shadow + FSM, pointer→FSM wiring, the
 * FSM→animation choreography ("the idle brain"), reduced-motion, theming,
 * and teardown. This is the integration ticket (T4) — it consumes the FSM
 * (`fsm.ts`), the placeholder rig (`placeholderBot.ts`/`rig.ts`), and the
 * scene/shadow (`scene.ts`/`shadow.ts`) built in Tasks 1–3 and wires them
 * into one coherent thing `main.ts` can boot with a single call.
 *
 * **Ownership (R-T4-4):** this function OWNS the scene and the render
 * ticker — it calls `createScene()`/`startTicker()` itself rather than
 * receiving them, so `main.ts` only ever holds the returned `BytePetHandle`.
 *
 * **One clock:** all per-frame work (rig update, eye look, the headline
 * anchor re-derive, FSM timers, the shadow) happens inside a single
 * `scene.onTick()` callback, which `scene.render(dt)` invokes before it
 * draws — itself driven by `startTicker()` off the one shared `gsap.ticker`.
 * No second `requestAnimationFrame` loop exists anywhere in this module.
 *
 * **Cleanup model:** every tween/timer this module creates is kept as an
 * explicit reference (mirroring `rig.ts`'s own "keep references, not just
 * a context" choice — most of these are created inside async callbacks a
 * single `gsap.context()` call wouldn't auto-capture anyway) in the
 * `liveTweens` registry below, killed exhaustively in `destroy()`; a
 * `gsap.matchMedia()` additionally scopes the reduced-motion branches per
 * R-T4-7 and is reverted there too.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { createPetRig } from './rig';
import { createPlaceholderBot, POSE_GROUP_NAME } from './placeholderBot';
import { createFSM } from './fsm';
import { createFeeder } from './feed';
import { startTicker } from './motion';
import { createBlobShadow } from './shadow';
import { bodyColorForTheme, createScene, DEFAULT_GLOW_ACCENT } from './scene';
import type { BytePetHandle, ClipName, PetOptions, PetState } from './types';

type Theme = 'light' | 'dark';
type Trackable = ReturnType<typeof gsap.timeline> | ReturnType<typeof gsap.to>;

// --- Tunables (all hand-picked, free to retune visually — same spirit as
// rig.ts/shadow.ts's own constants). Grouped by the behaviour they drive. ---

/** SPEC §6 "cursor within ~150px" — screen-space distance that flips POINTER_NEAR/FAR. */
const PROXIMITY_PX = 150;

/** `localStorage` key gating the invited hint (SPEC §6 "gone forever after first feed"). */
const HINT_SHOWN_KEY = 'byte-hint-shown';
const HINT_TEXT = '(click to feed Byte)';
/** Gap (px) between the headline's bottom edge and the hint, below it. */
const HINT_GAP_PX = 14;
const HINT_FADE_S = 0.35;

/**
 * `createBytePet` is the single source of truth for `peekMs` — passed
 * straight into `createFSM({ peekMs: PEEK_MS })` below, rather than relying
 * on this constant merely matching `fsm.ts`'s own default by convention (a
 * real, if previously harmless, coupling: `PetFSM` exposes no getter, so a
 * silent drift would have been possible had anyone ever changed one without
 * the other). Also used to time this module's own `setBehind()` flip
 * against the FSM's own peekMs-driven auto-exit.
 */
const PEEK_MS = 1200;
/** When (seconds into the peek) the bot flips behind the letterform — roughly the rise's apex. */
const PEEK_BEHIND_ON_S = 0.3;
/** When it flips back in front — comfortably before the FSM's own `peekMs` auto-exit, leaving a settle beat. */
const PEEK_BEHIND_OFF_S = 0.85;
/** Reduced-motion peek: opacity dipped to, and the small rise/duration of each fade leg. */
const PEEK_REDUCED_FADE_OPACITY = 0.45;
const PEEK_REDUCED_RISE_PX = 10;
const PEEK_REDUCED_PHASE_S = 0.25;

/** Editor-authentic hard-step blink (brief 4d) — `source.eye.scale.y` squash via `steps()`. */
const EYE_OPEN_SCALE_Y = 1;
const EYE_CLOSED_SCALE_Y = 0.06;
/** Time between the start of one blink and the next. */
const BLINK_CYCLE_S = 2.6;
/** How long the eye stays visually closed. */
const BLINK_CLOSED_HOLD_S = 0.08;
/** Non-zero so `ease: 'steps(1)'` has a (tiny) window to snap within — see `buildBlink()`. */
const BLINK_SNAP_S = 0.05;

/** Micro-behaviour scheduler cadence (SPEC §6 "every 4–8s"). */
const MICRO_MIN_S = 4;
const MICRO_MAX_S = 8;
/** Eye-glance look-offset radius (world px) and hold time. */
const GLANCE_OFFSET_PX = 36;
const GLANCE_HOLD_S = 0.5;
/** Baseline-slide travel distance range (world px) and leg duration. */
const SLIDE_MIN_PX = 8;
const SLIDE_MAX_PX = 18;
const SLIDE_DURATION_S = 0.5;

/** Sleep "dim": body color multiplied toward black by this factor while asleep. */
const DIM_FACTOR = 0.55;

/** Curious's "slight lean" — a small root-level Z rotation (never touches the rig's own `pose` node). */
const LEAN_ROTATION_RAD = 0.06;
const LEAN_DURATION_S = 0.4;

/**
 * T5 dash/eat root handoff (R-T5-6): while Byte is `dashing`/`eating`, the
 * feeder (`feed.ts`) owns `rig.object3d.position` (toss-dash + eat
 * convergence) and deliberately leaves it at the food spot on `ATE` rather
 * than tweening home itself — this module (`onTick`, below) is the chosen
 * "return leg" owner, since it already holds the anchor math. `HOME_STATES`
 * are the states this module's own per-tick anchor pin applies to;
 * `REACQUIRE_DURATION_S` is how long the no-snap glide back to the anchor
 * takes on the first home tick after a dashing/eating span (instant
 * instead, under `reducedActive`).
 */
const HOME_STATES: ReadonlySet<PetState> = new Set<PetState>([
  'idle',
  'curious',
  'invited',
  'peeking',
  'sleeping',
  'waking',
]);
const REACQUIRE_DURATION_S = 0.3;

/**
 * Tight bounding rect of the LAST rendered line of text inside `el`, via a
 * `Range` over its last non-empty text node — deliberately NOT
 * `el.getBoundingClientRect()`. This project's `.hero__line` spans are
 * `display: block`, which stretches each line's own box to the full
 * container width regardless of how short its text is; anchoring to that
 * box's center (as `scene.screenFromRect()` would) lands Byte in empty
 * space well past the visible glyphs, with no letterform nearby for
 * `peeking` to occlude against. A `Range` over the actual text content
 * gives the glyphs' own tight bounds instead, so anchoring to its right
 * edge matches SPEC §6's "home anchor = end of the in-view text block" —
 * Byte straddles the last character, not the empty box past it. Falls back
 * to `el.getBoundingClientRect()` if `el` has no text at all (defensive;
 * a real headline always does).
 */
function lastLineTextRect(el: HTMLElement): DOMRect {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let lastNode: Text | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent && node.textContent.trim().length > 0) {
      lastNode = node as Text;
    }
  }
  if (!lastNode) {
    return el.getBoundingClientRect();
  }
  const range = document.createRange();
  range.selectNodeContents(lastNode);
  return range.getBoundingClientRect();
}

/**
 * Assembles and boots a living Byte into `mount`, returning the handle
 * `main.ts` (or any other host page) drives feed/theme/teardown through.
 */
export function createBytePet(mount: HTMLElement, opts: PetOptions): BytePetHandle {
  let theme: Theme = opts.theme ?? 'light';

  // --- Assemble (brief 4b) --------------------------------------------------
  const scene = createScene({
    headlineEl: opts.headlineEl,
    theme,
    mount,
    reducedMotion: opts.reducedMotion,
  });

  const unitPx = parseFloat(getComputedStyle(opts.headlineEl).fontSize);
  const source = createPlaceholderBot({ unitPx, theme });
  const rig = createPetRig(source);
  scene.addToPet(rig.object3d);

  const shadow = createBlobShadow();
  scene.addToFront(shadow.mesh);

  const fsm = createFSM({ peekMs: PEEK_MS });

  // --- Feeder (T5, R-T5-8) ---------------------------------------------------
  // Owns the toss/dash/eat glyph choreography end to end: `feed(x,y)` tosses
  // + enqueues a glyph and (via its own `maybeStartProcessing`) sends `FEED`
  // once a target is actually queued; a separate `fsm.onEnter` subscription
  // (registered inside `createFeeder` itself) drives the dash-to-food +
  // eat-into-the-mouth motion and fires `REACHED`/`ATE` back into the FSM.
  // `reducedActive` is read lazily (the closure below), so this always
  // reflects the module's live flag even though it isn't assigned until the
  // `gsap.matchMedia()` branches run further down.
  const feeder = createFeeder(rig, scene, fsm, {
    prefersReducedMotion: () => reducedActive,
    unitPx,
  });

  // The placeholder's internal clip-motion node (`placeholderBot.ts`'s "root
  // vs pose split") — read-only here, purely to sample the bot's CURRENT
  // hover height for the shadow. Never written to directly: only `rig.play()`
  // owns this node's transform.
  const pose = source.scene.getObjectByName(POSE_GROUP_NAME);

  // --- Feed zone (brief 4c "the feed zone (hero area)") --------------------
  // `PetOptions` only hands us the headline, so the feed zone is derived via
  // generic DOM traversal (never a hardcoded page class name) — keeps `pet/`
  // portable. Falls back gracefully if the headline has no `<section>`
  // ancestor at all.
  const feedZone: HTMLElement =
    opts.headlineEl.closest('section') ?? opts.headlineEl.parentElement ?? opts.headlineEl;

  // --- Hint DOM element (brief 4d "invited" hint) ---------------------------
  // Inline-styled (not a page CSS class) so `pet/` stays portable, matching
  // `scene.ts`'s own canvas-styling convention. `position: fixed` + opacity-
  // only fades means this can never shift page layout (CLS 0) regardless of
  // when it appears — it is never part of any element's in-flow box.
  const hintEl = document.createElement('p');
  hintEl.textContent = HINT_TEXT;
  hintEl.setAttribute('aria-live', 'polite');
  Object.assign(hintEl.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    margin: '0',
    // Above #gl-front (z-index 40, scene.ts) so it's never covered by the
    // shadow/future glyphs; below the grain overlay (9999, grain.css).
    zIndex: '41',
    pointerEvents: 'none',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    letterSpacing: '0.02em',
    opacity: '0',
    willChange: 'transform, opacity',
  } satisfies Partial<CSSStyleDeclaration>);
  mount.appendChild(hintEl);

  function isHintPermanentlyDismissed(): boolean {
    try {
      return localStorage.getItem(HINT_SHOWN_KEY) === '1';
    } catch {
      return false;
    }
  }

  function markHintPermanentlyDismissed(): void {
    try {
      localStorage.setItem(HINT_SHOWN_KEY, '1');
    } catch {
      // Best-effort only — mirrors lib/theme.ts's storage guards.
    }
  }

  // --- Tween bookkeeping -----------------------------------------------------
  // `track()` self-prunes on natural completion (composed with whatever
  // onComplete the caller already passed — `gsap.delayedCall`'s own
  // callback in particular, which would otherwise be silently replaced) so
  // `liveTweens` doesn't grow unboundedly over a long session; `.kill()`
  // never fires `onComplete`, so anything killed early (a superseded
  // peek/glance/micro-timer/blink — see `killTracked()`) needs its own
  // explicit removal instead.
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

  /** Kills a tracked, possibly-null tween/timeline (if any) and removes it from `liveTweens`, returning `null` for reassignment. */
  function killTracked<T extends Trackable>(tween: T | null): null {
    if (tween) {
      liveTweens.delete(tween);
      tween.kill();
    }
    return null;
  }

  const mm = gsap.matchMedia();

  let blinkTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let microTimer: ReturnType<typeof gsap.delayedCall> | null = null;
  let glanceTimer: ReturnType<typeof gsap.delayedCall> | null = null;
  let peekTimeline: ReturnType<typeof gsap.timeline> | null = null;
  /** Named single slot (parked T4 minor, carry-forward #5) so a superseded hint fade self-prunes instead of leaving a dead entry in `liveTweens` — `overwrite: true` already kills the competing GSAP tween internally, but that kill never fires `onComplete`, so `track()`'s own Set-removal never ran for it without this. */
  let hintTween: ReturnType<typeof gsap.to> | null = null;
  /** The `onTick` "no-snap reacquire" glide (R-T5-6) — tracked in its own named slot (not just `liveTweens` membership) so a rapid re-feed can defensively kill it before it fights a fresh dash tween for `rig.object3d.position`. */
  let reacquireTween: ReturnType<typeof gsap.to> | null = null;
  // Whether the guaranteed-early peek (SPEC §6 "must happen within the first
  // ~10 idle seconds") has ever fired. Set once, on the FIRST successful
  // micro-behaviour roll of the bot's life, and never reset afterward — see
  // `pickMicroBehaviour()`'s doc comment for why this must NOT be re-armed
  // on every idle re-entry (that was a real, shipped bug — see the task-4
  // report's Fix Report section).
  let earlyPeekDelivered = false;
  let reducedActive = false;
  let currentPeekRunner: () => void = () => {};

  // --- Cursor / anchor / idle-drift state ------------------------------------
  const cursorScreen = { x: -9999, y: -9999 };
  let cursorWorld = { x: 0, y: 0 };
  // Whether a real pointer event has ever arrived — until then, `setLook`
  // targets the bot's own anchor (≈ "look straight ahead") instead of the
  // far-off-screen `cursorScreen` sentinel, which would otherwise pin the
  // eye to its yaw/pitch clamp before the user ever moves the mouse.
  let hasPointerInput = false;
  // Idle baseline-slide offset (world px), added on top of the anchor each
  // tick. Single-axis: the reduced-motion peek's own small rise lives on
  // `pose.position.y` instead (see `runPeekReduced`), not here.
  const drift = { x: 0 };
  let glanceOverride: { x: number; y: number } | null = null;
  // Edge-triggered proximity (brief 4c): POINTER_NEAR/FAR are sent only on
  // an actual crossing, not every tick — see `onTick`'s doc comment for why.
  // Re-armed to `false` on every idle (re-)entry (`enterIdleBehaviour`) so a
  // cursor that became near while Byte was peeking/dashing/waking/sleeping
  // (none of which consume POINTER_NEAR into a transition) is re-detected
  // as a fresh crossing once idle resumes, rather than being silently
  // stranded as "already near, no new edge" forever (I-1 fix).
  let wasNear = false;
  // Edge-triggered "was Byte in a HOME state last tick" (R-T5-6) — mirrors
  // `wasNear`'s own pattern. Drives the reacquire tween off the actual
  // transition INTO a home state (idle/curious/invited/peeking/sleeping/
  // waking), not merely "currently home", so the glide starts exactly once
  // per dashing/eating span. Starts `true`: `createFSM()` starts in `idle`,
  // already home, so there is no span to reacquire from on the first tick.
  let wasHome = true;

  // --- Blink (brief 4d "Blink") ----------------------------------------------
  // Hard-step squash of `source.eye.scale.y` — an infinite-repeat timeline
  // that's PAUSED/RESUMED (not killed/rebuilt) as states change, so it never
  // restarts mid-cycle. Built fresh inside EACH matchMedia branch below (both
  // branches call `buildBlink()` identically) so it survives a live OS
  // reduced-motion flip, per R-T4-7's explicit instruction.
  function buildBlink(): ReturnType<typeof gsap.timeline> | null {
    if (!source.eye) {
      return null;
    }
    const eyeScale = source.eye.scale;
    const tl = track(gsap.timeline({ repeat: -1 }));
    tl.to(
      eyeScale,
      { y: EYE_CLOSED_SCALE_Y, duration: BLINK_SNAP_S, ease: 'steps(1)' },
      BLINK_CYCLE_S,
    );
    tl.to(
      eyeScale,
      { y: EYE_OPEN_SCALE_Y, duration: BLINK_SNAP_S, ease: 'steps(1)' },
      BLINK_CYCLE_S + BLINK_CLOSED_HOLD_S,
    );
    return tl;
  }

  function pauseBlink(): void {
    blinkTimeline?.pause();
    if (source.eye) {
      gsap.set(source.eye.scale, { y: EYE_OPEN_SCALE_Y });
    }
  }

  function resumeBlink(): void {
    blinkTimeline?.play();
  }

  // --- Reduced-motion (R-T4-7) -----------------------------------------------
  // `opts.reducedMotion`, when explicitly supplied, is a hard override (an
  // always-matching `'all'` query forces one branch); otherwise both real
  // `prefers-reduced-motion` queries are registered for live self-detection,
  // matching `page/hero.ts`'s own matchMedia pattern.
  function setupFullBranch(): (() => void) | void {
    reducedActive = false;
    blinkTimeline = buildBlink();
    currentPeekRunner = runPeekFull;
    return () => {
      blinkTimeline = killTracked(blinkTimeline);
    };
  }

  function setupReducedBranch(): (() => void) | void {
    reducedActive = true;
    blinkTimeline = buildBlink();
    currentPeekRunner = runPeekReduced;
    return () => {
      blinkTimeline = killTracked(blinkTimeline);
    };
  }

  if (opts.reducedMotion === true) {
    mm.add('all', setupReducedBranch);
  } else if (opts.reducedMotion === false) {
    mm.add('all', setupFullBranch);
  } else {
    mm.add('(prefers-reduced-motion: reduce)', setupReducedBranch);
    mm.add('(prefers-reduced-motion: no-preference)', setupFullBranch);
  }

  // --- Theme (R-T4-5) ----------------------------------------------------------
  function themedMaterials(): THREE.MeshStandardMaterial[] {
    return [source.body, source.glow].filter((m): m is THREE.MeshStandardMaterial => m != null);
  }

  function setDimmed(on: boolean): void {
    const base = bodyColorForTheme(theme);
    rig.setBodyColor(on ? new THREE.Color(base).multiplyScalar(DIM_FACTOR) : base);
  }

  function applyTheme(t: Theme): void {
    theme = t;
    scene.setTheme(t);
    rig.setGlow(t === 'dark', DEFAULT_GLOW_ACCENT);
    setDimmed(fsm.state() === 'sleeping');
  }

  // --- Invited hint ------------------------------------------------------------
  function hideHint(): void {
    hintTween = killTracked(hintTween);
    hintTween = track(
      gsap.to(hintEl, { opacity: 0, duration: HINT_FADE_S, ease: 'power1.out', overwrite: true }),
    );
  }

  function maybeShowHint(): void {
    if (isHintPermanentlyDismissed()) {
      return;
    }
    hintTween = killTracked(hintTween);
    hintTween = track(
      gsap.to(hintEl, { opacity: 1, duration: HINT_FADE_S, ease: 'power1.out', overwrite: true }),
    );
  }

  // --- Curious lean (SPEC §6 "slight lean") -------------------------------------
  // Tweens the ROOT's rotation, never the rig's internal `pose` node, so this
  // can never fight `rig.play()`'s own clip motion (see the module doc
  // comment on `pose` above).
  function applyCuriousLean(): void {
    const dx = cursorWorld.x - rig.object3d.position.x;
    const target = (dx >= 0 ? -1 : 1) * LEAN_ROTATION_RAD;
    if (reducedActive) {
      gsap.set(rig.object3d.rotation, { z: target });
    } else {
      track(
        gsap.to(rig.object3d.rotation, {
          z: target,
          duration: LEAN_DURATION_S,
          ease: 'power2.out',
        }),
      );
    }
  }

  function clearLean(): void {
    if (reducedActive) {
      gsap.set(rig.object3d.rotation, { z: 0 });
    } else {
      track(
        gsap.to(rig.object3d.rotation, { z: 0, duration: LEAN_DURATION_S, ease: 'power2.out' }),
      );
    }
  }

  // --- Peek (brief 4d "peeking") -------------------------------------------------
  function runPeekFull(): void {
    peekTimeline = killTracked(peekTimeline);
    rig.play('Peek');
    const tl = track(gsap.timeline());
    tl.call(() => scene.setBehind(true), undefined, PEEK_BEHIND_ON_S);
    tl.call(() => scene.setBehind(false), undefined, PEEK_BEHIND_OFF_S);
    peekTimeline = tl;
  }

  /** Reduced-motion: "fade up/behind instead of a hop" — still `setBehind` (occlusion is a layer swap). */
  function runPeekReduced(): void {
    peekTimeline = killTracked(peekTimeline);
    themedMaterials().forEach((m) => {
      m.transparent = true;
    });

    // The small "rise" drives `pose.position.y` — the SAME hover channel
    // the shadow's height/opacity reads every tick (`onTick`, `hoverPx`) and
    // the full-motion path's `rig.play('Peek')` uses internally — NOT
    // `drift` (a ROOT-level offset the shadow's own POSITION also follows).
    // Driving the rise through `drift` moved the shadow along with the bot
    // without correspondingly fading/growing it (the shadow read `hoverPx`
    // from `pose`, which `drift` never touches), so the ground-contact blob
    // floated up fully dark instead of scaling/fading like the full-motion
    // peek's does. Reaching into `pose` directly here (unlike everywhere
    // else in this module) is safe specifically because `playUnlessReduced`
    // guarantees `rig.play()` is never called while `reducedActive` is true
    // — nothing else can be fighting over this node's transform in this
    // mode. `riseFraction` converts the original world-px rise target into
    // `pose`'s normalized (fraction-of-bot-height) units, so the visible
    // rise stays ~`PEEK_REDUCED_RISE_PX` regardless of `unitPx`.
    const riseFraction = PEEK_REDUCED_RISE_PX / unitPx;

    const holdEnd = PEEK_MS / 1000 - PEEK_REDUCED_PHASE_S * 2 - 0.15;
    const tl = track(gsap.timeline());
    tl.call(() => scene.setBehind(true), undefined, 0);
    if (pose) {
      tl.to(
        pose.position,
        { y: riseFraction, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.out' },
        0,
      );
    }
    tl.to(
      themedMaterials(),
      { opacity: PEEK_REDUCED_FADE_OPACITY, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.out' },
      0,
    );
    tl.call(() => scene.setBehind(false), undefined, holdEnd);
    if (pose) {
      tl.to(pose.position, { y: 0, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.in' }, holdEnd);
    }
    tl.to(
      themedMaterials(),
      { opacity: 1, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.in' },
      holdEnd,
    );
    // Back to fully opaque by this point — drop `transparent` so the
    // material renders in the normal (non-blended) pass again afterward.
    tl.call(
      () => themedMaterials().forEach((m) => (m.transparent = false)),
      undefined,
      holdEnd + PEEK_REDUCED_PHASE_S,
    );
    peekTimeline = tl;
  }

  // --- Micro-behaviour scheduler (brief 4d) ---------------------------------------
  // Lives here, not in the FSM (R-T4-3) — randomness + cadence are this
  // module's job. Paused whenever the FSM leaves 'idle'. Hop/slide
  // (position/clip motion — the brief's "wander" category) are excluded
  // from the reduced pool: Hop is rig.ts's own clip, with no
  // duration/amplitude knob this module can turn down; Slide is this
  // module's own tween and COULD be shortened, but a near-instant position
  // jump would read as a glitch rather than a fade, so it's dropped instead
  // — conservative and consistent with Hop. Eye glances are tiny rotations,
  // kept in both pools; Peek gets its own dedicated reduced branch above
  // (fully controlled by this module, unlike Hop).
  type MicroBehaviour = 'glance' | 'hop' | 'slide' | 'peek';

  function idleMicroPool(): MicroBehaviour[] {
    return reducedActive ? ['glance', 'peek'] : ['glance', 'hop', 'slide', 'peek'];
  }

  /**
   * `earlyPeekDelivered` gates the SPEC §6 guarantee ("must happen within
   * the first ~10 idle seconds") as a ONE-TIME event, not a per-idle-entry
   * one. It must NOT be reset every time `idle` is (re-)entered: a peek
   * itself routes through `idle → peeking → (peekMs) → idle`, and re-arming
   * the force on that return trip made every idle span's first (and only,
   * since a peek ends the span) roll a forced peek forever — `glance`/`hop`/
   * `slide` were dead code, and since a peek every ~6s kept resetting the
   * FSM's sleep accumulator too (see `onTick`'s edge-triggered proximity
   * fix), `sleeping`/`waking` were unreachable. Confirmed as a real,
   * shipped bug via code review, then reproduced and fixed here — see the
   * task-4 report's Fix Report section.
   */
  function pickMicroBehaviour(): MicroBehaviour {
    if (!earlyPeekDelivered) {
      earlyPeekDelivered = true;
      return 'peek';
    }
    const pool = idleMicroPool();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function doEyeGlance(): void {
    const angle = Math.random() * Math.PI * 2;
    const botPos = rig.object3d.position;
    glanceOverride = {
      x: botPos.x + Math.cos(angle) * GLANCE_OFFSET_PX,
      y: botPos.y + Math.sin(angle) * GLANCE_OFFSET_PX,
    };
    glanceTimer = killTracked(glanceTimer);
    glanceTimer = track(
      gsap.delayedCall(GLANCE_HOLD_S, () => {
        glanceOverride = null;
      }),
    );
  }

  function doBaselineSlide(): void {
    const distance = (Math.random() < 0.5 ? -1 : 1) * gsap.utils.random(SLIDE_MIN_PX, SLIDE_MAX_PX);
    track(
      gsap.to(drift, {
        x: distance,
        duration: SLIDE_DURATION_S,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1,
      }),
    );
  }

  function rollMicroBehaviour(): void {
    if (fsm.state() !== 'idle') {
      return; // Defensive — the scheduler is paused on leaving idle.
    }
    const choice = pickMicroBehaviour();
    if (choice === 'peek') {
      fsm.send('PEEK'); // onEnter('peeking') pauses the scheduler; idle re-entry restarts it.
      return;
    }
    if (choice === 'glance') {
      doEyeGlance();
    } else if (choice === 'hop') {
      rig.play('Hop');
    } else {
      doBaselineSlide();
    }
    scheduleNextMicroBehaviour();
  }

  function scheduleNextMicroBehaviour(): void {
    microTimer = killTracked(microTimer);
    microTimer = track(
      gsap.delayedCall(gsap.utils.random(MICRO_MIN_S, MICRO_MAX_S), rollMicroBehaviour),
    );
  }

  function pauseMicroScheduler(): void {
    microTimer = killTracked(microTimer);
  }

  function enterIdleBehaviour(): void {
    playUnlessReduced('Idle');
    resumeBlink();
    // Re-arm edge-triggered proximity (I-1 fix): without this, a cursor that
    // moved near Byte WHILE it was peeking/dashing/waking/sleeping (none of
    // which consume POINTER_NEAR into a real transition) left `wasNear`
    // already `true` by the time idle was (re-)entered, so the NEXT tick's
    // still-near cursor read as "no new edge" and never sent POINTER_NEAR —
    // Byte would sit idle right next to the cursor indefinitely, with no
    // curious/invited, until the cursor actually left and came back.
    // Resetting `wasNear` here means the very next tick treats a
    // currently-near cursor as a fresh crossing and (correctly) fires
    // POINTER_NEAR once; a currently-far cursor still fires nothing.
    wasNear = false;
    // Deliberately does NOT reset `earlyPeekDelivered` — see
    // `pickMicroBehaviour()`'s doc comment. Every idle (re-)entry just
    // restarts the 4–8s scheduler; only the bot's very first-ever roll is
    // forced.
    scheduleNextMicroBehaviour();
  }

  /**
   * Plays a named clip UNLESS reduced motion is active, in which case the
   * call is skipped outright (I-2 fix) — R-T4-7 plus the project's global
   * "no continuous motion a reduced-motion user can't stop" constraint.
   * `Idle`/`Sleep` are `repeat:-1, yoyo:true` loops (a perpetual bob/breath)
   * and `Dash`/`Wake` are large jump/shake beats; none of the four get a
   * reduced ALTERNATIVE the way `Peek` does (`runPeekReduced`) — they're
   * simply skipped, leaving `pose` at whatever it currently is.
   *
   * This is safe (not "leaves a stale non-identity pose lying around")
   * specifically because, under `reducedActive`, NOTHING ELSE ever calls
   * `rig.play()` either: `Hop` is excluded from the reduced micro-behaviour
   * pool (`idleMicroPool()`), `Peek`'s reduced branch (`runPeekReduced`)
   * never calls `rig.play('Peek')`, and this function itself gates the
   * remaining four. `rig.play()` is the only thing THIS GUARD needs to
   * worry about gating, so `pose` stays at its construction-time identity
   * for the entire reduced-motion lifetime EXCEPT during a peek:
   * `runPeekReduced` nudges `pose.position.y` directly (a small rise/fall,
   * not through `play()`) for the fade's duration, settling back to
   * identity once the peek ends. Sleep's dim (`setDimmed`, unconditional)
   * is unaffected either way.
   */
  function playUnlessReduced(clip: ClipName): void {
    if (!reducedActive) {
      rig.play(clip);
    }
  }

  // --- FSM → choreography dispatch (brief 4d, "the idle brain") -------------------
  function dispatch(state: PetState): void {
    // A prior onEnter listener may have caused a NESTED transition mid-loop (e.g. the
    // feeder re-chaining idle→FEED→dashing for the next queued glyph). When that
    // happens this callback still fires for the now-superseded state, so bail if the
    // dispatched state is no longer the live one — otherwise we'd drive choreography
    // for a state Byte already left (replaying Idle over a fresh Dash, etc.).
    if (fsm.state() !== state) {
      return;
    }

    // Defensive per-state resets (brief 4d): every non-peeking state ensures
    // the occlusion flip is off, regardless of how it was reached.
    if (state !== 'peeking') {
      scene.setBehind(false);
    }
    setDimmed(state === 'sleeping');

    if (state === 'curious' || state === 'sleeping') {
      pauseBlink();
    } else {
      resumeBlink();
    }

    if (state !== 'idle') {
      pauseMicroScheduler();
      glanceTimer = killTracked(glanceTimer);
      glanceOverride = null;
    }
    if (state !== 'invited') {
      hideHint();
    }
    // R-T5-6 fix: do NOT clear the lean when entering dashing/eating — the
    // feeder (`feed.ts`) drives its own bank rotation on
    // `rig.object3d.rotation.z` during dashing, and this clear (previously
    // unconditional for every non-curious state, including dashing/eating)
    // was fighting it for the same property every time dashing was
    // (re-)entered. Only clear it when actually returning to a resting home
    // posture.
    if (state !== 'curious' && state !== 'dashing' && state !== 'eating') {
      clearLean();
    }

    switch (state) {
      case 'idle':
        enterIdleBehaviour();
        break;
      case 'curious':
        // "Eyes lock on" is the continuous per-tick setLook below — no extra
        // wiring needed here; blink is already paused above.
        applyCuriousLean();
        break;
      case 'invited':
        maybeShowHint();
        break;
      case 'peeking':
        currentPeekRunner();
        break;
      case 'sleeping':
        playUnlessReduced('Sleep');
        break;
      case 'waking':
        playUnlessReduced('Wake');
        break;
      case 'dashing':
      case 'eating':
        // T5 (R-T5-5): the feeder (`feed.ts`) now owns both the `Dash`/`Eat`
        // clips and the root locomotion for these two states via its own
        // `fsm.onEnter` subscription — nothing to play/pose here. The one
        // thing this module still does on entry is defensively kill a
        // still-in-flight `onTick` reacquire tween (R-T5-6): without this, a
        // rapid re-feed landing while Byte is still gliding home from a
        // previous eat would leave that tween and the feeder's own fresh
        // dash tween both writing `rig.object3d.position` on the same
        // frame. Safe/idempotent when there's nothing to kill (the common
        // case) — `killTracked(null)` is a no-op.
        reacquireTween = killTracked(reacquireTween);
        break;
      default:
        // 'retyping' | 'traveling' | 'hidden' | 'entering' are not reachable
        // via the current FSM (fsm.ts never transitions into them yet) —
        // reserved for later tickets.
        break;
    }
  }

  fsm.onEnter(dispatch);

  // onEnter never fires for the FSM's initial state (createFSM() starts in
  // 'idle'), so both of these need an explicit initial call.
  applyTheme(theme);
  enterIdleBehaviour();

  // --- Pointer wiring → FSM events (brief 4c) --------------------------------------
  function onPointerMove(e: PointerEvent): void {
    hasPointerInput = true;
    cursorScreen.x = e.clientX;
    cursorScreen.y = e.clientY;
  }

  function onPointerDown(e: PointerEvent): void {
    fsm.send('POINTER_DOWN'); // wakes Byte when sleeping; harmless/no-op elsewhere.
    feed(e.clientX, e.clientY);
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  feedZone.addEventListener('pointerdown', onPointerDown, { passive: true });

  // --- Per-tick update (brief 4b) -----------------------------------------------------
  function onTick(dt: number): void {
    // Re-derive the headline's text-end anchor every tick (never snapshot) —
    // the canvases are viewport-fixed and the headline reflows once fonts/
    // SplitText settle, exactly as the (now-removed) T3 `?glcube` rig did.
    const lineRect = lastLineTextRect(opts.headlineEl);
    const anchorX = lineRect.right;
    const anchorY = lineRect.top + lineRect.height / 2;
    const anchorWorld = scene.worldFromScreen(anchorX, anchorY);
    cursorWorld = scene.worldFromScreen(cursorScreen.x, cursorScreen.y);

    // Edge-triggered (brief 4c), NOT sent unconditionally every tick: the
    // FSM's `peeking` case resets its sleep accumulator on POINTER_NEAR/FAR
    // (fsm.ts) — designed for occasional real pointer events, not a 60×/s
    // dispatch. Firing every tick pinned the sleep clock near zero during
    // every peek, defeating fsm.ts's own deliberate "PEEK doesn't delay
    // sleep" guarantee (and flapped curious↔idle for a cursor sitting on
    // the 150px boundary). Distance is still recomputed fresh every tick
    // (so a scroll that moves the headline under a stationary cursor is
    // still caught), but the FSM is only told about an actual crossing —
    // `enterIdleBehaviour()` re-arms `wasNear = false` on every idle entry
    // so a cursor that was already near throughout a peeking/dashing/
    // waking/sleeping span (none of which consume POINTER_NEAR) is still
    // re-detected as a fresh crossing once idle resumes (I-1 fix), rather
    // than staying silently "already near, no new edge" forever.
    const dist = Math.hypot(cursorScreen.x - anchorX, cursorScreen.y - anchorY);
    const isNear = dist <= PROXIMITY_PX;
    if (isNear && !wasNear) {
      fsm.send('POINTER_NEAR');
    } else if (!isNear && wasNear) {
      fsm.send('POINTER_FAR');
    }
    wasNear = isNear;
    fsm.tickTimers(dt * 1000);

    rig.update(dt);
    // Before any real pointer input, look at the bot's own anchor (≈ dx=dy=0,
    // i.e. "straight ahead") instead of the `cursorScreen` sentinel, which
    // would otherwise pin yaw/pitch to their clamp on load.
    const lookTarget = glanceOverride ?? (hasPointerInput ? cursorWorld : anchorWorld);
    rig.setLook(lookTarget.x, lookTarget.y);

    // Root placement (R-T5-6 handoff): feet land at the anchor's own
    // vertical center minus half the bot's height, so the assembled bot
    // reads centered on the headline anchor (the placeholder's origin is at
    // its feet, not its center — see placeholderBot.ts) plus any idle-drift
    // offset. Only HARD-PIN the root here while Byte is in a HOME state —
    // while `dashing`/`eating`, the feeder (`feed.ts`) owns
    // `rig.object3d.position` (toss-dash + eat convergence), and pinning it
    // here too every tick would fight that tween for the same property.
    const rootX = anchorWorld.x + drift.x;
    const rootY = anchorWorld.y - unitPx / 2;
    const home = HOME_STATES.has(fsm.state());

    if (home && !wasHome) {
      // No-snap reacquire: the feeder deliberately leaves Byte at the food
      // spot when it sends ATE (see feed.ts's own doc comment) rather than
      // tweening home itself — this module is the chosen return-leg owner,
      // since it already holds the anchor math above. Glide from wherever
      // eating finished back to the anchor instead of hard-snapping on this
      // first home tick; the steady-state hard-pin below resumes once it
      // arrives. Instant under `reducedActive` — no arc a reduced-motion
      // user can't stop.
      reacquireTween = killTracked(reacquireTween);
      if (reducedActive) {
        rig.object3d.position.set(rootX, rootY, 0);
      } else {
        reacquireTween = track(
          gsap.to(rig.object3d.position, {
            x: rootX,
            y: rootY,
            z: 0,
            duration: REACQUIRE_DURATION_S,
            ease: 'power2.out',
            onComplete: () => {
              reacquireTween = null;
            },
          }),
        );
      }
    } else if (home && !reacquireTween) {
      // Steady-state home, no in-flight reacquire — hard-pin every tick
      // exactly as before T5.
      rig.object3d.position.set(rootX, rootY, 0);
    }
    wasHome = home;

    // Shadow follows the root's ACTUAL current position, not the freshly
    // recomputed anchor: during dashing/eating (feeder-owned) and during the
    // reacquire glide just above, `rig.object3d.position` is wherever the
    // feeder/tween left it, and the shadow must track that rather than snap
    // ahead to where Byte is heading. Its scale/opacity still only respond
    // to the pose group's own live hover height, never its own position.
    shadow.mesh.position.set(rig.object3d.position.x, rig.object3d.position.y, 0);
    const hoverPx = (pose?.position.y ?? 0) * unitPx;
    shadow.setHeight(Math.max(0, hoverPx));

    // The hint sits under the last line (also "under the headline" — it's
    // the bottom-most line — and right below where Byte itself now lives).
    const hintLeft = lineRect.left;
    const hintTop = lineRect.bottom + HINT_GAP_PX;
    hintEl.style.transform = `translate(${hintLeft}px, ${hintTop}px)`;
  }

  scene.onTick(onTick);
  const ticker = startTicker((dt) => scene.render(dt));

  // --- Public handle (brief 4a/4e) ------------------------------------------------
  function feed(x: number, y: number): void {
    // T5: the feeder owns the FEED send now (via its own
    // `maybeStartProcessing`, fired once the tossed glyph is actually
    // queued) — sending it again here would double-send into the FSM.
    feeder.feed(x, y);
    markHintPermanentlyDismissed();
  }

  function setTheme(t: Theme): void {
    applyTheme(t);
  }

  function onEat(cb: (total: number) => void): void {
    feeder.onEat(cb);
  }

  let destroyed = false;
  function destroy(): void {
    if (destroyed) {
      return;
    }
    destroyed = true;

    ticker.stop();
    window.removeEventListener('pointermove', onPointerMove);
    feedZone.removeEventListener('pointerdown', onPointerDown);

    // Every named ref (blink/micro/glance/peek) is already inside
    // `liveTweens` (each was created via `track()`), so this bulk kill+clear
    // already covers them — the explicit nulls below are just hygiene, not
    // a second kill.
    liveTweens.forEach((tween) => tween.kill());
    liveTweens.clear();
    blinkTimeline = null;
    microTimer = null;
    glanceTimer = null;
    peekTimeline = null;
    hintTween = null;
    reacquireTween = null;

    mm.revert();

    hintEl.remove();

    feeder.dispose();
    rig.dispose();
    shadow.dispose();
    scene.dispose();
  }

  return { feed, setTheme, onEat, destroy };
}
