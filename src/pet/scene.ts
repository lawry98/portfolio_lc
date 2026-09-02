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
import gsap from 'gsap';
import * as THREE from 'three';
import { clampToStage, type Point, type Size, type StageRect } from './stage';
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
 * T11 (Task 2, R11-1): converts a `StageRect` (screen px, DOM top-left
 * origin — `stage.ts`'s coordinate convention) into the box
 * `WebGLRenderer.setScissor`/`prepareRenderer` below expect: CSS px, GL's
 * bottom-left origin. Only `y` needs to change — DOM `x` already grows
 * rightward same as GL `x`, and a rect's `width`/`height` don't depend on
 * which corner is the origin — so the flip is `viewportHeight - (stage.y +
 * stage.height)`: the distance from the viewport's bottom edge up to the
 * stage's own bottom edge becomes the new box's distance up from GL's
 * bottom-left origin.
 *
 * Returns CSS px, NOT device px — three multiplies by the renderer's own
 * pixel ratio internally (three@0.185.1,
 * `node_modules/three/build/three.cjs:76805`: `setScissor` stores the rect
 * then calls `.multiplyScalar(_pixelRatio)` before handing it to GL).
 * Pre-multiplying by devicePixelRatio before calling `setScissor` would
 * double-apply the ratio and clip to a quarter-size box on any retina
 * display — do not "fix" this back.
 */
export function scissorFromStage(
  stage: StageRect,
  viewportHeight: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: stage.x,
    y: viewportHeight - (stage.y + stage.height),
    width: stage.width,
    height: stage.height,
  };
}

/**
 * T11 containment (R11-7; Task 3 fix round 1 — "the highest-risk math was
 * not extracted as a pure, testable helper"). Clamps a proposed FEET
 * position (world px — `createBytePet.ts`'s own `rootX`/`rootY`, i.e.
 * `anchorWorld.x + drift.x`, `anchorWorld.y - unitPx / 2`) into `stage` and
 * returns the clamped FEET position, also in world px. Pure — composed
 * entirely of already-pure pieces (`screenFromWorld`/`worldFromScreen`
 * above, `clampToStage` from `stage.ts`), with `unitPx`/`viewport` taken as
 * plain parameters rather than read from `window` or a caller's closure —
 * the same shape as `scissorFromStage` above, so both can be exercised the
 * same way in `scene.test.ts`, asserting exact numbers.
 *
 * Two conversions make this a round trip through `clampToStage`, which
 * works in SCREEN px on the box CENTRE:
 *  - world <-> screen: `screenFromWorld` going in, `worldFromScreen` coming
 *    back — both defined just above;
 *  - feet <-> centre: world-y grows UP, and a FEET position sits
 *    `unitPx / 2` BELOW its box's own centre (`createBytePet.ts` places
 *    Byte's feet at `anchorWorld.y - unitPx / 2`, where `anchorWorld.y` IS
 *    the box's vertical centre by construction — see that module's own
 *    root-placement comment), so centre = feet + `unitPx / 2` going in, and
 *    the inverse coming back.
 * Byte's body is treated as `unitPx` square (the only live size measure
 * `createBytePet.ts` keeps for the placeholder rig), so that same value
 * sizes BOTH the box `clampToStage` fits and the feet/centre offset above.
 *
 * `createBytePet.ts` wraps this with its own live `unitPx` and
 * `window.innerWidth`/`innerHeight` — mirrors how `worldFromScreenAtViewport`
 * (below) wraps `worldFromScreen` — see that module's own (now-thin)
 * `clampFeetToStage` wrapper.
 *
 * NOTE on containment: this function bounds Byte's *wander*, not the
 * page's containment guarantee. That guarantee is the WebGL scissor clip
 * (`scissorFromStage` above, driven by `SceneHandle.setStage`) — it is fed
 * `activeStage` unconditionally, every tick, regardless of FSM state or the
 * hand-off fade's current opacity, so nothing this module draws can ever
 * paint outside a real section's stage. This function is a *second*,
 * independent safeguard (keeps Byte's own root visually inside the stage
 * rather than merely invisible-because-clipped at its edge) — removing it
 * would look wrong, but would not by itself let Byte paint over another
 * section.
 */
