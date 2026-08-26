/**
 * Byte's brain — a pure, deterministic finite-state machine deciding Byte's
 * state from interaction events + timers. T4 built the idle-brain subset
 * (SPEC §6); T5 added the feeding beats (dashing -> eating, driven by the
 * feeder's REACHED/ATE events) on the same shape; T6a extended the feed's
 * completion into the retype reward (eating -> retyping -> idle, driven by
 * the retype-driver's RETYPED event); T6b adds the entrance drop-in
 * (hidden -> entering -> idle, driven by the entrance driver's SHOWN/ENTERED
 * events and started via `initialState: 'hidden'`); T8 makes `traveling`
 * reachable — the scroll-driven hero<->footer migration (a resting home state
 * --MIGRATE--> traveling --ARRIVED--> idle, both controller-fired), plus a feed
 * begun mid-trip that eats and returns to `traveling` (a happy spin, no retype)
 * instead of retyping — see the `feedFromTraveling` flag and the `eating`/ATE
 * fork below.
 *
 * Purity is the whole point (and the ticket's central requirement): this
 * file imports neither `gsap` nor `three`, and never reads the wall clock
 * (`Date.now`/`performance.now`) or `Math.random`. Time enters only via
 * `tickTimers(dtMs)`, so the FSM is a pure function of its config, the
 * events sent, and the milliseconds ticked in — fully unit-testable without
 * a real clock or a DOM (see `fsm.test.ts`).
 *
 * Two independent timer mechanisms, both advanced by every `tickTimers`
 * call:
 *  1. The **sleep accumulator** — time since the last user interaction.
 *     Reset by POINTER_NEAR/POINTER_FAR/POINTER_DOWN/FEED, but only when
 *     one of those is a *legal* event for the current state (see `send`
 *     below) — an ignored/illegal event has no side effects at all.
 *     Deliberately NOT reset by PEEK: peeks are Byte's own
 *     scheduled micro-behaviour (R-T4-3), not user interaction — if they
 *     reset the sleep clock, Byte would never sleep while idly peeking
 *     around every 4-8s.
 *  2. The **state timer** — reset to 0 on every actual state entry (never
 *     on a "stay" pseudo-transition), driving each state's own timed exit.
 *
 * `tickTimers` transition ordering (the multi-step guard): a single call
 * causes AT MOST ONE transition, so a huge `dtMs` can't skip states. Within
 * one call, a state's own specific timer-driven exit (e.g. curious's
 * curiousToInvitedMs) is checked BEFORE the generic "30s idle -> sleeping"
 * overlay — e.g. a 40000ms tick from `curious` lands on `invited` in one
 * step, not `sleeping`, even though both thresholds are technically
 * exceeded. Whichever transition doesn't fire this call is simply
 * re-evaluated (and may fire) on the next `tickTimers` call, however small.
 */
import type { PetEvent, PetFSM, PetFSMConfig, PetState } from './types';

/**
 * Config with every DURATION knob resolved to its default. `initialState` is
 * omitted on purpose — it's a start value, not a duration, so it never gets a
 * DEFAULTS entry; `createFSM` reads it straight off the caller's `cfg` with
 * `?? 'idle'`. Mirrors retype.ts's `ResolvedRetypeConfig`, which likewise omits
 * its own non-duration field (`initial`).
 */
type ResolvedFSMConfig = Required<Omit<PetFSMConfig, 'initialState'>>;

const DEFAULTS: ResolvedFSMConfig = {
  curiousToInvitedMs: 2500,
  idleToSleepMs: 30000,
  peekMs: 1200,
  wakeMs: 600,
  dashMs: 1200,
  eatMs: 1500,
  retypeMs: 4000,
  enteringMs: 8000,
};

/**
 * States the "30s no interaction -> sleeping" overlay can fire from — an
 * explicit allowlist of the awake, resting states (R-T5-3; this used to be a
 * denylist of `sleeping`/`waking` only, which wrongly let the overlay fire
 * mid-dash or mid-eat):
 *  - `idle`/`curious`/`invited`: the states a user can just walk away from.
 *  - `peeking`: stays eligible even though PEEK itself deliberately does NOT
 *    reset the sleep accumulator (see module doc comment) — if peeking were
 *    excluded too, a peek firing late in the idle countdown could strand the
 *    accumulator past threshold with no state left willing to discharge it.
 *  - `dashing`/`eating` are excluded: Byte always finishes a feed (dash then
 *    eat) before it's allowed to drift to sleep — those two states only ever
 *    exit via the feeder's REACHED/ATE (or their generous safety-cap timers),
 *    never via this overlay.
 *  - `retyping` is excluded too: it's the post-eat reward animation, not a
 *    resting state — no sleep mid-retype. It only ever exits via the
 *    retype-driver's RETYPED (or its own retypeMs safety-cap timer), never
 *    via this overlay.
 *  - `sleeping`/`waking` are excluded (already asleep / already waking up);
 *  - `hidden`/`entering` ARE reachable now (T6b's entrance drop-in) but are
 *    still excluded — the mid-entrance beats are not "resting" states, so Byte
 *    can't drift to sleep before phrase #1 has even finished typing;
 *  - `traveling` IS reachable now (T8's MIGRATE/ARRIVED migration) but is
 *    excluded on the same principle — Byte never sleeps mid-trip; it's
 *    following the visitor's scroll until the controller fires `ARRIVED`.
 */
