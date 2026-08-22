import './styles/tokens.css';
import './styles/global.css';
import './styles/grain.css';
import { BoxGeometry, Mesh } from 'three';
import gsap from 'gsap';
import { initTheme, type Theme, type ThemeController } from './lib/theme';
import { initGrain } from './lib/grain';
import { initLenis } from './lib/lenisScroll';
import { initHero } from './page/hero';
import { initManifesto } from './page/manifesto';
import { initWork } from './page/work';
import { initFooter } from './page/footer';
import { initLab } from './page/lab';
import { createScene, createThemedMaterial, hasWebGL, FRONT_RENDER_LAYER } from './pet/scene';
import { startTicker, type TickerHandle } from './pet/motion';
import { createBlobShadow } from './pet/shadow';
import type { SceneHandle } from './pet/types';

/**
 * Byte demo entry point.
 *
 * Import order matters: tokens.css first so every CSS custom property is
 * available before anything else runs, then global.css (consumes the
 * tokens for the base/reset/layout styles), then grain.css (the overlay
 * painted above everything). `initTheme()` reconciles the `data-theme`
 * attribute the no-flash inline script (see `index.html`) already applied
 * pre-paint; `initGrain()` paints the runtime noise tile once.
 *
 * T3 adds the WebGL pet layer at the end of `bootstrap()`, behind a
 * `hasWebGL()` guard (SPEC's no-WebGL degradation: hide the canvases, keep
 * the static headline, page fully usable) — see the guard block below and
 * `initGLCubeRig()` for the `?glcube` QA rig.
 */

/**
 * `window.__byteScene`/`window.__byteCube` exist only while the `?glcube` dev
 * rig is active (see `initGLCubeRig` below) — never in production. They let
 * the controller's browser-QA script force deterministic renders
 * (`renderBack()`/`renderFront()`) and read canvas pixels to prove occlusion,
 * since this pane throttles rAF and animation can't just be watched live.
 */
declare global {
  interface Window {
    __byteScene?: SceneHandle;
    __byteCube?: Mesh;
  }
}

/**
 * Wires the nav theme-toggle button to the theme controller and keeps its
 * `aria-pressed` state + icon glyph in sync with the active theme. `onToggle`
 * (added in T3) fires after the sync, once the DOM/ARIA state already
 * reflects the new theme — `bootstrap()` uses it to re-theme the WebGL scene
 * without this module needing to know the scene exists at bind time (the
 * scene is created later, after the section inits; the callback closes over
 * the module-scope `scene` binding below, which is assigned by then).
 */
function bindThemeToggle(root: HTMLElement, theme: ThemeController, onToggle?: () => void): void {
  const button = root.querySelector<HTMLButtonElement>('#theme-toggle');
  if (!button) {
    return;
  }
  const icon = button.querySelector<HTMLElement>('[data-theme-toggle-icon]');

  const sync = (): void => {
    const isDark = theme.current() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    if (icon) {
      icon.textContent = isDark ? '☾' : '☀';
    }
  };

  sync();
  button.addEventListener('click', () => {
    theme.toggle();
    sync();
    onToggle?.();
  });
}

/**
 * OS/browser reduced-motion preference, guarding environments without
 * `matchMedia` (mirrors `lenisScroll.ts`'s `shouldUseNativeScroll` guard) —
 * treated as "no preference" rather than "reduce" when the API is missing,
 * since there's no way to ask.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// --- `?glcube` dev rig (R-T3-10) ------------------------------------------

/** World-px (== CSS px) edge length of the `?glcube` test cube — within the brief's ~60-80 range. */
const GLCUBE_SIZE = 72;
/** World-px the cube travels either side of its resting x position while weaving. */
const GLCUBE_WEAVE_OFFSET = 36;
/** Seconds per weave leg (rest → offset or offset → rest). */
const GLCUBE_WEAVE_DURATION = 1.1;
/** World-px the shadow sits below the cube's center — roughly the cube's half-height plus a margin. */
const GLCUBE_SHADOW_Y_OFFSET = 46;

/**
 * `?glcube` occlusion test rig (R-T3-10, T3 Task 5 brief) — QA-only, gated on
 * the URL flag so it never runs for real visitors. Drops a themed cube +
 * blob shadow onto the hero headline, and — unless reduced-motion — weaves
 * the cube behind/in front of the DOM text on a small looping GSAP timeline
 * (rides `gsap.ticker`; no separate rAF loop). This is what proves the
 * two-canvas occlusion sandwich actually occludes: the controller forces
 * `renderBack()`/`renderFront()` via `window.__byteScene` and reads pixels,
 * since this pane's throttled rAF means the weave can't just be watched.
 */
