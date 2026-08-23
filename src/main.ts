import './styles/tokens.css';
import './styles/global.css';
import './styles/grain.css';
import { initTheme, type ThemeController } from './lib/theme';
import { initGrain } from './lib/grain';
import { initLenis } from './lib/lenisScroll';
import { initHero } from './page/hero';
import { initManifesto } from './page/manifesto';
import { initWork } from './page/work';
import { initFooter } from './page/footer';
import { initLab } from './page/lab';
import { hasWebGL } from './pet/scene';
import { createBytePet } from './pet/createBytePet';
import type { BytePetHandle } from './pet/types';

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
 * WebGL pet layer (T3 laid the foundation; T4 wires the real Byte):
 * `bootstrap()` delegates to `createBytePet()` behind a `hasWebGL()` guard
 * (SPEC's no-WebGL degradation: hide the canvases, keep the static
 * headline, page fully usable) — see the guard block below.
 * `createBytePet()` owns the scene, the render ticker, the rig, the
 * shadow, and the FSM internally; this module only holds the returned
 * `BytePetHandle` (for the theme-toggle callback and the pagehide
 * teardown). T3's `?glcube` QA rig (which proved the two-canvas occlusion
 * sandwich) was removed once its job was done.
 */

/**
 * Wires the nav theme-toggle button to the theme controller and keeps its
 * `aria-pressed` state + icon glyph in sync with the active theme. `onToggle`
 * (added in T3) fires after the sync, once the DOM/ARIA state already
 * reflects the new theme — `bootstrap()` uses it to re-theme Byte without
 * this module needing to know `bytePet` exists at bind time (it's created
 * later, after the section inits and the `hasWebGL()` guard; the callback
 * closes over the module-scope `bytePet` binding below, which may still be
 * `undefined` at click time on the no-WebGL path — hence the `?.`).
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

// Kept in module scope (rather than dropped like `initLenis()`'s handle) so
// both the theme-toggle callback and the `pagehide` teardown below can reach
// it — `undefined` on the no-WebGL path, where there is no Byte to theme or
// tear down.
let bytePet: BytePetHandle | undefined;

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

  bindThemeToggle(root, theme, () => bytePet?.setTheme(theme.current()));

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

  // WebGL pet layer (T3 foundation, T4 real Byte) — graceful degradation per
  // SPEC/CLAUDE.md: no WebGL means no canvases at all, so the page stays
  // exactly as T2 left it (static headline #1, fully usable). `console.info`
  // is fine here; an `error`/`warn` is not, since this is an expected,
  // handled path, not a failure.
  if (!hasWebGL()) {
    console.info('[byte] WebGL unavailable — static headline only, pet scene skipped.');
    return;
  }

  const headlineEl = root.querySelector<HTMLElement>('#hero-headline');
  if (!headlineEl) {
    return;
  }

  const reducedMotion = prefersReducedMotion();

  bytePet = createBytePet(document.body, { headlineEl, theme: theme.current(), reducedMotion });

  // Gives the module-scope `bytePet` a genuine (if rarely exercised) reason
  // to exist beyond the theme-toggle callback above: tear it down (kills
  // every tween/timer/listener + the scene's renderers/canvases) on a *real*
  // page unload. `pagehide` also fires when the page is frozen into the
  // back/forward cache instead of destroyed (`event.persisted === true`) —
  // destroying there would strand a frozen, unresumable scene for a later
  // `pageshow` restore. Only a non-persisted `pagehide` (an actual unload)
  // calls `destroy()`; a bfcache round-trip is left entirely to
  // `startTicker`'s own internal `visibilitychange` pause/resume (see
  // `pet/motion.ts`). The single-page demo never navigates away internally,
  // so this rarely fires either way.
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      bytePet?.destroy();
    }
  });
}

bootstrap();
