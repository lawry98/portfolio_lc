import { describe, expect, it } from 'vitest';
import { REST_OFFSET_UNITS, restFeetX } from './restPose';

/**
 * `restPose` is plain arithmetic (no gsap, no three, no DOM) — the position
 * settled with the owner on 2026-09-24 (D-24): Byte stands upright just right
 * of the caret instead of on the text end.
 */

describe('restFeetX', () => {
  it('stands Byte half its height to the right of the text end', () => {
    expect(REST_OFFSET_UNITS).toBe(0.5);
    expect(restFeetX(-200, 130)).toBe(-135);
  });

  it('scales with Byte, so the gap holds at every viewport', () => {
    expect(restFeetX(0, 64)).toBe(32);
    expect(restFeetX(0, 130)).toBe(65);
  });
});
