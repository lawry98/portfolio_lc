import './styles/tokens.css';
import './styles/global.css';
import './styles/grain.css';
import { initTheme, type ThemeController } from './lib/theme';
import { initGrain } from './lib/grain';
import { initLenis } from './lib/lenisScroll';

/**
 * Byte demo entry point.
 *
 * Import order matters: tokens.css first so every CSS custom property is
 * available before anything else runs, then global.css (consumes the
 * tokens for the base/reset/layout styles), then grain.css (the overlay
 * painted above everything). `initTheme()` reconciles the `data-theme`
 * attribute the no-flash inline script (see `index.html`) already applied
 * pre-paint; `initGrain()` paints the runtime noise tile once.
 */

/**
 * Wires the nav theme-toggle button to the theme controller and keeps its
 * `aria-pressed` state + icon glyph in sync with the active theme.
 */
function bindThemeToggle(root: HTMLElement, theme: ThemeController): void {
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
  });
}

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

  bindThemeToggle(root, theme);
}

bootstrap();
