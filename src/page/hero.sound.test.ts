import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initSoundControls } from './hero';
import type { SoundEngine } from '../pet/sound/SoundEngine';

// Importing `./hero` transitively loads `./reveals`, whose
// `gsap.registerPlugin(SplitText, ScrollTrigger)` calls `window.matchMedia`
// during module evaluation — which jsdom lacks. `vi.hoisted` runs ahead of the
// imports above, so install a default (non-matching) stub before that fires;
// individual tests overwrite it via `mockMatchMedia` below.
vi.hoisted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      addListener: (): void => {},
      removeListener: (): void => {},
      dispatchEvent: (): boolean => false,
    })) as unknown as typeof window.matchMedia;
  }
});

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const GATE_LABEL_SELECTOR = '.sound-gate-label';
/** Marker class carrying the muted slash on the nav EQ button. */
const MUTED_CLASS = 'is-muted';

const EQ_BUTTON_MARKUP = `
  <button
    type="button"
    id="sound-toggle"
    class="nav__eq-toggle"
    aria-pressed="false"
    data-eq-toggle
    aria-label="Toggle sound"
  >
    <span aria-hidden="true"></span>
    <span aria-hidden="true"></span>
    <span aria-hidden="true"></span>
  </button>
`;

/**
 * jsdom implements neither `matchMedia` nor `PointerEvent`. This stub mirrors
 * `lib/cursor.test.ts`'s: a predicate over the query string, so a test can
 * answer the fine-pointer and reduced-motion gates independently.
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

/**
 * Minimal `SoundEngine` double: `enabled()` reads a mutable flag that
 * `setEnabled` writes, so the toggle's `!engine.enabled()` round-trips
 * realistically; `unlock`/`setEnabled`/`enabled` are spies so calls can be
 * asserted. `play`/`setMaster` are unused by these controls.
 */
function createMockEngine(initialEnabled = true): SoundEngine {
  let enabled = initialEnabled;
  return {
    unlock: vi.fn(),
    setEnabled: vi.fn((next: boolean) => {
      enabled = next;
    }),
    enabled: vi.fn(() => enabled),
    play: vi.fn(),
    setMaster: vi.fn(),
  };
}

function eqButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('[data-eq-toggle]');
  if (!button) {
    throw new Error('EQ button missing from the test fixture');
  }
  return button;
}

beforeEach(() => {
  // Default to a touch/coarse device (no fine pointer, no reduced-motion) so the
  // gate hint is static and no gsap follow tween / `pointermove` is set up; the
  // fine-pointer test overrides this.
  mockMatchMedia(() => false);
  document.body.innerHTML = EQ_BUTTON_MARKUP;
});

afterEach(() => {
  // A test that never dispatched its own `pointerdown` leaves the one-shot,
  // capture-phase first-gesture listener attached to `window`; flush it here so
  // it can't fire during a later test (its closure holds this test's now-dead
  // engine/label, so firing it is harmless — this just sweeps it up).
  window.dispatchEvent(new Event('pointerdown'));
  document.body.innerHTML = '';
  document.querySelectorAll(GATE_LABEL_SELECTOR).forEach((node) => node.remove());
});

