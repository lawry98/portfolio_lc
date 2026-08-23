/**
 * Blob-shadow ground-contact sprite (SPEC "no realtime shadows — ground
 * contact is a blob-shadow sprite (radial gradient) that scales/fades with
 * hover height"). Two pieces:
 *
 * - `shadowScaleForHeight`/`shadowOpacityForHeight` — pure height→number
 *   maps, unit-tested in `shadow.test.ts`. `h` is hover height in world
 *   units (CSS px, per the `scene.ts` convention — 1 world unit == 1 CSS px
 *   at the z=0 plane); `h = 0` means resting on the ground. As `h` grows the
 *   shadow *grows and fades* — a bigger, softer, fainter blob, as if the
 *   light around Byte gets more diffuse the further its feet lift from the
 *   ground — clamped at both ends so callers never need to pre-clamp `h`
 *   themselves.
 * - `createBlobShadow()` — draws a radial-gradient alpha texture to an
 *   offscreen `<canvas>` (`getContext('2d')`), wraps it in a
 *   `THREE.CanvasTexture`, and puts that on a flat `THREE.PlaneGeometry` +
 *   `THREE.MeshBasicMaterial` mesh. This has real DOM/canvas side effects
 *   and cannot be unit-tested under jsdom — jsdom's
 *   `HTMLCanvasElement.getContext('2d')` returns `null` (no 2D canvas
 *   backend), so `shadow.test.ts` exercises only the pure math above;
 *   `createBlobShadow()` itself is wired into the live scene by Task 5
 *   (behind `?glcube`) and verified there by browser QA.
 *
 * The scene's fixed camera sits dead-level on the +z axis with no
 * elevation (`scene.ts`'s `createScene()`: only `camera.position.z` is set,
 * looking at the origin) — a plane rotated flat into the ground (XZ) plane
 * would be viewed edge-on and effectively invisible under that camera. This
 * mesh is therefore left in its default orientation (facing +z, i.e.
 * "camera-facing", the brief's other option) rather than rotated flat.
 * `THREE.Sprite` was considered for the same "camera-facing" effect, but
 * every `THREE.Sprite` instance shares one module-level `BufferGeometry`
 * (see `three/src/objects/Sprite.js`) — disposing it here would tear down
 * geometry any *other* live sprite (e.g. a future glow-halo sprite, SPEC
 * "faint glow halo sprite") still depends on. A `PlaneGeometry` this module
 * creates and owns keeps `dispose()` self-contained.
 *
 * This module owns no position/rotation for the mesh and never adds it to a
 * scene or layer — the caller (Task 5) positions it at Byte's feet each
 * frame and adds it to `frontLayer` (`scene.ts`'s `FRONT_RENDER_LAYER`,
 * "food + shadow always front" per SPEC/D-04) so `shadow.ts` stays
 * independent of `scene.ts`.
 */
import * as THREE from 'three';

// --- Pure height → scale/opacity math (unit-tested) -------------------------

/** Shadow scale multiplier at `h = 0` (resting on the ground) — the mesh's unscaled footprint. */
export const BASE_SHADOW_SCALE = 1;

/** Shadow scale multiplier once `h` reaches/exceeds `MAX_HOVER_HEIGHT` — the widest, most diffuse spread. */
export const MAX_SHADOW_SCALE = 1.6;

/** Shadow opacity at `h = 0` (resting) — darkest, most concentrated ground contact. */
export const MAX_SHADOW_OPACITY = 0.35;

/** Shadow opacity floor once `h` reaches/exceeds `MAX_HOVER_HEIGHT` — fully faded. */
export const MIN_SHADOW_OPACITY = 0;

/**
 * Hover height (world px == CSS px) at which the scale/opacity ramps fully
 * saturate. R-T4-10: retuned against the placeholder's actual `Hop` apex
 * now that it exists (`rig.ts`'s `HOP_APEX_FRACTION = 0.5`, i.e. half the
 * bot's own body height) at a representative large-desktop headline size —
 * `.hero__headline`'s `font-size: clamp(3rem, 2rem + 5vw, 8rem)`
 * (`styles/global.css`) ceiling, `8rem` = 128px — so `0.5 * 128 ≈ 64`. At
 * smaller headline sizes (the clamp's floor is 3rem/48px) the actual apex is
 * proportionally smaller, so the shadow only partially fades mid-hop there
 * instead of hitting the faintest/widest end of the ramp — reads fine
 * (graceful undershoot) rather than odd, same as this constant's previous,
 * larger placeholder value did before hops existed to calibrate against.
 * Free to retune visually; same hand-picked-not-derived spirit as
 * `scene.ts`'s theme values.
 */
export const MAX_HOVER_HEIGHT = 64;

/** Clamps `t` to `[0, 1]`. Shared by both height maps below. */
function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/**
 * Monotonically **increasing** map from hover height to shadow scale
 * multiplier: `BASE_SHADOW_SCALE` at `h <= 0`, ramping linearly to
 * `MAX_SHADOW_SCALE` at `h >= MAX_HOVER_HEIGHT`, clamped at both ends.
 */
