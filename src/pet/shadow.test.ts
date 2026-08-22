import {
  BASE_SHADOW_SCALE,
  MAX_HOVER_HEIGHT,
  MAX_SHADOW_OPACITY,
  MAX_SHADOW_SCALE,
  MIN_SHADOW_OPACITY,
  shadowOpacityForHeight,
  shadowScaleForHeight,
} from './shadow';

/**
 * Height math only — no WebGL, no canvas. `createBlobShadow()` draws to a 2D
 * canvas (`getContext('2d')`) to build its `CanvasTexture`, and jsdom's
 * `HTMLCanvasElement.getContext('2d')` returns `null` (no 2D backend), so
 * that function is intentionally left untested here; it's browser-only and
 * gets exercised visually once T5 wires it into the live scene.
 */

describe('shadowScaleForHeight', () => {
  it('returns the base scale at h=0 (resting on the ground)', () => {
    expect(shadowScaleForHeight(0)).toBe(BASE_SHADOW_SCALE);
  });

  it('increases monotonically as height grows', () => {
    const heights = [0, 20, 40, 60, 80, 100, 120, 140];
    const scales = heights.map(shadowScaleForHeight);

    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    }
  });

  it('is exactly halfway between base and max at the midpoint height', () => {
    const expectedMid = (BASE_SHADOW_SCALE + MAX_SHADOW_SCALE) / 2;
    expect(shadowScaleForHeight(MAX_HOVER_HEIGHT / 2)).toBeCloseTo(expectedMid, 9);
  });

  it('reaches exactly MAX_SHADOW_SCALE at MAX_HOVER_HEIGHT', () => {
    expect(shadowScaleForHeight(MAX_HOVER_HEIGHT)).toBeCloseTo(MAX_SHADOW_SCALE, 9);
  });

  it('clamps to MAX_SHADOW_SCALE beyond MAX_HOVER_HEIGHT instead of continuing to grow', () => {
    expect(shadowScaleForHeight(MAX_HOVER_HEIGHT * 5)).toBe(MAX_SHADOW_SCALE);
    expect(shadowScaleForHeight(1e6)).toBe(MAX_SHADOW_SCALE);
  });

  it('clamps to the base scale for negative height (never smaller than resting)', () => {
    expect(shadowScaleForHeight(-50)).toBe(BASE_SHADOW_SCALE);
  });
});

describe('shadowOpacityForHeight', () => {
  it('returns max opacity at h=0 (resting on the ground)', () => {
    expect(shadowOpacityForHeight(0)).toBe(MAX_SHADOW_OPACITY);
  });

  it('decreases monotonically as height grows', () => {
    const heights = [0, 20, 40, 60, 80, 100, 120, 140];
    const opacities = heights.map(shadowOpacityForHeight);

    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeLessThan(opacities[i - 1]);
    }
  });

  it('is exactly halfway between max and min at the midpoint height', () => {
    const expectedMid = (MAX_SHADOW_OPACITY + MIN_SHADOW_OPACITY) / 2;
    expect(shadowOpacityForHeight(MAX_HOVER_HEIGHT / 2)).toBeCloseTo(expectedMid, 9);
  });

  it('reaches exactly MIN_SHADOW_OPACITY (0) at MAX_HOVER_HEIGHT', () => {
    expect(shadowOpacityForHeight(MAX_HOVER_HEIGHT)).toBe(MIN_SHADOW_OPACITY);
  });

  it('clamps to 0 for large height instead of going negative', () => {
    expect(shadowOpacityForHeight(MAX_HOVER_HEIGHT * 5)).toBe(0);
    expect(shadowOpacityForHeight(1e6)).toBe(0);
  });

  it('clamps to max opacity for negative height (never more opaque than resting)', () => {
    expect(shadowOpacityForHeight(-50)).toBe(MAX_SHADOW_OPACITY);
  });

  it('stays within [0, MAX_SHADOW_OPACITY] for any height', () => {
    for (const h of [-100, 0, 1, 70, 140, 500]) {
      const opacity = shadowOpacityForHeight(h);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(MAX_SHADOW_OPACITY);
    }
  });
});
