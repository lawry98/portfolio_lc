/**
 * Footer section — scroll reveal for the closing CTA (SPEC §8.6).
 *
 * Mirrors the hero's load reveal, gated on scroll instead of load: the
 * two-line `.footer__headline` ("LET'S" / "BUILD", each its own block
 * `.footer__line` span — same shape as the hero's `.hero__headline`, no
 * `data-reveal` hook of its own) mask-rises via `revealLines()`, and the
 * meta row (email link + fed-glyph counter placeholder) and the copyright
 * line each fade/rise in via `revealFade()`.
 *
 * T8 makes the footer CTA Byte's SECOND retype home (`createBytePet`'s
 * `setHomeAnchor`). Two things follow from that here:
 *  - the headline reveal is DEFERRED one frame so `createBytePet`'s
 *    `buildHome` (main.ts calls it AFTER `initFooter`) tags the
 *    `.footer__line` spans + appends Byte's footer caret BEFORE SplitText
 *    snapshots the headline — otherwise the split captures the untagged,
 *    caret-less markup and its revert wipes both (mirrors how the hero reveal
 *    defers to `whenFontsSettled()`, also after `createBytePet`);
 *  - the `revealLines` SplitText is reverted once the scroll reveal has played
 *    (mirror hero.ts's bounded `REVEAL_REVERT_S`, R-T6a-4), so its
 *    `mask: 'lines'` wrappers don't sit over the retype spans/caret and the
 *    caret's offsetParent stays `.footer__headline`. Best-effort / guarded:
 *    the retype still FUNCTIONS without it (`renderRetype` resolves
 *    `[data-byte-line]` live + uses offsetParent-immune rect deltas), so a
 *    failed revert is a missed nice-to-have, never a broken page.
 *
 * Reduced motion is handled entirely by the primitives (see `reveals.ts`).
 */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { revealFade, revealLines } from './reveals';

// Registered defensively (idempotent — reveals.ts also registers it) since
// this module creates its own ScrollTrigger below to time the reveal-revert.
gsap.registerPlugin(ScrollTrigger);

/**
 * Seconds after the footer's scroll reveal fires before its SplitText is
 * reverted — mirrors hero.ts's own `REVEAL_REVERT_S` (R-T6a-4). Comfortably
 * past the mask-rise (0.9s + line stagger) so the animation always completes
 * first; measured from the reveal's `top 80%` scroll point (not from load) via
 * a one-shot ScrollTrigger, so it can never revert before the mask-rise plays.
 */
const REVEAL_REVERT_S = 2;

/**
 * Sets up the footer headline's masked-line reveal + its bounded SplitText
 * revert. Deferred a frame (see the module doc comment) so Byte's footer
 * `buildHome` runs first; the reveal itself is unchanged (`revealLines` with a
 * scroll trigger). Guarded so it never throws into boot.
 */
function initFooterHeadlineReveal(headline: HTMLElement): void {
  const start = (): void => {
    const revertReveal = revealLines(headline, { scrollTrigger: true });

    // Revert once the scroll reveal has PLAYED: fire the bounded revert
    // `REVEAL_REVERT_S` after the same `top 80%` point the reveal uses, via a
    // one-shot ScrollTrigger (`once: true` self-kills after firing). This
    // restores `.footer__line[data-byte-line]` as direct children of
    // `.footer__headline` (unwrapping SplitText's line/mask wrappers), keeping
    // the retype caret's geometry honest. Guarded — see the module doc comment.
    ScrollTrigger.create({
      trigger: headline,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.delayedCall(REVEAL_REVERT_S, () => {
          try {
            revertReveal();
          } catch {
            // Defensive only — a failed revert is a missed nice-to-have, not a
            // broken page (mirrors hero.ts's own guard).
          }
        });
      },
    });
  };

  // Defer one frame so `createBytePet`'s `buildHome` has already tagged +
  // caret-seeded the original `.footer__line` spans before SplitText snapshots
  // the headline. `requestAnimationFrame` fires after the synchronous
  // `bootstrap()` (which calls `createBytePet` after `initFooter`); falls back
  // to running immediately where rAF is unavailable.
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(start);
  } else {
    start();
  }
}

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
    initFooterHeadlineReveal(headline);
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
