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
import { pickAnchor } from './anchor';
import { createFeeder } from './feed';
import { startTicker } from './motion';
import { createBlobShadow } from './shadow';
import { bodyColorForTheme, createScene, DEFAULT_GLOW_ACCENT } from './scene';
import { createRetype, renderRetype } from './retype';
import { announcePhrase } from './a11y';
import { silentSoundEngine, type SoundEngine } from './sound/SoundEngine';
import type { Phrase } from '../phrases';
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
 * T6 retype reward (SPEC §6 "Byte operates the caret"). `RETYPE_FOLLOW_*`
 * time the per-frame `quickTo` glide of Byte's root to the live caret world
 * position; `SPARK_*` size the minimal per-edit caret "spark" (a cheap
 * box-shadow glow pulse — SPEC §18 explicitly sanctions tuning this at the
 * "small spark links Byte↔caret" level during T6; a fuller 3D streak is
 * deferrable polish). All hand-picked, free to retune.
 */
const RETYPE_FOLLOW_DURATION_S = 0.18;
const SPARK_DURATION_S = 0.06;
const SPARK_BLUR_PX = 8;
const SPARK_SPREAD_PX = 2;
/**
 * T7 (R7-6): ONE shared throttle for the caret spark AND the `typeTick` cue.
 * The retype/entrance driver detects an edit roughly once per typed character;
 * firing the spark + tick on every Nth detected edit (rather than ~1/char)
 * keeps both the glow pulse and the sound from machine-gunning. `3` sits in the
 * ticket's "every 2–3 edits" band; free to retune.
 */
const TYPE_TICK_EVERY = 3;

/**
 * T6b entrance drop-in (SPEC §8.1, full motion only). Byte falls from
 * `ENTRANCE_DROP_UNITS` bot-heights above the type-start anchor to it with a
 * `bounce.out` ease over `ENTRANCE_DROP_DURATION_S`, its body scaling up from
 * `ENTRANCE_SCALE_FROM` to 1 over the same beat. `ENTRANCE_DROP_UNITS` is a
 * multiple of `unitPx` (the bot's own unit height) rather than a fixed px —
 * mirroring how the shadow/peek code scales its px targets by `unitPx` inline
 * — so the drop reads the same at any headline size. All hand-picked, free to
 * retune (same spirit as the `RETYPE_*`/`PEEK_*` constants above).
 */
const ENTRANCE_DROP_UNITS = 2;
const ENTRANCE_DROP_DURATION_S = 0.7;
const ENTRANCE_SCALE_FROM = 0.6;

/**
 * T8 migration (SPEC §6 "traveling & footer migration"; TICKETS T8
 * "right-margin travel lane following scroll"). Exactly TWO homes, so
 * migration is unambiguous: when the ACTIVE home's own text-end anchor
 * scrolls out of the comfortable on-screen band (`MIGRATE_BAND_*` below),
 * Byte starts traveling the right-margin lane — see `runMigrationFull`/
 * `runMigrationReduced` (declared just above `onTick`) for the full state
 * machine. All hand-picked, free to retune visually — same spirit as the
 * `PEEK_*`/`RETYPE_*`/`ENTRANCE_*` constants above.
 *
 * REVERSIBLE by design (fix round 1): while `traveling`, both the lane
 * point and the arrival decision are driven every tick by the LIVE
 * `pickAnchor` result, never a target captured once when `MIGRATE` fired.
 * A visitor who leaves the hero's band (triggering `MIGRATE`) and then
 * scrolls back up before the footer ever enters the band simply keeps
 * seeing `pickAnchor` favor the hero, so the lane point and the arrival
 * check both stay pinned there — Byte can never be stranded in the lane;
 * it always re-homes onto whichever block is actually in view.
 */
/** The RESTING subset of `HOME_STATES` eligible to trigger a `MIGRATE` —
 *  mirrors the FSM's own idle/curious/invited MIGRATE-accepting cases
 *  (fsm.ts) exactly. Deliberately excludes peeking/sleeping/waking (also
 *  `HOME_STATES`): those settle back to `idle` on their own first, where
 *  the trigger re-evaluates fresh — the `wasActiveInBand` re-arm in
 *  `enterIdleBehaviour` (below) is the same "re-check on return to idle"
 *  idiom `wasNear` already uses. */
const MIGRATE_ELIGIBLE_STATES: ReadonlySet<PetState> = new Set<PetState>([
  'idle',
  'curious',
  'invited',
]);
/** The comfortable on-screen band (viewport px, inset from each edge) an
 *  anchor must sit inside to count as "home" for migration purposes —
 *  tighter than the full `[0, innerHeight]` viewport so a migration
 *  triggers/arrives a little before/after the text is fully at the
 *  bleeding edge of the fold, not exactly at it. */
const MIGRATE_BAND_TOP_PX = 96;
const MIGRATE_BAND_BOTTOM_PX = 96;
/** Right-margin lane: how far right of the migration target's own text-end
 *  the lane sits, and how close to the viewport's right edge it may
 *  approach on a narrow viewport (so Byte never travels fully off-screen).
 *  Fixed viewport-scale px, NOT `unitPx`-scaled — this is screen-edge
 *  geometry, not headline type size (same reasoning as `PROXIMITY_PX`). */
const MIGRATE_LANE_GAP_PX = 48;
const MIGRATE_LANE_MARGIN_PX = 56;
/** Per-tick ease duration for the lane-follow `quickTo` pair
 *  (`byteToLaneX/Y`) — slower than `RETYPE_FOLLOW_DURATION_S` since this
 *  trails a multi-second scroll, not a snappy per-character caret chase. */
const MIGRATE_LANE_FOLLOW_DURATION_S = 0.5;
/** World-px "close enough" distance between Byte and the lane point — one
 *  of two independent conditions (with the live pick's own band
 *  membership) `runMigrationFull` requires before calling
 *  `setHomeAnchor`. `pickAnchor` itself is no longer a separate THIRD
 *  condition here (fix round 1): since the lane point IS the live pick's
 *  own anchor, the two are the same thing by construction. */
const MIGRATE_ARRIVE_DIST_PX = 40;

/**
 * T8 task 5 "happy 360° spin" — the ONLY reward for a feed that begins while
 * `traveling` (SPEC §6: no retype for a trip-feed — fsm.ts's own
 * `feedFromTraveling` fork already routes `eating --ATE--> traveling`
 * instead of `retyping` for that edge). `SPIN_DURATION_S`/`SPIN_EASE` tune
 * the one-full-turn `rig.object3d.rotation.y` tween `playHappySpin()`
 * (declared just above `dispatch`, below) plays on that edge only — hand-
 * picked, free to retune visually, same spirit as every other tunable in
 * this section.
 */
const SPIN_DURATION_S = 0.6;
const SPIN_EASE = 'back.out(1.4)';

/**
 * T8 ("theme reaction" ticket): `setTheme`'s full-motion crossfade. Byte's
 * Body colour lerps `bodyColorForTheme(prev)` -> `bodyColorForTheme(next)`
 * and the dark phosphor Glow's emissive intensity lerps alongside it, both
 * over `THEME_LERP_DURATION_S` — matching `scene.ts`'s own light lerp
 * (`scene.setTheme(t, THEME_LERP_DURATION_S)`, SPEC §11 "material/light
 * state per theme lerps on toggle"), so lights and Body/Glow crossfade in
 * lockstep. `THEME_STRETCH_*` size the accompanying full-height
 * squash-and-stretch (`playThemeStretch`, below) — a MULTIPLIER of `unitPx`
 * applied to the ROOT's `scale.y` only (x/z stay at `unitPx`), mirroring
 * `feed.ts`'s `SATISFIED_WIGGLE_SCALE` exactly (`rig.object3d.scale` rests
 * at `unitPx` on every axis; nothing else writes it outside a transient
 * pulse like this one or `playSatisfiedWiggle`). Both the lerp and the
 * stretch are skipped entirely under `reducedActive` (R-T4-7) — reduced
 * motion sets the theme instantly, with no lerp and no stretch. Hand-picked,
 * free to retune visually — same spirit as every other tunable in this
 * section.
 */
