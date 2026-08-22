/**
 * Footer section — scroll reveal for the closing CTA (SPEC §8.5).
 *
 * Mirrors the hero's load reveal, gated on scroll instead of load: the
 * two-line `.footer__headline` ("LET'S" / "BUILD", each its own block
 * `.footer__line` span — same shape as the hero's `.hero__headline`, no
 * `data-reveal` hook of its own) mask-rises via `revealLines()`, and the
 * meta row (email link + fed-glyph counter placeholder) and the copyright
 * line each fade/rise in via `revealFade()`.
 *
 * This module's only T2 job is the reveal. The counter (`[data-fed-counter]`)
 * and any retype/feed behaviour belong to later tickets (counter
 * increments, footer retype, the eventual pet migration) — they'll query
 * `[data-fed-counter]` and `.footer__email` themselves when that work
 * lands, so no ref is held here speculatively.
 *
 * Reduced motion is handled entirely by the primitives (see `reveals.ts`).
 */

import { revealFade, revealLines } from './reveals';

/**
 * Boots the footer's scroll reveals. Guards every lookup — no-ops safely if
 * `#footer` or a given sub-element is absent.
 */
export function initFooter(root: ParentNode = document): void {
  const footer = root.querySelector<HTMLElement>('#footer');
  if (!footer) {
    return;
  }

  const headline = footer.querySelector<HTMLElement>('.footer__headline');
  if (headline) {
    revealLines(headline, { scrollTrigger: true });
  }

  const meta = footer.querySelector<HTMLElement>('.footer__meta');
  if (meta) {
    revealFade(meta, { scrollTrigger: true });
  }

  const copyright = footer.querySelector<HTMLElement>('.footer__copyright');
  if (copyright) {
    revealFade(copyright, { scrollTrigger: true });
  }
}