function isSleepEligible(state: PetState): boolean {
  return state === 'idle' || state === 'curious' || state === 'invited' || state === 'peeking';
}

/**
 * This state's own timer-driven exit, or `null` if `stateTimerMs` hasn't
 * crossed its threshold (or this state has no timer-driven exit at all —
 * `idle`/`invited`/`sleeping`/`traveling` only ever change on events, falling
 * through to the `default` below). `traveling` in particular is
 * controller-driven: it exits solely on the migration driver's `ARRIVED` (T8),
 * never on a timer — no timed auto-exit, mirroring how `idle`/`invited` have
 * none. Checked before the sleep overlay in `tickTimers` (see module doc
 * comment on ordering).
 */
function specificTimerTarget(
  state: PetState,
  stateTimerMs: number,
  cfg: ResolvedFSMConfig,
  pendingFeed: boolean,
): PetState | null {
  switch (state) {
    case 'curious':
      return stateTimerMs >= cfg.curiousToInvitedMs ? 'invited' : null;
    case 'peeking':
      return stateTimerMs >= cfg.peekMs ? 'idle' : null;
    case 'dashing':
      // Safety cap only — the feeder's REACHED normally fires well before
      // this (real dash is 380-600ms; dashMs defaults to 1200).
      return stateTimerMs >= cfg.dashMs ? 'idle' : null;
    case 'eating':
      // Safety cap only — the feeder's ATE normally fires well before this.
      return stateTimerMs >= cfg.eatMs ? 'idle' : null;
    case 'retyping':
      // Safety cap only — the retype-driver's RETYPED normally fires well
      // before this.
      return stateTimerMs >= cfg.retypeMs ? 'idle' : null;
    case 'entering':
      // Safety cap only — the entrance driver's ENTERED (phrase #1 finished
      // live-typing) normally fires well before this; mirrors retyping.
      return stateTimerMs >= cfg.enteringMs ? 'idle' : null;
    case 'waking':
      // Because pendingFeed — the wake→feed payoff (T5 renders it).
      return pendingFeed && stateTimerMs >= cfg.wakeMs ? 'dashing' : null;
    default:
      return null;
  }
}

/**
 * `createFSM(cfg)` — the pure FSM handle. Starts in `cfg.initialState`,
 * defaulting to `idle`. T6b's entrance constructs it with `initialState:
 * 'hidden'` so the drop-in can play (hidden --SHOWN--> entering --ENTERED-->
 * idle); every other caller omits it and Byte simply appears idle.
 */
