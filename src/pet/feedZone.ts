/**
 * The feed zone: which page region owns one of Byte's home anchors (brief 4c
 * "the feed zone (hero area)").
 *
 * Split out of `createBytePet.ts` so the DOM-traversal decision is a pure,
 * jsdom-testable function — same "pure core, thin executor" split as
 * `anchor.ts`/`retype.ts`. `createBytePet` calls this once per home and
 * re-binds its `pointerdown` listener whenever `setHomeAnchor` switches homes,
 * so the clickable area FOLLOWS Byte instead of being captured once at
 * construction.
 */

/**
 * The HTML region elements a home anchor can live in. Deliberately TAG names
 * (HTML sectioning content + the page-region landmarks), never page CSS class
 * names — that is what keeps `pet/` portable across host pages.
 *
 * `section` alone is not enough: it is a TYPE selector, so it matches
 * `<section id="hero">` but NOT a `<footer class="section">` — a `<footer>`
 * that merely carries a `section` class, which is exactly how the demo page's
 * footer (Byte's second home) is marked up.
 */
const REGION_SELECTOR = 'section, article, aside, nav, header, footer, main';

/**
 * The feed zone for home anchor `el` — its nearest enclosing page region,
 * falling back to the anchor's parent, then to the anchor itself, so a
 * stripped or unusual host page always yields SOME zone rather than none.
 */
export function feedZoneFor(el: HTMLElement): HTMLElement {
  return el.closest<HTMLElement>(REGION_SELECTOR) ?? el.parentElement ?? el;
}
