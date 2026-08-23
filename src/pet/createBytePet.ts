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
 * **Cleanup model:** most tweens/timers this module creates are kept as
 * explicit references (mirroring `rig.ts`'s own "keep references, not just
 * a context" choice) in the `liveTweens` registry below, killed exhaustively
 * in `destroy()`; a `gsap.context()` and a `gsap.matchMedia()` additionally
 * scope the reduced-motion branches per R-T4-7 and are reverted there too —
 * belt and suspenders, per the ticket brief's explicit destroy checklist.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { createPetRig } from './rig';
import { createPlaceholderBot, POSE_GROUP_NAME } from './placeholderBot';
import { createFSM } from './fsm';
import { startTicker } from './motion';
import { createBlobShadow } from './shadow';
import { bodyColorForTheme, createScene, DEFAULT_GLOW_ACCENT } from './scene';
import type { BytePetHandle, PetOptions, PetState } from './types';

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
 * Mirrors `fsm.ts`'s own `DEFAULTS.peekMs` (1200ms). `createFSM()` below is
 * called with no config, so this is the FSM's real, effective value — but
 * `PetFSM` exposes no getter for it, so this constant documents the coupling
 * rather than reading it back at runtime. Used to time this module's own
 * `setBehind()` flip against the FSM's own peekMs-driven auto-exit.
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

  const fsm = createFSM();

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
  const liveTweens = new Set<Trackable>();
  function track<T extends Trackable>(tween: T): T {
    liveTweens.add(tween);
    return tween;
  }

  // `gsap.context(func, scope)` only builds a real, revertable `Context` when
  // called WITH a function (`func ? new Context(func, scope) : _context` —
  // gsap-core.js); called with zero arguments it just returns the current
  // *ambient* context (`undefined` here, outside any other context's own
  // callback), which has no `.revert()` at all. The empty callback below
  // exists purely so `ctx` is a genuine Context object for `destroy()` to
  // revert — confirmed by testing `destroy()` directly (see task-4 report).
  const ctx = gsap.context(() => {});
  const mm = gsap.matchMedia();

  let blinkTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let microTimer: ReturnType<typeof gsap.delayedCall> | null = null;
  let glanceTimer: ReturnType<typeof gsap.delayedCall> | null = null;
  let peekTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let firstIdleRoll = true;
  let reducedActive = false;
  let currentPeekRunner: () => void = () => {};

  // --- Cursor / anchor / idle-drift state ------------------------------------
  const cursorScreen = { x: -9999, y: -9999 };
  let cursorWorld = { x: 0, y: 0 };
  const drift = { x: 0, y: 0 };
  let glanceOverride: { x: number; y: number } | null = null;

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
      blinkTimeline?.kill();
      blinkTimeline = null;
    };
  }

  function setupReducedBranch(): (() => void) | void {
    reducedActive = true;
    blinkTimeline = buildBlink();
    currentPeekRunner = runPeekReduced;
    return () => {
      blinkTimeline?.kill();
      blinkTimeline = null;
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
    track(
      gsap.to(hintEl, { opacity: 0, duration: HINT_FADE_S, ease: 'power1.out', overwrite: true }),
    );
  }

  function maybeShowHint(): void {
    if (isHintPermanentlyDismissed()) {
      return;
    }
    track(
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
    peekTimeline?.kill();
    rig.play('Peek');
    const tl = track(gsap.timeline());
    tl.call(() => scene.setBehind(true), undefined, PEEK_BEHIND_ON_S);
    tl.call(() => scene.setBehind(false), undefined, PEEK_BEHIND_OFF_S);
    peekTimeline = tl;
  }

  /** Reduced-motion: "fade up/behind instead of a hop" — still `setBehind` (occlusion is a layer swap). */
  function runPeekReduced(): void {
    peekTimeline?.kill();
    themedMaterials().forEach((m) => {
      m.transparent = true;
    });

    const holdEnd = PEEK_MS / 1000 - PEEK_REDUCED_PHASE_S * 2 - 0.15;
    const tl = track(gsap.timeline());
    tl.call(() => scene.setBehind(true), undefined, 0);
    tl.to(
      drift,
      { y: PEEK_REDUCED_RISE_PX, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.out' },
      0,
    );
    tl.to(
      themedMaterials(),
      { opacity: PEEK_REDUCED_FADE_OPACITY, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.out' },
      0,
    );
    tl.call(() => scene.setBehind(false), undefined, holdEnd);
    tl.to(drift, { y: 0, duration: PEEK_REDUCED_PHASE_S, ease: 'power1.in' }, holdEnd);
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
  // module's job. Paused whenever the FSM leaves 'idle'; the first roll of
  // every idle period is forced to 'peek' so one always lands within the
  // first ~10 idle seconds (SPEC §6), satisfied by the 4–8s roll cadence
  // itself. Hop/slide (position/clip motion — the brief's "wander" category)
  // are excluded from the reduced pool: Hop is rig.ts's own clip, with no
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

  function pickMicroBehaviour(): MicroBehaviour {
    if (firstIdleRoll) {
      firstIdleRoll = false;
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
    glanceTimer?.kill();
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
    microTimer?.kill();
    microTimer = track(
      gsap.delayedCall(gsap.utils.random(MICRO_MIN_S, MICRO_MAX_S), rollMicroBehaviour),
    );
  }

  function pauseMicroScheduler(): void {
    microTimer?.kill();
    microTimer = null;
  }

  function enterIdleBehaviour(): void {
    rig.play('Idle');
    resumeBlink();
    firstIdleRoll = true;
    scheduleNextMicroBehaviour();
  }

  // --- FSM → choreography dispatch (brief 4d, "the idle brain") -------------------
  function dispatch(state: PetState): void {
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
      glanceTimer?.kill();
      glanceOverride = null;
    }
    if (state !== 'invited') {
      hideHint();
    }
    if (state !== 'curious') {
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
        rig.play('Sleep');
        break;
      case 'waking':
        rig.play('Wake');
        break;
      case 'dashing':
        // Minimal in T4 (R-T4-9) — the real dash-to-food + eat is T5.
        rig.play('Dash');
        break;
      default:
        // 'eating' | 'retyping' | 'traveling' | 'hidden' | 'entering' are not
        // reachable via the current FSM (fsm.ts never transitions into
        // them yet) — reserved for later tickets.
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

    const dist = Math.hypot(cursorScreen.x - anchorX, cursorScreen.y - anchorY);
    fsm.send(dist <= PROXIMITY_PX ? 'POINTER_NEAR' : 'POINTER_FAR');
    fsm.tickTimers(dt * 1000);

    rig.update(dt);
    const lookTarget = glanceOverride ?? cursorWorld;
    rig.setLook(lookTarget.x, lookTarget.y);

    // Root placement: feet land at the anchor's own vertical center minus
    // half the bot's height, so the assembled bot reads centered on the
    // headline anchor (the placeholder's origin is at its feet, not its
    // center — see placeholderBot.ts) plus any idle-drift offset.
    const rootX = anchorWorld.x + drift.x;
    const rootY = anchorWorld.y - unitPx / 2 + drift.y;
    rig.object3d.position.set(rootX, rootY, 0);

    // Shadow stays pinned to the ground (the root's own resting position) —
    // hops/peeks/etc. only change its scale/opacity via the pose group's
    // live hover height, never its own position.
    shadow.mesh.position.set(rootX, rootY, 0);
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
    // Unused in T4 — the dash-to-food + eat glyph payload is T5 (see
    // BytePetHandle.feed's doc comment); mirrors rig.ts's own `void dt;`
    // idiom for an intentionally-unused, forward-compatible parameter.
    void x;
    void y;
    fsm.send('FEED');
    markHintPermanentlyDismissed();
  }

  function setTheme(t: Theme): void {
    applyTheme(t);
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

    liveTweens.forEach((tween) => tween.kill());
    liveTweens.clear();
    blinkTimeline?.kill();
    blinkTimeline = null;
    microTimer?.kill();
    microTimer = null;
    glanceTimer?.kill();
    glanceTimer = null;
    peekTimeline?.kill();
    peekTimeline = null;

    mm.revert();
    ctx.revert();

    hintEl.remove();

    rig.dispose();
    shadow.dispose();
    scene.dispose();
  }

  return { feed, setTheme, destroy };
}