export function createFSM(cfg: PetFSMConfig = {}): PetFSM {
  const config: ResolvedFSMConfig = { ...DEFAULTS, ...cfg };

  // `initialState` is a start value, not a duration, so it's read straight off
  // `cfg` (never merged into DEFAULTS) — default `idle` keeps the no-config
  // baseline unchanged.
  let current: PetState = cfg.initialState ?? 'idle';
  let stateTimerMs = 0;
  let sleepAccumMs = 0;
  /** Set by sleeping's POINTER_DOWN; consumed when waking's timer elapses. */
  let pendingFeed = false;
  /**
   * T8: set true when a FEED begins while `traveling` (traveling --FEED-->
   * dashing); it makes the eventual `eating`--ATE--> route back to `traveling`
   * (a happy spin, no retype) instead of `retyping`. Mirrors `pendingFeed` — a
   * pure bit of state, not an event. Cleared on EVERY exit from a
   * traveling-origin feed: consumed in the `eating`/ATE handler, wiped by
   * `traveling`--ARRIVED-->idle, and cleared by the dashing/eating safety cap in
   * `tickTimers` — so it can never strand true past a capped trip-feed.
   */
  let feedFromTraveling = false;
  const listeners: Array<(state: PetState, prev: PetState) => void> = [];

  /** Perform an ACTUAL state change: reset the state timer and notify
   *  subscribers. Never call this for a "stay" pseudo-transition. */
  function enter(next: PetState): void {
    const prev = current;
    current = next;
    stateTimerMs = 0;
    for (const listener of listeners) {
      listener(next, prev);
    }
  }

  function resetSleepAccum(): void {
    sleepAccumMs = 0;
  }

  /**
   * Table-driven event handling: every (state, event) pair not explicitly
   * handled below is an illegal/ignored transition — a complete no-op, with
   * no side effects (including no sleep-accumulator reset), per the ticket's
   * "ignore any event/timer not listed for a state" rule.
   */
  function send(event: PetEvent): void {
    switch (current) {
      case 'idle':
        switch (event) {
          case 'POINTER_NEAR':
            resetSleepAccum();
            enter('curious');
            return;
          case 'FEED':
            resetSleepAccum();
            enter('dashing');
            return;
          case 'PEEK':
            // Deliberately does NOT reset the sleep accumulator.
            enter('peeking');
            return;
          case 'POINTER_DOWN':
            // Feeding-click routing is T5; for now this just proves liveness.
            resetSleepAccum();
            return;
          case 'MIGRATE':
            // T8: a scroll pulled Byte away from a resting home state into the
            // hero<->footer trip. Controller-driven from here on — `traveling`
            // exits only on `ARRIVED` (no timed auto-exit; not sleep-eligible).
            resetSleepAccum();
            enter('traveling');
            return;
          default:
            return;
        }

      case 'curious':
        switch (event) {
          case 'POINTER_FAR':
            resetSleepAccum();
            enter('idle');
            return;
          case 'FEED':
            resetSleepAccum();
            enter('dashing');
            return;
          case 'POINTER_NEAR':
            // Stay curious: no re-enter, no onEnter — reset sleep accum only.
            resetSleepAccum();
            return;
          case 'POINTER_DOWN':
            // Stay curious: matches idle's POINTER_DOWN — reset sleep accum
            // only (real feeding-click routing is T5).
            resetSleepAccum();
            return;
          case 'MIGRATE':
            // T8 migration — see idle's MIGRATE.
            resetSleepAccum();
            enter('traveling');
            return;
          default:
            return;
        }

      case 'invited':
        switch (event) {
          case 'FEED':
            resetSleepAccum();
            enter('dashing');
            return;
          case 'POINTER_FAR':
            resetSleepAccum();
            enter('idle');
            return;
          case 'POINTER_NEAR':
            // Stay invited: reset sleep accum only.
            resetSleepAccum();
            return;
          case 'POINTER_DOWN':
            // Stay invited: matches idle/curious's POINTER_DOWN — reset
            // sleep accum only.
            resetSleepAccum();
            return;
          case 'MIGRATE':
            // T8 migration — see idle's MIGRATE.
            resetSleepAccum();
            enter('traveling');
            return;
          default:
            return;
        }

      case 'peeking':
        // Peek is atomic (ends only via its own state timer). POINTER_* just
        // resets the sleep accumulator without changing state or firing
        // onEnter; anything else (FEED, another PEEK) is ignored outright.
        switch (event) {
          case 'POINTER_NEAR':
          case 'POINTER_FAR':
          case 'POINTER_DOWN':
            resetSleepAccum();
            return;
          default:
            return;
        }

      case 'sleeping':
        if (event === 'POINTER_DOWN') {
          resetSleepAccum();
          pendingFeed = true;
          enter('waking');
        }
        return;

      case 'dashing':
        // Only REACHED (the feeder marking dash-arrival) is legal; every
        // other event is ignored — otherwise dashing runs to completion
        // solely via its own safety-cap timer (see `specificTimerTarget`).
        // Does NOT reset the sleep accumulator: like PEEK, this is Byte's
        // own scheduled behaviour, not user interaction — moot anyway since
        // dashing isn't sleep-eligible (see `isSleepEligible`).
        if (event === 'REACHED') {
          enter('eating');
        }
        return;

      case 'eating':
        // Only ATE (the feeder marking eat-animation-complete) is legal;
        // eating is NOT sleep-eligible (see `isSleepEligible`), so — unlike
        // every other real transition above — there's no sleep accumulator
        // that needs protecting by a reset here. Eat-complete FORKS on
        // `feedFromTraveling` (T8): a feed begun mid-trip returns to
        // `traveling` (clearing the flag; NO retype — the executor plays a
        // happy spin), while a normal hero feed hands off to the retype reward
        // (eating -> retyping) exactly as before. The eatMs safety cap still
        // exits straight to idle as an emergency path (see
        // `specificTimerTarget`), deliberately skipping either payoff — and
        // that path ALSO clears `feedFromTraveling` (in `tickTimers`) so a
        // capped trip-feed can't strand the flag.
        if (event === 'ATE') {
          if (feedFromTraveling) {
            feedFromTraveling = false;
            enter('traveling');
          } else {
            enter('retyping');
          }
        }
        return;

      case 'retyping':
        // Only RETYPED (the retype-driver marking retype-animation-complete)
        // is legal; every other event is ignored — otherwise retyping runs
        // to completion solely via its own safety-cap timer (see
        // `specificTimerTarget`), mirroring `dashing`/`eating`. Does NOT
        // reset the sleep accumulator: retyping isn't sleep-eligible (see
        // `isSleepEligible`), so there's nothing to protect.
        if (event === 'RETYPED') {
          enter('idle');
        }
        return;

      case 'hidden':
        // Entrance beat 1 (hidden -> entering): the overlay lifts / the drop-in
        // begins on SHOWN; every other event is ignored. Like `retyping`, this
        // does NOT reset the sleep accumulator — `hidden` isn't sleep-eligible
        // (see `isSleepEligible`), so there's nothing to protect.
        if (event === 'SHOWN') {
          enter('entering');
        }
        return;

      case 'entering':
        // Entrance beat 2 (entering -> idle): phrase #1 has finished live-typing
        // on ENTERED; every other event is ignored. The enteringMs safety cap
        // also exits straight to idle (see `specificTimerTarget`), mirroring
        // retyping's retypeMs. Not sleep-eligible either, so — as above — no
        // accumulator reset is needed here.
        if (event === 'ENTERED') {
          enter('idle');
        }
        return;

      case 'traveling':
        // T8 migration (SPEC §6): Byte is following the visitor's scroll on a
        // hero<->footer trip. Controller-driven — it exits only on the
        // migration driver's `ARRIVED` (no timed auto-exit; see
        // `specificTimerTarget`) — and is deliberately NOT sleep-eligible (see
        // `isSleepEligible`): Byte never sleeps or drifts curious/invited
        // mid-trip. A FEED begun mid-travel routes through the dash/eat beats
        // and back to `traveling` (NOT retyping) via `feedFromTraveling`, so the
        // executor can play a happy spin. POINTER_* only reset the sleep
        // accumulator (matching the resting states); everything else ignored.
        switch (event) {
          case 'ARRIVED':
            resetSleepAccum();
            // Belt-and-suspenders: the flag is already false here on every
            // normal path (ATE clears it before re-entering `traveling`), but
            // clear it on arrival too so nothing survives the trip.
            feedFromTraveling = false;
            enter('idle');
            return;
          case 'FEED':
            resetSleepAccum();
            feedFromTraveling = true;
            enter('dashing');
            return;
          case 'POINTER_NEAR':
          case 'POINTER_FAR':
          case 'POINTER_DOWN':
            // Reset the sleep accumulator only — no curious/invited/sleep
            // mid-trip. (Moot for sleep since `traveling` isn't sleep-eligible,
            // but kept for consistency with the resting states' POINTER_*.)
            resetSleepAccum();
            return;
          default:
            return;
        }

      // `waking` ignores every event — it runs to completion solely via its
      // own state timer (see `specificTimerTarget`). `traveling` now has its own
      // case above (T8), so only `waking` reaches this default.
      default:
        return;
    }
  }

  function tickTimers(dtMs: number): void {
    stateTimerMs += dtMs;
    sleepAccumMs += dtMs;

    const specific = specificTimerTarget(current, stateTimerMs, config, pendingFeed);
    if (specific) {
      if (current === 'waking') {
        pendingFeed = false;
      } else if (current === 'dashing' || current === 'eating') {
        // The dash/eat safety cap fires straight to idle, deliberately skipping
        // the retype/travel payoff. Clear `feedFromTraveling` here so a capped
        // traveling-origin feed can't strand the flag past this emergency exit
        // (a no-op for a normal hero feed — the flag is already false). This is
        // the ONE cap path that could otherwise leave the flag set, since the
        // normal `eating`/ATE route clears it itself.
        feedFromTraveling = false;
      }
      enter(specific);
      return;
    }

    if (isSleepEligible(current) && sleepAccumMs >= config.idleToSleepMs) {
      enter('sleeping');
    }
  }

  function state(): PetState {
    return current;
  }

  function onEnter(cb: (state: PetState, prev: PetState) => void): void {
    listeners.push(cb);
  }

  return { state, send, onEnter, tickTimers };
}
