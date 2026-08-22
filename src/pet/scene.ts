/**
 * Pixel-space camera math + WebGL capability check for the two-canvas
 * occlusion sandwich (SPEC "Two full-viewport, fixed, transparent canvases
 * sandwich the DOM"), plus `createScene()` (Task 2), which builds the actual
 * renderers, camera, and layers on top of the pure math below. Everything
 * up to `hasWebGL()` is pure and DOM/GL-side-effect-free (aside from
 * `hasWebGL()`'s own throwaway canvas probe) and unit-tested in
 * `scene.test.ts`; `createScene()` has real DOM/WebGL side effects and
 * cannot be unit-tested under jsdom (no WebGL) — see its own doc comment.
 *
 * Convention: world units equal CSS pixels at the z=0 plane, with the world
 * origin at the screen center and world-y increasing upward (screen-y
 * increases downward) — see `worldFromScreen`/`screenFromWorld` below.
 */
import * as THREE from 'three';
import type { SceneHandle, SceneOptions } from './types';

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

// ---------------------------------------------------------------------------
// Task 2 — `createScene()`: the two-renderer occlusion sandwich (R-T3-2,
// R-T3-4, R-T3-7) built on the pure math above. Everything below has real
// DOM/WebGL side effects (canvases, renderers, listeners) and cannot be
// unit-tested under jsdom (no WebGL) — verified by `tsc` + `vite build` +
// the controller's browser QA (T3 plan, Task 2 brief).
// ---------------------------------------------------------------------------

const GL_BACK_CANVAS_ID = 'gl-back';
const GL_FRONT_CANVAS_ID = 'gl-front';

/**
 * Occlusion render layers (R-T3-2). `frontLayer`'s contents live on
 * `FRONT_RENDER_LAYER` permanently; `petLayer`'s contents move between the
 * two as `setBehind()` toggles. Exported so any ticket that adds a mesh
 * directly to `frontLayer` (e.g. the T3 Task 3 blob shadow, or the T3 Task 5
 * `?glcube` rig) can call `mesh.layers.set(FRONT_RENDER_LAYER)` on it —
 * three.js layers are per-object and do not cascade from a parent `Group`
 * to its children, so each mesh must set its own.
 */
export const FRONT_RENDER_LAYER = 1;
export const BACK_RENDER_LAYER = 2;

type Theme = 'light' | 'dark';

interface ThemePreset {
  hemisphereSky: number;
  hemisphereGround: number;
  hemisphereIntensity: number;
  keyColor: number;
  keyIntensity: number;
  materialColor: number;
  emissive: number;
  emissiveIntensity: number;
}

/**
 * Light + material presets per theme (R-T3-7). Sky/ground/material hexes
 * are pitched near the `--paper`/`--paper-2` tokens in `styles/tokens.css`
 * (D-08) so Byte's "soft-clay" materials read as part of the same page
 * without `pet/` importing page CSS custom properties (module purity —
 * `pet/` stays portable). Dark gets a faint mint emissive tint, echoing the
 * project's default `--glow` token; light has none. Values are hand-picked
 * for a calm, matte look, not derived from a formula — free to retune
 * visually once the real rig (T4/T-GLB) exists.
 */
const THEME_PRESETS: Record<Theme, ThemePreset> = {
  light: {
    hemisphereSky: 0xfaf7ef,
    hemisphereGround: 0xd9d2c1,
    hemisphereIntensity: 1.15,
    keyColor: 0xfff3e0,
    keyIntensity: 0.85,
    materialColor: 0xdad2c3,
    emissive: 0x000000,
    emissiveIntensity: 0,
  },
  dark: {
    hemisphereSky: 0x2c2a35,
    hemisphereGround: 0x0e0d12,
    hemisphereIntensity: 0.5,
    keyColor: 0x9fb8ff,
    keyIntensity: 0.55,
    materialColor: 0x3c3946,
    emissive: 0x38e8a8,
    emissiveIntensity: 0.15,
  },
};

/**
 * Themed `MeshStandardMaterial` factory (R-T3-7) — the shared "soft-clay"
 * look (matte, non-metallic, `roughness` ≈ 0.35) for any mesh the pet
 * module or a QA rig adds to the scene. Pure/stateless by design: rather
 * than requiring callers to separately "register" materials they build
 * with it, `createScene()`'s `setTheme` re-themes every
 * `MeshStandardMaterial` it finds already living in the scene graph (see
 * below) — build with this, add the mesh to `petLayer`/`frontLayer`, and
 * theme toggles apply automatically. This is the "seam for T4/T8" the T3
 * plan describes, first exercised by the T3 Task 5 `?glcube` dev rig.
 */
