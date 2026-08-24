import { describe, expect, it } from 'vitest';
import { buildRetypeSchedule, createRetype, renderRetype } from './retype';
import type { RetypeFrame } from './retype';

/**
 * `retype.ts` is a PURE decision-core (no gsap, no three, no wall-clock, no
 * `Math.random` — see its module doc comment) so every schedule here is
 * fully reproducible from its inputs alone, exactly like `fsm.test.ts`
 * drives `createFSM` off injected `tickTimers(dtMs)` instead of a real
 * clock. Defaults (`random` = `() => 0.5`) make even the "jittered" type
 * cadence deterministic unless a test injects its own `random`.
 *
 * Fixture phrases match the brief: `FROM` (10, 3 chars) is the app's real
 * static headline #1; `TO` (6, 8 chars) is an arbitrary next phrase with
 * different per-line lengths on both lines, so the delete/type counts can't
 * accidentally coincide.
 */

const FROM: readonly [string, string] = ['FULL-STACK', '+AI'];
const TO: readonly [string, string] = ['I SHIP', 'PRODUCTS'];

/** Caret position as one running "characters from the very start of the
 *  2-line phrase" number, independent of which line it's on — lets the
 *  monotonicity tests compare across the line-0/line-1 boundary. */
function caretOffset(frame: RetypeFrame): number {
  return frame.caretIndex.line === 0
    ? frame.caretIndex.col
    : frame.line0.length + frame.caretIndex.col;
}

/** Every schedule has exactly one keyframe with both lines empty — the
 *  hinge between the delete phases (A/B) and the type phases (C/D). Shared
 *  by several tests below instead of re-deriving it each time. */
function findBoundaryIndex(keyframes: ReturnType<typeof buildRetypeSchedule>): number {
  const index = keyframes.findIndex((k) => k.frame.line0 === '' && k.frame.line1 === '');
  if (index === -1) {
    throw new Error('expected a both-lines-empty keyframe between delete and type phases');
  }
  return index;
}

describe('buildRetypeSchedule: default cadence constants', () => {
  it('first backspace interval is 26ms (backspaceMsPerChar, n=0)', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    expect(kf[1].atMs - kf[0].atMs).toBe(26);
  });

  it('first type interval is 40ms (default random() => 0.5 means zero jitter)', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    const boundary = findBoundaryIndex(kf);
    expect(kf[boundary + 1].atMs - kf[boundary].atMs).toBe(40);
  });

  it('keyframe 0 is the full `from` phrase, caret at the end of the bottom line', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    expect(kf[0]).toEqual({
      atMs: 0,
      frame: { line0: 'FULL-STACK', line1: '+AI', caretIndex: { line: 1, col: 3 } },
    });
  });
});

describe('buildRetypeSchedule: 1. deletes BOTTOM line fully before TOP line', () => {
  it('the first keyframe where line0 has shrunk below its original length already has an empty line1', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    const firstLine0Shrink = kf.find((k) => k.frame.line0.length < FROM[0].length);

    expect(firstLine0Shrink).toBeDefined();
    expect(firstLine0Shrink?.frame.line1).toBe('');
  });
});

describe('buildRetypeSchedule: 2. total typed == next phrase', () => {
  it('Phase C+D keyframe count == to[0].length + to[1].length (14); final frame == the `to` phrase', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    const boundary = findBoundaryIndex(kf);
    const typeKeyframes = kf.slice(boundary + 1);

    expect(typeKeyframes.length).toBe(TO[0].length + TO[1].length);
    expect(typeKeyframes.length).toBe(14);

    const final = kf[kf.length - 1];
    expect(final.frame).toEqual({
      line0: 'I SHIP',
      line1: 'PRODUCTS',
      caretIndex: { line: 1, col: 8 },
    });
  });
});

describe('buildRetypeSchedule: 3. caret monotonic during delete, advances during type', () => {
  it('caretOffset is non-increasing across delete keyframes and non-decreasing across type keyframes', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    const boundary = findBoundaryIndex(kf);

    const deleteOffsets = kf.slice(0, boundary + 1).map((k) => caretOffset(k.frame));
    const typeOffsets = kf.slice(boundary).map((k) => caretOffset(k.frame));

    for (let i = 1; i < deleteOffsets.length; i++) {
      expect(deleteOffsets[i]).toBeLessThanOrEqual(deleteOffsets[i - 1]);
    }
    for (let i = 1; i < typeOffsets.length; i++) {
      expect(typeOffsets[i]).toBeGreaterThanOrEqual(typeOffsets[i - 1]);
    }

    // Sanity: the boundary keyframe is the shared hinge, at offset 0.
    expect(caretOffset(kf[boundary].frame)).toBe(0);
  });
});

