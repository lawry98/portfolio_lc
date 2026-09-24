/**
 * Preloader overlay + entrance orchestrator (SPEC §8.1).
 *
 * The static `#preloader` overlay (see `index.html`) paints a blinking caret
 * next to a counting `%` over the whole viewport on load. `runEntrance()`
 * drives that count 0→100, waits on a **bounded gate** (webfonts settling OR a
 * fallback timeout, whichever comes first, but never less than a MIN so the
 * loader can't flash-and-vanish), lifts the overlay, then — when a Byte handle
 * is supplied — awaits Byte's drop-in + live-type before staggering in the
 * page chrome.
 *
 * Never-hang contract (the whole point of this module):
 *  - `whenFontsSettled()` races `document.fonts.ready` against a bounded
 *    `PRELOADER_FONTS_FALLBACK_MS` timeout and never rejects, so a
 *    `document.fonts.ready` that never resolves (or an engine with no
 *    `document.fonts` at all) still settles the race via the timeout.
 *  - The gate is `Promise.all([whenFontsSettled(), delay(PRELOADER_MIN_MS),
 *    race(modelReady, delay(PRELOADER_FONTS_FALLBACK_MS))])` (`entranceGate`),
 *    so it resolves in `[PRELOADER_MIN_MS, max(PRELOADER_FONTS_FALLBACK_MS,
 *    PRELOADER_MIN_MS)]` — bounded on BOTH ends. It waits at least the MIN even
 *    if fonts are already ready, and at most the fallback even if they never
 *    are.
 *  - Belt-and-suspenders, `index.html` also carries a dependency-free inline
 *    `<head>` timeout that force-hides `#preloader` even if this module never
 *    boots at all (load error, no module support). This module lifting the
 *    overlay far sooner is the normal path; that inline timeout is the floor.
 *
 * CLS-0 by construction: the overlay is `position: fixed` (never in flow, so it
 * cannot shift `#app`), the `%` is monospace + `tabular-nums` (counting never
 * jitters digit width), and both the lift and the page-chrome stagger touch
 * only opacity + transform (compositor-only, never layout).
 *
 * Reduced motion is handled here in JS (GSAP animates inline styles, so the
 * base `prefers-reduced-motion` CSS freeze does not reach it): the count snaps
 * to 100, the lift is a quick opacity fade with no upward travel, and the
 * page-chrome stagger becomes an instant set. The caret's blink is CSS and
 * deliberately kept alive under reduced motion (a native-caret exception, SPEC
 * §12 — see `.preloader__caret` in `global.css`).
 *
 * GSAP is used freely here — this is a `page/` module (demo-only), not the
 * portable `pet/` module whose purity constraint (`fsm.ts`/`retype.ts`) does
 * not apply.
 */

import gsap from 'gsap';
import type { BytePetHandle } from '../pet/types';

/**
 * Floor for how long the overlay stays up, in ms. Even if webfonts are already
 * cached and `document.fonts.ready` resolves on the first microtask, the gate
 * still waits this long so the loader reads as a deliberate beat rather than a
 * flash. Also the duration the `%` count is tweened over.
 */
export const PRELOADER_MIN_MS = 900;

/**
 * Ceiling for the font wait, in ms. `whenFontsSettled()` resolves at
 * `document.fonts.ready` OR this timeout, whichever is first — so a
 * `document.fonts.ready` that never settles (stalled load, unsupported API)
 * can never leave the gate (and thus the overlay) waiting forever. Real loads
 * on this project's self-hosted, subsetted woff2s settle well under this; the
 * timeout is the safety net, not the expected path.
 */
export const PRELOADER_FONTS_FALLBACK_MS = 4000;

/** Overlay lift: fade + small upward travel (compositor-only), in seconds. */
const LIFT_DURATION_S = 0.6;
/** Reduced-motion lift: a quick opacity fade, no travel, in seconds. */
const LIFT_REDUCED_DURATION_S = 0.2;
/** How far the overlay travels up as it lifts (px). Reduced motion skips this. */
const LIFT_TRAVEL_PX = 24;

/** Page-chrome stagger (opacity + small y), in seconds. */
const CHROME_DURATION_S = 0.5;
/** Downward offset the chrome rises from as it fades in (px). */
const CHROME_TRAVEL_PX = 12;
/** Gap between each chrome element's entrance (s). */
const CHROME_STAGGER_S = 0.08;

