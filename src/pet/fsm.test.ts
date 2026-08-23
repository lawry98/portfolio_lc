import { describe, expect, it, vi } from 'vitest';
import { createFSM } from './fsm';
import type { PetState } from './types';

describe('createFSM: initial state', () => {
  it('starts in idle', () => {
    const fsm = createFSM();
    expect(fsm.state()).toBe('idle');
  });
});

describe('createFSM: idle', () => {
  it('idle -> curious on POINTER_NEAR', () => {
    const fsm = createFSM();
    fsm.send('POINTER_NEAR');
    expect(fsm.state()).toBe('curious');
  });

  it('idle -> dashing on FEED', () => {
    const fsm = createFSM();
    fsm.send('FEED');
    expect(fsm.state()).toBe('dashing');
  });

  it('idle -> peeking on PEEK', () => {
    const fsm = createFSM();
    fsm.send('PEEK');
    expect(fsm.state()).toBe('peeking');
  });

  it('idle stays idle on POINTER_DOWN (feeding-click routing is T5)', () => {
    const fsm = createFSM();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_DOWN');

    expect(fsm.state()).toBe('idle');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('idle -> sleeping after tickTimers(30000) with no events', () => {
    const fsm = createFSM();
    fsm.tickTimers(30000);
    expect(fsm.state()).toBe('sleeping');
  });

  it('ignores POINTER_FAR in idle (no change, no onEnter)', () => {
    const fsm = createFSM();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_FAR');

    expect(fsm.state()).toBe('idle');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: curious', () => {
  function enterCurious() {
    const fsm = createFSM();
    fsm.send('POINTER_NEAR');
    return fsm;
  }

  it('curious -> invited after tickTimers(2500) (default), and NOT before', () => {
    const fsm = enterCurious();

    fsm.tickTimers(2499);
    expect(fsm.state()).toBe('curious');

    fsm.tickTimers(1);
    expect(fsm.state()).toBe('invited');
  });

  it('curious -> idle on POINTER_FAR before the invited timeout', () => {
    const fsm = enterCurious();
    fsm.tickTimers(1000);

    fsm.send('POINTER_FAR');

    expect(fsm.state()).toBe('idle');
  });

  it('curious -> dashing on FEED', () => {
    const fsm = enterCurious();
    fsm.send('FEED');
    expect(fsm.state()).toBe('dashing');
  });

  it('POINTER_NEAR in curious stays curious (no re-enter, no onEnter)', () => {
    const fsm = enterCurious();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');

    expect(fsm.state()).toBe('curious');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('a "stay curious" POINTER_NEAR does not restart the curious state timer', () => {
    // The transition table calls this "no re-enter" — a naive implementation
    // that resets the per-state timer on every event (not just real state
    // changes) would push the invited deadline out; this proves it doesn't.
    const fsm = enterCurious();

    fsm.tickTimers(1000);
    fsm.send('POINTER_NEAR'); // stay curious; must NOT reset the state timer
    fsm.tickTimers(1499); // cumulative state timer = 2499 (< 2500)
    expect(fsm.state()).toBe('curious');

    fsm.tickTimers(1); // cumulative state timer = 2500
    expect(fsm.state()).toBe('invited');
  });
});

describe('createFSM: invited', () => {
  function enterInvited() {
    const fsm = createFSM();
    fsm.send('POINTER_NEAR');
    fsm.tickTimers(2500);
    return fsm;
  }

  it('reaches invited from curious via the state timer', () => {
    expect(enterInvited().state()).toBe('invited');
  });

  it('invited -> dashing on FEED', () => {
    const fsm = enterInvited();
    fsm.send('FEED');
    expect(fsm.state()).toBe('dashing');
  });

  it('invited -> idle on POINTER_FAR', () => {
    const fsm = enterInvited();
    fsm.send('POINTER_FAR');
    expect(fsm.state()).toBe('idle');
  });

  it('POINTER_NEAR in invited stays invited (no onEnter)', () => {
    const fsm = enterInvited();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');

    expect(fsm.state()).toBe('invited');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: peeking', () => {
  it('idle -> peeking on PEEK; peeking -> idle after tickTimers(1200)', () => {
    const fsm = createFSM();
    fsm.send('PEEK');
    expect(fsm.state()).toBe('peeking');

    fsm.tickTimers(1199);
    expect(fsm.state()).toBe('peeking');

    fsm.tickTimers(1);
    expect(fsm.state()).toBe('idle');
  });

  it('POINTER_* during a peek resets the sleep accumulator but does not end the peek early', () => {
    const fsm = createFSM();
    const onEnter = vi.fn();
    fsm.send('PEEK');
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');
    fsm.send('POINTER_DOWN');

    expect(fsm.state()).toBe('peeking');
    expect(onEnter).not.toHaveBeenCalled();

    // Peek still ends atomically on its own timer.
    fsm.tickTimers(1200);
    expect(fsm.state()).toBe('idle');
  });

  it('FEED and PEEK are ignored while already peeking', () => {
    const fsm = createFSM();
    fsm.send('PEEK');
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('FEED');
    fsm.send('PEEK');

    expect(fsm.state()).toBe('peeking');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: dashing', () => {
  it('dashing -> idle after tickTimers(500) (no dead-end)', () => {
    const fsm = createFSM();
    fsm.send('FEED');
    expect(fsm.state()).toBe('dashing');

    fsm.tickTimers(499);
    expect(fsm.state()).toBe('dashing');

    fsm.tickTimers(1);
    expect(fsm.state()).toBe('idle');
  });

  it('ignores every event while dashing (runs to completion via its own timer)', () => {
    const fsm = createFSM();
    fsm.send('FEED');
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');
    fsm.send('POINTER_DOWN');
    fsm.send('FEED');
    fsm.send('PEEK');

    expect(fsm.state()).toBe('dashing');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: sleeping / waking', () => {
  function enterSleeping() {
    const fsm = createFSM();
    fsm.tickTimers(30000);
    return fsm;
  }

  it('sleeping -> waking on POINTER_DOWN', () => {
    const fsm = enterSleeping();
    fsm.send('POINTER_DOWN');
    expect(fsm.state()).toBe('waking');
  });

  it('waking -> dashing after tickTimers(600) (the wake "counts as a feed")', () => {
    const fsm = enterSleeping();
    fsm.send('POINTER_DOWN');

    fsm.tickTimers(599);
    expect(fsm.state()).toBe('waking');

    fsm.tickTimers(1);
    expect(fsm.state()).toBe('dashing');
  });

  it('ignores FEED while sleeping (only POINTER_DOWN wakes)', () => {
    const fsm = enterSleeping();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('FEED');

    expect(fsm.state()).toBe('sleeping');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('ignores PEEK while sleeping', () => {
    const fsm = enterSleeping();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('PEEK');

    expect(fsm.state()).toBe('sleeping');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('ignores POINTER_NEAR/POINTER_FAR while sleeping', () => {
    const fsm = enterSleeping();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');

    expect(fsm.state()).toBe('sleeping');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('ignores every event while waking (runs to completion via its own timer)', () => {
    const fsm = enterSleeping();
    fsm.send('POINTER_DOWN');
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');
    fsm.send('FEED');
    fsm.send('PEEK');

    expect(fsm.state()).toBe('waking');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: the 30s sleep overlay from every awake state', () => {
  it('curious/invited -> sleeping after 30000ms of no interaction', () => {
    const fsm = createFSM();
    fsm.send('POINTER_NEAR'); // idle -> curious
    fsm.tickTimers(2500); // curious -> invited (state-specific timer)
    expect(fsm.state()).toBe('invited');

    fsm.tickTimers(27500); // 2500 + 27500 = 30000ms since the last interaction
    expect(fsm.state()).toBe('sleeping');
  });

  it(
    'sleep accumulator resets on interaction (POINTER_NEAR), so 58000ms of elapsed ' +
      'wall time does not sleep — only 30000ms since the reset does',
    () => {
      const fsm = createFSM();

      fsm.tickTimers(29000); // idle, sleep accum = 29000 (< 30000): no transition
      expect(fsm.state()).toBe('idle');

      fsm.send('POINTER_NEAR'); // idle -> curious; sleep accum reset to 0
      expect(fsm.state()).toBe('curious');

      // A single big tick: curious's own 2500ms timer has priority over the
      // sleep overlay (pinned by the "at most one transition per tickTimers
      // call" test below), so this lands on invited in one step — it does NOT
      // skip straight to sleeping even though the sleep accumulator (now
      // 29000ms) is still under threshold anyway.
      fsm.tickTimers(29000);
      expect(fsm.state()).toBe('invited');

      // Sleep accumulator since the POINTER_NEAR reset is now 29000ms. If the
      // reset had NOT happened, total elapsed time would be 58000ms+ and this
      // tiny tick would already cross the 30000ms threshold — it does not,
      // proving the reset took effect.
      fsm.tickTimers(999);
      expect(fsm.state()).toBe('invited');

      fsm.tickTimers(1); // sleep accum since reset = 30000
      expect(fsm.state()).toBe('sleeping');
    },
  );

  it('PEEK does NOT reset the sleep accumulator', () => {
    const fsm = createFSM();

    fsm.tickTimers(29000); // idle, sleep accum = 29000
    fsm.send('PEEK'); // idle -> peeking; sleep accum NOT reset, still 29000
    expect(fsm.state()).toBe('peeking');

    // This tick crosses BOTH peeking's own 1200ms timer AND the 30000ms sleep
    // threshold (29000 + 1200 = 30200) in the same call. Per the "at most
    // one transition per call" rule, peeking's own state-specific exit takes
    // priority, so this call lands on idle (the peek completes atomically) —
    // the pending sleep transition is deferred to the next tick.
    fsm.tickTimers(1200);
    expect(fsm.state()).toBe('idle');

    // The very next tick (however small) now finds the sleep accumulator
    // already past threshold and fires the overlay — proving PEEK never
    // reset it (a reset would have left only ~1200ms on the clock here).
    fsm.tickTimers(1);
    expect(fsm.state()).toBe('sleeping');
  });

  it(
    'at most one transition per tickTimers call: from curious, a single ' +
      'tickTimers(40000) lands on invited, not sleeping',
    () => {
      const fsm = createFSM();
      fsm.send('POINTER_NEAR'); // idle -> curious, sleep accum reset to 0

      // 40000ms exceeds BOTH curiousToInvitedMs (2500) and idleToSleepMs
      // (30000) in one call. The guard means only ONE transition happens.
      fsm.tickTimers(40000);

      expect(fsm.state()).toBe('invited');
    },
  );
});

describe('createFSM: onEnter', () => {
  it('fires (next, prev) on a real transition', () => {
    const fsm = createFSM();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');

    expect(onEnter).toHaveBeenCalledExactlyOnceWith('curious', 'idle');
  });

  it('does not fire on the initial state', () => {
    const onEnter = vi.fn();
    const fsm = createFSM();
    fsm.onEnter(onEnter);

    expect(fsm.state()).toBe('idle');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('does not fire on a no-op/ignored event', () => {
    const fsm = createFSM();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_FAR'); // illegal in idle

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers; all of them fire', () => {
    const fsm = createFSM();
    const first = vi.fn();
    const second = vi.fn();
    fsm.onEnter(first);
    fsm.onEnter(second);

    fsm.send('POINTER_NEAR');

    expect(first).toHaveBeenCalledExactlyOnceWith('curious', 'idle');
    expect(second).toHaveBeenCalledExactlyOnceWith('curious', 'idle');
  });

  it('fires on each transition in a sequence, in order', () => {
    const fsm = createFSM();
    const seen: Array<[PetState, PetState]> = [];
    fsm.onEnter((next, prev) => seen.push([next, prev]));

    fsm.send('POINTER_NEAR'); // idle -> curious
    fsm.send('FEED'); // curious -> dashing
    fsm.tickTimers(500); // dashing -> idle

    expect(seen).toEqual([
      ['curious', 'idle'],
      ['dashing', 'curious'],
      ['idle', 'dashing'],
    ]);
  });
});

describe('createFSM: config overrides', () => {
  it('applies a custom curiousToInvitedMs threshold', () => {
    const fsm = createFSM({ curiousToInvitedMs: 100 });
    fsm.send('POINTER_NEAR');

    fsm.tickTimers(99);
    expect(fsm.state()).toBe('curious');

    fsm.tickTimers(1);
    expect(fsm.state()).toBe('invited');
  });

  it('applies a custom idleToSleepMs threshold', () => {
    const fsm = createFSM({ idleToSleepMs: 1000 });

    fsm.tickTimers(999);
    expect(fsm.state()).toBe('idle');

    fsm.tickTimers(1);
    expect(fsm.state()).toBe('sleeping');
  });

  it('applies custom peekMs, wakeMs, and dashMs thresholds', () => {
    const fsm = createFSM({ peekMs: 50, wakeMs: 20, dashMs: 10, idleToSleepMs: 100 });

    fsm.send('PEEK');
    fsm.tickTimers(50);
    expect(fsm.state()).toBe('idle'); // peek ended (sleep accum so far: 50)

    fsm.send('FEED'); // resets sleep accum to 0
    fsm.tickTimers(10);
    expect(fsm.state()).toBe('idle'); // dash ended (sleep accum so far: 10)

    fsm.tickTimers(90); // sleep accum reaches the overridden 100 -> sleeping
    expect(fsm.state()).toBe('sleeping');

    fsm.send('POINTER_DOWN'); // -> waking
    fsm.tickTimers(20);
    expect(fsm.state()).toBe('dashing');
  });
});