const THEME_LERP_DURATION_S = 0.4;
const THEME_STRETCH_SCALE = 1.18;
const THEME_STRETCH_UP_DURATION_S = 0.14;
const THEME_STRETCH_DOWN_DURATION_S = 0.21;

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
  /**
   * T8 Style Lab wiring (SPEC §7 "preview & lock variants live" / §11):
   * per-instance state for the CURRENT dark-mode phosphor Glow accent,
   * defaulting to `DEFAULT_GLOW_ACCENT` (scene.ts) until the public
   * `setGlowAccent()` handle method (below) overrides it — `main.ts` drives
   * that from the Style Lab's `data-glow` axis. A per-instance `let` (NOT
   * module scope) is all that's needed here: both of `applyTheme`'s
   * `rig.setGlow` call sites (the instant + animate branches, below) and
   * `setGlowAccent` itself are already inside THIS SAME `createBytePet`
   * closure, so they read the same live value regardless of where in the
   * closure it's declared. Module scope would instead leak a lab-selected
   * accent across separate `createBytePet()` instances — and survive a
   * `destroy()` + recreate, handing a brand-new Byte a stale accent from
   * whichever instance set it last — a latent factory bug this per-instance
   * placement avoids (no observable difference today, with exactly one
   * Byte on the page). A lab-selected accent still survives every
   * subsequent theme toggle, since nothing here ever resets it back to the
   * default.
   */
  let currentGlowAccent: THREE.ColorRepresentation = DEFAULT_GLOW_ACCENT;
  // T7 sound seam (R7-1): every cue this module or its feeder fires goes through
  // this one `SoundEngine`. Defaults to the exported `silentSoundEngine` no-op
  // when `main.ts` injects no engine, so all `sound.play(...)` calls become
  // no-ops and behaviour stays byte-identical to before sound existed. Only the
  // `SoundEngine` interface is ever referenced here — never a concrete engine.
  const sound: SoundEngine = opts.sound ?? silentSoundEngine;

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

  // `initialState: 'hidden'` (T6b entrance) starts Byte in the construction
  // mode `enterAndType()` reveals + drops in from; omitting the entrance keeps
  // the FSM starting `idle`, byte-for-byte as before.
  const fsm = createFSM({ peekMs: PEEK_MS, initialState: opts.entrance ? 'hidden' : 'idle' });

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
    sound,
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

  // --- Active home model: anchor + caret + lines + phrase cycle (T6/T8) -----
  // Byte's "home" is generalized (T8) from the single hero headline to a
  // SWITCHABLE record: an anchor element, its OWN DOM caret, its OWN
  // `data-byte-line` line spans, and its OWN phrase cycle + index.
  // `buildHome` runs the SAME per-home setup (line tagging R-T6a-3 + caret
  // seed) for the hero AND the footer — ONE caret/tag path, never forked —
  // and `setHomeAnchor` (below) switches which home is active. Each home
  // independently remembers its cycle position, so hero and footer keep
  // separate `phraseIndex`es.
  interface Home {
    el: HTMLElement;
    caret: HTMLElement;
    lines: HTMLElement[];
    cycle: readonly Phrase[];
    phraseIndex: number;
  }

  /** The caret's rest transform for home `el` — parked at the end of the
   *  bottom line's text in `el`-relative coords (bounding-rect deltas, immune
   *  to any positioned ancestor between the anchor glyph and `el`). Shared by
   *  `buildHome`'s seed and the per-tick rest write in `onTick`, so the two
   *  can never drift. `el` MUST be the caret's offsetParent (both
   *  `.hero__headline` and `.footer__headline` are `position: relative`) so the
   *  caret's `top:0/left:0` base sits at `el`'s own top-left. */
  function caretRestTransform(el: HTMLElement, lineRect: DOMRect): string {
    const headlineRect = el.getBoundingClientRect();
    return `translate(${lineRect.right - headlineRect.left}px, ${
      lineRect.top - headlineRect.top
    }px)`;
  }

  /**
   * Builds a `Home` from an anchor `el` + its phrase `cycle`, running the
   * per-home retype setup that used to be hero-only:
   *  - tag the first two child line spans `data-byte-line="0|1"` (R-T6a-3 — by
   *    ATTRIBUTE, never a page CSS class, keeping `pet/` portable — so the tags
   *    travel with the spans through the hero's/footer's SplitText line-reveal
   *    which wraps them, and survive its revert). Runs synchronously here, at
   *    construction, BEFORE either reveal's SplitText runs (the hero reveal is
   *    deferred to `whenFontsSettled()`; the footer reveal is deferred a frame
   *    in `page/footer.ts` for exactly this reason), so it always tags the
   *    ORIGINAL `.hero__line`/`.footer__line` spans;
   *  - create the SEED caret (`class="byte-caret"` for CSS dims/color +
   *    `data-byte-caret` for the reduced-motion blink opt-back-in and the
   *    `liveCaret` re-find) appended as a DIRECT child of `el`, moved by
   *    `transform` WRITES only (never inserted in flow) so it can never reflow
   *    `el` (CLS 0);
   *  - seed the caret at its rest position immediately so it never flashes at
   *    `el`'s top-left for the ≤1 frame before the first `onTick` positions it.
   */
  function buildHome(el: HTMLElement, cycle: readonly Phrase[]): Home {
    const lines = Array.from(el.children).slice(0, 2) as HTMLElement[];
    lines.forEach((lineEl, i) => lineEl.setAttribute('data-byte-line', String(i)));

    const caret = document.createElement('span');
    caret.className = 'byte-caret';
    caret.setAttribute('data-byte-caret', '');
    caret.setAttribute('aria-hidden', 'true');
    el.appendChild(caret);
    caret.style.transform = caretRestTransform(el, lastLineTextRect(el));

    return { el, caret, lines, cycle, phraseIndex: 0 };
  }

  // Always build the HERO home. Build the FOOTER home only when BOTH
  // `footerEl` and `footerPhrases` are supplied (§6). `activeHome` starts as
  // the hero — the entrance always boots hero-active, byte-identical to before.
  const heroHome = buildHome(opts.headlineEl, opts.phrases ?? []);
  const footerHome: Home | null =
    opts.footerEl && opts.footerPhrases ? buildHome(opts.footerEl, opts.footerPhrases) : null;
  let activeHome: Home = heroHome;

  /**
   * The LIVE caret node for `home`. That home's SplitText line-reveal (+ its
   * revert) can REPLACE its children with clones that keep the `data-byte-*`
   * attributes but ORPHAN the init-captured seed `home.caret`. So resolve the
   * caret by attribute (scoped to `home.el`) at every runtime point of use
   * (symmetric with how `renderRetype` re-queries `[data-byte-line]` live),
   * re-appending the home's seed caret only if none is currently in `home.el`.
   */
  function liveCaret(home: Home): HTMLElement {
    const found = home.el.querySelector<HTMLElement>('[data-byte-caret]');
    if (found) {
      return found;
    }
    home.el.appendChild(home.caret);
    return home.caret;
  }

  /** The two line texts currently shown in `home`, resolved LIVE by attribute
   *  (so a SplitText clone-swap or a footer revert never returns stale text).
   *  Used to seed / re-seed the retype engine so its next schedule deletes what
   *  is actually on-screen. */
  function currentTextOf(home: Home): [string, string] {
    const l0 = home.el.querySelector<HTMLElement>('[data-byte-line="0"]');
    const l1 = home.el.querySelector<HTMLElement>('[data-byte-line="1"]');
    return [l0?.textContent ?? '', l1?.textContent ?? ''];
  }

  /** Show/hide a home's caret via a STYLE toggle only. Uses `visibility` — NOT
   *  `opacity` (the caret's CSS blink keyframe animates opacity and would
   *  override an inline `opacity: 0`, so a "hidden" caret would still blink
   *  into view) and NOT the `data-byte-caret` attribute (the engine +
   *  `liveCaret` resolve carets by it). Resolves the LIVE caret so a SplitText
   *  clone-swap is covered; the caret is absolutely positioned, so toggling
   *  visibility never reflows (CLS 0), and `visibility: hidden` leaves no ghost
   *  (the blink still runs when shown). */
  function setCaretVisible(home: Home, visible: boolean): void {
    liveCaret(home).style.visibility = visible ? '' : 'hidden';
  }

  // R8-1 / SPEC §6 "a blinking DOM caret remains in the headline" — exactly ONE
  // visible caret, at Byte's ACTIVE home. The hero (active at boot) shows its
  // caret; any inactive home (the footer) hides its own until `setHomeAnchor`
  // switches to it. Hiding the footer's seed HERE, before its deferred
  // SplitText split (page/footer.ts), means the `visibility: hidden` is
  // captured in the split's innerHTML snapshot and survives the revert, so the
  // restored clone stays hidden too — no second byte-caret ever blinks at rest.
  setCaretVisible(heroHome, true);
  if (footerHome) {
    setCaretVisible(footerHome, false);
  }

  // --- Retype reward: the ONE pure engine (T6, reused for BOTH homes) -------
  // A SINGLE `createRetype` instance drives every retype — hero AND footer
  // (carry-forward #1: one typing path, one caret path). `setHomeAnchor`
  // re-seeds it to the new home's on-screen text; `activeHome.cycle[phraseIndex]`
  // is the phrase currently shown (`cycle[0]` == that home's static headline #1).
  // The engine is pure (retype.ts) — inject `Math.random` for the typed jitter,
  // seed `initial` with the hero's shown phrase so the first schedule deletes
  // from the right text.
  const retype = createRetype({
    initial: heroHome.cycle[0] ?? currentTextOf(heroHome),
    random: Math.random,
  });
  // Whether a FULL-motion retype is being driven per-tick in `onTick` (false
  // under reduced motion, where the retype is an instant text set instead).
  let retypeActive = false;
  // Free-running ms clock the engine's `step()` reads during a full retype —
  // accumulated every tick (below); the engine re-anchors it on each enqueue.
  let retypeClockMs = 0;
  // Edit detector for the per-edit spark + typeTick throttle: the previous
  // frame's total char count. `-1` so the first observed frame differs. The
  // stray first frame after an entrance re-arm has `total === 0` and is now
  // explicitly suppressed in the driver below, so it no longer sparks/ticks.
  let lastRetypeTotal = -1;
  // T7 (R7-6): monotonic count of REAL typing edits (char total changed, and
  // the frame is neither empty nor reduced-motion) the retype/entrance driver
  // has seen. The ONE shared spark+typeTick throttle emits every
  // `TYPE_TICK_EVERY`th such edit — see the driver's per-edit block.
  let typeEditCount = 0;

  // --- Entrance (T6b) --------------------------------------------------------
  // The `enterAndType()` Promise's resolver, held while the entrance is in
  // flight and cleared by the one-shot completion detector (entering→idle) or
  // `destroy()`. `null` whenever no entrance is running. The entrance reuses
  // the retype engine + the `onTick` retype-driver above to live-type phrase
  // #1 — there is no second typing path.
  let entranceResolve: (() => void) | null = null;

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

  /** Schedules `fn` for gsap's NEXT ticker pass (mirrors `feed.ts`'s helper of
   *  the same name) — never a synchronous `fsm.send()` inside an `onEnter`
   *  dispatch, which would recurse through the listener loop mid-transition. */
  function fireOnNextTick(fn: () => void): void {
    track(gsap.delayedCall(0, fn));
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
  /** T8 task 5's happy-spin tween (`playHappySpin`, declared just above
   *  `dispatch` below) — a named slot mirroring `dashTween`/`eatTween`/
   *  `reacquireTween` so a hypothetical rapid re-entry into `traveling` from
   *  `eating` can defensively kill a still-in-flight predecessor before
   *  starting a fresh one (in practice a full dash+eat cycle is always
   *  slower than this spin's own duration, so the two should never actually
   *  overlap — belt-and-suspenders, same reasoning as those three). */
  let spinTween: ReturnType<typeof gsap.to> | null = null;
  /** T8 "theme reaction" — the Body-colour/Glow-intensity crossfade tween (`applyTheme`'s
   *  animate path, below). Named (not just `liveTweens` membership) so a rapid re-toggle
   *  kills the previous lerp before starting a fresh one — the codebase's usual
   *  kill-before-restart idiom, mirroring `scene.ts`'s own `themeTween` for the light lerp. */
  let themeLerpTween: ReturnType<typeof gsap.to> | null = null;
  /** T8 "theme reaction" — the full-height squash-and-stretch pulse (`playThemeStretch`,
   *  below). Named for the same kill-before-restart reason as `themeLerpTween`. */
  let themeStretchTween: ReturnType<typeof gsap.timeline> | null = null;
  // Per-frame Byte→caret follow (T6): `quickTo` so the per-tick target update
  // during a retype reuses ONE tween per axis instead of spawning a fresh
  // tween each frame (CLAUDE.md GSAP conventions). Created once here; drives
  // `rig.object3d.position` ONLY while `retyping` (nothing else pins the root
  // then — `retyping` isn't a HOME_STATE). NOT in `liveTweens` (quickTo owns
  // its own reused tween) — `destroy()` kills it via `gsap.killTweensOf`.
  const byteToCaretX = gsap.quickTo(rig.object3d.position, 'x', {
    duration: RETYPE_FOLLOW_DURATION_S,
    ease: 'power2',
  });
  const byteToCaretY = gsap.quickTo(rig.object3d.position, 'y', {
    duration: RETYPE_FOLLOW_DURATION_S,
    ease: 'power2',
  });
  // T8 migration lane-follow (mirrors byteToCaretX/Y exactly, same
  // reasoning): a dedicated quickTo pair, created ONCE here (not per-trip).
  // Drives `rig.object3d.position` ONLY while `traveling`
  // (`runMigrationFull`, below) — nothing else pins the root then,
  // `traveling` isn't a HOME_STATE. Unlike `byteToCaretX/Y`'s own
  // end-of-retype handoff (which relies solely on tween-creation-order —
  // see its doc comment above), `runMigrationFull`'s arrival branch
  // (fix round 1, hardening) EXPLICITLY `gsap.killTweensOf`s
  // `rig.object3d.position` before handing off to the reacquire glide, so
  // this pair's own in-flight ease can never still be writing the SAME
  // tick that glide starts. Confirmed (empirically, against the installed
  // gsap version) that killing a `quickTo`'s underlying tween this way
  // does NOT break its returned setter for a LATER migration — `resetTo()`
  // re-attaches a killed tween to the root timeline on its next call.
  // Also covered by `destroy()`'s existing
  // `gsap.killTweensOf(rig.object3d.position)`.
  const byteToLaneX = gsap.quickTo(rig.object3d.position, 'x', {
    duration: MIGRATE_LANE_FOLLOW_DURATION_S,
    ease: 'power2',
  });
  const byteToLaneY = gsap.quickTo(rig.object3d.position, 'y', {
    duration: MIGRATE_LANE_FOLLOW_DURATION_S,
    ease: 'power2',
  });
  // The per-edit caret spark. One shared proxy + a single named slot (mirrors
  // `hintTween`): each edit kills+restarts the same tween via `killTracked`,
  // so overlapping edits never accumulate competing box-shadow writers.
  const sparkProxy = { v: 0 };
  let sparkTween: ReturnType<typeof gsap.to> | null = null;
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
  // T8 migration (SPEC §6): edge-triggered "was the ACTIVE home's own
  // anchor inside the comfortable on-screen migration band last tick" —
  // mirrors wasNear/wasHome exactly. `runMigrationFull`/`runMigrationReduced`
  // (declared just above `onTick`) fire `MIGRATE` only on the true->false
  // crossing, and only while Byte is resting (idle/curious/invited), so a
  // scroll that merely keeps the active home out of band doesn't re-fire
  // every tick. Re-armed to `true` in `enterIdleBehaviour()` (the same
  // I-1-style fix `wasNear` uses) so a home that left band DURING an
  // interrupting dashing/eating/traveling span is still detected as a
  // fresh "leaving" edge the moment idle resumes, rather than being
  // silently stranded off-screen forever. Starts `true`: Byte boots home,
  // on-screen (mirrors `wasHome`'s own starting assumption).
  let wasActiveInBand = true;

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

  /**
   * T8 "theme reaction": full-height squash-and-stretch pulse on the ROOT's
   * `scale.y` only (x/z stay at `unitPx` — see `THEME_STRETCH_*`'s doc
   * comment). Deliberately the ROOT (`rig.object3d`), never the clip-owned
   * `pose` node, so this can never fight an active clip — `rig.play()` only
   * ever touches `pose` (see the module doc comment's "Root vs. pose split"
   * reference), and the dash tween (`feed.ts`) only ever touches `position`/
   * `rotation.z` on the root, never `scale`. `overwrite: 'auto'` guards the
   * one OTHER tween that also pulses ROOT scale — `feed.ts`'s
   * `playSatisfiedWiggle`, private to that module's own `liveTweens`
   * registry and so not reachable/killable by name from here — so a
   * same-instant race between the two can't strand `scale.y` off `unitPx`.
   */
  function playThemeStretch(): void {
    themeStretchTween = killTracked(themeStretchTween);
    const peak = unitPx * THEME_STRETCH_SCALE;
    const tl = gsap.timeline({
      onComplete: () => {
        themeStretchTween = null;
      },
    });
    tl.to(rig.object3d.scale, {
      y: peak,
      duration: THEME_STRETCH_UP_DURATION_S,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    tl.to(rig.object3d.scale, {
      y: unitPx,
      duration: THEME_STRETCH_DOWN_DURATION_S,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
    themeStretchTween = track(tl);
  }

  /**
   * Re-themes the scene + rig (R-T4-5). `opts.animate` (set by the public
   * `setTheme` wrapper, below) requests the ~400ms crossfade + Byte's
   * stretch; construction (`applyTheme(theme, { animate: false })`, further
   * down) always takes the instant path, and `reducedActive` forces it too
   * regardless of what the caller asked for (R-T4-7 — reduced motion sets
   * the theme instantly, with no lerp and no stretch).
   */
  function applyTheme(t: Theme, opts: { animate?: boolean } = {}): void {
    const prevTheme = theme;
    const animate = (opts.animate ?? false) && !reducedActive;
    theme = t;

    themeLerpTween = killTracked(themeLerpTween);

    if (!animate) {
      // Belt-and-suspenders: undo any in-flight stretch left mid-pulse by a
      // PRIOR animated toggle (e.g. reduced-motion flipping on live, mid-
      // stretch) so the instant path really does leave `scale.y` at exactly
      // `unitPx`, never a stray interpolated value — "no stretch" means none
      // lingers either.
      themeStretchTween = killTracked(themeStretchTween);
      rig.object3d.scale.y = unitPx;

      scene.setTheme(t, 0);
      rig.setGlow(t === 'dark', currentGlowAccent);
      setDimmed(fsm.state() === 'sleeping');
      return;
    }

    scene.setTheme(t, THEME_LERP_DURATION_S);

    const fromBody = bodyColorForTheme(prevTheme);
    const toBody = bodyColorForTheme(t);

    // Snapshot the Glow's CURRENT emissive intensity as the lerp's start
    // value, then call `rig.setGlow` itself (instant) purely to read the
    // intensity it jumps to as the lerp's target — this decouples this
    // module from rig.ts's own private `GLOW_ON_INTENSITY` constant, which
    // isn't exported. `rig.setGlow` also sets the emissive accent color
    // here (constant across a single theme lerp — `currentGlowAccent`, T8's
    // lab-switchable accent, defaulting to `DEFAULT_GLOW_ACCENT` — so it
    // needs no lerp of its own); restoring `emissiveIntensity` to the start
    // value right after undoes only the instant intensity jump, so the
    // tween below can ease between the two.
    const fromGlowIntensity = source.glow?.emissiveIntensity ?? 0;
    rig.setGlow(t === 'dark', currentGlowAccent);
    const toGlowIntensity = source.glow?.emissiveIntensity ?? 0;
    if (source.glow) {
      source.glow.emissiveIntensity = fromGlowIntensity;
    }

    const proxy = { p: 0 };
    themeLerpTween = track(
      gsap.to(proxy, {
        p: 1,
        duration: THEME_LERP_DURATION_S,
        ease: 'power2.inOut',
        onUpdate: () => {
          rig.setBodyColor(new THREE.Color(fromBody).lerp(new THREE.Color(toBody), proxy.p));
          if (source.glow) {
            source.glow.emissiveIntensity =
              fromGlowIntensity + (toGlowIntensity - fromGlowIntensity) * proxy.p;
          }
        },
        onComplete: () => {
          themeLerpTween = null;
          // Re-apply the sleeping dim on top of the now-settled theme body
          // color, exactly as the instant path's own `setDimmed` call does.
          setDimmed(fsm.state() === 'sleeping');
        },
      }),
    );

    playThemeStretch();
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
    // T8: the same I-1-style re-arm for the migration band edge. Without
    // this, the active home leaving the band DURING an interrupting
    // dashing/eating/traveling span would already be reflected in
    // `wasActiveInBand` by the time idle resumes, silently swallowing the
    // edge — Byte would stay stranded at an off-screen home. Resetting to
    // `true` means the very next tick treats a currently-out-of-band home
    // as a fresh "leaving" edge and migrates immediately; a currently-
    // in-band home still triggers nothing.
    wasActiveInBand = true;
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

  // --- Retype reward: caret spark + the retyping-entry driver (T6) ----------
  /**
   * A minimal per-edit "spark" linking Byte→caret (SPEC §6): a quick
   * box-shadow glow pulse on the caret. Deliberately NOT a `transform`/scale
   * tween — `renderRetype` and the rest-position write already own the
   * caret's `transform`, and the CSS blink owns its `opacity`; box-shadow
   * (driven off a numeric proxy so the accent stays a live `var()`) is the
   * one channel nothing else writes. Skipped under reduced motion.
   */
  function sparkAtCaret(): void {
    if (reducedActive) {
      return;
    }
    // Resolve the active home's live caret once for this pulse (a spark only
    // fires mid-edit, long after any load-time clone-swap has settled).
    const caret = liveCaret(activeHome);
    sparkTween = killTracked(sparkTween);
    sparkProxy.v = 0;
    sparkTween = track(
      gsap.to(sparkProxy, {
        v: 1,
        duration: SPARK_DURATION_S,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onUpdate: () => {
          caret.style.boxShadow = `0 0 ${SPARK_BLUR_PX * sparkProxy.v}px ${
            SPARK_SPREAD_PX * sparkProxy.v
          }px var(--accent)`;
        },
        onComplete: () => {
          sparkTween = null;
          caret.style.boxShadow = '';
        },
      }),
    );
  }

  /**
   * `retyping` entry (T6): retype the headline into the NEXT phrase in the
   * cycle. Three paths, each firing `RETYPED` promptly so the FSM's
   * retyping→idle drains without waiting on its 4s `retypeMs` safety cap (the
   * feeder's queue-drain only runs on idle entry):
   *  - No cycle / a single phrase → nothing to retype into: beat straight
   *    through to `RETYPED` next tick (pass-through).
   *  - Reduced motion (SPEC §12) → an INSTANT text set, no Byte glide, no
   *    spark: enqueue, then drive the engine to completion with TWO `step()`s
   *    — the first anchors the schedule's clock (elapsed 0), the second, well
   *    past the schedule end, settles it and advances its `current` (see
   *    retype.ts's `step` + retype.test.ts's own two-call completion). Render
   *    the final frame, then fire `RETYPED` next tick. The caret's CSS blink
   *    stays (global.css).
   *  - Full motion → enqueue and flip `retypeActive`; `onTick` drives it
   *    per-frame and fires `RETYPED` on engine completion.
   */
  function handleEnterRetyping(): void {
    // Drive the ACTIVE home's retype (hero or footer — same engine, same
    // path). Each home advances its own `phraseIndex`.
    const home = activeHome;
    if (home.cycle.length < 2) {
      fireOnNextTick(() => fsm.send('RETYPED'));
      return;
    }

    home.phraseIndex = (home.phraseIndex + 1) % home.cycle.length;
    const next = home.cycle[home.phraseIndex];

    // SPEC §12: announce the retyped phrase to a throttled polite live region.
    // Placed here (not the entrance) so hero + footer, full + reduced all announce
    // through this one seam; the entrance types `entering` (never handleEnterRetyping),
    // and its phrase #1 is already the static headline the SR read on load.
    announcePhrase(next.join(' '));

    if (reducedActive) {
      retype.enqueue(next);
      retype.step(0);
      const finalFrame = retype.step(Number.MAX_SAFE_INTEGER);
      if (finalFrame) {
        renderRetype(finalFrame, home.el, liveCaret(home));
      }
      fireOnNextTick(() => fsm.send('RETYPED'));
      return;
    }

    retype.enqueue(next);
    retypeActive = true;
  }

  // --- T8 task 5: feed-while-traveling happy spin ----------------------------
  /**
   * Plays once, on the `eating`->`traveling` edge only (a feed that began
   * mid-trip; fsm.ts's `feedFromTraveling` fork) — see `dispatch`'s
   * `'traveling'` case for the `prev === 'eating'` gate that calls this.
   * Never fires for a MIGRATE-driven entry into `traveling` from a home
   * state. Skipped outright under `reducedActive` (no spin a reduced-motion
   * user can't stop, matching every other full-motion-only beat in this
   * module). A full turn of `rig.object3d.rotation.y` — a channel nothing
   * else ever writes: `rig.ts`'s look system drives `source.eye.rotation`
   * (a different node, yaw+pitch for the eyes), and the dash bank
   * (`feed.ts`) / curious lean (`applyCuriousLean`) both live on
   * `rotation.z` — so this can never fight another writer. Hard-resets to
   * exactly 0 on completion (rather than leaving it at the tweened '+=2π'
   * value) so repeated spins never accumulate float drift.
   */
  function playHappySpin(): void {
    spinTween = killTracked(spinTween);
    if (reducedActive) {
      return;
    }
    const root = rig.object3d;
    spinTween = track(
      gsap.to(root.rotation, {
        y: `+=${Math.PI * 2}`,
        duration: SPIN_DURATION_S,
        ease: SPIN_EASE,
        onComplete: () => {
          spinTween = null;
          root.rotation.y = 0;
        },
      }),
    );
  }

  // --- FSM → choreography dispatch (brief 4d, "the idle brain") -------------------
  function dispatch(state: PetState, prev: PetState): void {
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
        // T7 (R7-2): chirp on peek only (wakeBoing owns wake). A discrete cue —
        // fires in BOTH motion modes; the engine alone gates it.
        sound.play('chirp');
        currentPeekRunner();
        break;
      case 'sleeping':
        playUnlessReduced('Sleep');
        break;
      case 'waking':
        playUnlessReduced('Wake');
        // T7 (R7-2): wakeBoing owns the startled wake. A discrete cue — fires in
        // BOTH motion modes (unlike `playUnlessReduced`, which is full-only).
        sound.play('wakeBoing');
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
      case 'retyping':
        // T6: drive the headline retype into the next phrase (full-motion
        // path continues per-tick in `onTick`; reduced-motion is an instant
        // set here). Fires `RETYPED` on completion to advance the FSM.
        handleEnterRetyping();
        break;
      case 'traveling':
        // T8 final review, finding 1: kill any still-in-flight `onTick`
        // "no-snap reacquire" glide (R-T5-6) the instant `traveling` is
        // (re-)entered — mirrors the defensive kill the `dashing`/`eating`
        // cases run just above, for the same single-writer reason. A
        // reacquire glide (`REACQUIRE_DURATION_S` = 0.3s) can still be in
        // flight here: it starts the moment Byte lands back in a HOME
        // state (e.g. right after `ATE`, or right after a PRIOR
        // migration's own `ARRIVED`), and a fast scroll can re-fire
        // `MIGRATE` within that same window — either the first migration
        // out of that home, or, since `ARRIVED` re-enters `idle` and
        // `enterIdleBehaviour` re-arms `wasActiveInBand`, a near-immediate
        // reversal back out. Without this kill, that lingering glide and
        // `runMigrationFull`'s own lane `quickTo` (`byteToLaneX/Y`, below)
        // would both write `rig.object3d.position` on the same frame.
        // Safe/idempotent when there's nothing to kill (the common case)
        // — `killTracked(null)` is a no-op.
        reacquireTween = killTracked(reacquireTween);
        // T8 migration: beyond the shared per-state resets above
        // (`setBehind(false)`, pause the micro scheduler + clear any
        // glance, hide the hint, clear the curious lean), Byte just keeps
        // blinking while it travels. The lane `quickTo` (`byteToLaneX/Y`)
        // is the sole writer of `rig.object3d.position` for this state,
        // driven per-tick from `onTick`'s `runMigrationFull` off the LIVE
        // `pickAnchor` result (never a target decided once on entry) —
        // that's what makes a mid-trip reversal turn Byte around instead
        // of stranding it in the lane.
        //
        // T8 task 5: the ONE exception — entering `traveling` FROM
        // `eating` (a feed that began mid-trip; fsm.ts's
        // `feedFromTraveling` fork) is the happy-spin reward, no retype.
        // A MIGRATE-driven entry into `traveling` from a home state
        // (`prev` is idle/curious/invited) must NOT spin.
        if (prev === 'eating') {
          playHappySpin();
        }
        break;
      case 'hidden':
      case 'entering':
        // T6b entrance beats — deliberate no-ops beyond the shared per-state
        // resets above (no idle brain, no clip, no hint). `hidden` is the
        // construction-time initial state (dispatch never fires for the
        // initial state, so this case is purely defensive); `entering` is
        // driven entirely by `enterAndType()` (reveal + drop-in) and the
        // generalized `onTick` retype-driver (phrase #1 live-type + ENTERED),
        // never from here.
        break;
      default:
        // Exhaustive: every `PetState` is now handled explicitly above.
        // Kept as a defensive no-op (rather than an `assertNever`/throw) so
        // a future `PetState` union addition fails soft here instead of
        // breaking the choreography loop outright.
        break;
    }
  }

  fsm.onEnter(dispatch);

  // Entrance completion detector (T6b): resolve `enterAndType()`'s Promise
  // exactly when the entrance settles (entering → idle), whether that beat
  // came from the live-typed `ENTERED` (full motion) or the reduced-motion
  // instant one. A one-shot in effect — it self-clears `entranceResolve`, so
  // it does nothing on any later idle re-entry; `onEnter` has no unsubscribe
  // in this module by design, which is fine since the guard is `null` outside
  // an entrance. Registered right after `dispatch` so `dispatch('idle')`
  // (which starts the idle brain) runs first on that same transition.
  fsm.onEnter((next, prev) => {
    if (next === 'idle' && prev === 'entering') {
      entranceResolve?.();
      entranceResolve = null;
    }
  });

  // onEnter never fires for the FSM's initial state, so the initial choreography
  // is invoked explicitly here. `applyTheme(theme, { animate: false })` runs
  // either way (instant — construction never animates). Then, per the initial
  // state:
  //  - `hidden` (entrance): hidden-prep — keep Byte + shadow invisible until
  //    `enterAndType()` reveals them, and (full motion only) clear the headline
  //    to empty so the type-from-empty has no first-frame flash of phrase #1.
  //    Under reduced motion, leave phrase #1's static text in place (the reduced
  //    entrance sets phrase #1 "directly" by simply leaving it). Runs AFTER the
  //    `mm.matchMedia` block above, so `reducedActive` is already final here.
  //  - `idle` (default, no entrance): appear idle immediately, exactly as before.
  applyTheme(theme, { animate: false });
  if (fsm.state() === 'hidden') {
    rig.object3d.visible = false;
    shadow.mesh.visible = false;
    if (!reducedActive) {
      renderRetype(
        { line0: '', line1: '', caretIndex: { line: 1, col: 0 } },
        activeHome.el,
        liveCaret(activeHome),
      );
    }
  } else {
    enterIdleBehaviour();
  }

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

  // --- T8 migration (SPEC §6 "traveling & footer migration") ---------------
  // Only meaningful when a footer home exists — `onTick` (below) never
  // calls either function otherwise, so migration is entirely inert
  // (hero-only, byte-identical to Task 3). Reduced motion (SPEC §12
  // "migration simplified") takes the separate `runMigrationReduced`
  // branch below: no lane, an instant re-home snap instead.
  //
  // Concern #5 carried from Task 3's report (`setHomeAnchor` has no state
  // guard against a mid-entrance/mid-retype switch): both functions below
  // are safe BY CONSTRUCTION rather than by an added guard — the trigger
  // only ever fires `MIGRATE` while `fsm.state()` is idle/curious/invited
  // (`MIGRATE_ELIGIBLE_STATES`; the FSM itself only accepts `MIGRATE` from
  // those three anyway, see fsm.ts), and `setHomeAnchor` is only ever
  // called from the arrival branch, which only runs while
  // `fsm.state() === 'traveling'`. Neither path can run mid-`entering` or
  // mid-`retyping`.
  //
  // REVERSIBLE (fix round 1): neither function locks in a destination when
  // `MIGRATE` fires. `runMigrationFull` re-derives the live `pickAnchor`
  // result every tick of `traveling` and drives both the lane point and
  // the arrival check off THAT, so a visitor who reverses course before
  // the other home ever enters the band turns Byte around instead of
  // stranding it in the lane — see `runMigrationFull`'s own doc comment.

  /** Whether `anchorY` (screen-space, top-left-origin px) sits comfortably
   *  inside the viewport — inset by `MIGRATE_BAND_TOP_PX`/`_BOTTOM_PX` on
   *  either edge so a migration doesn't trigger/arrive right at the
   *  bleeding edge of the fold. */
  function inMigrationBand(anchorY: number): boolean {
    return anchorY >= MIGRATE_BAND_TOP_PX && anchorY <= window.innerHeight - MIGRATE_BAND_BOTTOM_PX;
  }

  /**
   * Full-motion migration driver — called every tick from `onTick`, BEFORE
   * its generic anchor computation reads `activeHome.el`, whenever a
   * footer home exists and reduced motion is off.
   *
   * Checks state eligibility FIRST (fix round 1, item 3): the 8 states
   * that are neither resting nor `traveling` return immediately, before
   * either home's rect is ever measured — those two `Range`-based reads
   * only happen when this function is actually going to use them. When it
   * does, it reads BOTH homes' live rects fresh (never cached, matching
   * `onTick`'s own "never snapshot" anchor philosophy) and:
   *  - while RESTING (`MIGRATE_ELIGIBLE_STATES`): fires `MIGRATE` on the
   *    tick the ACTIVE home's own anchor crosses OUT of the comfortable
   *    band — the `wasActiveInBand` edge guard (mirrors `wasNear`/
   *    `wasHome`) makes this a once-per-crossing event, not a per-tick
   *    spam (see its own doc comment for the full reasoning). No
   *    destination is recorded here (fix round 1, item 1 — see below).
   *  - while TRAVELING: REVERSIBLE. Every tick recomputes
   *    `pick = pickAnchor(heroRect, footerRect, { height })` LIVE and
   *    drives BOTH the lane point (X = a right-margin lane trailing the
   *    PICKED home's own text-end; Y = the picked home's own anchor Y
   *    clamped into the comfortable band) AND the arrival decision off
   *    that live pick — never off a destination captured once when
   *    `MIGRATE` fired. This is what makes a mid-trip reversal turn Byte
   *    around: if the visitor scrolls back before the other home ever
   *    enters the band, `pick` simply keeps returning the ORIGINAL home
   *    the whole time, so the lane point and the arrival check both stay
   *    pinned there. Re-homes (`setHomeAnchor` + `ARRIVED`) once the live
   *    pick's own (unclamped) anchor is back in the comfortable band AND
   *    Byte has caught up to within `MIGRATE_ARRIVE_DIST_PX` of the (
   *    clamped) lane point — direction-agnostic, so this fires identically
   *    for a completed hero->footer trip and for a hero->(partway)->hero
   *    reversal. `setHomeAnchor` runs here, BEFORE `onTick`'s own generic
   *    anchor computation reads `activeHome.el` this same tick, so the
   *    existing `wasHome` no-snap reacquire seam picks up the anchor
   *    immediately — no new home-handoff code. On a reversal back to the
   *    still-active home, `setHomeAnchor` simply no-ops (the brief's own
   *    documented behavior: `el === activeHome.el`), and `ARRIVED` +
   *    the reacquire glide alone bring Byte back onto it. Before handing
   *    off, this branch also explicitly kills this module's own lane
   *    tween (fix round 1, item 2 — see `byteToLaneX/Y`'s own doc comment
   *    above for why that's safe to do and still leaves the pair usable
   *    for a LATER migration).
   */
  function runMigrationFull(footer: Home): void {
    const state = fsm.state();
    const resting = MIGRATE_ELIGIBLE_STATES.has(state);
    if (!resting && state !== 'traveling') {
      return;
    }

    const heroRect = lastLineTextRect(heroHome.el);
    const footerRect = lastLineTextRect(footer.el);
    const heroAnchorY = heroRect.top + heroRect.height / 2;
    const footerAnchorY = footerRect.top + footerRect.height / 2;

    if (resting) {
      const activeAnchorY = activeHome === heroHome ? heroAnchorY : footerAnchorY;
      const activeInBand = inMigrationBand(activeAnchorY);
      if (!activeInBand && wasActiveInBand) {
        fsm.send('MIGRATE');
      }
      wasActiveInBand = activeInBand;
      return;
    }

    // state === 'traveling': the live pick IS the destination — recomputed
    // fresh every tick, never a target locked in back when MIGRATE fired.
    const pick = pickAnchor(heroRect, footerRect, { height: window.innerHeight });
    const pickHome = pick === 'hero' ? heroHome : footer;
    const pickRect = pick === 'hero' ? heroRect : footerRect;
    const pickAnchorY = pick === 'hero' ? heroAnchorY : footerAnchorY;
    const pickInBand = inMigrationBand(pickAnchorY);

    const laneScreenX = Math.min(
      pickRect.right + MIGRATE_LANE_GAP_PX,
      window.innerWidth - MIGRATE_LANE_MARGIN_PX,
    );
    const laneScreenY = gsap.utils.clamp(
      MIGRATE_BAND_TOP_PX,
      window.innerHeight - MIGRATE_BAND_BOTTOM_PX,
      pickAnchorY,
    );
    const laneWorld = scene.worldFromScreen(laneScreenX, laneScreenY);
    const laneRootY = laneWorld.y - unitPx / 2;

    const dist = Math.hypot(
      rig.object3d.position.x - laneWorld.x,
      rig.object3d.position.y - laneRootY,
    );
    const arrived = pickInBand && dist <= MIGRATE_ARRIVE_DIST_PX;

    if (arrived) {
      // Fix round 1, item 2: explicitly hand the root back over — never
      // rely solely on tween-creation-order to keep this pair from racing
      // the reacquire glide that starts moments later in this same tick.
      gsap.killTweensOf(rig.object3d.position);
      setHomeAnchor(pickHome.el);
      fsm.send('ARRIVED');
      return;
    }

    byteToLaneX(laneWorld.x);
    byteToLaneY(laneRootY);
  }

  /**
   * Reduced-motion migration driver (SPEC §12 "migration simplified") — the
   * SAME band-leave trigger as `runMigrationFull` (so the two stay in
   * lockstep conceptually), but no lane and no arrival distance: the
   * instant Byte's active home leaves the comfortable band, it snaps
   * straight to whichever home `pickAnchor` currently favors (fix round 1,
   * item 1 — "target the live pick", not mechanically "the other home":
   * the two usually agree, but a home leaving ITS OWN band doesn't
   * guarantee the other one is actually more visible yet — e.g. a scroll
   * that leaves both hero and footer off-screen mid-page).
   *
   * T8 final review, finding 2: that mid-page case is exactly where an
   * unconditional snap broke down. `pickAnchor`'s tie-break-to-hero always
   * returns SOME winner, even when BOTH homes are out of band — snapping to
   * it unconditionally (as this used to) parked Byte at an equally
   * off-screen anchor, and since the snap synchronously fires
   * `MIGRATE`, then (next tick) `ARRIVED` back to `idle`,
   * `enterIdleBehaviour`'s own `wasActiveInBand = true` re-arm made the
   * VERY NEXT idle tick see that (still out-of-band) active home as a
   * fresh "just left the band" edge again — an infinite migrate/arrive
   * churn, parked off-screen the whole time. This now mirrors
   * `runMigrationFull`'s own `pickInBand` arrival gate: the live pick's
   * OWN anchor must actually be in-band before this snaps to it. When it
   * isn't, this returns WITHOUT touching `wasActiveInBand` — leaving the
   * edge armed (still `true`) rather than consuming it — so Byte simply
   * stays at its CURRENT home, re-checking every tick with no FSM traffic
   * and no position write, until a home genuinely re-enters the band, at
   * which point the still-armed edge fires the snap immediately (no extra
   * idle re-entry needed). Normal (non-mid-page) migrations — where the
   * live pick lands in-band on the very first check — are byte-identical
   * to before.
   *
   * `fsm.send('MIGRATE')`, then `setHomeAnchor`, then the instant
   * `rig.object3d.position` placement all happen synchronously here —
   * before `onTick`'s generic anchor computation runs, the same seam the
   * full-motion path uses — so the shadow (which reads the root's position
   * later in the SAME tick) never renders one stale frame at the old home.
   * `fsm.send('ARRIVED')` is deferred via `fireOnNextTick` — never a
   * synchronous send back-to-back with `MIGRATE` — mirroring every other
   * instant-completion beat in this module (the reduced-motion entrance,
   * the reduced-motion retype).
   */
  function runMigrationReduced(footer: Home): void {
    const state = fsm.state();
    if (!MIGRATE_ELIGIBLE_STATES.has(state)) {
      return;
    }

    const heroRect = lastLineTextRect(heroHome.el);
    const footerRect = lastLineTextRect(footer.el);
    const heroAnchorY = heroRect.top + heroRect.height / 2;
    const footerAnchorY = footerRect.top + footerRect.height / 2;

    const activeAnchorY = activeHome === heroHome ? heroAnchorY : footerAnchorY;
    const activeInBand = inMigrationBand(activeAnchorY);

    if (!activeInBand && wasActiveInBand) {
      const pick = pickAnchor(heroRect, footerRect, { height: window.innerHeight });
      const target = pick === 'hero' ? heroHome : footer;
      const targetRect = pick === 'hero' ? heroRect : footerRect;
      const targetAnchorY = pick === 'hero' ? heroAnchorY : footerAnchorY;

      if (!inMigrationBand(targetAnchorY)) {
        // No in-band target yet (e.g. mid-page, with BOTH homes out of
        // band) — hold: leave `wasActiveInBand` at `true` (do NOT consume
        // the edge) so every subsequent tick keeps re-checking, with no
        // MIGRATE/ARRIVED FSM traffic and no position write, until a home
        // genuinely re-enters the band.
        return;
      }

      const targetWorld = scene.worldFromScreen(targetRect.right, targetAnchorY);
      fsm.send('MIGRATE');
      setHomeAnchor(target.el);
      rig.object3d.position.set(targetWorld.x, targetWorld.y - unitPx / 2, 0);
      fireOnNextTick(() => fsm.send('ARRIVED'));
    }
    wasActiveInBand = activeInBand;
  }

  // --- Per-tick update (brief 4b) -----------------------------------------------------
  function onTick(dt: number): void {
    // Free-running retype clock — ALWAYS advanced (independent of state) so
    // the engine's `step()` reads a monotonic ms value during a full retype;
    // the engine re-anchors it on each `enqueue`. Cheap.
    retypeClockMs += dt * 1000;

    // T8 migration — inert (no-op) with no footer home, exactly Task 3's
    // hero-only behavior. Runs BEFORE the generic anchor computation below
    // reads `activeHome.el`, so an arrival's `setHomeAnchor` call this same
    // tick is already reflected in it (see `runMigrationFull`'s doc
    // comment above).
    if (footerHome) {
      if (reducedActive) {
        runMigrationReduced(footerHome);
      } else {
        runMigrationFull(footerHome);
      }
    }

    // Re-derive the ACTIVE home's text-end anchor every tick (never snapshot)
    // — the canvases are viewport-fixed and the headline reflows once fonts/
    // SplitText settle, exactly as the (now-removed) T3 `?glcube` rig did. On a
    // `setHomeAnchor` switch this seamlessly re-anchors Byte/caret/hint to the
    // new home from the next tick.
    const lineRect = lastLineTextRect(activeHome.el);
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

    // Retype/entrance driver (T6/T6b, R-T6b-3): the ONE per-frame typing path,
    // shared by a reward `retyping` AND the entrance's `entering` phrase-#1
    // live-type — no second typing loop, no second caret path. While either
    // state is active under full motion, step the engine off `retypeClockMs`,
    // paint the frame, and glide Byte's root to the live caret world position
    // — Byte "operates the caret". Neither `retyping` nor `entering` is a
    // HOME_STATE, so the block above pinned nothing this tick: the `quickTo`
    // follow is the root's sole writer here (during the entrance it takes over
    // only AFTER `enterAndType`'s drop-in bounce has completed, so the two
    // never write `rig.object3d.position` on the same frame), and on
    // completion the `wasHome` edge above fires the existing no-snap reacquire
    // home next tick (the same seam T5 built — no new handoff code). The
    // `quickTo` tween is the oldest tween of `rig.object3d.position` (created
    // at init), so the reacquire / any fresh dash / the steady-state hard-pin
    // all render AFTER it and win, leaving no lingering fight once typing ends.
    // On engine completion, fire the state-appropriate beat: `ENTERED` closes
    // the entrance (entering → idle), `RETYPED` closes a reward (retyping →
    // idle).
    if ((fsm.state() === 'retyping' || fsm.state() === 'entering') && retypeActive) {
      const frame = retype.step(retypeClockMs);
      if (frame) {
        const caret = liveCaret(activeHome);
        renderRetype(frame, activeHome.el, caret);
        // Caret's live world position → Byte's feet (its vertical center
        // minus half the bot height, matching the home anchor's `- unitPx/2`).
        const cr = caret.getBoundingClientRect();
        const cw = scene.worldFromScreen(cr.left, cr.top + cr.height / 2);
        byteToCaretX(cw.x);
        byteToCaretY(cw.y - unitPx / 2);
        // T7 (R7-6): keep the edit DETECTOR live every frame (`lastRetypeTotal`
        // tracks the char total), but gate the EFFECTS — the caret spark AND
        // the `typeTick` cue — behind ONE shared throttle so they fire together
        // roughly every `TYPE_TICK_EVERY` edits instead of ~1/char. Skip the
        // stray empty-headline frame the entrance re-arm leaves (`total === 0`)
        // and skip under reduced motion (`sparkAtCaret` already no-ops there;
        // the tick must be suppressed too). Only real, emittable edits advance
        // the throttle counter, so neither skip ever consumes a slot.
        const total = frame.line0.length + frame.line1.length;
        if (total !== lastRetypeTotal) {
          lastRetypeTotal = total;
          if (total !== 0 && !reducedActive) {
            typeEditCount += 1;
            if (typeEditCount % TYPE_TICK_EVERY === 0) {
              sparkAtCaret();
              sound.play('typeTick');
            }
          }
        }
      }
      if (!retype.isBusy()) {
        retypeActive = false;
        fireOnNextTick(() => fsm.send(fsm.state() === 'entering' ? 'ENTERED' : 'RETYPED'));
      }
    }

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

    // Permanent caret rest position (SPEC: "a blinking DOM caret remains in
    // the headline"): when NOT mid-type, park the LIVE caret at the end of
    // the bottom line's text, in `headlineEl`-relative coords. Transform-only
    // on the absolutely-positioned caret, so it never reflows (CLS 0); reuses
    // the `lineRect` already read for the anchor. During a retype OR the
    // entrance's phrase-#1 type, `renderRetype` owns the caret transform
    // instead — so the rest write runs only when the state is neither
    // `retyping` nor `entering` (R-T6b-3, the inverse of the driver gate).
    if (fsm.state() !== 'retyping' && fsm.state() !== 'entering') {
      liveCaret(activeHome).style.transform = caretRestTransform(activeHome.el, lineRect);
    }
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
    // T7 (R7-1): whoosh on an EXPLICIT theme change only. Fired here in the
    // public wrapper — NOT in `applyTheme`, which also runs once at construction
    // (`applyTheme(theme, { animate: false })` above), where it would whoosh on
    // page load. `{ animate: true }` is what turns on T8's ~400ms crossfade +
    // stretch below (instant instead, whenever `reducedActive` is true —
    // `applyTheme` itself is what checks that flag, not this wrapper).
    sound.play('themeWhoosh');
    applyTheme(t, { animate: true });
  }

  /**
   * Style Lab wiring (T8, SPEC §7 "preview & lock variants live" / §11):
   * swap the dark-mode phosphor Glow's accent color live — `main.ts` drives
   * this from the `data-glow` axis's live `--glow` CSS token. Stores the new
   * accent in this instance's own `currentGlowAccent` (so every LATER
   * `applyTheme` call — including a subsequent theme toggle — keeps
   * painting it, not just this one call) and re-applies it immediately via
   * `rig.setGlow`, reading the CURRENT theme rather than assuming dark. In
   * light mode the glow is off (`rig.setGlow(false, ...)` — see rig.ts), so
   * switching the accent has no visible effect until dark mode is active;
   * that is correct per SPEC §11 (the glow is a dark-mode-only effect).
   */
  function setGlowAccent(color: THREE.ColorRepresentation): void {
    currentGlowAccent = color;
    rig.setGlow(theme === 'dark', currentGlowAccent);
  }

  function onEat(cb: (total: number) => void): void {
    feeder.onEat(cb);
  }

  /**
   * Switch Byte's active home (T8): the per-tick anchor, the DOM caret, the
   * retype target, and the phrase cycle all follow `activeHome`. No-op if `el`
   * already matches the active home; ignore an `el` matching NEITHER home
   * (defensive). On a real switch: hide the previously-active home's caret and
   * show the newly-active one (R8-1 — exactly ONE visible caret, at Byte's
   * home), re-seed the ONE retype engine to the new home's on-screen text
   * (`retype.reset(currentTextOf(next))`) so the next retype deletes what is
   * actually shown there; `onTick` parks the new home's caret at its rest
   * position from the next tick (it already writes the active home's rest
   * transform). Each home keeps its OWN `phraseIndex`, so hero and footer
   * independently remember their cycle position.
   *
   * This does NOT drive migration/travel — it only re-points the retype
   * machinery. WHEN to switch (the scroll-driven `MIGRATE`/`ARRIVED` FSM
   * beats) is a later task; for now this is called manually (browser QA).
   */
  function setHomeAnchor(el: HTMLElement): void {
    if (el === activeHome.el) {
      return;
    }
    let next: Home | null = null;
    if (el === heroHome.el) {
      next = heroHome;
    } else if (footerHome && el === footerHome.el) {
      next = footerHome;
    }
    if (!next) {
      return;
    }
    setCaretVisible(activeHome, false);
    activeHome = next;
    setCaretVisible(activeHome, true);
    retype.reset(currentTextOf(next));
  }

  /**
   * Style Lab wiring (T8, SPEC §7): replace the HERO home's retype cycle
   * live — `main.ts` drives this from the `data-phrase-set` axis. Mirrors
   * `setHomeAnchor`'s "one engine, both homes" spirit but only ever touches
   * the hero: the footer's own cycle (its fixed CTA phrases) is never a lab
   * axis and is left untouched. Resets `heroHome.phraseIndex` to 0 so the
   * next hero feed starts the new cycle from its first entry — the exact
   * next-phrase index isn't spec-critical, this just guarantees it's a valid
   * index into the NEW cycle rather than a stale one from the old — and,
   * only if the hero is CURRENTLY the active home, re-seeds the shared
   * retype engine to the hero's on-screen text (`currentTextOf`) so the very
   * next retype deletes what's actually shown instead of a schedule built
   * against the old cycle. A no-op on the engine when the footer is active:
   * it already points at the footer's own text, which this never touches.
   */
  function setPhrases(cycle: readonly Phrase[]): void {
    heroHome.cycle = cycle;
    heroHome.phraseIndex = 0;
    if (activeHome === heroHome) {
      retype.reset(currentTextOf(heroHome));
    }
  }

  // --- Entrance choreography (T6b, SPEC §8.1) -------------------------------
  /**
   * The full-motion drop-in: place Byte `ENTRANCE_DROP_UNITS` bot-heights
   * above the type-start anchor (the TOP line's left edge — where phrase #1
   * begins), shrunk to `ENTRANCE_SCALE_FROM`, then bounce it down onto the
   * anchor while its body scales up to 1, `ease: 'bounce.out'`. Writes the
   * ROOT's `position.y` (world placement) and the clip-owned `pose`'s `scale`
   * — the normalized body node the clips animate, NOT the root (whose scale is
   * `unitPx`; scaling the root to 1 would shrink Byte permanently). `pose`'s
   * identity scale is 1 and `rig.play('Idle')` resets it to 1 when the idle
   * brain takes over, and this tween already ends there, so there is no jump.
   * Returns a Promise resolved on the bounce's `onComplete` (composed via
   * `track()`); `enterAndType` `await`s it so the `byteToCaret` follow — which
   * also writes the root's position — only begins after the bounce finishes,
   * never on the same frame.
   */
  function runDropIn(): Promise<void> {
    // Type-start anchor: the TOP line's left edge (phrase #1 types line0
    // first). It's empty at this point (hidden-prep cleared it), but its box
    // still carries the CSS-reserved line height, so its rect gives the spot.
    const line0El = opts.headlineEl.querySelector<HTMLElement>('[data-byte-line="0"]');
    const startRect = (line0El ?? opts.headlineEl).getBoundingClientRect();
    const landWorld = scene.worldFromScreen(startRect.left, startRect.top + startRect.height / 2);
    const landX = landWorld.x;
    const landY = landWorld.y - unitPx / 2; // feet, matching onTick's `- unitPx/2`

    // Snap to the elevated, shrunk start BEFORE the bounce so frame 0 is that
    // start (world +y is up, so "above" is a larger y), never the origin.
    rig.object3d.position.set(landX, landY + unitPx * ENTRANCE_DROP_UNITS, 0);
    if (pose) {
      pose.scale.setScalar(ENTRANCE_SCALE_FROM);
    }

    return new Promise<void>((resolve) => {
      const tl = track(gsap.timeline({ onComplete: resolve }));
      tl.to(
        rig.object3d.position,
        { y: landY, duration: ENTRANCE_DROP_DURATION_S, ease: 'bounce.out' },
        0,
      );
      if (pose) {
        tl.to(
          pose.scale,
          { x: 1, y: 1, z: 1, duration: ENTRANCE_DROP_DURATION_S, ease: 'bounce.out' },
          0,
        );
      }
    });
  }

  /**
   * SPEC §8.1 entrance: reveal Byte, drop it in, and live-type phrase #1 by
   * reusing the retype engine + the `onTick` retype-driver (no second typing
   * path). Reduced motion sets phrase #1 directly (no drop-in, no type).
   * Resolves when the entrance settles into idle (the entering→idle completion
   * detector registered above). Defensive no-op-resolve if not constructed
   * with `{ entrance: true }` (the FSM won't be in `hidden`).
   */
  async function enterAndType(): Promise<void> {
    // Guard: only meaningful in the entrance path (FSM starts `hidden`).
    // Otherwise Byte is already idle — resolve immediately. `main.ts` only
    // calls this on the entrance path anyway.
    if (fsm.state() !== 'hidden') {
      return;
    }

    // The Promise the caller awaits; its resolver is fired by the entering→idle
    // completion detector (covers BOTH the full `ENTERED` and the reduced one).
    const entered = new Promise<void>((resolve) => {
      entranceResolve = resolve;
    });

    // Reveal Byte + its shadow (hidden-prep hid both).
    rig.object3d.visible = true;
    shadow.mesh.visible = true;

    if (reducedActive) {
      // Reduced motion (SPEC §12): no drop-in, no spark, no glide. Place Byte at
      // the home anchor instantly — computed exactly like `onTick`'s root pin
      // (`lastLineTextRect` → `worldFromScreen`, minus `unitPx/2` in y) — so it
      // never first appears at the world origin, and leave phrase #1 as its
      // static headline text (hidden-prep left it untouched). Then beat through
      // the FSM: SHOWN now, ENTERED next tick (never a synchronous send inside
      // this call); the completion detector resolves `entered`.
      const anchor = lastLineTextRect(opts.headlineEl);
      const anchorWorld = scene.worldFromScreen(anchor.right, anchor.top + anchor.height / 2);
      rig.object3d.position.set(anchorWorld.x, anchorWorld.y - unitPx / 2, 0);
      fsm.send('SHOWN');
      fireOnNextTick(() => fsm.send('ENTERED'));
      return entered;
    }

    // Full motion: hidden → entering (SHOWN), drop Byte in and AWAIT the bounce
    // to completion, THEN start the shared retype-driver typing phrase #1 up
    // from an empty headline. Awaiting the bounce first guarantees it and the
    // `byteToCaret` `quickTo` never write `rig.object3d.position` on the same
    // frame. `reset(['',''])` + `enqueue(phrase)` = a pure type-from-empty (see
    // retype.ts); if the hero cycle is empty this enqueues
    // `currentTextOf(heroHome)` (empty under full motion) and the driver beats
    // straight to `ENTERED` next tick — mirroring `handleEnterRetyping`'s
    // pass-through. `lastRetypeTotal = -1` re-arms the per-edit spark detector.
    fsm.send('SHOWN');
    await runDropIn();
    retype.reset(['', '']);
    // The entrance always types phrase #1 into the HERO home (boot is always
    // hero-active). `heroHome.cycle[0] ?? currentTextOf(heroHome)` mirrors the
    // pre-T8 `cycle[0] ?? currentLinesText()` exactly.
    retype.enqueue(heroHome.cycle[0] ?? currentTextOf(heroHome));
    lastRetypeTotal = -1;
    retypeActive = true;
    return entered;
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
    spinTween = null;
    sparkTween = null;
    themeLerpTween = null;
    themeStretchTween = null;
    // Drop any in-flight entrance resolver (the drop-in tween itself is in
    // `liveTweens`, already killed by the bulk kill above). A destroy mid-
    // entrance leaves the `enterAndType()` Promise unresolved — intentional:
    // the page is going away, and nothing awaits it past teardown.
    entranceResolve = null;
    // The Byte→caret follow (`byteToCaretX/Y`) AND the migration lane-follow
    // (`byteToLaneX/Y`) are both `quickTo`s — their reused tweens are NOT in
    // `liveTweens`, so kill them explicitly here (one call: both target the
    // same `rig.object3d.position` object).
    gsap.killTweensOf(rig.object3d.position);

    mm.revert();

    hintEl.remove();
    // Remove BOTH homes' carets: the live node (found by attribute, in case a
    // SplitText clone-swap replaced the seed) AND the seed itself (a detached
    // node's `.remove()` is a safe no-op). Hero-only when there is no footer
    // home — byte-identical to before.
    for (const home of footerHome ? [heroHome, footerHome] : [heroHome]) {
      home.el.querySelector('[data-byte-caret]')?.remove();
      home.caret.remove();
    }

    feeder.dispose();
    rig.dispose();
    shadow.dispose();
    scene.dispose();
  }

  return {
    feed,
    setTheme,
    onEat,
    enterAndType,
    setHomeAnchor,
    setGlowAccent,
    setPhrases,
    destroy,
  };
}
