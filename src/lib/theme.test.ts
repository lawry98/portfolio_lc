import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initTheme } from './theme';

const STORAGE_KEY = 'byte-theme';

/**
 * jsdom does not implement `matchMedia` — stub it so `initTheme()` can read a
 * fake system color-scheme preference.
 */
function mockMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      addListener: (): void => {},
      removeListener: (): void => {},
      dispatchEvent: (): boolean => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('initTheme', () => {
  it('defaults to the system color-scheme preference when localStorage has no saved theme', () => {
    mockMatchMedia(true);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    document.documentElement.removeAttribute('data-theme');
    mockMatchMedia(false);
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('lets a persisted localStorage value override the system preference', () => {
    mockMatchMedia(true); // system says dark…
    localStorage.setItem(STORAGE_KEY, 'light'); // …but a saved choice says light.

    const theme = initTheme();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(theme.current()).toBe('light');
  });

  it('toggle() flips the active theme, applies the attribute, and persists it', () => {
    mockMatchMedia(false); // starts light
    const theme = initTheme();

    theme.toggle();

    expect(theme.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('set(t) applies the data-theme attribute and persists it', () => {
    mockMatchMedia(false); // starts light
    const theme = initTheme();

    theme.set('dark');

    expect(theme.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('falls back to the system preference when localStorage.getItem throws (privacy mode / blocked storage)', () => {
    mockMatchMedia(true); // system says dark
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });

    expect(() => initTheme()).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    getItemSpy.mockRestore();
  });

  it('toggle() still applies data-theme when localStorage.setItem throws (silent no-op persistence)', () => {
    mockMatchMedia(false); // starts light
    const theme = initTheme();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: storage disabled');
    });

    expect(() => theme.toggle()).not.toThrow();
    expect(theme.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    setItemSpy.mockRestore();
  });
});
