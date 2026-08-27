/**
 * Byte's live-region phrase announcer — a throttled polite `aria-live` region
 * that speaks the FINAL headline phrase after each reward retype (SPEC §12 "a
 * throttled polite live-region announces the final phrase after a retype";
 * TICKETS T9 `announcePhrase(text: string): void`).
 *
 * Split into a tested pure core + a thin DOM executor, exactly like
 * `retype.ts`'s `createRetype` vs `renderRetype` (and mirroring the purity of
 * `anchor.ts`/`glyphs.ts`):
 *
 * - `createPhraseThrottle(intervalMs)` — the PURE decision-core (unit-tested
 *   below). It owns only the throttle DECISION: leading-edge emit, coalesce
 *   rapid pushes to the latest text, and a trailing flush. It imports neither
 *   `gsap` nor `three`, touches no DOM, and never reads the wall clock
 *   (`Date.now`/`performance.now`) or `Math.random` — time enters ONLY via the
 *   `nowMs` argument each caller supplies, so the same call sequence is fully
 *   deterministic under test.
 * - `announcePhrase(text)` — the executor half: a module-singleton that reads
 *   `performance.now()`, lazily builds one visually-hidden live region on
 *   `document.body`, and schedules the trailing flush via `setTimeout`. Being
 *   the DOM/clock half, it is exempt from the core's purity rules — it is the
 *   only thing here that touches either.
 */

/**
 * The pure throttle's surface. `push`/`flush` return the text to ANNOUNCE now
 * (already trimmed) or `null` when there is nothing to say yet; `pending`
 * reports whether a deferred push is waiting for a trailing flush.
 */
export interface PhraseThrottle {
  /** Offer `text` at time `nowMs`. Emits (returns the trimmed text) on the
   *  leading edge — the first push, or any push ≥ `intervalMs` after the last
   *  emit — otherwise defers it (returns `null`, marks it pending, coalescing
   *  over any earlier pending text). Empty/whitespace text is ignored and never
   *  consumes the leading slot. */
  push(text: string, nowMs: number): string | null;
  /** Emit the pending text if one is waiting AND `intervalMs` has elapsed since
   *  the last emit; otherwise `null`. Clears pending on emit. */
  flush(nowMs: number): string | null;
  /** Whether a deferred push is currently waiting for a trailing flush. */
  pending(): boolean;
}

/**
 * Builds a leading-edge throttle with trailing coalesce. `lastEmitMs` seeds at
 * `-Infinity` so the very first `push` always clears the `>= intervalMs` gate
 * and emits immediately. PURE — no imports, no DOM, no clock, no randomness;
 * every timestamp is the caller's injected `nowMs`.
 */
export function createPhraseThrottle(intervalMs: number): PhraseThrottle {
  let lastEmitMs = -Infinity;
  let pendingText: string | null = null;

  function push(text: string, nowMs: number): string | null {
    const t = text.trim();
    if (!t) return null;
    if (nowMs - lastEmitMs >= intervalMs) {
      lastEmitMs = nowMs;
      pendingText = null;
      return t;
    }
    pendingText = t;
    return null;
  }

  function flush(nowMs: number): string | null {
    if (pendingText !== null && nowMs - lastEmitMs >= intervalMs) {
      lastEmitMs = nowMs;
      const out = pendingText;
      pendingText = null;
      return out;
    }
    return null;
  }

  function pending(): boolean {
    return pendingText !== null;
  }

  return { push, flush, pending };
}

// ---------------------------------------------------------------------------
// `announcePhrase(text)` — the DOM executor (module-singleton, lazy region).
// ---------------------------------------------------------------------------

/** Minimum gap between spoken announcements — a leading emit, then at most one
 *  trailing emit (the latest text) per interval. */
const ANNOUNCE_INTERVAL_MS = 1000;
const throttle = createPhraseThrottle(ANNOUNCE_INTERVAL_MS);

let region: HTMLElement | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Create the polite live region once (lazily) and cache it. Styled
 * visually-hidden INLINE rather than via a page CSS class: `pet/` never
 * depends on `global.css` (portability), so this mirrors `.visually-hidden`
 * (global.css) as inline styles. `aria-atomic="true"` makes SRs read the whole
 * phrase on each change; `data-byte-live` is the test/debug hook.
 */
function ensureRegion(): HTMLElement {
  if (region !== null) return region;
  const el = document.createElement('div');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('data-byte-live', '');
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  document.body.appendChild(el);
  region = el;
  return el;
}

/**
 * Announce `text` to the polite live region, throttled. A leading push writes
 * immediately; a push within the interval is deferred and a single trailing
 * flush is scheduled a full `ANNOUNCE_INTERVAL_MS` later. Scheduling the flush
 * that far out always satisfies `flush`'s `>= intervalMs` check (the deferred
 * push was itself ≤ intervalMs after the last emit), so the trailing
 * announcement is guaranteed to fire, coalesced to the latest text.
 */
export function announcePhrase(text: string): void {
  const now = performance.now();
  const emit = throttle.push(text, now);
  if (emit !== null) {
    ensureRegion().textContent = emit;
    return;
  }
  if (throttle.pending() && flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const due = throttle.flush(performance.now());
      if (due !== null) ensureRegion().textContent = due;
    }, ANNOUNCE_INTERVAL_MS);
  }
}
