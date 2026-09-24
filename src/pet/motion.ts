/**
 * WebGL render-loop ticker — rides the app's single shared clock instead of
 * opening a second `requestAnimationFrame` loop. `src/lib/lenisScroll.ts`
 * already adds its own callback to `gsap.ticker` and already calls
 * `gsap.ticker.lagSmoothing(0)`; `startTicker` below adds a second,
 * independent callback to that same ticker (CLAUDE.md "GSAP conventions" —
 * "drive the render loop off gsap.ticker") and never touches
 * `lagSmoothing`/`sleep`/`wake` itself, since those are ticker-wide and
 * would affect Lenis/ScrollTrigger too, not just this draw call.
 *
 * Per R-T3-6, backgrounding the tab pauses only the WebGL draw: a
 * `visibilitychange` listener removes the render callback from
 * `gsap.ticker` while `document.hidden` and re-adds the same callback
 * instance when the tab becomes visible again. `gsap.ticker` itself (and
 * anything else riding it, e.g. Lenis) keeps running throughout — calling
 * `gsap.ticker.sleep()/wake()` here would pause those too, which is why
 * this only ever calls `add`/`remove`.
 */
import gsap from 'gsap';

/** Handle returned by `startTicker()`. */
export interface TickerHandle {
  /** Remove the ticker callback and detach the `visibilitychange` listener. Idempotent. */
  stop(): void;
}

/**
 * Subscribes `render(dt)` to `gsap.ticker`, converting the ticker's
 * millisecond `deltaTime` to the seconds most render/physics code expects.
 * Adds the callback immediately (regardless of the tab's current visibility
 * state) and thereafter toggles it off/on with `document.hidden`.
 */
export function startTicker(render: (dt: number) => void): TickerHandle {
  function onTick(_time: number, deltaTimeMs: number): void {
    render(deltaTimeMs / 1000);
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      gsap.ticker.remove(onTick);
    } else {
      gsap.ticker.add(onTick);
    }
  }

  gsap.ticker.add(onTick);
  document.addEventListener('visibilitychange', onVisibilityChange);

  let stopped = false;

  return {
    stop(): void {
      if (stopped) {
        return;
      }
      stopped = true;
      gsap.ticker.remove(onTick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}

/**
 * Stops one or more `gsap.quickTo` setters mid-ease WITHOUT retiring them:
 * pauses each setter's own underlying tween, so it writes nothing more until
 * the setter is next called (`resetTo` resumes a paused tween — the same way
 * a fresh quickTo starts out paused and plays on its first call).
 *
 * Use this, never `gsap.killTweensOf(target)`, to hand a quickTo-driven
 * property over to another writer. Killing clears the tween's internal
 * PropTween list (`_pt = 0`) but leaves it initialised, so every later
 * `resetTo` updates orphaned PropTweens and the setter silently never
 * writes the target again (pinned in `motion.test.ts`; gsap 3.15).
 */
export function haltQuickTo(...setters: gsap.QuickToFunc[]): void {
  for (const setter of setters) {
    setter.tween.pause();
  }
}
