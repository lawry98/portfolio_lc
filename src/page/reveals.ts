/**
 * Shared masked-reveal primitives — consumed by the hero (load reveal, this
 * ticket) and by manifesto/work/footer (scroll reveals, a later ticket).
 *
 * Two flavours:
 *  - `revealLines()` — a masked *line* reveal via SplitText's `mask: 'lines'`
 *    (3.13+): each line rises out of an overflow-clipped mask. SplitText is
 *    free in gsap 3.15 (no Club package, no registration token).
 *  - `revealFade()` — a plain fade/rise (`autoAlpha` + `y`), no SplitText,
 *    for paragraphs and rows that don't need per-line masking.
 *
 * Both plugins are registered once here, at module init (idempotent —
 * `lenisScroll.ts` also registers ScrollTrigger; calling
 * `gsap.registerPlugin()` again with the same plugin is a harmless no-op),
 * per CLAUDE.md "GSAP conventions".
 *
 * Both branch on `prefers-reduced-motion` with `gsap.matchMedia()`:
 *  - `(prefers-reduced-motion: no-preference)` runs the real animation
 *    (masked lines for `revealLines`, a fade/rise for `revealFade`), plus a
 *    `ScrollTrigger` when `opts.scrollTrigger` is set.
 *  - `(prefers-reduced-motion: reduce)` skips the motion and *explicitly*
 *    sets the element to its final visible state — reduced motion shortens
 *    the experience to "just show it", it never merely plays the same
 *    animation faster.
 *
 * Neither branch ever renders a hidden start state via CSS — this project
 * never ships `opacity: 0` in a stylesheet, so if this module's JS never
 * ran at all the content would already be sitting at fully visible. The
 * animated branch only *starts* from a hidden state because `gsap.from()`
 * applies that start state and the tween back to visible in the same breath
 * (`immediateRender`); nothing here can leave content parked invisible.
 *
 * Cleanup: both functions return a function that reverts the matchMedia
 * (`mm.revert()` — kills any tween/ScrollTrigger created inside it) and,
 * belt-and-suspenders, explicitly reverts the SplitText instance / kills the
 * fade tween too, so a caller that re-runs a reveal (or a future page with
 * an unmount path) never leaks a split wrapper, tween, trigger, or listener.
 */

import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(SplitText, ScrollTrigger);

export interface RevealOptions {
  scrollTrigger?: boolean;
  start?: string;
  stagger?: number;
}

const DEFAULT_SCROLL_START = 'top 80%';
const DEFAULT_LINE_STAGGER = 0.12;

function noop(): void {
  // Intentional no-op cleanup for guard branches (missing/empty element).
}

/**
 * Masked line reveal: splits `el` into lines (SplitText `type: 'lines'`,
 * `mask: 'lines'`) and animates each line up out of its clip-mask.
 * `autoSplit: true` means fonts finishing loading or a resize re-splits and
 * re-runs `onSplit` automatically (3.13+). The reveal is one-shot, though:
 * `onSplit` only returns (and so only creates) the `gsap.from()` tween the
 * first time it runs — letting SplitText track/revert it across re-splits —
 * and on every later re-split instead just snaps the freshly-measured lines
 * to their final visible state, so a resize/rotation/font-swap re-measures
 * without replaying the mask-rise.
 *
 * A single `white-space: nowrap` line (e.g. the hero's `.hero__line` spans)
 * still yields exactly one "line" to SplitText — that's expected, and still
 * gets the rise-from-mask treatment.
 *
 * No-ops (returns a no-op cleanup) if `el` is missing or has no text to
 * split.
 */
export function revealLines(el: HTMLElement, opts: RevealOptions = {}): () => void {
  if (!el || !el.textContent?.trim()) {
    return noop;
  }

  let split: SplitText | undefined;
  // Sticks at `true` once the reveal tween has been created. `autoSplit`
  // re-splits (and re-invokes `onSplit`) on any width/orientation/font-size
  // change — the hero headline's `clamp()` font-size means a desktop
  // width-drag or a phone rotation both qualify — and without this guard
  // every re-split would return a brand-new `gsap.from()` (complete with its
  // own fresh `ScrollTrigger` for scroll reveals), replaying the mask-rise
  // or re-flashing a reveal that already fired. The reveal is one-shot: only
  // the first `onSplit` animates, later re-splits just re-measure.
  let revealed = false;
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    split = SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'reveal-line',
      autoSplit: true,
      onSplit(self) {
        if (revealed) {
          // Re-split from a resize/orientation/font-swap, not the first
          // run — land the freshly-measured lines at the reveal's final
          // visible state instead of replaying it.
          gsap.set(self.lines, { yPercent: 0, autoAlpha: 1 });
          return undefined;
        }

        revealed = true;
        return gsap.from(self.lines, {
          yPercent: 100,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power4.out',
          stagger: opts.stagger ?? DEFAULT_LINE_STAGGER,
          scrollTrigger: opts.scrollTrigger
            ? { trigger: el, start: opts.start ?? DEFAULT_SCROLL_START, once: true }
            : undefined,
        });
      },
    });

    return () => {
      split?.revert();
      split = undefined;
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    // No SplitText, no transform, no stagger — just the final state. Also
    // covers the OS-level toggle happening live: matchMedia re-runs this
    // branch when the query starts matching, snapping back to visible even
    // if a split/tween from the branch above is mid-flight.
    gsap.set(el, { autoAlpha: 1, clearProps: 'transform' });
  });

  return () => {
    mm.revert();
    split?.revert();
    split = undefined;
  };
}

/**
 * Fade/rise reveal (no SplitText): animates `el` from a slight downward
 * offset + transparent up to its natural, current position/opacity.
 *
 * No-ops (returns a no-op cleanup) if `el` is missing.
 */
export function revealFade(el: HTMLElement, opts: RevealOptions = {}): () => void {
  if (!el) {
    return noop;
  }

  let tween: ReturnType<typeof gsap.from> | undefined;
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    tween = gsap.from(el, {
      y: 24,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: opts.stagger,
      scrollTrigger: opts.scrollTrigger
        ? { trigger: el, start: opts.start ?? DEFAULT_SCROLL_START, once: true }
        : undefined,
    });

    return () => {
      tween?.kill();
      tween = undefined;
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'transform' });
  });

  return () => {
    mm.revert();
    tween?.kill();
    tween = undefined;
  };
}
