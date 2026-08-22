import './styles/tokens.css';
import { initTheme } from './lib/theme';

/**
 * Byte demo entry point.
 *
 * Tokens are imported first so every CSS custom property is available before
 * anything else runs; `initTheme()` reconciles the `data-theme` attribute the
 * no-flash inline script (see `index.html`) already applied pre-paint. Page
 * layout/grain (Task 3) mounts its own pieces here in a later ticket.
 */
function bootstrap(): void {
  initTheme();

  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    return;
  }
}

bootstrap();
