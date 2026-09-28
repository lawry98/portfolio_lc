import { describe, expect, it } from 'vitest';
import {
  buildChargeRelease,
  buildPulse,
  byteScreenBox,
  chooseSwitchPlan,
  composeGlow,
  cornerFeetScreen,
  FLIP_AT_S,
  PULSE_S,
  restingGesture,
  THEME_SWITCH_LERP_S,
  visibleFraction,
  type GestureState,
} from './themeGesture';
import type { PetState } from './types';

/**
 * GSAP stamps an enumerable `_gsap` cache onto every object it tweens, so a
 * tweened `GestureState` never `toEqual`s a fresh one — compare its four
 * fields instead (verified against gsap 3.15, 2026-09-28).
 */
function fields(g: GestureState): GestureState {
  return { sqY: g.sqY, sqXZ: g.sqXZ, glowMul: g.glowMul, boost: g.boost };
}

describe('chooseSwitchPlan', () => {
  const resting: PetState[] = ['idle', 'curious', 'invited', 'peeking', 'sleeping', 'waking'];
  const busy: PetState[] = ['dashing', 'eating', 'retyping'];
  const away: PetState[] = ['hidden', 'entering', 'traveling', 'switching'];

  it.each(resting)('%s: home when >= 50%% visible, corner otherwise', (s) => {
    expect(chooseSwitchPlan(s, 0.5, false)).toBe('home');
    expect(chooseSwitchPlan(s, 0.49, false)).toBe('corner');
  });

  it.each(busy)('%s: layered when visible, button otherwise', (s) => {
    expect(chooseSwitchPlan(s, 1, false)).toBe('layer');
    expect(chooseSwitchPlan(s, 0, false)).toBe('button');
  });

  it.each(away)('%s: always the button reveal', (s) => {
    expect(chooseSwitchPlan(s, 1, false)).toBe('button');
  });

  it('reduced motion: a glow pulse when Byte is visible and able, else a plain crossfade', () => {
    expect(chooseSwitchPlan('idle', 1, true)).toBe('pulse');
    expect(chooseSwitchPlan('eating', 1, true)).toBe('pulse');
    expect(chooseSwitchPlan('idle', 0, true)).toBe('instant');
    expect(chooseSwitchPlan('traveling', 1, true)).toBe('instant');
  });
});

describe('visibleFraction', () => {
  const box = { x: 0, y: 0, width: 100, height: 100 };

  it('is 1 fully inside, 0.5 half clipped, 0 disjoint or with no clip', () => {
    expect(visibleFraction(box, { x: -10, y: -10, width: 200, height: 200 })).toBe(1);
    expect(visibleFraction(box, { x: 50, y: 0, width: 100, height: 100 })).toBe(0.5);
    expect(visibleFraction(box, { x: 200, y: 0, width: 100, height: 100 })).toBe(0);
    expect(visibleFraction(box, null)).toBe(0);
  });

  it('is 0 for a degenerate box', () => {
    expect(visibleFraction({ x: 0, y: 0, width: 0, height: 10 }, box)).toBe(0);
  });
});

describe('byteScreenBox / cornerFeetScreen', () => {
  it('boxes Byte as 0.6 x 1 unit heights standing on its feet', () => {
    expect(byteScreenBox({ x: 100, y: 200 }, 100)).toEqual({
      x: 70,
      y: 100,
      width: 60,
      height: 100,
    });
  });

  it('stands Byte on the viewport bottom, inset 24px from the right edge', () => {
    expect(cornerFeetScreen({ width: 1000, height: 800 }, 100)).toEqual({ x: 946, y: 800 });
  });
});

describe('composeGlow', () => {
  it('scales the theme level by glowMul and adds the boost', () => {
    expect(composeGlow(1, restingGesture())).toBe(1);
    expect(composeGlow(1, { sqY: 1, sqXZ: 1, glowMul: 0.1, boost: 0 })).toBeCloseTo(0.1, 10);
    expect(composeGlow(0, { sqY: 1, sqXZ: 1, glowMul: 1, boost: 0.6 })).toBeCloseTo(0.6, 10);
  });
});

describe('buildChargeRelease', () => {
  it('is paused, ~1.45s long, and flips inside the release', () => {
    const tl = buildChargeRelease(restingGesture(), 'dark');
    expect(tl.paused()).toBe(true);
    expect(tl.duration()).toBeCloseTo(1.45, 5);
    expect(FLIP_AT_S).toBeGreaterThan(0.56);
    expect(FLIP_AT_S).toBeLessThan(0.67);
  });

  it('crouches to y 0.8 / xz 1.11 by the end of the charge', () => {
    const g = restingGesture();
    buildChargeRelease(g, 'light').seek(0.56);
    expect(g.sqY).toBeCloseTo(0.8, 5);
    expect(g.sqXZ).toBeCloseTo(1.11, 5);
  });

  it('going dark: the glow ignites from off during the charge', () => {
    const g = restingGesture();
    buildChargeRelease(g, 'dark').seek(0.5);
    expect(g.boost).toBeCloseTo(0.6, 5);
    expect(g.glowMul).toBe(1);
  });

  it('going light: the glow dims during the charge', () => {
    const g = restingGesture();
    buildChargeRelease(g, 'light').seek(0.5);
    expect(g.glowMul).toBeCloseTo(0.1, 5);
    expect(g.boost).toBe(0);
  });

  it.each(['light', 'dark'] as const)('to %s: flaring and stretched on the flip beat', (to) => {
    const g = restingGesture();
    buildChargeRelease(g, to).seek(FLIP_AT_S);
    expect(g.boost).toBeGreaterThan(1);
    expect(g.sqY).toBeGreaterThan(1);
  });

  it.each(['light', 'dark'] as const)('to %s: settles back to rest exactly', (to) => {
    const g = restingGesture();
    const tl = buildChargeRelease(g, to);
    tl.seek(tl.duration());
    expect(fields(g)).toEqual(restingGesture());
  });
});

describe('buildPulse', () => {
  it('peaks at PULSE_S, returns to rest, and never moves the body', () => {
    const g = restingGesture();
    const tl = buildPulse(g);
    expect(tl.paused()).toBe(true);
    tl.seek(PULSE_S);
    expect(g.boost).toBeCloseTo(1.2, 5);
    tl.seek(tl.duration());
    expect(fields(g)).toEqual(restingGesture());
  });
});

describe('THEME_SWITCH_LERP_S', () => {
  it("matches the page reveal's length so Byte's look lands with the circle", () => {
    expect(THEME_SWITCH_LERP_S * 1000).toBe(620);
  });
});