describe('initSoundControls', () => {
  it('is a safe no-op when the nav EQ button is absent', () => {
    document.body.innerHTML = '';
    const engine = createMockEngine();

    expect(() => initSoundControls({ engine })).not.toThrow();
    expect(document.querySelector(GATE_LABEL_SELECTOR)).toBeNull();
  });

  it('syncs aria-pressed to the enabled state on init, but keeps `is-on` off until unlock', () => {
    const engine = createMockEngine(true);

    initSoundControls({ engine });

    const button = eqButton();
    // enabled defaults on → aria-pressed true; but not audible yet (locked) → no `is-on`.
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList.contains('is-on')).toBe(false);
  });

  it('EQ button click toggles the engine enabled state and aria-pressed', () => {
    const engine = createMockEngine(true);
    initSoundControls({ engine });
    const button = eqButton();

    button.click();
    expect(engine.setEnabled).toHaveBeenCalledWith(false);
    expect(engine.enabled()).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    expect(engine.setEnabled).toHaveBeenCalledWith(true);
    expect(engine.enabled()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('first window pointerdown unlocks the engine, removes the gate hint, and lights the EQ', () => {
    const engine = createMockEngine(true);
    initSoundControls({ engine });
    const button = eqButton();

    expect(document.querySelector(GATE_LABEL_SELECTOR)).not.toBeNull();
    expect(engine.unlock).not.toHaveBeenCalled();
    expect(button.classList.contains('is-on')).toBe(false);

    window.dispatchEvent(new Event('pointerdown'));

    expect(engine.unlock).toHaveBeenCalledTimes(1);
    expect(document.querySelector(GATE_LABEL_SELECTOR)).toBeNull();
    // Enabled (default) AND now unlocked → audible → the equalizer animates.
    expect(button.classList.contains('is-on')).toBe(true);
  });

  it('first window keydown also unlocks the engine, removes the gate hint, and lights the EQ', () => {
    // Keyboard-only users never fire `pointerdown` — the unlock must also accept
    // a `keydown` (SPEC §12 keyboard operability), or "enable sound" is unusable
    // for them.
    const engine = createMockEngine(true);
    initSoundControls({ engine });
    const button = eqButton();

    expect(document.querySelector(GATE_LABEL_SELECTOR)).not.toBeNull();
    expect(engine.unlock).not.toHaveBeenCalled();
    expect(button.classList.contains('is-on')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(engine.unlock).toHaveBeenCalledTimes(1);
    expect(document.querySelector(GATE_LABEL_SELECTOR)).toBeNull();
    expect(button.classList.contains('is-on')).toBe(true);
  });

  it('on a fine pointer, builds a following (non-static) hint and cleans it up on unlock', () => {
    mockMatchMedia((query) => query === FINE_POINTER_QUERY);
    const engine = createMockEngine(true);

    initSoundControls({ engine });

    const label = document.querySelector<HTMLElement>(GATE_LABEL_SELECTOR);
    expect(label).not.toBeNull();
    expect(label?.classList.contains('sound-gate-label--static')).toBe(false);

    window.dispatchEvent(new Event('pointerdown'));

    expect(engine.unlock).toHaveBeenCalledTimes(1);
    expect(document.querySelector(GATE_LABEL_SELECTOR)).toBeNull();
  });

  it('creates no gate hint when the stored preference is muted', () => {
    // The reported bug: `enabled()` is persisted but `unlocked` is not, so a
    // muted user who reloaded got `(click to enable sound)` back — and the click
    // opened the gate on an engine that stayed muted. A hint that cannot keep
    // its promise must not be made: no label at all while the preference is off.
    mockMatchMedia((query) => query === FINE_POINTER_QUERY);
    const engine = createMockEngine(false);

    initSoundControls({ engine });

    expect(document.querySelector(GATE_LABEL_SELECTOR)).toBeNull();
  });

  it('still unlocks on the first gesture while muted, with no hint to remove', () => {
    // Suppressing the hint must not disturb the gate itself — the AudioContext
    // still opens on the first gesture, so a later unmute is audible at once.
    const engine = createMockEngine(false);
    initSoundControls({ engine });
    const button = eqButton();

    expect(() => window.dispatchEvent(new Event('pointerdown'))).not.toThrow();

    expect(engine.unlock).toHaveBeenCalledTimes(1);
    // Unlocked but still muted → not audible: dark equalizer, slash still shown.
    expect(button.classList.contains('is-on')).toBe(false);
    expect(button.classList.contains(MUTED_CLASS)).toBe(true);
  });

  it('marks the EQ muted from the persisted preference, not from audibility', () => {
    // A first-time visitor is enabled-but-locked — silent, but they never muted
    // anything, so the slash must stay off until the preference itself says so.
    const engine = createMockEngine(true);
    initSoundControls({ engine });
    const button = eqButton();

    expect(button.classList.contains(MUTED_CLASS)).toBe(false);

    button.click();
    expect(button.classList.contains(MUTED_CLASS)).toBe(true);

    button.click();
    expect(button.classList.contains(MUTED_CLASS)).toBe(false);
  });

  it('clears the muted marker and lights the EQ when a muted reload is unmuted', () => {
    const engine = createMockEngine(false);
    initSoundControls({ engine });
    const button = eqButton();

    expect(button.classList.contains(MUTED_CLASS)).toBe(true);

    // jsdom's `.click()` fires only `click`, so send the `pointerdown` a real
    // browser would have delivered first — that capture-phase gesture is what
    // opens the gate before the button's own handler unmutes.
    window.dispatchEvent(new Event('pointerdown'));
    button.click();

    expect(button.classList.contains(MUTED_CLASS)).toBe(false);
    expect(button.classList.contains('is-on')).toBe(true);
  });
});
