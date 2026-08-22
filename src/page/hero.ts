/**
 * Hero section — load reveal + mouse-parallax (SPEC §8.2, §8.7).
 *
 * Two independent behaviours, both scoped to `#hero`:
 *  - a masked line reveal of the two-line headline, fired once on load
 *    (via `revealLines()`), gated on webfonts settling with a bounded
 *    fallback so it can never wait forever;
 *  - a small mouse-parallax garnish: the headline nudges toward the
 *    pointer, the `[data-parallax]` micro-label(s) nudge the opposite way,
 *    both driven by `gsap.quickTo()` so repeated `pointermove` events reuse
 *    the same tweens instead of creating a new one per event (CLAUDE.md
 *    "GSAP conventions").
 *
 * Both respect `prefers-reduced-motion`: the load reveal defers to
 * `revealLines()`'s own instant/no-transform branch, and the parallax is
 * skipped entirely via its own `gsap.matchMedia()` (SPEC §12/§14).
 */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { revealLines } from './reveals';

// Registered defensively (idempotent — see reveals.ts) since this module
// calls `ScrollTrigger.refresh()` directly below, rather than only going
// through the already-registered `revealLines`.
gsap.registerPlugin(ScrollTrigger);

/**
 * Real webfont loads on this project's self-hosted, subsetted woff2s settle
 * well under this. The race exists so a `document.fonts.ready` that never
 * resolves (unsupported API, a stalled load) can't leave the hero's load
 * reveal waiting forever — the invariant is that content is never stuck
 * hidden, and `revealLines()` only runs once this promise settles one way
 * or the other.
 */
const FONTS_TIMEOUT_MS = 1500;

/** Parallax budget — "a few px", never more than this on either axis. */
const PARALLAX_MAX_PX = 8;
/**
 * `handlePointerMove` below normalizes the pointer position to `nx`/`ny` in
 * roughly -0.5..0.5 across the hero's box, so doubling the ±px budget here
 * compensates for that ±0.5 range: `nx * PARALLAX_RANGE_PX` (and its `ny`/
 * label counterparts) then spans the full ±`PARALLAX_MAX_PX`.
 */
const PARALLAX_RANGE_PX = PARALLAX_MAX_PX * 2;
const PARALLAX_VARS = { duration: 0.6, ease: 'power3' };

/**
 * Resolves once webfonts have settled, or after `FONTS_TIMEOUT_MS`,
 * whichever comes first. Never rejects: `document.fonts.ready` is caught
 * defensively, and a missing `document.fonts` (very old engine) resolves
 * immediately via the timeout branch instead.
 */
function whenFontsSettled(): Promise<void> {
  const fontsReady =
    typeof document !== 'undefined' && document.fonts
      ? document.fonts.ready.then(() => undefined).catch(() => undefined)
      : Promise.resolve();
  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, FONTS_TIMEOUT_MS);
  });
  return Promise.race([fontsReady, timeout]);
}

/**
 * Reads the `data-parallax-speed` hook (a per-label multiplier — SPEC's
 * "drifting micro-labels" at different speeds), defaulting to `1` and
 * clamping to +/-1 so a stray markup value can't blow the parallax budget.
 */
function parallaxSpeed(el: HTMLElement): number {
  const raw = Number(el.dataset.parallaxSpeed);
  return Number.isFinite(raw) ? gsap.utils.clamp(-1, 1, raw) : 1;
}

/**
 * Wires the hero's pointer-parallax. Branches on `prefers-reduced-motion`
 * via its own `gsap.matchMedia()`:
 *  - `no-preference` sets up one `quickTo` per axis per target (headline +
 *    each `[data-parallax]` label) and a single `pointermove` listener on
 *    the hero section that drives all of them; returns a cleanup that
 *    removes the listener and clears the applied transforms.
 *  - `reduce` skips all of the above — no listener, no quickTo, no
 *    parallax — and explicitly resets any transform to neutral.
 *
 * `gsap.matchMedia()` re-evaluates live: if the user flips the OS reduced-
 * motion setting while the page is open, it calls the `no-preference`
 * branch's returned cleanup automatically before running the `reduce`
 * branch. That live re-evaluation is this project's only real "teardown"
 * path today — there is no SPA unmount in this single-page bootstrap
 * (mirrors the comment in `lenisScroll.ts`).
 */
function initParallax(hero: HTMLElement, headline: HTMLElement, labels: HTMLElement[]): void {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const headlineX = gsap.quickTo(headline, 'x', PARALLAX_VARS);
    const headlineY = gsap.quickTo(headline, 'y', PARALLAX_VARS);
    const labelSetters = labels.map((label) => ({
      x: gsap.quickTo(label, 'x', PARALLAX_VARS),
      y: gsap.quickTo(label, 'y', PARALLAX_VARS),
      speed: parallaxSpeed(label),
    }));

    const handlePointerMove = (event: PointerEvent): void => {
      const rect = hero.getBoundingClientRect();
      // Normalize to roughly -0.5..0.5 across the hero's own box.
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;

      headlineX(nx * PARALLAX_RANGE_PX);
      headlineY(ny * PARALLAX_RANGE_PX);

      labelSetters.forEach(({ x, y, speed }) => {
        x(-nx * PARALLAX_RANGE_PX * speed);
        y(-ny * PARALLAX_RANGE_PX * speed);
      });
    };

    hero.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      hero.removeEventListener('pointermove', handlePointerMove);
      gsap.set([headline, ...labels], { clearProps: 'transform' });
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set([headline, ...labels], { clearProps: 'transform' });
  });
}

/**
 * Boots the hero section: the load reveal + the pointer-parallax garnish.
 * Guards every lookup — no-ops safely if `#hero` or its headline is absent.
 */
export function initHero(root: ParentNode = document): void {
  const hero = root.querySelector<HTMLElement>('#hero');
  const headline = hero?.querySelector<HTMLElement>('.hero__headline');
  if (!hero || !headline) {
    return;
  }

  // Load reveal: fires once fonts have settled (or the fallback timeout
  // elapses), never gated on anything that can hang forever. No
  // `scrollTrigger` — this is a load reveal, not a scroll one.
  void whenFontsSettled().then(() => {
    revealLines(headline);

    // The reveal ScrollTriggers (this section's own, plus manifesto/work/
    // footer's — all booted synchronously earlier in the same `bootstrap()`
    // call, see main.ts) were created before webfonts swapped in; the
    // `font-display: swap` metric shift can leave their cached start
    // positions slightly stale. A single refresh here, once fonts have
    // settled, recomputes every trigger's start/end against the now-final
    // layout. Not a recurring call — ScrollTrigger already auto-refreshes on
    // load/resize on its own — and guarded so this best-effort recompute can
    // never throw its way into breaking the load reveal above it.
    try {
      ScrollTrigger.refresh();
    } catch {
      // Defensive only (mirrors theme.ts's storage guards) — a failed
      // recompute here is a missed nice-to-have, not a broken page.
    }
  });

  const labels = Array.from(hero.querySelectorAll<HTMLElement>('[data-parallax]'));
  initParallax(hero, headline, labels);
}