export function clampFeetToStage(
  feet: Point,
  unitPx: number,
  stage: StageRect,
  viewport: Size,
  pad: number,
): Point {
  const centreWorldY = feet.y + unitPx / 2;
  const centreScreen = screenFromWorld(feet.x, centreWorldY, viewport.width, viewport.height);
  const clampedCentreScreen = clampToStage(
    centreScreen,
    { width: unitPx, height: unitPx },
    stage,
    pad,
  );
  const clampedCentreWorld = worldFromScreen(
    clampedCentreScreen.x,
    clampedCentreScreen.y,
    viewport.width,
    viewport.height,
  );
  return { x: clampedCentreWorld.x, y: clampedCentreWorld.y - unitPx / 2 };
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
 * two as `setBehind()` toggles. `SceneHandle.addToPet`/`addToFront` apply
 * these automatically for the common case (R-T4-6); exported directly too,
 * since three.js layers are per-object and do not cascade from a parent
 * `Group` to its children, so any mesh added straight to `frontLayer`
 * (bypassing `addToFront`) must still set its own layer.
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
 * module adds to the scene. Pure/stateless: build one per theme with this
 * and hand it to whatever owns re-theming it later — `createScene()`'s
 * `setTheme` only re-lerps the hemisphere/key lights (R-T4-5), it does NOT
 * repaint materials, so the caller (the rig, via `setBodyColor`/`setGlow`;
 * see `bodyColorForTheme`/`DEFAULT_GLOW_ACCENT` below) is responsible for
 * re-theming anything built with this on a theme change. Momentarily
 * unused after the T3 QA `?glcube` rig was removed; next consumed by
 * Task 3's placeholder Body material.
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

/** The themed Body base colour (from THEME_PRESETS). createBytePet passes this to
 *  rig.setBodyColor on theme change (R-T4-5) — kept here so callers don't duplicate
 *  the palette hexes. */
export function bodyColorForTheme(theme: Theme): number {
  return THEME_PRESETS[theme].materialColor;
}

/** Default dark-mode Glow emissive accent — matches the T3 dark preset's emissive
 *  color. `createBytePet`/the rig use this for `rig.setGlow(true, DEFAULT_GLOW_ACCENT)`
 *  on entering dark theme; the lab glow-axis wiring (a user-tunable accent) is T8. */
export const DEFAULT_GLOW_ACCENT = 0x38e8a8;

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
  // Reset on every reuse, not just at creation: T11's hand-off fade (`setOpacity`,
  // below) writes this property on both canvases, so a canvas recycled by a second
  // `createScene()` call must not inherit whatever opacity a prior instance's
  // in-flight fade left behind.
  canvas.style.opacity = '1';
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
  // parent `Group` to children added later. Use `addToPet()` below to add
  // content to `petLayer` — it re-applies this automatically. Adding
  // directly via `scene.petLayer.add(...)` bypasses that and strands the
  // new content on layer 0 until a manual `setBehind()` call fixes it up.
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

  /**
   * Adds `obj` to `petLayer` and immediately re-applies the current
   * behind/front layer to every `petLayer` descendant by reusing
   * `applyPetLayerState()`'s traversal — so `obj` (and its descendants) are
   * never stranded on layer 0 (rendered on neither canvas). This makes a
   * follow-up `setBehind()` call unnecessary just to pick up a freshly-added
   * object; `setBehind()` remains how callers flip Byte behind/in front
   * afterwards (R-T4-6).
   */
  function addToPet(obj: THREE.Object3D): void {
    petLayer.add(obj);
    applyPetLayerState();
  }

  /**
   * Adds `obj` to `frontLayer` (food/shadow/particles — always in front) and
   * sets `FRONT_RENDER_LAYER` on it + every descendant directly, since
   * three.js layers are per-object and don't cascade from the `frontLayer`
   * `Group` to children added to it later (R-T4-6).
   */
  function addToFront(obj: THREE.Object3D): void {
    frontLayer.add(obj);
    obj.traverse((o) => o.layers.set(FRONT_RENDER_LAYER));
  }

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

  // T8 ("theme reaction"): the one in-flight light lerp, if any — killed
  // before every call (instant or animated) so a rapid re-toggle never
  // leaves two writers on the same light properties (mirrors the rest of
  // the codebase's kill-before-restart idiom, e.g. `createBytePet.ts`'s
  // named tween slots).
  let themeTween: ReturnType<typeof gsap.timeline> | null = null;

  /**
   * Re-lerps only the hemisphere/key lights — NOT Byte's own Body/Glow
   * materials, which the rig owns instead via `setBodyColor`/`setGlow`
   * (`createBytePet` calls these on theme change using
   * `bodyColorForTheme`/`DEFAULT_GLOW_ACCENT` above) — R-T4-5.
   *
   * `durationS` (default `0`, the construction path via `setTheme(opts.
   * theme)` below): `0` sets every light property to `THEME_PRESETS[theme]`
   * instantly, exactly as before T8. `> 0` instead GSAP-tweens each
   * property from its CURRENT live value to that same target over
   * `durationS` seconds — colors via `gsap.to(color, { r, g, b })` (three.js
   * `Color`s expose plain numeric `.r/.g/.b`, so gsap can tween them
   * directly with no manual lerp math) and intensities directly on the
   * light objects, all in one timeline so every channel arrives together.
   * Reading the "current live value" rather than snapshotting fixed "from"
   * colors up front is what makes the kill-before-restart idiom below
   * correct: killing an in-flight lerp freezes each property wherever it
   * was, and the next `setTheme` call's fresh tweens simply pick up from
   * there — never a snap back to the previous theme's start point.
   */
  function setTheme(theme: Theme, durationS = 0): void {
    const preset = THEME_PRESETS[theme];

    themeTween?.kill();
    themeTween = null;

    if (durationS <= 0) {
      hemisphereLight.color.set(preset.hemisphereSky);
      hemisphereLight.groundColor.set(preset.hemisphereGround);
      hemisphereLight.intensity = preset.hemisphereIntensity;
      keyLight.color.set(preset.keyColor);
      keyLight.intensity = preset.keyIntensity;
      return;
    }

    const toHemiSky = new THREE.Color(preset.hemisphereSky);
    const toHemiGround = new THREE.Color(preset.hemisphereGround);
    const toKeyColor = new THREE.Color(preset.keyColor);
    const ease = 'power2.inOut';

    const tl = gsap.timeline({
      onComplete: () => {
        themeTween = null;
      },
    });
    tl.to(
      hemisphereLight.color,
      { r: toHemiSky.r, g: toHemiSky.g, b: toHemiSky.b, duration: durationS, ease },
      0,
    );
    tl.to(
      hemisphereLight.groundColor,
      { r: toHemiGround.r, g: toHemiGround.g, b: toHemiGround.b, duration: durationS, ease },
      0,
    );
    tl.to(hemisphereLight, { intensity: preset.hemisphereIntensity, duration: durationS, ease }, 0);
    tl.to(
      keyLight.color,
      { r: toKeyColor.r, g: toKeyColor.g, b: toKeyColor.b, duration: durationS, ease },
      0,
    );
    tl.to(keyLight, { intensity: preset.keyIntensity, duration: durationS, ease }, 0);

    themeTween = tl;
  }

  setTheme(opts.theme);

  // --- Render loop --------------------------------------------------------
  const tickCallbacks: Array<(dt: number) => void> = [];

  // T11 stage clip (R11-4). Tri-state: `undefined` until the first
  // `setStage()` call — renders unclipped, byte-identical to pre-T11
  // behaviour; `null` once set means no stage is on screen anywhere
  // (render-skip, R11-3); a `StageRect` is the active hero/footer stage
  // both renderers scissor-clip to. `createBytePet`'s `onTick` callback is
  // what calls `setStage()` each frame, and `render(dt)` below runs tick
  // callbacks before `renderBack()`/`renderFront()`, so `stage` is always
  // current for the frame by the time those two read it.
  let stage: StageRect | null | undefined = undefined;

  /**
   * T11 scissor clip + render-skip (R11-1/R11-2/R11-3), shared by
   * `renderFront()`/`renderBack()` so both canvases always agree on
   * whether — and where — to draw. Returns whether the caller should still
   * call `renderer.render(scene, camera)` this frame.
   *
   * Every branch clears `renderer` first, with the scissor test forced
   * OFF: `clear()` is itself subject to the scissor test (WebGL spec), and
   * the scissor-test flag is NOT reset per render — three.js restores
   * whatever `setScissorTest()` last set on every `render()` call — so
   * leaving a prior frame's scissor box enabled here would clear only
   * inside that box and strand last frame's pixels outside it: a stale
   * hero-region Byte ghosting on screen once the active stage moves to the
   * footer.
   *
   * `stage === null` clears and returns `false` (R11-3) rather than
   * skipping the clear too — an un-cleared skip would leave the compositor
   * showing the last presented frame, freezing Byte mid-page, which is the
   * exact bug T11 exists to fix.
   */
  function prepareRenderer(renderer: THREE.WebGLRenderer): boolean {
    renderer.setScissorTest(false);
    renderer.clear();

    if (stage === null) {
      return false;
    }
    if (stage === undefined) {
      return true;
    }

    // CSS px, matching `applyViewport`'s `setSize` — see `scissorFromStage`
    // for why (it takes/returns CSS px throughout, on purpose).
    const { x, y, width, height } = scissorFromStage(stage, window.innerHeight);
    renderer.setScissor(x, y, width, height);
    renderer.setScissorTest(true);
    return true;
  }

  /** T11 stage clip setter (Task 2) — see `SceneHandle.setStage`'s doc comment in `types.ts`
   *  for the tri-state contract; this just records it for `prepareRenderer()` to read. */
  function setStage(rect: StageRect | null): void {
    stage = rect;
  }

  function renderFront(): void {
    if (!prepareRenderer(frontRenderer)) {
      return;
    }
    camera.layers.set(FRONT_RENDER_LAYER);
    frontRenderer.render(scene, camera);
  }

  function renderBack(): void {
    if (!prepareRenderer(backRenderer)) {
      return;
    }
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

  /** T11 hero/footer hand-off fade (Task 2, R11-5): sets CSS `opacity` directly on both
   *  canvas elements. No tween lives here — `createBytePet`'s migration driver owns the
   *  GSAP tween across a hero/footer trip and calls this setter on every tick of it. */
  function setOpacity(a: number): void {
    backCanvas.style.opacity = String(a);
    frontCanvas.style.opacity = String(a);
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

    // T11: `setScissorTest`'s flag is plain renderer state, not tied to the
    // GL context lifecycle, so reset it (and this module's own `stage`)
    // explicitly for a clean teardown — mirrors nulling `themeTween` and
    // zeroing `tickCallbacks.length` below.
    backRenderer.setScissorTest(false);
    frontRenderer.setScissorTest(false);
    stage = undefined;

    themeTween?.kill();
    themeTween = null;

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
    setStage,
    setOpacity,
    addToPet,
    addToFront,
    setTheme,
    worldFromScreen: worldFromScreenAtViewport,
    screenFromRect,
    resize,
    dispose,
  };
}
