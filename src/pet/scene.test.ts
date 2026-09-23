import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  FOV_DEG,
  cameraDistanceForHeight,
  clampFeetToStage,
  hasWebGL,
  scissorFromStage,
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

describe('scissorFromStage', () => {
  it("flips y for a stage flush to the viewport top (the brief's worked example: viewportHeight 900, y 0, height 800 → y 100)", () => {
    const stage = { x: 20, y: 0, width: 600, height: 800 };
    expect(scissorFromStage(stage, 900)).toEqual({ x: 20, y: 100, width: 600, height: 800 });
  });

  it('flips y for a different stage flush to the viewport top', () => {
    const stage = { x: 40, y: 0, width: 300, height: 250 };
    expect(scissorFromStage(stage, 1000)).toEqual({ x: 40, y: 750, width: 300, height: 250 });
  });

  it('returns y = 0 for a stage flush to the viewport bottom', () => {
    const stage = { x: 10, y: 900, width: 500, height: 300 };
    expect(scissorFromStage(stage, 1200)).toEqual({ x: 10, y: 0, width: 500, height: 300 });
  });

  it('flips y for a mid-page stage touching neither edge', () => {
    const stage = { x: 100, y: 200, width: 400, height: 150 };
    expect(scissorFromStage(stage, 800)).toEqual({ x: 100, y: 450, width: 400, height: 150 });
  });

  it('does not clamp — a stage taller than the viewport yields a negative y', () => {
    const stage = { x: 0, y: 0, width: 1440, height: 900 };
    expect(scissorFromStage(stage, 600)).toEqual({ x: 0, y: -300, width: 1440, height: 900 });
  });
});

describe('clampFeetToStage', () => {
  it('is a no-op for a point already comfortably inside the stage (catches a missed or doubled conversion)', () => {
    // Reviewer's worked example (Task 3 fix round 1): 390×844 viewport,
    // footer home, unitPx 52, stage {x:0, y:400, width:390, height:229}
    // (viewport-relative — the footer scrolled into view), anchor screen
    // (220, 456), drift.x +8 — mirrors createBytePet.ts's own
    // `rootX = anchorWorld.x + drift.x; rootY = anchorWorld.y - unitPx / 2`.
    // anchorWorld = worldFromScreen(220, 456, 390, 844) = {x: 25, y: -34}.
    // feet = {x: 25 + 8, y: -34 - 26} = {x: 33, y: -60}.
    const feet = { x: 33, y: -60 };
    const stage = { x: 0, y: 400, width: 390, height: 229 };

    expect(clampFeetToStage(feet, 52, stage, { width: 390, height: 844 }, 12)).toEqual({
      x: 33,
      y: -60,
    });
  });

  it('clamps against the stage TOP edge, pushing the box DOWN (away from the edge)', () => {
    // 800×800 viewport, unitPx 100, pad 20, stage {x:0,y:100,w:800,h:500}
    // (screen y in [100,600]). feet {x:0,y:300} forward-converts to centre
    // screen (400, 50) — above the stage's own top edge. Clamped centre
    // screen y is stage.y + pad + unitPx/2 = 100+20+50 = 170; x (400) is
    // untouched (already centered). Back through centre->feet: world centre
    // (0, 230), feet (0, 180) — moved DOWN (world-y decreased), into the
    // stage, never through it.
    const feet = { x: 0, y: 300 };
    const stage = { x: 0, y: 100, width: 800, height: 500 };

    expect(clampFeetToStage(feet, 100, stage, { width: 800, height: 800 }, 20)).toEqual({
      x: 0,
      y: 180,
    });
  });

  it('clamps against the stage BOTTOM edge, pushing the box UP (away from the edge)', () => {
    // Same stage/viewport/unitPx/pad as the top-edge case. feet {x:0,y:-350}
    // forward-converts to centre screen (400, 700) — below the stage's own
    // bottom edge. Clamped centre screen y is
    // stage.y + height - pad - unitPx/2 = 100+500-20-50 = 530. Back through
    // centre->feet: world centre (0, -130), feet (0, -180) — moved UP
    // (world-y increased), into the stage, never through it.
    const feet = { x: 0, y: -350 };
    const stage = { x: 0, y: 100, width: 800, height: 500 };

    expect(clampFeetToStage(feet, 100, stage, { width: 800, height: 800 }, 20)).toEqual({
      x: 0,
      y: -180,
    });
  });

  it('clamps against the stage LEFT edge, pushing the box RIGHT (away from the edge)', () => {
    // Same stage/viewport/unitPx/pad as the top-edge case. feet {x:-450,y:0}
    // forward-converts to centre screen (-50, 350) — left of the stage's
    // own left edge. Clamped centre screen x is stage.x + pad + unitPx/2 =
    // 0+20+50 = 70. Back through centre->feet: world centre (-330, 50),
    // feet (-330, 0) — moved RIGHT (world-x increased), into the stage.
    const feet = { x: -450, y: 0 };
    const stage = { x: 0, y: 100, width: 800, height: 500 };

    expect(clampFeetToStage(feet, 100, stage, { width: 800, height: 800 }, 20)).toEqual({
      x: -330,
      y: 0,
    });
  });

  it('clamps against the stage RIGHT edge, pushing the box LEFT (away from the edge)', () => {
    // Same stage/viewport/unitPx/pad as the top-edge case. feet {x:450,y:0}
    // forward-converts to centre screen (850, 350) — right of the stage's
    // own right edge. Clamped centre screen x is
    // stage.x + width - pad - unitPx/2 = 0+800-20-50 = 730. Back through
    // centre->feet: world centre (330, 50), feet (330, 0) — moved LEFT
    // (world-x decreased), into the stage.
    const feet = { x: 450, y: 0 };
    const stage = { x: 0, y: 100, width: 800, height: 500 };

    expect(clampFeetToStage(feet, 100, stage, { width: 800, height: 800 }, 20)).toEqual({
      x: 330,
      y: 0,
    });
  });

  it('agrees with the controller-verified tight-mobile boundary numbers (390×844 footer stage)', () => {
    // Controller's real numbers: 390×844 viewport, unitPx 52, footer stage
    // {x:0, y:2228, width:390, height:229}, pad 12 — the tight mobile
    // footer from the brief (~4.4× unitPx of room). feet {x:-195, y:396}
    // forward-converts to centre screen (0, 0) — the viewport's own
    // top-left corner, "well outside" the stage on BOTH axes. The
    // controller ran the real `clampToStage` on this and got centre screen
    // exactly {x: 38, y: 2266} (= 0+12+26 and 2228+12+26); back through
    // centre->feet: world centre (-157, -1844), feet (-157, -1870).
    const feet = { x: -195, y: 396 };
    const stage = { x: 0, y: 2228, width: 390, height: 229 };

    expect(clampFeetToStage(feet, 52, stage, { width: 390, height: 844 }, 12)).toEqual({
      x: -157,
      y: -1870,
    });
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
