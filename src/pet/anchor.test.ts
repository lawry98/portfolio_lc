import { describe, expect, it } from 'vitest';
import { pickAnchor } from './anchor';
import type { AnchorViewport } from './anchor';

/**
 * `pickAnchor` is plain arithmetic (no gsap, no three, no DOM, no wall-clock,
 * no `Math.random`) — every case here is a direct transcription of the T8
 * plan's task-1 brief, so each `it` title states the expected winner and the
 * visible-pixel numbers that produce it.
 */

const viewport: AnchorViewport = { height: 800 };

describe('pickAnchor: one block in view, the other off-screen', () => {
  it('picks hero: hero fully in view (visible 100), footer below the fold (visible 0)', () => {
    const hero = { top: 100, bottom: 200 };
    const footer = { top: 900, bottom: 1000 };
    expect(pickAnchor(hero, footer, viewport)).toBe('hero');
  });

  it('picks footer: footer fully in view (visible 100), hero scrolled above (visible 0)', () => {
    const hero = { top: -500, bottom: -400 };
    const footer = { top: 300, bottom: 400 };
    expect(pickAnchor(hero, footer, viewport)).toBe('footer');
  });
});

describe('pickAnchor: both partially visible — more-visible-pixels wins', () => {
  it('picks footer: hero visible 50 vs footer visible 100', () => {
    const hero = { top: -50, bottom: 50 };
    const footer = { top: 700, bottom: 900 };
    expect(pickAnchor(hero, footer, viewport)).toBe('footer');
  });

  it('picks hero: a rect taller than the band clamps to its visible slice (hero visible 300 vs footer visible 50)', () => {
    const hero = { top: -100, bottom: 300 };
    const footer = { top: 600, bottom: 650 };
    expect(pickAnchor(hero, footer, viewport)).toBe('hero');
  });

  it('picks hero: a rect straddling the bottom edge clamps at viewport.height (footer visible 50, not 450)', () => {
    // If bottom were left unclamped, footer's raw span (1200 - 750 = 450)
    // would beat hero's 200 and flip the result to 'footer' — so this only
    // passes when the bottom edge is actually clamped to viewport.height.
    const hero = { top: 100, bottom: 300 };
    const footer = { top: 750, bottom: 1200 };
    expect(pickAnchor(hero, footer, viewport)).toBe('hero');
  });
});

describe('pickAnchor: ties resolve to hero (strict `>` tie-break)', () => {
  it('picks hero when both are equally visible (100 vs 100)', () => {
    const hero = { top: 0, bottom: 100 };
    const footer = { top: 700, bottom: 800 };
    expect(pickAnchor(hero, footer, viewport)).toBe('hero');
  });

  it('picks hero when both are entirely off-screen (0 vs 0)', () => {
    const hero = { top: -500, bottom: -400 };
    const footer = { top: 900, bottom: 1000 };
    expect(pickAnchor(hero, footer, viewport)).toBe('hero');
  });
});
