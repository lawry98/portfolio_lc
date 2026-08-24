/**
 * Byte's headline retype engine — the PURE decision-core that computes the
 * delete-then-type schedule for retyping one 2-line headline phrase into
 * another (SPEC §6 "the signature reward"; D-03: a custom span-based engine,
 * not GSAP's SplitText — SplitText is reserved for the manifesto's masked
 * line reveals). A later task drives a real DOM caret + per-char spans off
 * this schedule (`renderRetype`, added to this same file) while Byte's 3D
 * body glides to the caret; this file only decides WHAT the headline should
 * read and WHEN, never touching the DOM/GSAP/three itself.
 *
 * Purity is the whole point (SPEC §4.3, mirrors `fsm.ts` and `glyphs.ts`'s
 * `createGlyphQueue`): this file imports neither `gsap` nor `three`, and
 * never reads the wall clock (`Date.now`/`performance.now`) or calls
 * `Math.random`. Time enters ONLY via the `now` argument to `step()`;
 * randomness (the ± jitter on each typed character's interval) enters ONLY
 * via the injected `random: () => number` config, which defaults to a
 * constant `() => 0.5` — i.e. exactly zero jitter, fully deterministic. The
 * live driver injects `Math.random`; tests inject whatever sequence they
 * need to hit specific bounds (see `retype.test.ts`).
 *
 * Two pieces:
 * - `buildRetypeSchedule(from, to, cfg)` — the tested core. A pure function
 *   from two 2-line phrases (+ config) to a flat, cumulative-time keyframe
 *   list: delete `from`'s BOTTOM line, then its TOP line (one continuous
 *   accelerating backspace run across both lines — SPEC "~26ms/char
 *   accelerating"), then type `to`'s TOP line, then its BOTTOM line (SPEC
 *   "~40ms/char, ±12ms jitter"). Deleting the bottom line first and typing
 *   the top line first means neither line is ever simultaneously mid-delete
 *   AND mid-type, which keeps each line's length bounded by its OWN source
 *   or target the whole time (see the "no overflow" test) and pairs with a
 *   later task's CSS `min-height` reserve for zero layout shift.
 * - `createRetype(cfg)` — a small stateful wrapper: `enqueue(next)` builds a
 *   fresh schedule from the current phrase to `next`; `step(now)` walks that
 *   schedule off an externally-supplied clock and returns the frame in
 *   effect at `now` (or `null` once idle/complete); `isBusy()` reports
 *   whether a schedule is still in flight. The driver calls `step` every
 *   animation frame with a `performance.now()`-derived value; this module
 *   never reads that clock itself — `now` is just a number to it.
 */

/** One rendered frame of the retype: the two headline lines' current text
 *  plus where the (Byte-operated) caret sits. `caretIndex.col` is the number
 *  of characters already committed on `caretIndex.line` — the caret sits
 *  AFTER that many chars, exactly like a text-input caret position. */
export type RetypeFrame = {
  line0: string; // TOP line
  line1: string; // BOTTOM line
  caretIndex: { line: 0 | 1; col: number };
};

/**
 * `createRetype`'s config (also accepted, minus `initial`, by
 * `buildRetypeSchedule`). Every timing/jitter knob has a SPEC-matched
 * default; `random` defaults to a constant `() => 0.5` (zero jitter) so a
 * default-config schedule is fully deterministic without any caller having
 * to inject a function of their own.
 */
export interface RetypeConfig {
  /** The phrase currently shown — what the first schedule deletes from. */
  initial: readonly [string, string];
  /** ms/char for the very first backspace of a delete run (SPEC "~26ms/char"). */
  backspaceMsPerChar?: number;
  /** Per-char multiplicative acceleration: `interval_n = base * accel**n`,
   *  where `n` is the 0-based index across the WHOLE delete run — both
   *  lines combined, not reset at the line boundary (see
   *  `buildRetypeSchedule`'s doc comment on phase B). */
  backspaceAccel?: number;
  /** Floor under which the accelerating backspace interval never shrinks. */
  backspaceMinMs?: number;
  /** ms/char while typing (SPEC "~40ms/char"). */
  typeMsPerChar?: number;
  /** ± spread applied to each typed char's interval (SPEC "±12ms"). */
  typeJitterMs?: number;
  /** Source of the jitter's randomness, `[0, 1)`-ranged like `Math.random`.
   *  NEVER called as `Math.random` by this module — injected so the engine
   *  stays pure/deterministic under test. Defaults to `() => 0.5`, which
   *  zeroes the jitter term exactly (`0.5 * 2 - 1 === 0`). */
  random?: () => number;
}