export function createThemedMaterial(theme: Theme): THREE.MeshStandardMaterial {
  const preset = THEME_PRESETS[theme];
  return new THREE.MeshStandardMaterial({
    color: preset.materialColor,
    roughness: 0.35,
    metalness: 0,
    emissive: preset.emissive,
    emissiveIntensity: preset.emissiveIntensity,
  });
}

function isDisposable(value: unknown): value is { dispose(): void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { dispose?: unknown }).dispose === 'function'
  );
}

/** Every texture-slot key `MeshStandardMaterial` (and similar materials) may hold. */
const MATERIAL_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const;

/**
 * Disposes a material's own textures — duck-typed by key + a `dispose`
 * function check rather than `instanceof THREE.Texture`, so this doesn't
 * need every possible map type imported as a value — plus the material
 * itself.
 */
function disposeMaterial(material: THREE.Material): void {
  const record = material as unknown as Record<string, unknown>;
  for (const key of MATERIAL_TEXTURE_KEYS) {
    const value = record[key];
    if (isDisposable(value)) {
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * Frees GPU resources for every geometry/material/texture reachable from
 * `root`. Duck-types `.geometry`/`.material` (present on `Mesh`/`Line`/
 * `Points`/`Sprite` alike) instead of `instanceof`-checking each concrete
 * three class, so this needs no extra value imports. Leaves the JS scene
 * graph itself in place — `dispose()` below discards the whole `scene`
 * afterwards anyway.
 */
function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    const { geometry, material } = child as unknown as {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    geometry?.dispose();
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

/**
 * Returns the existing `<canvas id={id}>` if one is already mounted
 * (avoids duplicating `#gl-back`/`#gl-front` across repeated `createScene()`
 * calls in the same document) or creates + appends a new one, then
 * (re)applies the fixed, full-viewport, non-interactive styling every T3
 * canvas needs (R-T3-4). Inline styles rather than a CSS file, so `pet/`
 * stays portable and doesn't depend on the demo page's stylesheets.
 */
function getOrCreateCanvas(id: string, mount: HTMLElement, zIndex: number): HTMLCanvasElement {
  const existing = document.getElementById(id);
  const canvas =
    existing instanceof HTMLCanvasElement ? existing : document.createElement('canvas');
  canvas.id = id;
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = String(zIndex);
  canvas.style.pointerEvents = 'none';
  canvas.setAttribute('aria-hidden', 'true');
  if (canvas.parentElement !== mount) {
    mount.appendChild(canvas);
  }
  return canvas;
}

/**
 * Builds the two-canvas WebGL "occlusion sandwich" (SPEC "Two full-viewport,
 * fixed, transparent canvases sandwich the DOM"; D-04) around the crisp DOM
 * headline: `#gl-back` (z-index -1, behind `#app`, above the `body` paper
 * background) and `#gl-front` (z-index 40, above page content, below the
 * z-9999 grain overlay) share one `THREE.Scene` + `THREE.PerspectiveCamera`,
 * each drawn by its own `WebGLRenderer`. `petLayer` (Byte + shadow) renders
 * to whichever canvas `setBehind()` selects; `frontLayer` (tossed
 * glyphs/particles) always renders to the front canvas. Implements the
 * `SceneHandle` contract from `types.ts` — see there for the full surface.
 */
export function createScene(opts: SceneOptions): SceneHandle {
  const mount = opts.mount ?? document.body;

  const backCanvas = getOrCreateCanvas(GL_BACK_CANVAS_ID, mount, -1);
  const frontCanvas = getOrCreateCanvas(GL_FRONT_CANVAS_ID, mount, 40);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    FOV_DEG,
    window.innerWidth / window.innerHeight,
    0.1,
    1e5,
  );

  const backRenderer = new THREE.WebGLRenderer({
    canvas: backCanvas,
    alpha: true,
    antialias: true,
  });
  backRenderer.setClearColor(0x000000, 0);

  const frontRenderer = new THREE.WebGLRenderer({
    canvas: frontCanvas,
    alpha: true,
    antialias: true,
  });
  frontRenderer.setClearColor(0x000000, 0);

  /**
   * Sets pixel ratio/size on both renderers and re-frames the camera for
   * the current viewport. Shared by the initial setup below and by
   * `resize()` so the two never drift apart.
   */
  function applyViewport(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    backRenderer.setPixelRatio(pixelRatio);
    backRenderer.setSize(width, height);
    frontRenderer.setPixelRatio(pixelRatio);
    frontRenderer.setSize(width, height);

    camera.aspect = width / height;
    camera.position.z = cameraDistanceForHeight(height);
    camera.updateProjectionMatrix();
  }

  applyViewport();
  // `lookAt` needs a non-zero camera position to compute a valid direction;
  // `applyViewport()` above already set `camera.position.z`. Re-framing on
  // resize only moves the camera further/closer along the same axis it
  // already faces, so `lookAt` never needs to run again after this.
  camera.lookAt(0, 0, 0);

  function resize(): void {
    applyViewport();
  }

  window.addEventListener('resize', resize);

  // --- Layers (R-T3-2) -------------------------------------------------
  const frontLayer = new THREE.Group();
  frontLayer.name = 'byte-front-layer';
  frontLayer.layers.set(FRONT_RENDER_LAYER);
  scene.add(frontLayer);

  const petLayer = new THREE.Group();
  petLayer.name = 'byte-pet-layer';
  scene.add(petLayer);

  // `behind` is the source of truth `setBehind()` writes to and
  // `applyPetLayerState()` reads from (rather than acting on its parameter
  // directly), so the current flag is always available to re-apply —
  // needed because three.js layers are per-object and don't cascade from a
  // parent `Group` to children added later. Callers that add new content to
  // `petLayer` after the fact must call `setBehind()` again (with either
  // value) so the new content picks up the active layer too.
  let behind = false;

  function applyPetLayerState(): void {
    const layer = behind ? BACK_RENDER_LAYER : FRONT_RENDER_LAYER;
    petLayer.traverse((obj) => {
      obj.layers.set(layer);
    });
  }

  function setBehind(b: boolean): void {
    behind = b;
    applyPetLayerState();
  }

  applyPetLayerState(); // establish the initial (in-front) layer state.

  // --- Lights (R-T3-7) ---------------------------------------------------
  // `renderFront()`/`renderBack()` pin `camera.layers` to a single layer per
  // pass; `WebGLRenderer` only collects a light if its own layers intersect
  // the camera's, so both lights must be enabled on *every* layer, or
  // meshes would render unlit/black on whichever pass a light was missing
  // from.
  const hemisphereLight = new THREE.HemisphereLight();
  hemisphereLight.layers.enableAll();
  scene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight();
  keyLight.position.set(3, 4, 6);
  keyLight.layers.enableAll();
  scene.add(keyLight);

  function setTheme(theme: Theme): void {
    const preset = THEME_PRESETS[theme];
    hemisphereLight.color.set(preset.hemisphereSky);
    hemisphereLight.groundColor.set(preset.hemisphereGround);
    hemisphereLight.intensity = preset.hemisphereIntensity;
    keyLight.color.set(preset.keyColor);
    keyLight.intensity = preset.keyIntensity;

    // Instant set is acceptable in T3 — the 400ms choreography lands in T8.
    scene.traverse((child) => {
      const material = (child as Partial<THREE.Mesh>).material;
      const materials = Array.isArray(material) ? material : material ? [material] : [];
      for (const mat of materials) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.color.set(preset.materialColor);
          mat.emissive.set(preset.emissive);
          mat.emissiveIntensity = preset.emissiveIntensity;
        }
      }
    });
  }

  setTheme(opts.theme);

  // --- Render loop --------------------------------------------------------
  const tickCallbacks: Array<(dt: number) => void> = [];

  function renderFront(): void {
    camera.layers.set(FRONT_RENDER_LAYER);
    frontRenderer.render(scene, camera);
  }

  function renderBack(): void {
    camera.layers.set(BACK_RENDER_LAYER);
    backRenderer.render(scene, camera);
  }

  function render(dt: number): void {
    for (const cb of tickCallbacks) {
      cb(dt);
    }
    renderBack();
    renderFront();
  }

  function onTick(cb: (dt: number) => void): void {
    tickCallbacks.push(cb);
  }

  // --- Pixel-space helpers -------------------------------------------------
  function worldFromScreenAtViewport(x: number, y: number): { x: number; y: number } {
    return worldFromScreen(x, y, window.innerWidth, window.innerHeight);
  }

  function screenFromRect(el: HTMLElement): { x: number; y: number; w: number; h: number } {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      w: rect.width,
      h: rect.height,
    };
  }

  // --- Teardown ------------------------------------------------------------
  function dispose(): void {
    window.removeEventListener('resize', resize);

    disposeObject3D(scene);

    backRenderer.dispose();
    backRenderer.forceContextLoss();
    frontRenderer.dispose();
    frontRenderer.forceContextLoss();

    backCanvas.remove();
    frontCanvas.remove();

    tickCallbacks.length = 0;
  }

  return {
    scene,
    camera,
    petLayer,
    frontLayer,
    renderFront,
    renderBack,
    render,
    onTick,
    setBehind,
    setTheme,
    worldFromScreen: worldFromScreenAtViewport,
    screenFromRect,
    resize,
    dispose,
  };
}
