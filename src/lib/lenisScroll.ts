import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/**
 * Lenis smooth scroll + GSAP ScrollTrigger integration — one clock.
 *
 * Registers ScrollTrigger once at module init (idempotent — harmless even
 * though a later module also registers SplitText), then boots a Lenis
 * instance and drives it off GSAP's own ticker so smooth scroll,
 * ScrollTrigger, and any future WebGL rAF draw all share a single clock
 * (CLAUDE.md "GSAP conventions": drive the render loop off `gsap.ticker`).
 *
 * Honors `prefers-reduced-motion: reduce` by skipping Lenis entirely and
 * leaving native scroll in charge — ScrollTrigger still works against the
 * default (window) scroller in that branch, it just reads the browser's own
 * scroll position instead of Lenis's virtual one.
 */

gsap.registerPlugin(ScrollTrigger);

export interface LenisScrollHandle {
  raf(t: number): void;
  destroy(): void;
}

/**
 * `matchMedia` is absent in some non-browser/old-webview environments.
 * Treat that as "skip Lenis" rather than "no preference": Lenis's own
 * constructor unconditionally calls `window.matchMedia` too (its
 * `respectReducedMotion` option defaults to `true`), so if we went ahead and
 * created a Lenis instance here it would throw anyway. Degrading straight to
 * native scroll is what actually satisfies "never throw".
 */
function shouldUseNativeScroll(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Handle for the reduced-motion (or `matchMedia`-less) path: Lenis is never
 * created, so there is nothing for `raf` to drive or `destroy` to tear down —
 * both are safe no-ops, so callers can use the same interface either way.
 */
function createNativeScrollHandle(): LenisScrollHandle {
  return {
    raf(): void {
      // No-op — native scroll drives itself.
    },
    destroy(): void {
      // No-op — nothing was created.
    },
  };
}

/**
 * Boots Lenis (with its own rAF loop disabled) and wires it to `gsap.ticker`:
 * the ticker calls `lenis.raf()` every frame, converting GSAP's seconds-based
 * ticker time to the milliseconds Lenis expects, and Lenis's `scroll` event
 * calls `ScrollTrigger.update()` so ScrollTrigger's cached trigger positions
 * stay in sync with Lenis's virtual scroll instead of drifting against it.
 * `lagSmoothing(0)` turns off GSAP's jump-ahead-after-a-stall behaviour,
 * since Lenis already smooths the scroll and the two would otherwise fight
 * after a long task or a tab-away/tab-back.
 */
function createLenisHandle(): LenisScrollHandle {
  const lenis = new Lenis({ autoRaf: false });

  // Keep a reference to the exact callback instance so `destroy()` can
  // remove this one ticker subscription (`gsap.ticker.add` returns void, not
  // an unsubscribe handle).
  const onTick = (time: number): void => {
    lenis.raf(time * 1000);
  };

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);

  return {
    raf(t: number): void {
      lenis.raf(t);
    },
    destroy(): void {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    },
  };
}

export function initLenis(): LenisScrollHandle {
  return shouldUseNativeScroll() ? createNativeScrollHandle() : createLenisHandle();
}