/** One scheduled point in time: the frame that becomes current at `atMs`
 *  (milliseconds since the schedule's own start, i.e. since its keyframe 0). */
export interface RetypeKeyframe {
  atMs: number;
  frame: RetypeFrame;
}

const DEFAULT_BACKSPACE_MS_PER_CHAR = 26;
const DEFAULT_BACKSPACE_ACCEL = 0.88;
const DEFAULT_BACKSPACE_MIN_MS = 8;
const DEFAULT_TYPE_MS_PER_CHAR = 40;
const DEFAULT_TYPE_JITTER_MS = 12;

/** Zero-jitter, fully deterministic default: `0.5 * 2 - 1 === 0`. */
const DEFAULT_RANDOM = (): number => 0.5;

type ResolvedRetypeConfig = Required<Omit<RetypeConfig, 'initial'>>;

/** Fills in every optional knob with its SPEC-matched default. */
function resolveConfig(cfg: Omit<RetypeConfig, 'initial'> | undefined): ResolvedRetypeConfig {
  return {
    backspaceMsPerChar: cfg?.backspaceMsPerChar ?? DEFAULT_BACKSPACE_MS_PER_CHAR,
    backspaceAccel: cfg?.backspaceAccel ?? DEFAULT_BACKSPACE_ACCEL,
    backspaceMinMs: cfg?.backspaceMinMs ?? DEFAULT_BACKSPACE_MIN_MS,
    typeMsPerChar: cfg?.typeMsPerChar ?? DEFAULT_TYPE_MS_PER_CHAR,
    typeJitterMs: cfg?.typeJitterMs ?? DEFAULT_TYPE_JITTER_MS,
    random: cfg?.random ?? DEFAULT_RANDOM,
  };
}

/**
 * Builds the full delete-then-type keyframe schedule for retyping `from`
 * into `to`. PURE — the same inputs (including the same `random` function's
 * sequence of return values) always produce an identical schedule.
 *
 * Cumulative `atMs` starts at 0 (keyframe 0 is `from` in full, caret resting
 * at the end of its bottom line — the state before any edit begins). Phases,
 * in order:
 *  A. Delete `from`'s BOTTOM line (line1) right-to-left, one char at a time.
 *  B. Delete `from`'s TOP line (line0) right-to-left. This continues the
 *     SAME accelerating backspace run started in phase A — the per-char
 *     interval index keeps climbing across the line boundary instead of
 *     resetting, so the whole delete (both lines) reads as one continuous
 *     accelerating backspace, per SPEC's "~26ms/char accelerating".
 *  C. Type `to`'s TOP line (line0) left-to-right, one char at a time.
 *  D. Type `to`'s BOTTOM line (line1) left-to-right.
 * Deleting the bottom line first and typing the top line first means, at
 * every keyframe, line0 is a prefix of EITHER `from[0]` (still being
 * deleted/not yet touched) OR `to[0]` (now being typed) — never longer than
 * either source — and symmetrically for line1 (see the "no overflow" test).
 *
 * An empty `from`/`to` line simply produces no keyframes for its phase (the
 * loop bound is `length - 1 downTo 0`, or `1 upTo length`, both empty when
 * length is 0) — no special-casing needed.
 */