/**
 * The light page-chrome garnish that staggers in once the overlay is gone and
 * Byte has entered (SPEC §8.1 "hint + nav + micro-labels stagger in"). Byte's
 * own invited hint is NOT here — `createBytePet` owns it. Kept intentionally
 * short so the entrance stays a garnish, not a second loading screen.
 */
const CHROME_SELECTORS = ['.nav', '.hero__micro-label', '.hero__scroll'] as const;

/**
 * Dependencies for `runEntrance`. `bytePet` is optional so the no-WebGL floor
 * (no Byte at all) still runs the overlay lift + chrome stagger — the
 * `enterAndType()` await simply becomes a no-op `undefined`. `root` scopes the
 * page-chrome lookups (and, best-effort, the overlay lookup) so a test or a
 * future multi-root page can target a subtree; it defaults to `document`.
 */
export interface EntranceDeps {
  bytePet?: BytePetHandle;
  reducedMotion: boolean;
  root?: ParentNode;
}

/**
 * Resolves once webfonts have settled, or after `PRELOADER_FONTS_FALLBACK_MS`,
 * whichever comes first. Never rejects: `document.fonts.ready` is caught
 * defensively, and a missing `document.fonts` (very old engine) resolves via
 * the timeout branch instead. Copied verbatim in shape from `hero.ts`'s
 * `whenFontsSettled()` — same bounded-race invariant, its own fallback
 * constant.
 */
function whenFontsSettled(): Promise<void> {
  const fontsReady =
    typeof document !== 'undefined' && document.fonts
      ? document.fonts.ready.then(() => undefined).catch(() => undefined)
      : Promise.resolve();
  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, PRELOADER_FONTS_FALLBACK_MS);
  });
  return Promise.race([fontsReady, timeout]);
}

/** A bounded, never-rejecting delay — the MIN half of the gate. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * The bounded entrance gate (SPEC §8.1 + TICKETS T-GLB row 1): webfonts
 * settled, the MIN beat elapsed, AND Byte's real model live — the last
 * capped at `PRELOADER_FONTS_FALLBACK_MS`, so a slow or failed model can
 * never hold the overlay longer than the fonts fallback already could. It
 * still resolves in `[PRELOADER_MIN_MS, PRELOADER_FONTS_FALLBACK_MS]`, and
 * usually the real Byte drops in from the very first frame. `modelReady`
 * never rejects (`BytePetHandle.modelReady`); absent (no WebGL, no
 * `modelUrl`) it counts as live.
 */
export function entranceGate(modelReady: Promise<void> = Promise.resolve()): Promise<void> {
  return Promise.all([
    whenFontsSettled(),
    delay(PRELOADER_MIN_MS),
    Promise.race([modelReady, delay(PRELOADER_FONTS_FALLBACK_MS)]),
  ]).then(() => undefined);
}

/**
 * Resolves `#preloader` regardless of the `root` passed. The overlay is a
 * body-level sibling of the content root (`#app`), so it may not be a
 * descendant of a narrowly-scoped `root`: prefer a scoped lookup (a test can
 * pass a detached subtree carrying its own overlay), then fall back to the
 * document — mirroring the inline `<head>` fallback's `getElementById` and
 * staying robust to whatever `root` the bootstrap passes.
 */
function resolveOverlay(scope: ParentNode): HTMLElement | null {
  const scoped = scope.querySelector<HTMLElement>('#preloader');
  if (scoped) {
    return scoped;
  }
  return typeof document !== 'undefined' ? document.getElementById('preloader') : null;
}

/**
 * Lifts the overlay off-screen, then removes it from rendering AND the a11y
 * tree (it already carries `aria-hidden`, but `hidden` + the `.preloader--done`
 * display:none in `global.css` also drops it from layout so nothing behind it
 * is intercepted). Compositor-only: `autoAlpha` (opacity + visibility) plus,
 * under full motion, a small upward `y`. Reduced motion → a quick fade, no
 * travel. Resolves once the overlay is fully gone.
 */
function liftOverlay(overlay: HTMLElement, reducedMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const finalize = (): void => {
      overlay.classList.add('preloader--done');
      overlay.setAttribute('hidden', '');
      resolve();
    };

    gsap.to(overlay, {
      autoAlpha: 0,
      y: reducedMotion ? 0 : -LIFT_TRAVEL_PX,
      duration: reducedMotion ? LIFT_REDUCED_DURATION_S : LIFT_DURATION_S,
      ease: reducedMotion ? 'none' : 'power2.inOut',
      onComplete: finalize,
    });
  });
}

