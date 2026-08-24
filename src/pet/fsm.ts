/**
 * Byte's brain — a pure, deterministic finite-state machine deciding Byte's
 * state from interaction events + timers. T4 built the idle-brain subset
 * (SPEC §6); T5 added the feeding beats (dashing -> eating, driven by the
 * feeder's REACHED/ATE events) on the same shape; T6 extends the feed's
 * completion into the retype reward (eating -> retyping -> idle, driven by
 * the retype-driver's RETYPED event) — traveling remains for a later ticket
 * (R-T4-9).
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

const DEFAULTS: Required<PetFSMConfig> = {
  curiousToInvitedMs: 2500,
  idleToSleepMs: 30000,
  peekMs: 1200,
  wakeMs: 600,
  dashMs: 1200,
  eatMs: 1500,
  retypeMs: 4000,
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
 *  `hidden`/`entering`/`traveling` aren't reachable by any current transition
 *  yet but are excluded on principle — none is a "resting" state.
 */
function isSleepEligible(state: PetState): boolean {
  return state === 'idle' || state === 'curious' || state === 'invited' || state === 'peeking';
}

/**
 * This state's own timer-driven exit, or `null` if `stateTimerMs` hasn't
 * crossed its threshold (or this state has no timer-driven exit at all —
 * `idle`/`invited`/`sleeping` only ever change on events). Checked before
 * the sleep overlay in `tickTimers` (see module doc comment on ordering).
 */
function specificTimerTarget(
  state: PetState,
  stateTimerMs: number,
  cfg: Required<PetFSMConfig>,
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
    case 'waking':
      // Because pendingFeed — the wake→feed payoff (T5 renders it).
      return pendingFeed && stateTimerMs >= cfg.wakeMs ? 'dashing' : null;
    default:
      return null;
  }
}

/**
 * `createFSM(cfg)` — the pure FSM handle. Starts in `idle` (the
 * preloader/entrance choreography that would use `hidden`/`entering` is T6;
 * in T4 the bot simply appears idle).
 */
export function createFSM(cfg: PetFSMConfig = {}): PetFSM {
  const config: Required<PetFSMConfig> = { ...DEFAULTS, ...cfg };

  let current: PetState = 'idle';
  let stateTimerMs = 0;
  let sleepAccumMs = 0;
  /** Set by sleeping's POINTER_DOWN; consumed when waking's timer elapses. */
  let pendingFeed = false;
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
        // that needs protecting by a reset here. Eat-complete now hands off
        // to the retype reward (eating -> retyping); the eatMs safety cap
        // still exits straight to idle as an emergency path (see
        // `specificTimerTarget`), deliberately skipping the reward.
        if (event === 'ATE') {
          enter('retyping');
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

      // `waking` ignores every event — it runs to completion solely via its
      // own state timer (see `specificTimerTarget`). (`hidden`/`entering`/
      // `traveling` fall through here too; none is reachable by any
      // transition yet.)
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
