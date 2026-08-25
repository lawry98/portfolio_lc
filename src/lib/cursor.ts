/**
 * Custom cursor — a dot that follows the pointer, with a labeled pill
 * (`FEED` / `TOGGLE` / `OPEN`) shown over certain zones (SPEC §8.7's "global
 * garnish": "custom cursor dot → labeled pills"). This module is a pure
 * MECHANISM: it has no idea which zone maps to which label — a LATER task
 * (`main.ts`, ruling R7-4) owns that hit-testing and drives the pill purely
 * through the `setLabel()` this file returns. Keeping the two apart means
 * this file never has to change if the zone list does.
 *
 * Touch detection (ruling R7-5, SPEC "no cursor-pill labels on touch"):
 * gated on `window.matchMedia('(hover: hover) and (pointer: fine)')`. A
 * touch/coarse/no-hover environment gets NO custom cursor at all —
 * `initCursor()` creates no DOM, and the returned `setLabel`/`destroy` are
 * harmless no-ops, mirroring the null-object shape of
 * `pet/sound/SoundEngine.ts`'s `silentSoundEngine` (every call site works
 * identically whether or not the mechanism is actually live).
 *
 * Fine-pointer path: builds a fixed, `pointer-events: none` dot with a pill
 * child, above the grain overlay (z-index 9999, `grain.css`) and the Style
 * Lab panel (10000, `global.css`) — see the `z-index` on `.byte-cursor` in
 * `global.css`. One `window` `pointermove` listener drives the dot's
 * position, smoothed via `gsap.quickTo()` (CLAUDE.md "GSAP conventions":
 * "use quickTo for anything updated at high frequency (cursor follower,
 * eye tracking)"). Under `prefers-reduced-motion: reduce` the smoothing
 * tween is skipped entirely and the position is set instantly instead — that
 * check is a one-time GATE decided at `initCursor()` time (mirroring
 * `lib/lenisScroll.ts`'s `shouldUseNativeScroll`), not an ongoing treatment
 * that needs to react live to an OS toggle mid-session. The native cursor is
 * hidden only while this mechanism is live, via a class on
 * `document.documentElement` (`global.css`'s `.byte-cursor-active`),
 * restored in `destroy()`.
 */

import gsap from 'gsap';

/**
 * The three cursor-pill labels a zone can show, or `null` to hide the pill.
 * Exported so a later task's zone→label lookup (in `main.ts`) can type
 * itself against the same union `setLabel()` accepts.
 */
export type CursorLabel = 'FEED' | 'TOGGLE' | 'OPEN' | null;

/** R7-5's touch-detection gate. Queried by exact string so tests can stub per-query. */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
/** Smoothing gate for the pointer follow — see the module doc above. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const DOT_CLASS = 'byte-cursor';
const PILL_CLASS = 'byte-cursor__pill';
/** Toggled on the root element only while the custom cursor is live — see the matching rule in `global.css`. */
const NATIVE_CURSOR_HIDDEN_CLASS = 'byte-cursor-active';

/** Fast, tight follow — a cursor dot, not the hero's softer parallax garnish (`page/hero.ts`). */
const FOLLOW_QUICK_TO_VARS = { duration: 0.15, ease: 'power3' };

/**
 * `window.matchMedia` guard mirrors `main.ts`'s `prefersReducedMotion()` /
 * `lib/lenisScroll.ts`'s `shouldUseNativeScroll()`: treated as "does not
 * match" rather than thrown, for the rare environment without the API.
 */
function queryMatches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Shape every branch of `initCursor()` returns — see the verbatim signature below. */
type CursorHandle = { setLabel(l: CursorLabel): void; destroy(): void };

/** The no-op handle for the touch/coarse-pointer path: nothing was created, so nothing to do. */
function noopCursorHandle(): CursorHandle {
  return {
    setLabel(): void {},
    destroy(): void {},
  };
}

/**
 * Builds the fine-pointer cursor: a `.byte-cursor` dot with a `.byte-cursor__pill`
 * child (native `hidden` until `setLabel()` sets a real label), appended to
 * `<body>`, plus the native-cursor-hiding class on the root element.
 */
function buildFinePointerCursor(): CursorHandle {
  const dot = document.createElement('div');
  dot.className = DOT_CLASS;
  dot.setAttribute('aria-hidden', 'true');

  const pill = document.createElement('span');
  pill.className = PILL_CLASS;
  pill.hidden = true;
  dot.appendChild(pill);

  document.body.appendChild(dot);
  document.documentElement.classList.add(NATIVE_CURSOR_HIDDEN_CLASS);

  // Reduced motion skips the smoothing tween entirely (CLAUDE.md: reduced
  // motion should shorten/skip animation, not just look the same faster) —
  // `handlePointerMove` below falls back to an instant `gsap.set` whenever
  // these are `null`.
  const reduced = queryMatches(REDUCED_MOTION_QUERY);
  const setX = reduced ? null : gsap.quickTo(dot, 'x', FOLLOW_QUICK_TO_VARS);
  const setY = reduced ? null : gsap.quickTo(dot, 'y', FOLLOW_QUICK_TO_VARS);

  const handlePointerMove = (event: PointerEvent): void => {
    if (setX && setY) {
      setX(event.clientX);
      setY(event.clientY);
    } else {
      gsap.set(dot, { x: event.clientX, y: event.clientY });
    }
  };

  window.addEventListener('pointermove', handlePointerMove, { passive: true });

  return {
    setLabel(label: CursorLabel): void {
      if (label === null) {
        pill.hidden = true;
        pill.textContent = '';
      } else {
        pill.textContent = label;
        pill.hidden = false;
      }
    },
    destroy(): void {
      window.removeEventListener('pointermove', handlePointerMove);
      gsap.killTweensOf(dot);
      dot.remove();
      document.documentElement.classList.remove(NATIVE_CURSOR_HIDDEN_CLASS);
    },
  };
}

/**
 * Boots the custom cursor mechanism. On a fine-pointer/hover device builds
 * the dot + pill and starts following the pointer; on a touch/coarse
 * pointer it creates nothing at all (ruling R7-5) and hands back a no-op
 * handle. Either way the caller gets the same shape back, so call sites
 * never need to branch on which device they're running on.
 */
export function initCursor(): {
  setLabel(l: 'FEED' | 'TOGGLE' | 'OPEN' | null): void;
  destroy(): void;
} {
  if (!queryMatches(FINE_POINTER_QUERY)) {
    return noopCursorHandle();
  }
  return buildFinePointerCursor();
}