/**
 * Staggers the page chrome in (nav + drifting micro-label + scroll cue).
 * `gsap.from(autoAlpha:0)` hides then reveals in the same breath, so nothing is
 * ever left parked hidden if this never runs (JS off / no boot): the resting
 * state is the fully-visible static CSS, never `opacity: 0` in a stylesheet
 * (the project-wide never-hidden invariant, see `reveals.ts`). Reduced motion →
 * an instant visible set. Compositor-only (opacity + transform), `clearProps`
 * scrubs the inline transform afterwards → CLS 0. No-op if none are present.
 */
function staggerPageChrome(scope: ParentNode, reducedMotion: boolean): void {
  const targets = CHROME_SELECTORS.map((sel) => scope.querySelector<HTMLElement>(sel)).filter(
    (el): el is HTMLElement => el !== null,
  );
  if (targets.length === 0) {
    return;
  }

  if (reducedMotion) {
    gsap.set(targets, { autoAlpha: 1, y: 0, clearProps: 'transform' });
    return;
  }

  gsap.from(targets, {
    autoAlpha: 0,
    y: -CHROME_TRAVEL_PX,
    duration: CHROME_DURATION_S,
    ease: 'power2.out',
    stagger: CHROME_STAGGER_S,
    clearProps: 'transform',
  });
}

/**
 * Runs the SPEC §8.1 entrance. Order: count % → wait the bounded gate → lift
 * the overlay → await Byte's drop-in + live-type (if supplied) → stagger the
 * page chrome in. Guards every DOM lookup and never throws; if the overlay is
 * absent it degrades to just Byte's entrance (if any) and returns.
 *
 * Resolves once the whole entrance has settled. The gate can never hang (see
 * the module doc comment) — the returned promise is always eventually
 * resolved.
 */
export async function runEntrance(deps: EntranceDeps): Promise<void> {
  const scope: ParentNode = deps.root ?? document;
  const overlay = resolveOverlay(scope);

  // Defensive: no overlay in the DOM (a future page without it, a stripped
  // test root). Nothing to count or lift — just run Byte's entrance, if any,
  // and return. Never throw.
  if (!overlay) {
    await deps.bytePet?.enterAndType();
    return;
  }

  const { reducedMotion } = deps;
  const pctEl = overlay.querySelector<HTMLElement>('[data-preloader-pct]');

  // 1. Count the % 0→100. A numeric proxy tweened by GSAP; `Math.round` written
  //    into the mono + tabular-nums span on each update, so the digits never
  //    jitter width (CLS 0). Reduced motion snaps straight to 100.
  const counter = { value: 0 };
  const writePct = (): void => {
    if (pctEl) {
      pctEl.textContent = String(Math.round(counter.value));
    }
  };

  let countTween: ReturnType<typeof gsap.to> | undefined;
  if (reducedMotion) {
    counter.value = 100;
    writePct();
  } else {
    countTween = gsap.to(counter, {
      value: 100,
      duration: PRELOADER_MIN_MS / 1000,
      ease: 'none',
      onUpdate: writePct,
    });
  }

  // 2. The bounded gate — resolves in [MIN, max(FALLBACK, MIN)], never hangs.
  //    (T-GLB: now also waits for Byte's model, capped — see `entranceGate`)
  await entranceGate(deps.bytePet?.modelReady);

  // Guarantee 100 is shown before the lift, whichever way the gate resolved
  // (fonts before the count finished, or reduced motion already at 100).
  countTween?.kill();
  counter.value = 100;
  writePct();

  // 3. Lift the overlay off (and out of the a11y tree + layout).
  await liftOverlay(overlay, reducedMotion);

  // 4. Byte drops in + live-types phrase #1. On the no-WebGL floor there is no
  //    bytePet, so this is a no-op `undefined` await. `enterAndType` owns its
  //    own reduced-motion (instant) branch.
  await deps.bytePet?.enterAndType();

  // 5. The one light page-chrome garnish (SPEC §8.1). Byte's invited hint is
  //    NOT here — `createBytePet` owns that.
  staggerPageChrome(scope, reducedMotion);
}
