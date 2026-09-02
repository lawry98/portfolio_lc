import { describe, expect, it } from 'vitest';
import { feedZoneFor } from './feedZone';

/**
 * `feedZoneFor` is the pure DOM-traversal half of the feed zone (no gsap, no
 * three, no wall-clock) — it answers "which page region owns this home
 * anchor?" and nothing else, so every case below is a hand-built jsdom tree.
 *
 * The regression these cases pin down: the zone used to be derived ONCE, with
 * `closest('section')`, from the HERO headline. `closest('section')` is a TYPE
 * selector, so it matched `<section id="hero">` but NOT the demo's
 * `<footer id="footer" class="section footer">` — a `<footer>` tag that merely
 * has a `section` CLASS. Byte's footer home therefore had no zone at all, and
 * (because the zone was a `const` captured at construction) the only
 * `pointerdown` listener stayed pinned to `#hero` for the whole page life.
 */
describe('feedZoneFor: sectioning-element ancestors', () => {
  it('returns the <section> ancestor for a hero headline', () => {
    document.body.innerHTML = `
      <div id="app">
        <section id="hero" class="hero"><h1 id="hero-headline"><span>A</span></h1></section>
      </div>`;
    const headline = document.querySelector<HTMLElement>('#hero-headline')!;
    expect(feedZoneFor(headline).id).toBe('hero');
  });

  it('returns the <footer> ancestor for a footer headline — the tag, not the `section` class', () => {
    document.body.innerHTML = `
      <div id="app">
        <footer id="footer" class="section footer">
          <div class="footer__inner"><h2 class="footer__headline"><span>A</span></h2></div>
        </footer>
      </div>`;
    const headline = document.querySelector<HTMLElement>('.footer__headline')!;
    expect(feedZoneFor(headline).id).toBe('footer');
  });

  it('picks the NEAREST region when regions nest', () => {
    document.body.innerHTML = `
      <main id="outer"><section id="inner"><h2 id="h">A</h2></section></main>`;
    expect(feedZoneFor(document.querySelector<HTMLElement>('#h')!).id).toBe('inner');
  });

  it('treats <article>, <aside>, <header> and <main> as regions too (portability, not page classes)', () => {
    for (const tag of ['article', 'aside', 'header', 'main']) {
      document.body.innerHTML = `<${tag} id="zone"><h2 id="h">A</h2></${tag}>`;
      expect(feedZoneFor(document.querySelector<HTMLElement>('#h')!).id).toBe('zone');
    }
  });
});

describe('feedZoneFor: fallbacks when no region ancestor exists', () => {
  it('falls back to the parent element', () => {
    document.body.innerHTML = `<div id="wrap"><h2 id="h">A</h2></div>`;
    expect(feedZoneFor(document.querySelector<HTMLElement>('#h')!).id).toBe('wrap');
  });

  it('falls back to the element itself when it has no parent', () => {
    const orphan = document.createElement('h2');
    expect(feedZoneFor(orphan)).toBe(orphan);
  });

  it('returns the element itself when it IS the region', () => {
    document.body.innerHTML = `<section id="zone"></section>`;
    const zone = document.querySelector<HTMLElement>('#zone')!;
    expect(feedZoneFor(zone)).toBe(zone);
  });
});