function initGLCubeRig(
  scene: SceneHandle,
  headlineEl: HTMLElement,
  theme: Theme,
  reducedMotion: boolean,
): void {
  if (!new URLSearchParams(window.location.search).has('glcube')) {
    return;
  }

  const cube = new Mesh(
    new BoxGeometry(GLCUBE_SIZE, GLCUBE_SIZE, GLCUBE_SIZE),
    createThemedMaterial(theme),
  );
  const initialRect = scene.screenFromRect(headlineEl);
  const initialWorld = scene.worldFromScreen(initialRect.x, initialRect.y);
  cube.position.set(initialWorld.x, initialWorld.y, 0);

  // `setBehind()` re-traverses `petLayer` and assigns every descendant's
  // render layer; it is not re-applied automatically as new content is
  // added. Without this call the cube would sit on layer 0, which neither
  // `renderFront()` nor `renderBack()` ever selects, and would be invisible
  // on both canvases.
  scene.petLayer.add(cube);
  scene.setBehind(false);

  const shadow = createBlobShadow();
  shadow.mesh.position.set(initialWorld.x, initialWorld.y - GLCUBE_SHADOW_Y_OFFSET, 0);
  // Unlike `petLayer`, `frontLayer`'s render layer is set once on the Group
  // itself at scene creation and is never re-traversed — three.js layers are
  // per-object and don't cascade from a parent Group to children added
  // later, so any mesh added directly to `frontLayer` must set its own layer
  // (see `scene.ts`'s `FRONT_RENDER_LAYER` doc comment).
  shadow.mesh.layers.set(FRONT_RENDER_LAYER);
  shadow.setHeight(0);
  scene.frontLayer.add(shadow.mesh);

  // `headlineEl`'s on-screen rect at this exact synchronous instant (before
  // the hero's own async, fonts-gated `SplitText` load reveal — see
  // `page/hero.ts` — has restructured its DOM) is not its final, settled
  // one: measured against a live page, the two can differ by well over 100
  // world-px vertically. Re-deriving the headline's screen position every
  // tick (cheap — one `getBoundingClientRect()` — and `?glcube`-only, never
  // shipped) keeps the rig glued to the real headline through that reflow,
  // any later resize, and page scroll (the canvases are viewport-fixed, so
  // `screenFromRect`/`worldFromScreen` must be re-evaluated for the cube to
  // track a scrolled headline too), instead of freezing a stale snapshot.
  // `weaveOffset` is the only thing GSAP below actually animates; this tick
  // callback re-anchors the base position and re-applies that offset.
  const weaveState = { offset: 0 };
  scene.onTick(() => {
    const rect = scene.screenFromRect(headlineEl);
    const world = scene.worldFromScreen(rect.x, rect.y);
    cube.position.set(world.x + weaveState.offset, world.y, 0);
    shadow.mesh.position.set(world.x, world.y - GLCUBE_SHADOW_Y_OFFSET, 0);
  });

  if (!reducedMotion) {
    gsap
      .timeline({ repeat: -1 })
      .call(() => scene.setBehind(true))
      .to(weaveState, {
        offset: GLCUBE_WEAVE_OFFSET,
        duration: GLCUBE_WEAVE_DURATION,
        ease: 'sine.inOut',
      })
      .call(() => scene.setBehind(false))
      .to(weaveState, {
        offset: -GLCUBE_WEAVE_OFFSET,
        duration: GLCUBE_WEAVE_DURATION,
        ease: 'sine.inOut',
      });
  }
  // Reduced motion: `weaveState.offset` stays 0 forever (no tween created),
  // so the tick callback above keeps re-anchoring the cube to the live
  // headline position without ever moving it relative to that anchor — a
  // static cube, already in front (`setBehind(false)` above), but
  // `setBehind` still works if a QA script calls it directly.

  window.__byteScene = scene;
  window.__byteCube = cube;
}

// Kept in module scope (rather than dropped like `initLenis()`'s handle)
// so a dispose path exists once a later ticket needs one — this single-page
// bootstrap never calls `dispose()`/`stop()` itself yet.
let scene: SceneHandle | undefined;
let ticker: TickerHandle | undefined;

function bootstrap(): void {
  const theme = initTheme();
  initGrain();
  // Registers ScrollTrigger and boots smooth scroll before the reveal/section
  // inits (later tasks) run, so their triggers attach to a live scroller. No
  // teardown path exists yet in this single-page bootstrap, so the returned
  // handle is intentionally not stored (see `lenisScroll.ts` for the handle
  // callers would use once one does).
  initLenis();

  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    return;
  }

  bindThemeToggle(root, theme, () => scene?.setTheme(theme.current()));

  // Hero load reveal + mouse-parallax (T2 Task 4), the remaining sections'
  // scroll reveals + parallax (T2 Task 5), each guarding its own lookups
  // the same way `initHero()` does. `initLab()` (T2 Task 6) goes last: the
  // Style Lab typography control, which itself no-ops entirely unless
  // `?lab` is present (see `page/lab.ts`).
  initHero();
  initManifesto();
  initWork();
  initFooter();
  initLab();

  // WebGL pet layer (T3) — graceful degradation per SPEC/CLAUDE.md: no
  // WebGL means no canvases at all, so the page stays exactly as T2 left it
  // (static headline #1, fully usable). `console.info` is fine here; an
  // `error`/`warn` is not, since this is an expected, handled path, not a
  // failure.
  if (!hasWebGL()) {
    console.info('[byte] WebGL unavailable — static headline only, pet scene skipped.');
    return;
  }

  const headlineEl = root.querySelector<HTMLElement>('#hero-headline');
  if (!headlineEl) {
    return;
  }

  const reducedMotion = prefersReducedMotion();

  scene = createScene({ headlineEl, theme: theme.current(), reducedMotion });
  ticker = startTicker((dt) => scene?.render(dt));
  // Gives the module-scope `ticker` a genuine (if rarely exercised) reason to
  // exist beyond just being reachable: stop the render callback + its
  // `visibilitychange` listener on an actual page unload, rather than
  // leaving them attached to `gsap.ticker` for the browser to discard along
  // with everything else. The single-page demo never navigates away
  // internally, so this never fires mid-session.
  window.addEventListener('pagehide', () => ticker?.stop());

  initGLCubeRig(scene, headlineEl, theme.current(), reducedMotion);
}

bootstrap();