export function shadowScaleForHeight(h: number): number {
  const t = clamp01(h / MAX_HOVER_HEIGHT);
  return BASE_SHADOW_SCALE + (MAX_SHADOW_SCALE - BASE_SHADOW_SCALE) * t;
}

/**
 * Monotonically **decreasing** map from hover height to shadow opacity:
 * `MAX_SHADOW_OPACITY` at `h <= 0`, ramping linearly down to
 * `MIN_SHADOW_OPACITY` (0) at `h >= MAX_HOVER_HEIGHT`, clamped to
 * `[MIN_SHADOW_OPACITY, MAX_SHADOW_OPACITY]`.
 */
export function shadowOpacityForHeight(h: number): number {
  const t = clamp01(h / MAX_HOVER_HEIGHT);
  return MAX_SHADOW_OPACITY + (MIN_SHADOW_OPACITY - MAX_SHADOW_OPACITY) * t;
}

// ---------------------------------------------------------------------------
// `createBlobShadow()` — real canvas/WebGL side effects, browser-only; see
// the module doc comment above for why this has no unit tests.
// ---------------------------------------------------------------------------

/** Offscreen canvas size (px) for the radial-gradient alpha texture. */
const SHADOW_TEXTURE_SIZE = 128;

/** World-px (== CSS px) footprint of the shadow mesh at `BASE_SHADOW_SCALE`. */
const BASE_SHADOW_DIAMETER = 64;

/**
 * Shadow tint (R, G, B), pitched near the light-theme `--ink` token
 * (`#16151a`, `styles/tokens.css`, D-08) rather than read from it — per
 * `scene.ts`'s `THEME_PRESETS` convention, `pet/` stays portable and
 * doesn't import page CSS custom properties. Fixed rather than
 * theme-lerped: `createBlobShadow()` takes no theme argument, and a
 * near-black tint reads as a believable ground shadow against the light
 * paper while staying deliberately faint (by design — real shadows aren't
 * theme-colored) against the near-black dark paper.
 */
const SHADOW_TINT_R = 0x16;
const SHADOW_TINT_G = 0x15;
const SHADOW_TINT_B = 0x1a;

/** Gradient stop (0..1) where the blob's alpha passes through its midpoint on the way to fully transparent. */
const GRADIENT_MID_STOP = 0.55;

/** Alpha at `GRADIENT_MID_STOP` — the center stop is always alpha 1, the outer edge always alpha 0. */
const GRADIENT_MID_ALPHA = 0.5;

/**
 * Draws the radial-gradient alpha blob to a fresh offscreen canvas and wraps
 * it in a `THREE.CanvasTexture`. Guards `getContext('2d')` returning `null`
 * (jsdom always; vanishingly rare real browsers) the same way `scene.ts`'s
 * `hasWebGL()` never throws — an unavailable 2D context yields a blank,
 * fully transparent texture instead of a crash.
 */
function createShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SHADOW_TEXTURE_SIZE;
  canvas.height = SHADOW_TEXTURE_SIZE;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = SHADOW_TEXTURE_SIZE / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, `rgba(${SHADOW_TINT_R}, ${SHADOW_TINT_G}, ${SHADOW_TINT_B}, 1)`);
    gradient.addColorStop(
      GRADIENT_MID_STOP,
      `rgba(${SHADOW_TINT_R}, ${SHADOW_TINT_G}, ${SHADOW_TINT_B}, ${GRADIENT_MID_ALPHA})`,
    );
    gradient.addColorStop(1, `rgba(${SHADOW_TINT_R}, ${SHADOW_TINT_G}, ${SHADOW_TINT_B}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SHADOW_TEXTURE_SIZE, SHADOW_TEXTURE_SIZE);
  }

  return new THREE.CanvasTexture(canvas);
}

/** Handle returned by `createBlobShadow()`. */
export interface BlobShadowHandle {
  /** The shadow mesh — add to the scene's `frontLayer` and position at Byte's feet each frame. */
  readonly mesh: THREE.Object3D;
  /** Sets `mesh.scale` from `shadowScaleForHeight(h)` and material opacity from `shadowOpacityForHeight(h)`. */
  setHeight(h: number): void;
  /** Frees the geometry, material, and texture this module created. */
  dispose(): void;
}

/**
 * Builds the blob-shadow mesh: a `BASE_SHADOW_DIAMETER`-square
 * `PlaneGeometry` with a transparent, depth-write-off `MeshBasicMaterial`
 * mapped to the radial-gradient `CanvasTexture` above. `setHeight(0)` is
 * called once up front so the mesh starts in its resting state (base scale,
 * max opacity) before any caller drives it.
 */
export function createBlobShadow(): BlobShadowHandle {
  const texture = createShadowTexture();
  const geometry = new THREE.PlaneGeometry(BASE_SHADOW_DIAMETER, BASE_SHADOW_DIAMETER);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: MAX_SHADOW_OPACITY,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'byte-blob-shadow';

  function setHeight(h: number): void {
    mesh.scale.setScalar(shadowScaleForHeight(h));
    material.opacity = shadowOpacityForHeight(h);
  }

  setHeight(0);

  function dispose(): void {
    geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  return { mesh, setHeight, dispose };
}