export function buildRetypeSchedule(
  from: readonly [string, string],
  to: readonly [string, string],
  cfg?: Omit<RetypeConfig, 'initial'>,
): RetypeKeyframe[] {
  const {
    backspaceMsPerChar,
    backspaceAccel,
    backspaceMinMs,
    typeMsPerChar,
    typeJitterMs,
    random,
  } = resolveConfig(cfg);

  const [f0, f1] = from;
  const [t0, t1] = to;

  /** `n` is the 0-based index across the WHOLE delete run (both lines) —
   *  callers pass in a running counter that never resets at the line
   *  boundary (see the phase-B doc note above). */
  function backspaceInterval(n: number): number {
    return Math.max(backspaceMinMs, backspaceMsPerChar * backspaceAccel ** n);
  }

  function typeInterval(): number {
    return typeMsPerChar + (random() * 2 - 1) * typeJitterMs;
  }

  const keyframes: RetypeKeyframe[] = [];
  let t = 0;
  let bi = 0;

  function push(atMs: number, frame: RetypeFrame): void {
    keyframes.push({ atMs, frame });
  }

  // START: the full `from` phrase, caret resting at the end of the bottom line.
  push(0, { line0: f0, line1: f1, caretIndex: { line: 1, col: f1.length } });

  // Phase A — delete the BOTTOM line (line1) right-to-left.
  for (let col = f1.length - 1; col >= 0; col -= 1) {
    t += backspaceInterval(bi);
    bi += 1;
    push(t, { line0: f0, line1: f1.slice(0, col), caretIndex: { line: 1, col } });
  }

  // Phase B — delete the TOP line (line0) right-to-left; `bi` keeps
  // climbing from phase A (one continuous accelerating run).
  for (let col = f0.length - 1; col >= 0; col -= 1) {
    t += backspaceInterval(bi);
    bi += 1;
    push(t, { line0: f0.slice(0, col), line1: '', caretIndex: { line: 0, col } });
  }

  // Both lines are now empty. Phase C — type the TOP line (line0) left-to-right.
  for (let col = 1; col <= t0.length; col += 1) {
    t += typeInterval();
    push(t, { line0: t0.slice(0, col), line1: '', caretIndex: { line: 0, col } });
  }

  // Phase D — type the BOTTOM line (line1) left-to-right.
  for (let col = 1; col <= t1.length; col += 1) {
    t += typeInterval();
    push(t, { line0: t0, line1: t1.slice(0, col), caretIndex: { line: 1, col } });
  }

  return keyframes;
}

/**
 * A small stateful wrapper over `buildRetypeSchedule`: holds the phrase
 * currently "settled" on-screen (`current`, seeded from `cfg.initial`) and,
 * on each `enqueue`, builds a fresh schedule from `current` to the newly
 * requested phrase — i.e. `enqueue` "resets the clock" (the next `step`
 * call re-anchors the schedule's start). `step(now)` is a pure read of the
 * schedule against `now`; it mutates only the one-time `startMs` anchor and
 * the `busy`/`current` bookkeeping at completion — still no wall-clock read
 * in here, `now` is supplied by the caller every time. `reset(lines)` re-seeds
 * the settled phrase without animating (the entrance uses it to start from an
 * empty headline) — see its own doc comment below.
 */
export function createRetype(cfg: RetypeConfig): {
  enqueue(next: readonly [string, string]): void;
  step(now: number): RetypeFrame | null;
  isBusy(): boolean;
  reset(lines: readonly [string, string]): void;
} {
  const { initial, ...rest } = cfg;

  let current: readonly [string, string] = initial;
  let pending: readonly [string, string] = initial;
  let keyframes: RetypeKeyframe[] = [];
  let startMs: number | null = null;
  let busy = false;

  function enqueue(next: readonly [string, string]): void {
    keyframes = buildRetypeSchedule(current, next, rest);
    startMs = null;
    pending = next;
    busy = keyframes.length > 1;
  }

  function step(now: number): RetypeFrame | null {
    if (!busy) {
      return null;
    }
    if (startMs === null) {
      startMs = now;
    }

    const elapsed = now - startMs;
    const last = keyframes[keyframes.length - 1];

    if (elapsed >= last.atMs) {
      busy = false;
      current = pending;
      return last.frame;
    }

    // The last keyframe whose atMs has already passed. Keyframes are sorted
    // ascending by atMs and keyframe 0 is always atMs 0, so this always
    // resolves to at least that one.
    let frame = keyframes[0].frame;
    for (let i = 1; i < keyframes.length; i += 1) {
      if (keyframes[i].atMs <= elapsed) {
        frame = keyframes[i].frame;
      } else {
        break;
      }
    }
    return frame;
  }

  function isBusy(): boolean {
    return busy;
  }

  /**
   * Re-seed the settled phrase WITHOUT animating: drop any in-flight schedule
   * and treat `lines` as the phrase now on-screen. The entrance re-seeds to
   * `['', '']` so the next `enqueue` types phrase #1 up from empty; a
   * subsequent `enqueue(next)` builds its schedule `from` this value (not from
   * whatever was previously settled or mid-flight). Purity is unchanged — no
   * imports, no clock, no random.
   */
  function reset(lines: readonly [string, string]): void {
    current = lines;
    pending = lines;
    keyframes = [];
    startMs = null;
    busy = false;
  }

  return { enqueue, step, isBusy, reset };
}

