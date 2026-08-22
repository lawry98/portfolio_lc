/**
 * Theme controller — light/dark `data-theme` axis.
 *
 * Source of truth precedence: a persisted `localStorage` choice overrides the
 * OS `prefers-color-scheme`. The resolved theme is applied as `data-theme` on
 * `document.documentElement`; see the no-flash inline script in `index.html`
 * for the pre-paint equivalent of this same resolution.
 */

export type Theme = 'light' | 'dark';

export interface ThemeController {
  current(): Theme;
  set(theme: Theme): void;
  toggle(): void;
}

const STORAGE_KEY = 'byte-theme';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * `localStorage` access can throw (privacy mode, "block all site data",
 * storage-quota-0 webviews). `initTheme()` is the first call in `bootstrap()`
 * (see `main.ts`), so an unguarded throw here would abort the whole
 * bootstrap — grain + the theme toggle would never init. Mirrors the
 * try/catch in the no-flash inline script in `index.html`.
 */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Silent no-op — persistence is a nice-to-have, not a requirement.
  }
}

function resolveInitialTheme(): Theme {
  const stored = safeGet(STORAGE_KEY);
  if (isTheme(stored)) {
    return stored;
  }
  return prefersDark() ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function persistTheme(theme: Theme): void {
  safeSet(STORAGE_KEY, theme);
}

export function initTheme(): ThemeController {
  let theme = resolveInitialTheme();
  applyTheme(theme);

  return {
    current(): Theme {
      return theme;
    },
    set(next: Theme): void {
      theme = next;
      applyTheme(theme);
      persistTheme(theme);
    },
    toggle(): void {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme(theme);
      persistTheme(theme);
    },
  };
}
