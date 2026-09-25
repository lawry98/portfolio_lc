/**
 * Byte's rest position at a home (D-24): it stands just right of the
 * headline's caret instead of on the text end, so it never covers the last
 * letter. Pure — no gsap, no three, no DOM; `createBytePet` applies it.
 */

/** Byte's feet sit this many `unitPx` (Byte's height) right of the text end. */
export const REST_OFFSET_UNITS = 0.5;

/** World x of Byte's feet for a home whose text (or caret) ends at world x `textEndX`. */
export function restFeetX(textEndX: number, unitPx: number): number {
  return textEndX + REST_OFFSET_UNITS * unitPx;
}