/**
 * The DOM applier: paints one `RetypeFrame` (as produced by `createRetype`'s
 * `step()`) — rebuilding each headline line's per-char spans and moving a
 * caret element to match. This is the one function in this file that
 * touches the DOM; everything above stays pure (see the module doc
 * comment). It still imports neither `gsap` nor `three`: the caret's blink
 * is a CSS `@keyframes` (see `global.css`), and Byte's 3D glide-to-caret is
 * a LATER task's job, layered on top of this same frame — this function
 * only paints the headline text + caret position.
 *
 * The two line elements are found via `[data-byte-line="0"]` /
 * `[data-byte-line="1"]` inside `headlineEl` — attributes, not a page CSS
 * class (R-T6a-3), so this stays portable and survives the hero's
 * SplitText wrapping; a later task (`createBytePet`) sets them on the real
 * headline markup. If either is missing this is a no-op — it never
 * partially renders one line while leaving the other untouched.
 *
 * Caret positioning is a layout READ (`getBoundingClientRect()` on the
 * anchor glyph/line and on `headlineEl`) followed by a `transform` WRITE on
 * the already-appended `caretEl` — never an in-flow insertion, so it cannot
 * reflow `headlineEl` (CLS 0). The position is expressed as viewport-rect
 * DELTAS relative to `headlineEl` (`rect.left - headlineRect.left`, etc.)
 * rather than `offsetLeft`/`offsetParent`-relative offsets: the hero's
 * SplitText line-reveal can wrap each line in a positioned `mask` element,
 * which would otherwise become the char span's `offsetParent` and skew the
 * math. Bounding-rect deltas are immune to any such positioned ancestor
 * (the caret is a direct child of `headlineEl` and the deltas are always
 * measured against `headlineEl` itself). The caller resolves the LIVE caret
 * node each call (createBytePet's `liveCaret()`), since the same SplitText
 * reveal + revert can replace `headlineEl`'s children with clones.
 */
export function renderRetype(
  frame: RetypeFrame,
  headlineEl: HTMLElement,
  caretEl: HTMLElement,
): void {
  const line0El = headlineEl.querySelector<HTMLElement>('[data-byte-line="0"]');
  const line1El = headlineEl.querySelector<HTMLElement>('[data-byte-line="1"]');

  if (!line0El || !line1El) {
    return;
  }

  renderLine(line0El, frame.line0);
  renderLine(line1El, frame.line1);

  const activeLineEl = frame.caretIndex.line === 0 ? line0El : line1El;
  const col = frame.caretIndex.col;
  const charEls = activeLineEl.querySelectorAll<HTMLElement>('.byte-char');
  // The char just before the caret, if any — falls back to the active
  // line's own left edge (col === 0, or a defensively out-of-range col).
  const caretCharEl = col > 0 ? charEls[col - 1] : undefined;

  // Bounding-rect deltas relative to `headlineEl` (see the doc comment):
  // immune to a positioned SplitText `mask` ancestor that `offsetParent`-
  // relative offsets would otherwise be thrown off by. When there's a char
  // before the caret, sit at its right edge; otherwise the active line's left.
  const anchorEl = caretCharEl ?? activeLineEl;
  const cRect = anchorEl.getBoundingClientRect();
  const hRect = headlineEl.getBoundingClientRect();
  const x = (caretCharEl ? cRect.right : cRect.left) - hRect.left;
  const y = cRect.top - hRect.top;

  caretEl.style.transform = `translate(${x}px, ${y}px)`;
}

/**
 * Rebuilds one line element's content as one `<span class="byte-char">`
 * per character of `text`, each char set via `textContent` (never
 * innerHTML string interpolation). Always clears first — rebuild every
 * call, per the brief, since these strings are short — so a shrinking
 * line (mid-backspace) never leaves stale trailing spans from a longer
 * previous frame; an empty `text` leaves zero children (the CSS
 * `min-height` on `.hero__line` keeps that line's row height, CLS 0).
 *
 * Indexes `text` by UTF-16 code unit (`text[i]`/`text.length`), matching
 * `buildRetypeSchedule`'s own `.length`/`.slice()` semantics for
 * `caretIndex.col` — the two stay in lockstep for any input this engine
 * is ever given (plain-ASCII headline phrases).
 */
function renderLine(lineEl: HTMLElement, text: string): void {
  lineEl.textContent = '';
  for (let i = 0; i < text.length; i += 1) {
    const charEl = document.createElement('span');
    charEl.className = 'byte-char';
    charEl.textContent = text[i];
    lineEl.appendChild(charEl);
  }
}
