import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initCursor } from './cursor';

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const ACTIVE_CLASS = 'byte-cursor-active';

/**
 * jsdom does not implement `matchMedia` — stub it so `initCursor()` can read
 * a fake pointer/hover capability (ruling R7-5). Unlike `lib/theme.test.ts`'s
 * mock (a single fixed `matches`), this one takes a predicate over the query
 * string: `cursor.ts` queries two DIFFERENT media features (the fine-pointer
 * gate and the reduced-motion smoothing check), so a test needs to answer
 * each independently rather than returning the same value for both.
 */
function mockMatchMedia(matchesQuery: (query: string) => boolean): void {
  window.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: matchesQuery(query),
      media: query,
      onchange: null,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      addListener: (): void => {},
      removeListener: (): void => {},
      dispatchEvent: (): boolean => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

function cursorDotCount(): number {
  return document.querySelectorAll('.byte-cursor').length;
}

function queryPill(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.byte-cursor__pill');
}

// Belt-and-suspenders against cross-test leakage: every test below either
// calls `destroy()` itself or relies on this to sweep up whatever the fine-
// pointer path appended to `<body>`/`<html>`, so node/class counts in later
// tests are never inflated by an earlier test's DOM.
afterEach(() => {
  document.querySelectorAll('.byte-cursor').forEach((node) => node.remove());
  document.documentElement.classList.remove(ACTIVE_CLASS);
});

describe('initCursor — fine-pointer/hover device', () => {
  beforeEach(() => {
    mockMatchMedia((query) => query === FINE_POINTER_QUERY);
  });

  it('creates the cursor dot in the DOM and hides the native cursor', () => {
    initCursor();

    expect(cursorDotCount()).toBe(1);
    expect(document.documentElement.classList.contains(ACTIVE_CLASS)).toBe(true);
  });

  it('creates a pill that starts hidden', () => {
    initCursor();

    const pill = queryPill();
    expect(pill).not.toBeNull();
    expect(pill?.hidden).toBe(true);
  });

  it('setLabel("FEED") shows the pill with the FEED text', () => {
    const cursor = initCursor();

    cursor.setLabel('FEED');

    const pill = queryPill();
    expect(pill?.hidden).toBe(false);
    expect(pill?.textContent).toBe('FEED');
  });

  it('setLabel swaps text when called with a different label', () => {
    const cursor = initCursor();

    cursor.setLabel('TOGGLE');
    expect(queryPill()?.textContent).toBe('TOGGLE');

    cursor.setLabel('OPEN');
    expect(queryPill()?.textContent).toBe('OPEN');
  });

  it('setLabel(null) hides the pill again', () => {
    const cursor = initCursor();

    cursor.setLabel('FEED');
    cursor.setLabel(null);

    expect(queryPill()?.hidden).toBe(true);
  });

  it('destroy() removes the created elements and restores the native cursor', () => {
    const cursor = initCursor();

    cursor.destroy();

    expect(cursorDotCount()).toBe(0);
    expect(queryPill()).toBeNull();
    expect(document.documentElement.classList.contains(ACTIVE_CLASS)).toBe(false);
  });
});

describe('initCursor — fine-pointer device with prefers-reduced-motion: reduce', () => {
  // `cursor.ts` skips creating the `gsap.quickTo` smoothing tweens on this
  // branch (see its module doc) — this exercises that branch's DOM-facing
  // behaviour only (element creation, label show/hide, destroy cleanup),
  // never gsap animation internals, per the brief's own testing guidance.
  beforeEach(() => {
    mockMatchMedia((query) => query === FINE_POINTER_QUERY || query === REDUCED_MOTION_QUERY);
  });

  it('still creates the dot + pill and supports setLabel/destroy', () => {
    const cursor = initCursor();
    expect(cursorDotCount()).toBe(1);

    cursor.setLabel('OPEN');
    expect(queryPill()?.hidden).toBe(false);
    expect(queryPill()?.textContent).toBe('OPEN');

    cursor.destroy();
    expect(cursorDotCount()).toBe(0);
    expect(document.documentElement.classList.contains(ACTIVE_CLASS)).toBe(false);
  });
});

describe('initCursor — touch/coarse-pointer device (no hover, no fine pointer)', () => {
  beforeEach(() => {
    mockMatchMedia(() => false);
  });

  it('creates no cursor elements at all', () => {
    initCursor();

    expect(cursorDotCount()).toBe(0);
    expect(queryPill()).toBeNull();
    expect(document.documentElement.classList.contains(ACTIVE_CLASS)).toBe(false);
  });

  it('setLabel is a no-op — still no pill in the DOM', () => {
    const cursor = initCursor();

    expect(() => cursor.setLabel('FEED')).not.toThrow();
    expect(cursorDotCount()).toBe(0);
    expect(queryPill()).toBeNull();
  });

  it('destroy is a no-op', () => {
    const cursor = initCursor();

    expect(() => cursor.destroy()).not.toThrow();
    expect(cursorDotCount()).toBe(0);
    expect(document.documentElement.classList.contains(ACTIVE_CLASS)).toBe(false);
  });
});
