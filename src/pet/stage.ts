/**
 * Byte's stage geometry — the PURE geometry core for T11's scroll-bounds
 * confinement (TICKETS T11 "Scroll bounds: stage clip, containment &
 * hand-off fade": "Byte and everything the pet module draws stay inside
 * the section they belong to. Nothing ever paints over the APPROACH
 * (`#manifesto`) or SELECTED WORK sections — at any scroll position, in
 * either theme, on any viewport." This ticket supersedes SPEC §6's
 * "Between them it follows the visitor down a right-margin lane.").
 * Byte lives in exactly two bounded on-screen stages — hero and footer,
 * with a fade hand-off between them — and this module computes the
 * geometry those stages need: carving a stage rect out of a section by
 * clearing its furniture (`stageFromSection`), clipping a stage to the
 * current viewport for the WebGL scissor test and the render-skip signal
 * (`intersectViewport`), and containing a moving point inside a stage
 * (`clampToStage`). Later T11 tasks wire these into `scene.ts`'s scissor
 * rect and `createBytePet.ts`'s wander/dash target clamping; this file
 * never draws, scrolls, or measures anything itself.
 *
 * Purity is the whole point (mirrors `anchor.ts`, `fsm.ts`, and
 * `retype.ts`): this file imports neither `gsap` nor `three`, and never
 * touches the DOM (no `window`/`document`/`DOMRect`), the wall clock
 * (`Date.now`/`performance.now`), or `Math.random`. The caller measures
 * sections and furniture with `Element.getBoundingClientRect()` and reads
 * `window.innerWidth`/`innerHeight` itself, then hands in plain numbers —
 * a real `DOMRect` satisfies `Rect` structurally (it has `x`, `y`, `width`,
 * and `height` among its other fields), so no adapter is needed at the
 * call site.
 */

/** Minimal rect — a DOMRect is assignable. Screen/viewport px, DOM origin (top-left). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A bounded play area for Byte, in the same screen px as `Rect`. */
export interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Viewport size in px (window.innerWidth/innerHeight at the call site). */
export interface Size {
  width: number;
  height: number;
}

/** A point in screen px. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The section box, inset at the bottom to clear the topmost furniture
 * rect. `x`, `y`, and `width` always pass through as the section's own —
 * only `height` changes. Furniture entirely below the section cannot
 * extend the stage (the new bottom is clamped to the section's own
 * bottom), and furniture above the section's top floors the height at 0
 * rather than letting it go negative. An empty `furniture` array is a
 * no-op: the section comes back unchanged.
 */
export function stageFromSection(section: Rect, furniture: readonly Rect[]): StageRect {
  const sectionBottom = section.y + section.height;
  const cut = furniture.length === 0 ? Infinity : Math.min(...furniture.map((rect) => rect.y));
  const newBottom = Math.min(cut, sectionBottom);
  return {
    x: section.x,
    y: section.y,
    width: section.width,
    height: Math.max(0, newBottom - section.y),
  };
}

/**
 * Intersects `stage` with the on-screen viewport rect `{x: 0, y: 0, width:
 * viewport.width, height: viewport.height}`. Returns the clipped rect, or
 * `null` when the intersection has zero or negative width or height —
 * i.e. `stage` doesn't overlap the viewport at all (including merely
 * touching an edge, which is a zero-area overlap). `null` is the
 * render-skip signal: a zero-area scissor rect draws nothing anyway, so
 * the caller can skip the draw call entirely.
 */
export function intersectViewport(stage: StageRect, viewport: Size): StageRect | null {
  const x0 = Math.max(stage.x, 0);
  const y0 = Math.max(stage.y, 0);
  const x1 = Math.min(stage.x + stage.width, viewport.width);
  const y1 = Math.min(stage.y + stage.height, viewport.height);
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: x0, y: y0, width, height };
}

/**
 * Clamps one axis of a box's centre so the box — inflated by `pad` on both
 * sides — stays inside `[stageStart, stageStart + stageLength]`. When the
 * stage is too short for `boxLength + 2 * pad`, the allowed range inverts
 * (its low end past its high end); rather than return that nonsense value,
 * this collapses to the stage's own centre on this axis.
 */
function clampAxis(
  center: number,
  stageStart: number,
  stageLength: number,
  boxLength: number,
  pad: number,
): number {
  const lo = stageStart + pad + boxLength / 2;
  const hi = stageStart + stageLength - pad - boxLength / 2;
  if (lo > hi) {
    return stageStart + stageLength / 2;
  }
  return Math.min(Math.max(center, lo), hi);
}

/**
 * Clamps the centre of a `size`-shaped box so the whole box, inflated by
 * `pad` on every side, stays inside `stage`. The two axes clamp
 * independently: a stage narrower (or shorter) than `size + 2 * pad` on
 * one axis collapses just that axis's centre to the stage's own centre —
 * this does happen in practice (a footer stage can be short) — while the
 * other axis keeps clamping normally.
 */
export function clampToStage(point: Point, size: Size, stage: StageRect, pad: number): Point {
  return {
    x: clampAxis(point.x, stage.x, stage.width, size.width, pad),
    y: clampAxis(point.y, stage.y, stage.height, size.height, pad),
  };
}
