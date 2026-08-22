/**
 * Selected-work section — scroll reveal for the row list (SPEC §8.4).
 *
 * Each `.work__row` fades/rises in independently as it scrolls into view —
 * one `revealFade()` call per row, so each gets its own `ScrollTrigger` and
 * fires "on enter" for that row specifically. That produces a natural
 * stagger for free as the user scrolls past the list (row 1 enters and
 * reveals, then row 2, then row 3) without reaching for `revealFade`'s
 * `stagger` option — which only staggers multiple targets handed to a
 * *single* tween, not useful here since every row needs its own
 * scroll-triggered entrance rather than one shared group entrance.
 *
 * Row hover/focus (the `translateX` nudge, accent-color swap on name/arrow)
 * is already plain CSS from Task 2 (`global.css`'s `.work__row:hover` /
 * `:focus-visible` rules) — not reimplemented here.
 *
 * Reduced motion is handled entirely by `revealFade()` itself: rows render
 * at their final visible state with no motion (see `reveals.ts`).
 */

import { revealFade } from './reveals';

/**
 * Boots the selected-work section's scroll reveals. Guards every lookup —
 * no-ops safely if `#selected-work` or its rows are absent.
 */
export function initWork(root: ParentNode = document): void {
  const section = root.querySelector<HTMLElement>('#selected-work');
  if (!section) {
    return;
  }

  section
    .querySelectorAll<HTMLElement>('.work__row[data-reveal="fade"]')
    .forEach((row) => revealFade(row, { scrollTrigger: true }));
}
