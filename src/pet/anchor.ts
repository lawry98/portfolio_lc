/**
 * Byte's home-anchor selection — the PURE decision-core for T8's migration
 * (SPEC §6 "traveling & footer migration ... Home anchor = end of the
 * in-view text block (hero headline <-> footer CTA)"; TICKETS T8
 * "anchor-selection helper `pickAnchor(...)` in a small pure fn + test").
 * `pickAnchor` decides which of the two text blocks is more in view right
 * now; a later task's scroll integration calls it on scroll/resize and feeds
 * the winner to `createBytePet.ts`'s `setHomeAnchor(el)` to re-home Byte.
 * This file only decides WHICH block wins — it never reads the scroll
 * position, measures an element, or moves anything itself.
 *
 * Purity is the whole point (mirrors `fsm.ts`, `retype.ts`, and
 * `glyphs.ts`'s `createGlyphQueue`): this file imports neither `gsap` nor
 * `three`, and never touches the DOM (no `window`/`document`/`DOMRect`), the
 * wall clock (`Date.now`/`performance.now`), or `Math.random`. The caller
 * measures both blocks with `Element.getBoundingClientRect()` and reads
 * `window.innerHeight` itself, then hands in plain numbers — a real
 * `DOMRect` satisfies `AnchorRect` structurally (only its `top`/`bottom`
 * fields are read here), so no adapter is needed at the call site.
 */

/** Minimal vertical rect — a DOMRect is assignable (only top/bottom read). Screen-space px. */
export interface AnchorRect {
  top: number;
  bottom: number;
}

/** Viewport height in px (window.innerHeight at the call site). */
export interface AnchorViewport {
  height: number;
}

/**
 * How many of `rect`'s vertical pixels fall inside the on-screen viewport
 * band `[0, viewport.height]`. Clamps BOTH edges: a rect that starts above
 * the top (`top < 0`) or runs past the bottom (`bottom > viewport.height`)
 * only counts the portion actually inside the band, and a rect entirely
 * outside the band (either clamped edge would invert) floors at 0 rather
 * than going negative.
 */
function visibleCoverage(rect: AnchorRect, viewport: AnchorViewport): number {
  return Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0));
}

/**
 * Which text block is Byte's home: whichever has MORE vertical pixels inside the
 * viewport band [0, viewport.height]. Ties (equal coverage, including both 0)
 * resolve to 'hero' — Byte's primary/default home. Pure.
 */
export function pickAnchor(
  hero: AnchorRect,
  footer: AnchorRect,
  viewport: AnchorViewport,
): 'hero' | 'footer' {
  const visibleHero = visibleCoverage(hero, viewport);
  const visibleFooter = visibleCoverage(footer, viewport);
  // Strict `>` is the tie-break: footer must be STRICTLY more visible to win,
  // so an exact tie (both equally visible, including both fully off-screen
  // at 0) falls through to hero, Byte's default home.
  return visibleFooter > visibleHero ? 'footer' : 'hero';
}
