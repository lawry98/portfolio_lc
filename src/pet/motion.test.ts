import gsap from 'gsap';
import { haltQuickTo, startTicker, type TickerHandle } from './motion';

/**
 * `document.hidden` is a getter inherited from `Document.prototype` (jsdom
 * defines it there, returning `false` because Vitest's jsdom environment
 * defaults `pretendToBeVisual: true`). Shadowing it with an own,
 * `configurable` property lets each test flip visibility on demand;
 * `restoreHidden()` deletes the own property in `afterEach` so the next
 * test starts from the real (visible) default instead of a leftover stub.
 */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}

function restoreHidden(): void {
  delete (document as { hidden?: boolean }).hidden;
}

function dispatchVisibilityChange(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * Replaces `gsap.ticker.add`/`remove` with mocks that never call through to
 * the real ticker — this suite only cares whether/when/with-what our own
 * `visibilitychange` wiring calls them, never about gsap's actual rAF loop
 * (jsdom + a real ticker would otherwise leave a dangling loop across
 * tests). `add`'s real return type is a callback, so the mock returns a
 * throwaway no-op function to stay type-honest rather than `undefined`.
 */
function mockTicker(): {
  addSpy: ReturnType<typeof vi.spyOn>;
  removeSpy: ReturnType<typeof vi.spyOn>;
} {
  const addSpy = vi.spyOn(gsap.ticker, 'add').mockImplementation(() => () => undefined);
  const removeSpy = vi.spyOn(gsap.ticker, 'remove').mockImplementation(() => undefined);
  return { addSpy, removeSpy };
}

/**
 * Every `it()` below that calls `startTicker()` must also tear it down: a
 * `startTicker()` whose `stop()` never runs leaves a real `visibilitychange`
 * listener on the shared, cross-test `document`, so a later test's
 * `dispatchVisibilityChange()` would also fire *this* test's leftover
 * listener — cross-test contamination, not a `motion.ts` bug. Tracking the
 * handle here and stopping it in `afterEach` keeps every test isolated.
 */
let activeHandle: TickerHandle | undefined;

function startTrackedTicker(render: (dt: number) => void): TickerHandle {
  activeHandle = startTicker(render);
  return activeHandle;
}

describe('startTicker', () => {
  afterEach(() => {
    activeHandle?.stop();
    activeHandle = undefined;
    restoreHidden();
    vi.restoreAllMocks();
  });

  it('adds one render callback to gsap.ticker on start', () => {
    const { addSpy } = mockTicker();

    startTrackedTicker(() => {});

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls[0]?.[0]).toBeTypeOf('function');
  });

  it('converts gsap.ticker millisecond deltaTime to seconds when it ticks', () => {
    const { addSpy } = mockTicker();
    const render = vi.fn();

    startTrackedTicker(render);

    // Grab the exact callback `startTicker` handed to `gsap.ticker.add` and
    // drive it directly with a synthetic frame, bypassing gsap's own rAF
    // loop entirely — this asserts the real ms→s conversion, not just that
    // `add` was called.
    const onTick = addSpy.mock.calls[0]?.[0] as (
      time: number,
      deltaTime: number,
      frame: number,
      elapsed: number,
    ) => void;
    onTick(12.3, 32, 5, 12.3);

    expect(render).toHaveBeenCalledExactlyOnceWith(0.032);
  });

  it('removes the callback when the tab becomes hidden, and re-adds the same callback when visible again', () => {
    const { addSpy, removeSpy } = mockTicker();

    startTrackedTicker(() => {});
    const onTick = addSpy.mock.calls[0]?.[0];
    expect(addSpy).toHaveBeenCalledTimes(1);

    setHidden(true);
    dispatchVisibilityChange();
    expect(removeSpy).toHaveBeenCalledExactlyOnceWith(onTick);

    setHidden(false);
    dispatchVisibilityChange();
    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(addSpy.mock.calls[1]?.[0]).toBe(onTick);
  });

  it('does not call gsap.ticker.sleep/wake (visibility must pause only the draw callback)', () => {
    mockTicker();
    const sleepSpy = vi.spyOn(gsap.ticker, 'sleep').mockImplementation(() => undefined);
    const wakeSpy = vi.spyOn(gsap.ticker, 'wake').mockImplementation(() => undefined);

    startTrackedTicker(() => {});
    setHidden(true);
    dispatchVisibilityChange();
    setHidden(false);
    dispatchVisibilityChange();

    expect(sleepSpy).not.toHaveBeenCalled();
    expect(wakeSpy).not.toHaveBeenCalled();
  });

  it('stop() removes the callback and detaches the listener, so a later visibilitychange does not re-add it', () => {
    const { addSpy, removeSpy } = mockTicker();

    const handle = startTrackedTicker(() => {});
    expect(addSpy).toHaveBeenCalledTimes(1);

    handle.stop();
    expect(removeSpy).toHaveBeenCalledTimes(1);

    // The listener is gone, so toggling visibility after `stop()` must not
    // touch the ticker again in either direction.
    setHidden(true);
    dispatchVisibilityChange();
    setHidden(false);
    dispatchVisibilityChange();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('stop() is idempotent — calling it again does not remove the ticker callback a second time', () => {
    const { removeSpy } = mockTicker();

    const handle = startTrackedTicker(() => {});
    handle.stop();
    handle.stop();

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * Drives GSAP's root timeline by hand, one synthetic 60fps frame per call —
 * the same `updateRoot` the real ticker calls every rAF, so these tests run
 * the actual quickTo/resetTo machinery without waiting on jsdom's rAF.
 * Starts from the global timeline's current time so an earlier test (or a
 * stray real tick) can't make the first synthetic frame render backwards.
 */
function createFrameDriver(): (frames: number, beforeEach?: () => void) => void {
  let time = gsap.globalTimeline.time();
  return (frames, beforeEach) => {
    for (let i = 0; i < frames; i += 1) {
      beforeEach?.();
      time += 1 / 60;
      gsap.updateRoot(time);
    }
  };
}

describe('haltQuickTo', () => {
  it('stops an in-flight quickTo ease on the spot', () => {
    const target = { x: 0 };
    const toX = gsap.quickTo(target, 'x', { duration: 0.5, ease: 'power2' });
    const frames = createFrameDriver();

    frames(3, () => toX(100));
    const held = target.x;
    expect(held).toBeGreaterThan(0);
    expect(held).toBeLessThan(100);

    haltQuickTo(toX);
    frames(30);

    expect(target.x).toBe(held);
  });

  // Regression: the T8 migration arrival used `gsap.killTweensOf(position)`
  // to stop the lane pair, which left every quickTo on that target unable
  // to write again — the footer->hero return leg never moved and Byte
  // stayed `traveling` forever. A halted setter must drive a second leg.
  it('leaves the setter usable, so a second leg still drives the target', () => {
    const target = { x: 0 };
    const toX = gsap.quickTo(target, 'x', { duration: 0.5, ease: 'power2' });
    const frames = createFrameDriver();

    frames(60, () => toX(100));
    expect(target.x).toBeCloseTo(100, 0);
    haltQuickTo(toX);

    frames(60, () => toX(0));

    expect(target.x).toBeCloseTo(0, 0);
  });

  // Pins the GSAP behaviour that makes `haltQuickTo` necessary: if a gsap
  // upgrade ever changes this, the comment on `haltQuickTo` needs revisiting.
  it('exists because gsap.killTweensOf permanently disables a quickTo setter', () => {
    const target = { x: 0 };
    const toX = gsap.quickTo(target, 'x', { duration: 0.5, ease: 'power2' });
    const frames = createFrameDriver();

    frames(60, () => toX(100));
    const afterFirstLeg = target.x;
    gsap.killTweensOf(target);

    frames(60, () => toX(0));

    expect(target.x).toBe(afterFirstLeg);
  });
});
