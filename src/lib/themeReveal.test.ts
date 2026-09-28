import { afterEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE_MS, REVEAL_MS, revealRadius, revealTheme } from './themeReveal';

// jsdom has neither `document.startViewTransition` nor `Element.animate`, while
// the DOM lib types both as always present — so stub them with
// `Object.defineProperty` and remove them with `Reflect.deleteProperty`,
// which sidestep the "operand of delete must be optional" and method-type
// assignment errors that plain `=`/`delete` would raise under tsc.
function stubViewTransition(ready: Promise<void> = Promise.resolve()) {
  const animate = vi.fn(() => ({ finished: Promise.resolve() }));
  Object.defineProperty(document.documentElement, 'animate', {
    value: animate,
    configurable: true,
    writable: true,
  });
  const start = vi.fn((cb: () => void) => {
    cb();
    return { ready, finished: ready.catch(() => {}), updateCallbackDone: Promise.resolve() };
  });
  Object.defineProperty(document, 'startViewTransition', {
    value: start,
    configurable: true,
    writable: true,
  });
  return { animate, start };
}

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(document.documentElement, 'animate');
  vi.restoreAllMocks();
});

describe('revealRadius', () => {
  it("reaches the viewport's farthest corner from the origin", () => {
    expect(revealRadius(0, 0, 100, 50)).toBeCloseTo(Math.hypot(100, 50), 10);
    expect(revealRadius(50, 25, 100, 50)).toBeCloseTo(Math.hypot(50, 25), 10);
  });
});

describe('revealTheme', () => {
  it('without View Transitions: applies synchronously and resolves', async () => {
    const apply = vi.fn();
    await revealTheme(apply, { x: 10, y: 10 }, { reduced: false });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('full motion: grows the radius custom property, not clip-path (Chrome composites clip-path at 1/dpr)', async () => {
    const { animate } = stubViewTransition();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const apply = vi.fn();

    await revealTheme(apply, { x: 900, y: 700 }, { reduced: false });

    expect(apply).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0] as unknown as [
      Record<string, string[]>,
      KeyframeAnimationOptions,
    ];
    expect(keyframes).toEqual({ '--theme-reveal-r': ['0px', `${Math.hypot(900, 700)}px`] });
    expect(options.duration).toBe(REVEAL_MS);
    expect(options.fill).toBe('forwards');
    expect(options.pseudoElement).toBe('::view-transition-new(root)');
  });

  it('pins the origin on the root while the circle runs, and clears it afterwards', async () => {
    let seen: { on: boolean; x: string; y: string } | null = null;
    const { animate } = stubViewTransition();
    animate.mockImplementation(() => {
      const root = document.documentElement;
      seen = {
        on: root.hasAttribute('data-theme-reveal'),
        x: root.style.getPropertyValue('--theme-reveal-x'),
        y: root.style.getPropertyValue('--theme-reveal-y'),
      };
      return { finished: Promise.resolve() };
    });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);

    await revealTheme(() => {}, { x: 1200, y: 900 }, { reduced: false });

    // Clamped onto the viewport edge.
    expect(seen).toEqual({ on: true, x: '1000px', y: '800px' });
    const root = document.documentElement;
    expect(root.hasAttribute('data-theme-reveal')).toBe(false);
    expect(root.style.getPropertyValue('--theme-reveal-x')).toBe('');
    expect(root.style.getPropertyValue('--theme-reveal-y')).toBe('');
  });

  it('reduced motion: an opacity crossfade, no circle', async () => {
    const { animate } = stubViewTransition();

    await revealTheme(() => {}, { x: 0, y: 0 }, { reduced: true });

    const [keyframes, options] = animate.mock.calls[0] as unknown as [
      { opacity: number[] },
      KeyframeAnimationOptions,
    ];
    expect(keyframes).toEqual({ opacity: [0, 1] });
    expect(options.duration).toBe(CROSSFADE_MS);
    expect(document.documentElement.hasAttribute('data-theme-reveal')).toBe(false);
  });

  it('a skipped transition (ready rejects) still applied the theme and resolves', async () => {
    const { animate } = stubViewTransition(Promise.reject(new Error('InvalidStateError')));
    const apply = vi.fn();

    await expect(revealTheme(apply, { x: 0, y: 0 }, { reduced: false })).resolves.toBeUndefined();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute('data-theme-reveal')).toBe(false);
  });
});
