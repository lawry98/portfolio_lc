import { describe, expect, it } from 'vitest';
import { clampToStage, intersectViewport, stageFromSection } from './stage';
import type { Point, Rect, Size, StageRect } from './stage';

/**
 * `stage.ts` is plain arithmetic (no gsap, no three, no DOM, no wall-clock,
 * no `Math.random`) — every case here is a direct transcription of T12's
 * task-1 brief, so each `it` title states the expected value and the
 * numbers that produce it.
 */

describe('stageFromSection: no furniture', () => {
  it('returns the section unchanged (identity) when furniture is empty', () => {
    const section: Rect = { x: 20, y: 40, width: 300, height: 360 };
    expect(stageFromSection(section, [])).toEqual({ x: 20, y: 40, width: 300, height: 360 });
  });
});

describe('stageFromSection: one furniture rect', () => {
  it('insets the bottom to the furniture top (section bottom 400, furniture.y 350 -> height 310)', () => {
    const section: Rect = { x: 20, y: 40, width: 300, height: 360 }; // bottom = 400
    const furniture: Rect = { x: 20, y: 350, width: 300, height: 50 };
    expect(stageFromSection(section, [furniture])).toEqual({
      x: 20,
      y: 40,
      width: 300,
      height: 310,
    });
  });
});

describe('stageFromSection: several furniture rects — the topmost wins, wherever it sits in the array', () => {
  it('picks y 150 out of [500, 150, 380] (150 is not the first element) giving height 110', () => {
    const section: Rect = { x: 20, y: 40, width: 300, height: 360 }; // bottom = 400
    const furniture: Rect[] = [
      { x: 20, y: 500, width: 300, height: 20 },
      { x: 20, y: 150, width: 300, height: 20 }, // topmost, but not furniture[0]
      { x: 20, y: 380, width: 300, height: 20 },
    ];
    expect(stageFromSection(section, furniture)).toEqual({ x: 20, y: 40, width: 300, height: 110 });
  });
});

describe('stageFromSection: furniture entirely below the section', () => {
  it('clamps to the section bottom without extending it (furniture.y 900 leaves height at 360, not 860)', () => {
    const section: Rect = { x: 20, y: 40, width: 300, height: 360 }; // bottom = 400
    const furniture: Rect = { x: 20, y: 900, width: 300, height: 20 };
    expect(stageFromSection(section, [furniture])).toEqual({
      x: 20,
      y: 40,
      width: 300,
      height: 360,
    });
  });
});

describe('stageFromSection: furniture above the section top', () => {
  it('floors height at 0, never negative (furniture.y 10 is above section.y 40)', () => {
    const section: Rect = { x: 20, y: 40, width: 300, height: 360 };
    const furniture: Rect = { x: 20, y: 10, width: 300, height: 20 };
    expect(stageFromSection(section, [furniture])).toEqual({ x: 20, y: 40, width: 300, height: 0 });
  });
});

describe('stageFromSection: furniture exactly at the section bottom edge', () => {
  it('is a no-op (furniture.y 400 equals the section bottom, height stays 360)', () => {
    const section: Rect = { x: 20, y: 40, width: 300, height: 360 }; // bottom = 400
    const furniture: Rect = { x: 20, y: 400, width: 300, height: 20 };
    expect(stageFromSection(section, [furniture])).toEqual({
      x: 20,
      y: 40,
      width: 300,
      height: 360,
    });
  });
});

const viewport: Size = { width: 1200, height: 800 };

