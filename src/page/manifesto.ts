/**
 * Manifesto section — scroll reveals + parallax micro-labels (SPEC §8.3).
 *
 * Three independent behaviours, all scoped to `#manifesto`:
 *  - the 3 display lines (`.manifesto__line[data-reveal="lines"]`) each get
 *    their own `revealLines()` call — one per element, "honoring" the
 *    per-line hooks Task 2 already wired into the markup — so each line
 *    masks/rises on its own `ScrollTrigger` as it crosses the viewport
 *    threshold, rather than one grouped call over the whole heading;
 *  - the supporting paragraph fades/rises on scroll via `revealFade()`;
 *  - the two `[data-parallax]` micro-labels ("APPROACH" / "— 01") drift on
 *    `y` at their own `data-parallax-speed`, scrubbed across the section's
 *    entire time on screen — differing (and here, opposite-signed) speeds
 *    produce the depth effect the copy deck calls for.
 *
 * `revealLines`/`revealFade` already branch on `prefers-reduced-motion`
 * internally (see `reveals.ts`); the parallax below does its own
 * `gsap.matchMedia()` branch, mirroring `hero.ts`'s pointer-parallax: no
 * scrub tweens at all under reduced motion, not just a faster version of
 * the same drift.
 */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { revealFade, revealLines } from './reveals';

// Registered defensively (idempotent — see reveals.ts) since this module
// hands a `scrollTrigger` config straight to `gsap.to()` itself, rather than
// only going through the already-registered `revealLines`/`revealFade`.
gsap.registerPlugin(ScrollTrigger);

/**
 * Total `y` drift (px) at `|speed| === 1`, applied across the section's
 * entire scroll-through range (`top bottom` → `bottom top`). An order of
 * magnitude above the hero's pointer-parallax budget (`PARALLAX_MAX_PX`,
 * ~8px) since this drift accumulates over a much longer scroll distance
 * instead of a single pointer nudge — still reads as a subtle depth cue,
 * not a hop.
 */
const PARALLAX_RANGE_PX = 120;

/**
 * Reads the `data-parallax-speed` hook, defaulting to `1` and clamping to
 * +/-1 so a stray markup value can't blow the parallax budget — mirrors
 * `hero.ts`'s `parallaxSpeed()`.
 */
function parallaxSpeed(el: HTMLElement): number {
  const raw = Number(el.dataset.parallaxSpeed);
  return Number.isFinite(raw) ? gsap.utils.clamp(-1, 1, raw) : 1;
}

/**
 * Wires the scroll-parallax for the manifesto's micro-labels. Each label
 * gets its own scrubbed tween: `start: 'top bottom'` / `end: 'bottom top'`
 * on the section spans the label's entire time on screen, and `scrub: true`
 * ties tween progress directly to scroll position, so ScrollTrigger — not
 * a per-frame `getBoundingClientRect` read — owns the position math.
 *
 * Branches on `prefers-reduced-motion` via its own `gsap.matchMedia()`:
 * `no-preference` creates the scrubbed tweens; `reduce` skips them and
 * resets any transform to neutral. matchMedia re-evaluates live on an OS
 * toggle, killing the `no-preference` branch's tweens before running
 * `reduce` (same live-teardown story as `hero.ts`'s `initParallax`).
 *
 * No-ops if there are no `[data-parallax]` labels to wire.
 */
function initParallax(section: HTMLElement, labels: HTMLElement[]): void {
  if (labels.length === 0) {
    return;
  }

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const tweens = labels.map((label) =>
      gsap.to(label, {
        y: PARALLAX_RANGE_PX * parallaxSpeed(label),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }),
    );

    return () => {
      // Killing a tween created with an inline `scrollTrigger` config also
      // kills the ScrollTrigger instance it spawned — same convention as
      // `reveals.ts`'s `revealFade` cleanup (`tween?.kill()`).
      tweens.forEach((tween) => tween.kill());
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(labels, { clearProps: 'transform' });
  });
}

/**
 * Boots the manifesto section: line/paragraph scroll reveals + the
 * micro-label parallax. Guards every lookup — no-ops safely if `#manifesto`
 * is absent, and each behaviour independently no-ops if its own elements
 * are missing.
 */
export function initManifesto(root: ParentNode = document): void {
  const section = root.querySelector<HTMLElement>('#manifesto');
  if (!section) {
    return;
  }

  section
    .querySelectorAll<HTMLElement>('.manifesto__line[data-reveal="lines"]')
    .forEach((line) => revealLines(line, { scrollTrigger: true }));

  const paragraph = section.querySelector<HTMLElement>('.manifesto__paragraph[data-reveal="fade"]');
  if (paragraph) {
    revealFade(paragraph, { scrollTrigger: true });
  }

  const labels = Array.from(section.querySelectorAll<HTMLElement>('[data-parallax]'));
  initParallax(section, labels);
}
