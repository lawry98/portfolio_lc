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

  it('full motion: a circle clip from the origin on the new view', async () => {
    const { animate } = stubViewTransition();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const apply = vi.fn();

    await revealTheme(apply, { x: 900, y: 700 }, { reduced: false });

    expect(apply).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0] as unknown as [
      { clipPath: string[] },
      KeyframeAnimationOptions,
    ];
    const r = Math.hypot(900, 700);
    expect(keyframes.clipPath).toEqual([
      'circle(0px at 900px 700px)',
      `circle(${r}px at 900px 700px)`,
    ]);
    expect(options.duration).toBe(REVEAL_MS);
    expect(options.pseudoElement).toBe('::view-transition-new(root)');
  });

  it('clamps an off-viewport origin onto the viewport edge', async () => {
    const { animate } = stubViewTransition();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);

    await revealTheme(() => {}, { x: 1200, y: 900 }, { reduced: false });

    const [keyframes] = animate.mock.calls[0] as unknown as [{ clipPath: string[] }];
    expect(keyframes.clipPath[0]).toBe('circle(0px at 1000px 800px)');
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
  });

  it('a skipped transition (ready rejects) still applied the theme and resolves', async () => {
    const { animate } = stubViewTransition(Promise.reject(new Error('InvalidStateError')));
    const apply = vi.fn();

    await expect(revealTheme(apply, { x: 0, y: 0 }, { reduced: false })).resolves.toBeUndefined();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });
});