describe('intersectViewport: stage fully inside the viewport', () => {
  it('returns the stage unchanged (identity)', () => {
    const stage: StageRect = { x: 100, y: 100, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toEqual({ x: 100, y: 100, width: 200, height: 200 });
  });
});

describe('intersectViewport: stage straddles a viewport edge — clipped, not rejected', () => {
  it('straddling the top edge clips y to 0 and height to 150 (stage.y -50, height 200)', () => {
    const stage: StageRect = { x: 100, y: -50, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toEqual({ x: 100, y: 0, width: 200, height: 150 });
  });

  it('straddling the bottom edge clips height to 100 (stage.y 700, height 200, viewport.height 800)', () => {
    const stage: StageRect = { x: 100, y: 700, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toEqual({ x: 100, y: 700, width: 200, height: 100 });
  });

  it('straddling the left edge clips x to 0 and width to 150 (stage.x -50, width 200)', () => {
    const stage: StageRect = { x: -50, y: 100, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toEqual({ x: 0, y: 100, width: 150, height: 200 });
  });

  it('straddling the right edge clips width to 100 (stage.x 1100, width 200, viewport.width 1200)', () => {
    const stage: StageRect = { x: 1100, y: 100, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toEqual({
      x: 1100,
      y: 100,
      width: 100,
      height: 200,
    });
  });
});

describe('intersectViewport: stage entirely outside the viewport — null (the render-skip signal)', () => {
  it('entirely above the viewport (stage bottom -100) returns null', () => {
    const stage: StageRect = { x: 100, y: -300, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toBeNull();
  });

  it('entirely below the viewport (stage top 900, viewport.height 800) returns null', () => {
    const stage: StageRect = { x: 100, y: 900, width: 200, height: 200 };
    expect(intersectViewport(stage, viewport)).toBeNull();
  });

  it('exactly touching the bottom edge (stage.y 800 equals viewport.height) is zero-area, returns null', () => {
    const stage: StageRect = { x: 100, y: 800, width: 200, height: 100 };
    expect(intersectViewport(stage, viewport)).toBeNull();
  });
});

describe('clampToStage: point already inside the stage', () => {
  it('returns the point unchanged (identity)', () => {
    const stage: StageRect = { x: 50, y: 20, width: 400, height: 300 };
    const size: Size = { width: 40, height: 40 };
    const point: Point = { x: 250, y: 150 };
    expect(clampToStage(point, size, stage, 10)).toEqual({ x: 250, y: 150 });
  });
});

describe('clampToStage: point off an edge — clamps to the pad-inset boundary', () => {
  // stage x:[50,450), y:[20,320); size 40x40, pad 10 ->
  // allowed centre-x [50+10+20, 50+400-10-20] = [80, 420]
  // allowed centre-y [20+10+20, 20+300-10-20] = [50, 290]
  const stage: StageRect = { x: 50, y: 20, width: 400, height: 300 };
  const size: Size = { width: 40, height: 40 };
  const pad = 10;

  it('off the left edge clamps x to 80 (point.x -50)', () => {
    expect(clampToStage({ x: -50, y: 150 }, size, stage, pad)).toEqual({ x: 80, y: 150 });
  });

  it('off the right edge clamps x to 420 (point.x 1000)', () => {
    expect(clampToStage({ x: 1000, y: 150 }, size, stage, pad)).toEqual({ x: 420, y: 150 });
  });

  it('off the top edge clamps y to 50 (point.y -100)', () => {
    expect(clampToStage({ x: 250, y: -100 }, size, stage, pad)).toEqual({ x: 250, y: 50 });
  });

  it('off the bottom edge clamps y to 290 (point.y 500)', () => {
    expect(clampToStage({ x: 250, y: 500 }, size, stage, pad)).toEqual({ x: 250, y: 290 });
  });
});

describe('clampToStage: pad widens the excluded margin', () => {
  const stage: StageRect = { x: 50, y: 20, width: 400, height: 300 };
  const size: Size = { width: 40, height: 40 };

  it('pad 25 clamps the same off-left point to x 95, tighter than pad 10', () => {
    expect(clampToStage({ x: -50, y: 150 }, size, stage, 25)).toEqual({ x: 95, y: 150 });
  });

  it('pad 0 clamps the same off-left point to x 70, the bare box edge with no margin', () => {
    expect(clampToStage({ x: -50, y: 150 }, size, stage, 0)).toEqual({ x: 70, y: 150 });
  });
});

describe('clampToStage: stage too narrow for size+2*pad on x only — collapses to stage centre on x, clamps y normally', () => {
  // width 50 < size.width 40 + 2*pad 20 = 80, so the x range [80, 70] inverts
  // and collapses to the stage's own centre-x = 50 + 50/2 = 75. Height 300 is
  // plenty, so y keeps clamping the ordinary way ([50, 290], same as above).
  const stage: StageRect = { x: 50, y: 20, width: 50, height: 300 };
  const size: Size = { width: 40, height: 40 };
  const pad = 10;

  it('collapses x to 75 regardless of input while y clamps to 290 (point off bottom at 500)', () => {
    expect(clampToStage({ x: -1000, y: 500 }, size, stage, pad)).toEqual({ x: 75, y: 290 });
  });

  it('collapses x to 75 even when y is already inside range (point.y 150, unchanged)', () => {
    expect(clampToStage({ x: 9999, y: 150 }, size, stage, pad)).toEqual({ x: 75, y: 150 });
  });
});

describe('clampToStage: stage too small on both axes — collapses to the stage centre entirely', () => {
  it('collapses to the centre of a 50x50 stage at (50, 20): {x: 75, y: 45}', () => {
    const stage: StageRect = { x: 50, y: 20, width: 50, height: 50 };
    const size: Size = { width: 40, height: 40 };
    expect(clampToStage({ x: -1000, y: 1000 }, size, stage, 10)).toEqual({ x: 75, y: 45 });
  });
});