describe('buildRetypeSchedule: 4. never longer than the delete source or type target (no overflow)', () => {
  it('every keyframe line0/line1 is a prefix of from[..] OR to[..] (never longer than either)', () => {
    const kf = buildRetypeSchedule(FROM, TO);

    for (const { frame } of kf) {
      const line0OK = FROM[0].startsWith(frame.line0) || TO[0].startsWith(frame.line0);
      const line1OK = FROM[1].startsWith(frame.line1) || TO[1].startsWith(frame.line1);

      expect(line0OK).toBe(true);
      expect(line1OK).toBe(true);
      expect(frame.line0.length).toBeLessThanOrEqual(Math.max(FROM[0].length, TO[0].length));
      expect(frame.line1.length).toBeLessThanOrEqual(Math.max(FROM[1].length, TO[1].length));
    }
  });
});

describe('buildRetypeSchedule: 5. jitter within bounds', () => {
  it('every TYPE-phase interval falls in [typeMsPerChar - typeJitterMs, typeMsPerChar + typeJitterMs] = [28, 52]', () => {
    // Cycles through a spread hitting both jitter extremes (~0 and ~0.999)
    // across successive calls, instead of a single fixed value.
    const spread = [0, 0.2, 0.4, 0.6, 0.8, 0.999];
    let calls = 0;
    const random = (): number => {
      const value = spread[calls % spread.length];
      calls += 1;
      return value;
    };

    const kf = buildRetypeSchedule(FROM, TO, { random });
    const boundary = findBoundaryIndex(kf);
    const typeKeyframes = kf.slice(boundary);

    expect(typeKeyframes.length).toBeGreaterThan(1);
    for (let i = 1; i < typeKeyframes.length; i++) {
      const interval = typeKeyframes[i].atMs - typeKeyframes[i - 1].atMs;
      expect(interval).toBeGreaterThanOrEqual(28);
      expect(interval).toBeLessThanOrEqual(52);
    }
  });
});

