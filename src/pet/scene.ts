/**
 * Pixel-space camera math + WebGL capability check for the two-canvas
 * occlusion sandwich (SPEC "Two full-viewport, fixed, transparent canvases
 * sandwich the DOM"). Everything below is pure and DOM/GL-side-effect-free
 * except `hasWebGL()`'s throwaway canvas probe — no `THREE.WebGLRenderer`,
 * no scene graph. `createScene()` (Task 2) builds the actual renderers,
 * camera, and layers on top of these.
 *
 * Convention: world units equal CSS pixels at the z=0 plane, with the world
 * origin at the screen center and world-y increasing upward (screen-y
 * increases downward) — see `worldFromScreen`/`screenFromWorld` below.
 */

/** Vertical field of view (degrees) for the shared perspective camera. */
export const FOV_DEG = 30;

/**
 * Distance along +z a camera with vertical FOV `fovDeg` must sit from the
 * z=0 plane so that plane's visible height equals `h` world units — i.e. so
 * 1 world unit equals 1 CSS pixel at z=0. Derived from the standard
 * half-height = distance * tan(halfFov) relation, solved for distance.
 */
export function cameraDistanceForHeight(h: number, fovDeg: number = FOV_DEG): number {
  return h / 2 / Math.tan((fovDeg * Math.PI) / 180 / 2);
}

/**
 * Screen pixel coords (origin top-left, y-down) → world coords at z=0
 * (origin at screen center, y-up). Inverse of `screenFromWorld`.
 */
export function worldFromScreen(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  return { x: x - w / 2, y: h / 2 - y };
}

/**
 * World coords at z=0 (origin at screen center, y-up) → screen pixel coords
 * (origin top-left, y-down). Exact inverse of `worldFromScreen`.
 */
export function screenFromWorld(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  return { x: x + w / 2, y: h / 2 - y };
}

/**
 * Best-effort WebGL capability probe via a throwaway canvas. Always returns
 * a boolean and never throws — some browsers/extensions/jsdom throw instead
 * of returning `null` from `getContext`, so both paths are guarded. Callers
 * use this to decide the graceful-degradation path (no WebGL → hide the
 * canvases, keep the static headline, page fully usable).
 */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return context != null;
  } catch {
    return false;
  }
}
