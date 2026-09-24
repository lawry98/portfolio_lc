import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { entranceGate, PRELOADER_FONTS_FALLBACK_MS, PRELOADER_MIN_MS } from './preloader';

/** Lets the gate's Promise.all/race chain settle after a timer fires (jsdom has no document.fonts, so fonts resolve at once). */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/** Returns a probe that turns true once `promise` settles. */
function watch(promise: Promise<void>): () => boolean {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  return () => settled;
}

describe('entranceGate (TICKETS T-GLB row 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens at PRELOADER_MIN_MS when the model is already live', async () => {
    const settled = watch(entranceGate(Promise.resolve()));
    await vi.advanceTimersByTimeAsync(PRELOADER_MIN_MS - 1);
    await flush();
    expect(settled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(settled()).toBe(true);
  });

  it('waits past the minimum for a model still loading', async () => {
    let live!: () => void;
    const model = new Promise<void>((resolve) => {
      live = resolve;
    });
    const settled = watch(entranceGate(model));
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(settled()).toBe(false);
    live();
    await flush();
    expect(settled()).toBe(true);
  });

  it('never waits past the fallback cap for a model that never settles', async () => {
    const settled = watch(entranceGate(new Promise<void>(() => {})));
    await vi.advanceTimersByTimeAsync(PRELOADER_FONTS_FALLBACK_MS - 1);
    await flush();
    expect(settled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(settled()).toBe(true);
  });

  it('opens at the minimum with no model at all (no WebGL, or no modelUrl)', async () => {
    const settled = watch(entranceGate());
    await vi.advanceTimersByTimeAsync(PRELOADER_MIN_MS);
    await flush();
    expect(settled()).toBe(true);
  });
});