describe('buildRetypeSchedule: 7. backspace accelerating', () => {
  it('DELETE-phase intervals are non-increasing (each <= the previous) and floored at backspaceMinMs', () => {
    const kf = buildRetypeSchedule(FROM, TO);
    const boundary = findBoundaryIndex(kf);
    const deleteKeyframes = kf.slice(0, boundary + 1);

    const intervals: number[] = [];
    for (let i = 1; i < deleteKeyframes.length; i++) {
      intervals.push(deleteKeyframes[i].atMs - deleteKeyframes[i - 1].atMs);
    }

    expect(intervals.length).toBe(13); // f1.length (3) + f0.length (10)
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1]);
    }
    for (const interval of intervals) {
      expect(interval).toBeGreaterThanOrEqual(8); // backspaceMinMs default
    }
    // The run is long enough (13 chars) that the floor is actually reached.
    expect(intervals[intervals.length - 1]).toBe(8);
  });

  it('a custom backspaceMinMs raises the floor', () => {
    const kf = buildRetypeSchedule(FROM, TO, { backspaceMinMs: 15 });
    const boundary = findBoundaryIndex(kf);
    const deleteKeyframes = kf.slice(0, boundary + 1);

    for (let i = 1; i < deleteKeyframes.length; i++) {
      const interval = deleteKeyframes[i].atMs - deleteKeyframes[i - 1].atMs;
      expect(interval).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('buildRetypeSchedule: determinism', () => {
  it('the same `random` function (same call sequence) produces an identical schedule', () => {
    const values = [0.1, 0.9, 0.3, 0.7, 0.5];
    // Each call gets its OWN closure over its OWN counter, so the two
    // schedules built below draw from identical, independent call sequences.
    function makeRandom(): () => number {
      let i = 0;
      return (): number => {
        const value = values[i % values.length];
        i += 1;
        return value;
      };
    }

    const a = buildRetypeSchedule(FROM, TO, { random: makeRandom() });
    const b = buildRetypeSchedule(FROM, TO, { random: makeRandom() });

    expect(a).toEqual(b);
  });

  it('the zero-jitter default (`random` omitted) is deterministic across calls', () => {
    const a = buildRetypeSchedule(FROM, TO);
    const b = buildRetypeSchedule(FROM, TO);
    expect(a).toEqual(b);
  });
});

describe('buildRetypeSchedule: edge case — a short/empty target line', () => {
  it('builds without throwing and types only the non-empty line', () => {
    const to: readonly [string, string] = ['GO', ''];

    expect(() => buildRetypeSchedule(FROM, to)).not.toThrow();

    const kf = buildRetypeSchedule(FROM, to);
    const boundary = findBoundaryIndex(kf);
    const typeKeyframes = kf.slice(boundary + 1);

    // to[1] is empty, so Phase D contributes no keyframes at all.
    expect(typeKeyframes.length).toBe(to[0].length);
    for (const { frame } of typeKeyframes) {
      expect(frame.line1).toBe('');
    }

    const final = kf[kf.length - 1];
    expect(final.frame).toEqual({ line0: 'GO', line1: '', caretIndex: { line: 0, col: 2 } });
  });

  it('an empty `from` line contributes no delete keyframes for that line', () => {
    const from: readonly [string, string] = ['SOLO', ''];
    const kf = buildRetypeSchedule(from, TO);

    // Only line0's 4 chars are deleted (line1 was already empty); the
    // both-empty boundary keyframe is the last of those 4.
    const boundary = findBoundaryIndex(kf);
    expect(boundary).toBe(4);
    expect(kf[0].frame).toEqual({ line0: 'SOLO', line1: '', caretIndex: { line: 1, col: 0 } });
  });
});

describe('createRetype: 6. isBusy() / step() lifecycle', () => {
  it('is busy immediately after enqueue; false once stepped past the total duration; last frame == `to`; further steps return null', () => {
    const r = createRetype({ initial: FROM });

    expect(r.isBusy()).toBe(false); // nothing enqueued yet

    r.enqueue(TO);
    expect(r.isBusy()).toBe(true);

    const totalMs = buildRetypeSchedule(FROM, TO).at(-1)!.atMs;
    const start = 1_000;

    // The FIRST step() call after enqueue anchors the clock at `now` (so
    // elapsed = 0 there) — later calls with an increasing `now` measure
    // elapsed time from that anchor, mirroring a real rAF-driven caller.
    const firstFrame = r.step(start); // anchors startMs = 1000, elapsed = 0
    expect(firstFrame).toEqual({
      line0: 'FULL-STACK',
      line1: '+AI',
      caretIndex: { line: 1, col: 3 },
    });
    expect(r.isBusy()).toBe(true);

    const midFrame = r.step(start + Math.floor(totalMs / 2));
    expect(r.isBusy()).toBe(true);
    expect(midFrame).not.toBeNull();

    const finalFrame = r.step(start + totalMs + 1_000); // increasing clock, well past completion
    expect(r.isBusy()).toBe(false);
    expect(finalFrame).toEqual({
      line0: 'I SHIP',
      line1: 'PRODUCTS',
      caretIndex: { line: 1, col: 8 },
    });

    expect(r.step(start + totalMs + 2_000)).toBeNull();
  });

  it('a fresh createRetype with no enqueue: step(0) is null and isBusy() is false', () => {
    const r = createRetype({ initial: FROM });
    expect(r.step(0)).toBeNull();
    expect(r.isBusy()).toBe(false);
  });

  it('enqueue after a completed schedule starts a new one from the settled phrase', () => {
    const r = createRetype({ initial: FROM });
    r.enqueue(TO);

    const totalMs = buildRetypeSchedule(FROM, TO).at(-1)!.atMs;
    r.step(0); // anchor
    r.step(totalMs + 1); // past completion -> current becomes TO
    expect(r.isBusy()).toBe(false);

    const next: readonly [string, string] = ['GO', ''];
    r.enqueue(next); // must schedule TO -> next, not FROM -> next
    expect(r.isBusy()).toBe(true);

    const secondTotalMs = buildRetypeSchedule(TO, next).at(-1)!.atMs;
    const secondStart = 50_000;
    r.step(secondStart); // anchor the new schedule's own clock
    const final = r.step(secondStart + secondTotalMs + 500); // past completion
    expect(final).toEqual({ line0: 'GO', line1: '', caretIndex: { line: 0, col: 2 } });
    expect(r.isBusy()).toBe(false);
  });
});

describe('createRetype: reset() re-seeds the settled phrase (entrance primitive)', () => {
  it('abandons any in-flight schedule (isBusy() false) and re-seeds `from` for the next enqueue', () => {
    const r = createRetype({ initial: FROM });
    r.enqueue(TO); // FROM -> TO, now in flight
    expect(r.isBusy()).toBe(true);

    // Re-seed to a phrase distinct from both `initial` (FROM) and the
    // abandoned in-flight target (TO), so the next schedule's `from` is
    // unambiguously the reset value.
    const reseeded: readonly [string, string] = ['RE-SEEDED', 'LINE TWO'];
    r.reset(reseeded);
    expect(r.isBusy()).toBe(false);

    // The next enqueue must build its schedule FROM the reset value. keyframe 0
    // is always the full `from` phrase (caret at the end of its bottom line) —
    // observe it as the first stepped frame.
    r.enqueue(['GO', '']);
    const first = r.step(1_000); // anchors the clock; elapsed 0 -> keyframe 0
    expect(first).toEqual({
      line0: 'RE-SEEDED',
      line1: 'LINE TWO',
      caretIndex: { line: 1, col: 'LINE TWO'.length },
    });
  });

  it("reset(['','']) makes the next enqueue a pure type-up from empty (both-empty keyframe 0, zero deletes)", () => {
    const r = createRetype({ initial: FROM });
    // Whatever was on-screen, re-seed to empty so the entrance types phrase #1
    // up from nothing (the entrance's real use of reset).
    r.reset(['', '']);
    expect(r.isBusy()).toBe(false);

    // The engine's next enqueue builds exactly buildRetypeSchedule(current, next)
    // with current === ['', ''] after the reset; cross-check that schedule's shape.
    const target: readonly [string, string] = ['FULL-STACK', '+AI'];
    const schedule = buildRetypeSchedule(['', ''], target);

    // keyframe 0: both lines empty (caret at the end of the empty bottom line).
    expect(schedule[0].frame).toEqual({ line0: '', line1: '', caretIndex: { line: 1, col: 0 } });

    // ZERO delete keyframes: the total char count never decreases across the
    // whole schedule (a pure type — nothing is ever removed).
    const total = (f: RetypeFrame): number => f.line0.length + f.line1.length;
    for (let i = 1; i < schedule.length; i++) {
      expect(total(schedule[i].frame)).toBeGreaterThanOrEqual(total(schedule[i - 1].frame));
    }

    // Drive the real engine through reset -> enqueue -> step and confirm it
    // lands on the target with isBusy() false after stepping past the end.
    r.enqueue(target);
    expect(r.isBusy()).toBe(true);
    const totalMs = schedule.at(-1)!.atMs;
    r.step(0); // anchor
    const final = r.step(totalMs + 500); // well past completion
    expect(final).toEqual({ line0: 'FULL-STACK', line1: '+AI', caretIndex: { line: 1, col: 3 } });
    expect(r.isBusy()).toBe(false);
  });
});

/**
 * `renderRetype` is this file's one DOM-touching function (see its doc
 * comment) — these tests are structural, not pixel-based: jsdom has no real
 * layout engine, so `offsetLeft`/`offsetTop`/`offsetWidth` are always 0 and
 * `getBoundingClientRect()` always returns zeros. That's fine here — we
 * assert span count/text and "a transform was written", never a specific
 * pixel value.
 *
 * Fixture mirrors the real contract (R-T6a-3): the two line elements carry
 * `[data-byte-line="0"|"1"]` (attributes, not a page class — see
 * `renderRetype`'s doc comment), and the caret is a plain element already
 * appended by the caller, exactly like `createBytePet` will do in Task 4.
 */
function buildHeadlineFixture(): { headlineEl: HTMLElement; caretEl: HTMLElement } {
  const headlineEl = document.createElement('h1');

  const line0El = document.createElement('span');
  line0El.setAttribute('data-byte-line', '0');

  const line1El = document.createElement('span');
  line1El.setAttribute('data-byte-line', '1');

  const caretEl = document.createElement('span');

  headlineEl.append(line0El, line1El, caretEl);

  return { headlineEl, caretEl };
}

describe('renderRetype: builds per-char spans', () => {
  it('one .byte-char span per character on each line; an empty line gets none', () => {
    const { headlineEl, caretEl } = buildHeadlineFixture();
    const frame: RetypeFrame = { line0: 'AB', line1: '', caretIndex: { line: 0, col: 2 } };

    renderRetype(frame, headlineEl, caretEl);

    const line0El = headlineEl.querySelector('[data-byte-line="0"]')!;
    const line1El = headlineEl.querySelector('[data-byte-line="1"]')!;

    const line0Chars = Array.from(line0El.querySelectorAll('.byte-char'));
    expect(line0Chars.map((el) => el.textContent)).toEqual(['A', 'B']);
    expect(line1El.querySelectorAll('.byte-char').length).toBe(0);
  });

  it('sets a non-empty transform on the caret element', () => {
    const { headlineEl, caretEl } = buildHeadlineFixture();
    const frame: RetypeFrame = { line0: 'AB', line1: '', caretIndex: { line: 0, col: 2 } };

    renderRetype(frame, headlineEl, caretEl);

    expect(caretEl.style.transform).not.toBe('');
  });
});

describe('renderRetype: idempotent + rebuild', () => {
  it('rendering the same frame twice yields the same span count/text', () => {
    const { headlineEl, caretEl } = buildHeadlineFixture();
    const frame: RetypeFrame = { line0: 'HEY', line1: 'YOU', caretIndex: { line: 1, col: 3 } };

    renderRetype(frame, headlineEl, caretEl);
    const firstPass = Array.from(headlineEl.querySelectorAll('.byte-char')).map(
      (el) => el.textContent,
    );

    renderRetype(frame, headlineEl, caretEl);
    const secondPass = Array.from(headlineEl.querySelectorAll('.byte-char')).map(
      (el) => el.textContent,
    );

    expect(secondPass).toEqual(firstPass);
    expect(secondPass).toEqual(['H', 'E', 'Y', 'Y', 'O', 'U']);
  });

  it('a shorter frame after a longer one leaves no stale trailing chars', () => {
    const { headlineEl, caretEl } = buildHeadlineFixture();

    renderRetype(
      { line0: 'HELLO', line1: 'WORLD', caretIndex: { line: 1, col: 5 } },
      headlineEl,
      caretEl,
    );
    renderRetype({ line0: 'HI', line1: '', caretIndex: { line: 0, col: 2 } }, headlineEl, caretEl);

    const line0El = headlineEl.querySelector('[data-byte-line="0"]')!;
    const line1El = headlineEl.querySelector('[data-byte-line="1"]')!;

    expect(Array.from(line0El.querySelectorAll('.byte-char')).map((el) => el.textContent)).toEqual([
      'H',
      'I',
    ]);
    expect(line1El.querySelectorAll('.byte-char').length).toBe(0);
  });
});

describe('renderRetype: defensive against a missing [data-byte-line] contract', () => {
  it('does not throw when both line elements are missing', () => {
    const headlineEl = document.createElement('h1'); // no [data-byte-line] children at all
    const caretEl = document.createElement('span');
    const frame: RetypeFrame = { line0: 'AB', line1: 'CD', caretIndex: { line: 0, col: 1 } };

    expect(() => renderRetype(frame, headlineEl, caretEl)).not.toThrow();
  });

  it('no-ops (does not partially render) when only one line element is missing', () => {
    const headlineEl = document.createElement('h1');
    const line0El = document.createElement('span');
    line0El.setAttribute('data-byte-line', '0');
    headlineEl.append(line0El); // line1 deliberately absent
    const caretEl = document.createElement('span');
    const frame: RetypeFrame = { line0: 'AB', line1: 'CD', caretIndex: { line: 0, col: 1 } };

    expect(() => renderRetype(frame, headlineEl, caretEl)).not.toThrow();
    expect(line0El.querySelectorAll('.byte-char').length).toBe(0);
  });
});

describe('renderRetype: CLS proxy — no elements added to headlineEl itself', () => {
  it('headlineEl.children.length is unchanged across renders', () => {
    const { headlineEl, caretEl } = buildHeadlineFixture();
    const before = headlineEl.children.length; // line0 + line1 + caret

    renderRetype(
      { line0: 'AB', line1: 'CD', caretIndex: { line: 0, col: 1 } },
      headlineEl,
      caretEl,
    );
    renderRetype(
      { line0: 'A', line1: 'CDEF', caretIndex: { line: 1, col: 4 } },
      headlineEl,
      caretEl,
    );

    expect(before).toBe(3);
    expect(headlineEl.children.length).toBe(before);
  });
});
