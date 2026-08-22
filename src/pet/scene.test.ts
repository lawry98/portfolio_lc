import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  FOV_DEG,
  cameraDistanceForHeight,
  hasWebGL,
  screenFromWorld,
  worldFromScreen,
} from './scene';

const W = 1440;
const H = 900;

describe('worldFromScreen', () => {
  it('maps the screen center to the world origin', () => {
    expect(worldFromScreen(W / 2, H / 2, W, H)).toEqual({ x: 0, y: 0 });
  });

  it('maps known corners (screen y-down → world y-up)', () => {
    // Top-left of the screen is up-and-left of center in world space.
    expect(worldFromScreen(0, 0, W, H)).toEqual({ x: -W / 2, y: H / 2 });
    // Bottom-right of the screen is down-and-right of center in world space.
    expect(worldFromScreen(W, H, W, H)).toEqual({ x: W / 2, y: -H / 2 });
  });
});

describe('screenFromWorld', () => {
  it('is the exact inverse of worldFromScreen for several points', () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [100, 200],
      [W, H],
      [-50, 1000],
      [W / 2, H / 2],
    ];

    for (const [x, y] of points) {
      const world = worldFromScreen(x, y, W, H);
      const roundTripped = screenFromWorld(world.x, world.y, W, H);
      expect(roundTripped.x).toBeCloseTo(x, 9);
      expect(roundTripped.y).toBeCloseTo(y, 9);
    }
  });
});

describe('cameraDistanceForHeight', () => {
  it('matches the half-height-over-tan(halfFov) formula', () => {
    const expected = 500 / Math.tan((15 * Math.PI) / 180);
    expect(cameraDistanceForHeight(1000)).toBeCloseTo(expected, 9);
  });

  it('defaults to FOV_DEG (30) when no fov is passed', () => {
    expect(cameraDistanceForHeight(1000)).toBe(cameraDistanceForHeight(1000, FOV_DEG));
  });
});

describe('projection proof (ties the pixel-space formulas to a real THREE.PerspectiveCamera)', () => {
  it('projects a world-space x offset back to screen w/2 + px within ±1px', () => {
    const camera = new THREE.PerspectiveCamera(FOV_DEG, W / H, 0.1, 1e5);
    camera.position.z = cameraDistanceForHeight(H);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    for (const px of [100, -250]) {
      const ndc = new THREE.Vector3(px, 0, 0).project(camera);
      const screenX = ((ndc.x + 1) / 2) * W;
      expect(Math.abs(screenX - (W / 2 + px))).toBeLessThan(1);
    }
  });
});

describe('hasWebGL', () => {
  // jsdom's own `getContext()` logs a noisy "Not implemented" notice to the
  // console instead of throwing; stub it so the suite stays deterministic
  // and quiet while still exercising every branch of `hasWebGL()`.

  it('returns false without throwing when no context can be obtained', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => hasWebGL()).not.toThrow();
    expect(hasWebGL()).toBe(false);

    spy.mockRestore();
  });

  it('returns true when the canvas can produce a WebGL context', () => {
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as unknown as WebGL2RenderingContext);

    expect(hasWebGL()).toBe(true);

    spy.mockRestore();
  });

  it('returns false without throwing when getContext itself throws', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('context creation blocked');
    });

    expect(() => hasWebGL()).not.toThrow();
    expect(hasWebGL()).toBe(false);

    spy.mockRestore();
  });
});
