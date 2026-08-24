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

  it('idle + POINTER_DOWN resets the sleep accumulator (previously untested)', () => {
    const fsm = createFSM();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.tickTimers(29000); // idle, sleep accum = 29000 (< 30000)
    expect(fsm.state()).toBe('idle');

    fsm.send('POINTER_DOWN'); // resets sleep accum to 0; stays idle, no onEnter
    expect(fsm.state()).toBe('idle');
    expect(onEnter).not.toHaveBeenCalled();

    fsm.tickTimers(29000); // without the reset this would be 58000 (>= 30000)
    expect(fsm.state()).toBe('idle');

    fsm.tickTimers(1000); // sleep accum since the POINTER_DOWN reset = 30000
    expect(fsm.state()).toBe('sleeping');
    expect(onEnter).toHaveBeenCalledExactlyOnceWith('sleeping', 'idle');
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

  it('curious + POINTER_DOWN resets the sleep accumulator (stay curious, no onEnter)', () => {
    // A large curiousToInvitedMs keeps this test in `curious` for the whole
    // run instead of auto-promoting to `invited` partway through.
    const fsm = createFSM({ curiousToInvitedMs: 999999 });
    fsm.send('POINTER_NEAR'); // idle -> curious; sleep accum + state timer reset to 0
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.tickTimers(29000); // sleep accum 29000 (< 30000): still curious
    expect(fsm.state()).toBe('curious');

    fsm.send('POINTER_DOWN'); // resets sleep accum to 0; stays curious, no onEnter
    expect(fsm.state()).toBe('curious');
    expect(onEnter).not.toHaveBeenCalled();

    fsm.tickTimers(29000); // without the reset this would be 58000 (>= 30000)
    expect(fsm.state()).toBe('curious');

    fsm.tickTimers(1000); // sleep accum since the POINTER_DOWN reset = 30000
    expect(fsm.state()).toBe('sleeping');
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

  it('invited + POINTER_DOWN resets the sleep accumulator (stay invited, no onEnter)', () => {
    const fsm = enterInvited(); // sleep accum = 2500 (from the curiousToInvitedMs tick)

    fsm.tickTimers(27499); // sleep accum 29999 (< 30000): still invited
    expect(fsm.state()).toBe('invited');

    const onEnter = vi.fn();
    fsm.onEnter(onEnter);
    fsm.send('POINTER_DOWN'); // resets sleep accum to 0; stays invited, no onEnter
    expect(fsm.state()).toBe('invited');
    expect(onEnter).not.toHaveBeenCalled();

    fsm.tickTimers(29999); // without the reset this would be far past 30000
    expect(fsm.state()).toBe('invited');

    fsm.tickTimers(1); // sleep accum since the POINTER_DOWN reset = 30000
    expect(fsm.state()).toBe('sleeping');
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
  it('dashing -> eating on REACHED (the feeder marking dash-arrival)', () => {
    const fsm = createFSM();
    fsm.send('FEED');
    expect(fsm.state()).toBe('dashing');

    fsm.send('REACHED');
    expect(fsm.state()).toBe('eating');
  });

  it(
    'dashing -> idle after tickTimers(dashMs) with no REACHED ' +
      '(safety cap only — the feeder normally fires REACHED long before this)',
    () => {
      const fsm = createFSM({ dashMs: 100 });
      fsm.send('FEED');
      expect(fsm.state()).toBe('dashing');

      fsm.tickTimers(99);
      expect(fsm.state()).toBe('dashing');

      fsm.tickTimers(1);
      expect(fsm.state()).toBe('idle');
    },
  );

  it('ignores POINTER_*/FEED/PEEK/ATE while dashing (only REACHED ends it)', () => {
    const fsm = createFSM();
    fsm.send('FEED');
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');
    fsm.send('POINTER_DOWN');
    fsm.send('FEED');
    fsm.send('PEEK');
    fsm.send('ATE');

    expect(fsm.state()).toBe('dashing');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: eating', () => {
  function enterEating() {
    const fsm = createFSM();
    fsm.send('FEED');
    fsm.send('REACHED');
    return fsm;
  }

  it('eating -> retyping on ATE (the feeder marking eat-animation-complete)', () => {
    const fsm = enterEating();
    expect(fsm.state()).toBe('eating');

    fsm.send('ATE');
    expect(fsm.state()).toBe('retyping');
  });

  it(
    'eating -> idle after tickTimers(eatMs) with no ATE ' +
      '(safety cap only — the feeder normally fires ATE long before this)',
    () => {
      const fsm = createFSM({ eatMs: 100 });
      fsm.send('FEED');
      fsm.send('REACHED');
      expect(fsm.state()).toBe('eating');

      fsm.tickTimers(99);
      expect(fsm.state()).toBe('eating');

      fsm.tickTimers(1);
      expect(fsm.state()).toBe('idle');
    },
  );

  it('ignores POINTER_*/FEED/PEEK/REACHED while eating (only ATE ends it)', () => {
    const fsm = enterEating();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');
    fsm.send('POINTER_DOWN');
    fsm.send('FEED');
    fsm.send('PEEK');
    fsm.send('REACHED');

    expect(fsm.state()).toBe('eating');
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('createFSM: retyping', () => {
  function enterRetyping() {
    const fsm = createFSM();
    fsm.send('FEED');
    fsm.send('REACHED');
    fsm.send('ATE');
    return fsm;
  }

  it('retyping -> idle on RETYPED', () => {
    const fsm = enterRetyping();
    expect(fsm.state()).toBe('retyping');

    fsm.send('RETYPED');
    expect(fsm.state()).toBe('idle');
  });

  it(
    'retyping -> idle after tickTimers(retypeMs) with no RETYPED ' +
      '(safety cap only — the retype-driver normally fires RETYPED long before this)',
    () => {
      const fsm = createFSM({ retypeMs: 100 });
      fsm.send('FEED');
      fsm.send('REACHED');
      fsm.send('ATE');
      expect(fsm.state()).toBe('retyping');

      fsm.tickTimers(99);
      expect(fsm.state()).toBe('retyping');

      fsm.tickTimers(1);
      expect(fsm.state()).toBe('idle');
    },
  );

  it('ignores POINTER_*/FEED/PEEK/REACHED/ATE while retyping (only RETYPED ends it)', () => {
    const fsm = enterRetyping();
    const onEnter = vi.fn();
    fsm.onEnter(onEnter);

    fsm.send('POINTER_NEAR');
    fsm.send('POINTER_FAR');
    fsm.send('POINTER_DOWN');
    fsm.send('FEED');
    fsm.send('PEEK');
    fsm.send('REACHED');
    fsm.send('ATE');

    expect(fsm.state()).toBe('retyping');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('retyping is NOT sleep-eligible: ticking past idleToSleepMs stays retyping', () => {
    // retypeMs set high enough that the retype safety cap can't pre-empt this.
    const fsm = createFSM({ retypeMs: 90000 });
    fsm.send('FEED');
    fsm.send('REACHED');
    fsm.send('ATE'); // eating -> retyping
    expect(fsm.state()).toBe('retyping');

    // Exceeds idleToSleepMs (30000) by a wide margin; if retyping were still
    // sleep-eligible, Byte would fall asleep mid-retype.
    fsm.tickTimers(60000);
    expect(fsm.state()).toBe('retyping');
  });

  it(
    'full reachability chain: idle -> dashing -> eating -> retyping -> idle ' +
      '(FEED, REACHED, ATE, RETYPED, in order)',
    () => {
      const fsm = createFSM();
      expect(fsm.state()).toBe('idle');

      fsm.send('FEED');
      expect(fsm.state()).toBe('dashing');

      fsm.send('REACHED');
      expect(fsm.state()).toBe('eating');

      fsm.send('ATE');
      expect(fsm.state()).toBe('retyping');

      fsm.send('RETYPED');
      expect(fsm.state()).toBe('idle');
    },
  );
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

  it('dashing is NOT sleep-eligible: ticking past idleToSleepMs stays dashing', () => {
    // dashMs set high enough that the dash safety cap can't pre-empt this.
    const fsm = createFSM({ dashMs: 60000 });
    fsm.send('FEED'); // idle -> dashing; sleep accum reset to 0
    expect(fsm.state()).toBe('dashing');

    // Exceeds idleToSleepMs (30000); if dashing were still sleep-eligible
    // (the old denylist bug) this would fall asleep mid-dash.
    fsm.tickTimers(30000);
    expect(fsm.state()).toBe('dashing');
  });

  it('eating is NOT sleep-eligible: ticking past idleToSleepMs stays eating', () => {
    // eatMs set high enough that the eat safety cap can't pre-empt this.
    const fsm = createFSM({ eatMs: 60000 });
    fsm.send('FEED');
    fsm.send('REACHED'); // dashing -> eating
    expect(fsm.state()).toBe('eating');

    // Exceeds idleToSleepMs (30000); if eating were still sleep-eligible
    // (the old denylist bug) Byte would fall asleep mid-eat.
    fsm.tickTimers(30000);
    expect(fsm.state()).toBe('eating');
  });

  it('peeking still allows the sleep overlay to fire directly from peeking', () => {
    const fsm = createFSM();

    fsm.tickTimers(29999); // idle, sleep accum = 29999 (< 30000): no transition
    fsm.send('PEEK'); // idle -> peeking; sleep accum NOT reset, still 29999
    expect(fsm.state()).toBe('peeking');

    // peeking's own exit needs peekMs (1200) on the state timer — nowhere
    // close yet — but the sleep accumulator (29999 + 1) now crosses
    // idleToSleepMs, and peeking IS sleep-eligible, so the overlay fires
    // straight from peeking (proving a late peek doesn't strand sleep).
    fsm.tickTimers(1);
    expect(fsm.state()).toBe('sleeping');
  });
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
    fsm.send('REACHED'); // dashing -> eating
    fsm.send('ATE'); // eating -> retyping
    fsm.send('RETYPED'); // retyping -> idle

    expect(seen).toEqual([
      ['curious', 'idle'],
      ['dashing', 'curious'],
      ['eating', 'dashing'],
      ['retyping', 'eating'],
      ['idle', 'retyping'],
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
