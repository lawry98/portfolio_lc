import { describe, expect, it } from 'vitest';
import { announcePhrase, createPhraseThrottle } from './a11y';

/**
 * `createPhraseThrottle` is the pure decision-core (no gsap, no three, no DOM,
 * no wall-clock — time enters only via each call's `nowMs` argument), so every
 * case below is direct arithmetic with `intervalMs = 1000` and hand-picked
 * timestamps — a transcription of the T9 task-1 brief. The lone executor smoke
 * test at the bottom exercises the thin DOM half (`announcePhrase`) under jsdom.
 */
describe('createPhraseThrottle', () => {
  it('emits the first push immediately (leading edge)', () => {
    const t = createPhraseThrottle(1000);
    expect(t.push('A', 0)).toBe('A');
    expect(t.pending()).toBe(false);
  });
  it('defers a push within the interval, marking it pending', () => {
    const t = createPhraseThrottle(1000);
    t.push('A', 0);
    expect(t.push('B', 100)).toBeNull();
    expect(t.pending()).toBe(true);
  });
  it('coalesces rapid pushes to the LATEST text on flush', () => {
    const t = createPhraseThrottle(1000);
    t.push('A', 0);
    expect(t.push('B', 100)).toBeNull();
    expect(t.push('C', 200)).toBeNull();
    expect(t.flush(1000)).toBe('C');
    expect(t.pending()).toBe(false);
  });
  it('flush before the interval elapses returns null', () => {
    const t = createPhraseThrottle(1000);
    t.push('A', 0);
    t.push('B', 100);
    expect(t.flush(500)).toBeNull();
    expect(t.flush(1000)).toBe('B');
  });
  it('flush with nothing pending returns null', () => {
    const t = createPhraseThrottle(1000);
    t.push('A', 0);
    expect(t.flush(5000)).toBeNull();
  });
  it('ignores empty/whitespace text without consuming the leading slot', () => {
    const t = createPhraseThrottle(1000);
    expect(t.push('', 0)).toBeNull();
    expect(t.push('   ', 0)).toBeNull();
    expect(t.pending()).toBe(false);
    expect(t.push('A', 10)).toBe('A'); // empty pushes did not set lastEmit
  });
  it('resumes leading edge once the interval has passed', () => {
    const t = createPhraseThrottle(1000);
    expect(t.push('A', 0)).toBe('A');
    expect(t.push('B', 2000)).toBe('B');
  });
  it('trims announced text', () => {
    const t = createPhraseThrottle(1000);
    expect(t.push('  I SHIP PRODUCTS  ', 0)).toBe('I SHIP PRODUCTS');
  });
});

describe('announcePhrase (executor smoke)', () => {
  it('creates a polite [data-byte-live] region, sets its text, and holds it for a second call within the interval', () => {
    announcePhrase('SAY HELLO');

    const region = document.body.querySelector('[data-byte-live]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.textContent).toBe('SAY HELLO');

    // A second call within the throttle interval is deferred (pending), so the
    // visible region text stays put — the leading announcement is not clobbered.
    announcePhrase('SAY GOODBYE');
    expect(region?.textContent).toBe('SAY HELLO');
  });
});
