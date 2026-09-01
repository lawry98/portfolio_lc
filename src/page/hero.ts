/**
 * Hero section — load reveal + mouse-parallax (SPEC §8.2, §8.7).
 *
 * Two independent behaviours, both scoped to `#hero`:
 *  - a masked line reveal of the two-line headline, fired once on load
 *    (via `revealLines()`), gated on webfonts settling with a bounded
 *    fallback so it can never wait forever. Suppressible via
 *    `initHero({ headlineReveal: false })` (R-T6b-6): on the full-motion
 *    WebGL path Byte itself live-types phrase #1 INTO this headline (the
 *    SPEC §8.1 entrance — see `main.ts`/`createBytePet`), so `main.ts` turns
 *    the reveal OFF there to avoid two animations driving the same two lines.
 *    The reduced-motion and no-WebGL floors keep it ON (Byte never types the
 *    headline in those modes — it places instantly, or is absent entirely);
 *  - a small mouse-parallax garnish: the headline nudges toward the
 *    pointer, the `[data-parallax]` micro-label(s) nudge the opposite way,
 *    both driven by `gsap.quickTo()` so repeated `pointermove` events reuse
 *    the same tweens instead of creating a new one per event (CLAUDE.md
 *    "GSAP conventions"). Unconditional — never suppressed.
 *
 * Both respect `prefers-reduced-motion`: the load reveal defers to
 * `revealLines()`'s own instant/no-transform branch, and the parallax is
 * skipped entirely via its own `gsap.matchMedia()` (SPEC §12/§14).
 */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { revealLines } from './reveals';
import type { SoundEngine } from '../pet/sound/SoundEngine';

// Registered defensively (idempotent — see reveals.ts) since this module
// calls `ScrollTrigger.refresh()` directly below, rather than only going
// through the already-registered `revealLines`.
gsap.registerPlugin(ScrollTrigger);

/**
 * Real webfont loads on this project's self-hosted, subsetted woff2s settle
 * well under this. The race exists so a `document.fonts.ready` that never
 * resolves (unsupported API, a stalled load) can't leave the hero's load
 * reveal waiting forever — the invariant is that content is never stuck
 * hidden, and `revealLines()` only runs once this promise settles one way
 * or the other.
 */
const FONTS_TIMEOUT_MS = 1500;

/**
 * Seconds after the load reveal fires before its SplitText is reverted
 * (R-T6a-4). Comfortably past the ≤~1.1s mask-rise, so the animation always
 * completes first. Reverting unwraps SplitText's `mask: 'lines'` line/mask
 * wrappers and restores the original `.hero__line` spans (carrying the
 * `data-byte-line` tags `createBytePet` set on them) as direct children of
 * `#hero-headline` — which the retype caret's offset math depends on
 * (`pet/createBytePet.ts` appends the caret to the headline expecting it to
 * be the offsetParent; the mask wrappers would otherwise become that parent
 * and skew the caret x/y). The retype itself still works without this via
 * the `data-byte-line` attribute lookup (`pet/retype.ts`); the revert only
 * keeps the caret geometry honest.
 */
const REVEAL_REVERT_S = 2;

/** Parallax budget — "a few px", never more than this on either axis. */
const PARALLAX_MAX_PX = 8;
/**
 * `handlePointerMove` below normalizes the pointer position to `nx`/`ny` in
 * roughly -0.5..0.5 across the hero's box, so doubling the ±px budget here
 * compensates for that ±0.5 range: `nx * PARALLAX_RANGE_PX` (and its `ny`/
 * label counterparts) then spans the full ±`PARALLAX_MAX_PX`.
 */
const PARALLAX_RANGE_PX = PARALLAX_MAX_PX * 2;
const PARALLAX_VARS = { duration: 0.6, ease: 'power3' };

/**
 * Resolves once webfonts have settled, or after `FONTS_TIMEOUT_MS`,
 * whichever comes first. Never rejects: `document.fonts.ready` is caught
 * defensively, and a missing `document.fonts` (very old engine) resolves
 * immediately via the timeout branch instead.
 */
function whenFontsSettled(): Promise<void> {
  const fontsReady =
    typeof document !== 'undefined' && document.fonts
      ? document.fonts.ready.then(() => undefined).catch(() => undefined)
      : Promise.resolve();
  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, FONTS_TIMEOUT_MS);
  });
  return Promise.race([fontsReady, timeout]);
}

/**
 * Reads the `data-parallax-speed` hook (a per-label multiplier — SPEC's
 * "drifting micro-labels" at different speeds), defaulting to `1` and
 * clamping to +/-1 so a stray markup value can't blow the parallax budget.
 */
function parallaxSpeed(el: HTMLElement): number {
  const raw = Number(el.dataset.parallaxSpeed);
  return Number.isFinite(raw) ? gsap.utils.clamp(-1, 1, raw) : 1;
}

/**
 * Wires the hero's pointer-parallax. Branches on `prefers-reduced-motion`
 * via its own `gsap.matchMedia()`:
 *  - `no-preference` sets up one `quickTo` per axis per target (headline +
 *    each `[data-parallax]` label) and a single `pointermove` listener on
 *    the hero section that drives all of them; returns a cleanup that
 *    removes the listener and clears the applied transforms.
 *  - `reduce` skips all of the above — no listener, no quickTo, no
 *    parallax — and explicitly resets any transform to neutral.
 *
 * `gsap.matchMedia()` re-evaluates live: if the user flips the OS reduced-
 * motion setting while the page is open, it calls the `no-preference`
 * branch's returned cleanup automatically before running the `reduce`
 * branch. That live re-evaluation is this project's only real "teardown"
 * path today — there is no SPA unmount in this single-page bootstrap
 * (mirrors the comment in `lenisScroll.ts`).
 */
function initParallax(hero: HTMLElement, headline: HTMLElement, labels: HTMLElement[]): void {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const headlineX = gsap.quickTo(headline, 'x', PARALLAX_VARS);
    const headlineY = gsap.quickTo(headline, 'y', PARALLAX_VARS);
    const labelSetters = labels.map((label) => ({
      x: gsap.quickTo(label, 'x', PARALLAX_VARS),
      y: gsap.quickTo(label, 'y', PARALLAX_VARS),
      speed: parallaxSpeed(label),
    }));

    const handlePointerMove = (event: PointerEvent): void => {
      const rect = hero.getBoundingClientRect();
      // Normalize to roughly -0.5..0.5 across the hero's own box.
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;

      headlineX(nx * PARALLAX_RANGE_PX);
      headlineY(ny * PARALLAX_RANGE_PX);

      labelSetters.forEach(({ x, y, speed }) => {
        x(-nx * PARALLAX_RANGE_PX * speed);
        y(-ny * PARALLAX_RANGE_PX * speed);
      });
    };

    hero.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      hero.removeEventListener('pointermove', handlePointerMove);
      gsap.set([headline, ...labels], { clearProps: 'transform' });
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set([headline, ...labels], { clearProps: 'transform' });
  });
}

/**
 * Boots the hero section: the load reveal + the pointer-parallax garnish.
 * Guards every lookup — no-ops safely if `#hero` or its headline is absent.
 *
 * `opts.root` scopes the lookups (defaults to `document` — the pre-entrance
 * no-arg behaviour is preserved for any other caller). `opts.headlineReveal`
 * (default `true`) gates ONLY the masked-line load reveal + its bounded
 * revert: `main.ts` passes `false` on the full-motion WebGL path, where Byte
 * live-types phrase #1 into the headline instead (R-T6b-6). The guarded
 * `ScrollTrigger.refresh()` and the pointer-parallax are set up regardless.
 */
export function initHero(opts?: { root?: ParentNode; headlineReveal?: boolean }): void {
  const root = opts?.root ?? document;
  const headlineReveal = opts?.headlineReveal ?? true;

  const hero = root.querySelector<HTMLElement>('#hero');
  const headline = hero?.querySelector<HTMLElement>('.hero__headline');
  if (!hero || !headline) {
    return;
  }

  // Load reveal: fires once fonts have settled (or the fallback timeout
  // elapses), never gated on anything that can hang forever. No
  // `scrollTrigger` — this is a load reveal, not a scroll one.
  void whenFontsSettled().then(() => {
    // R-T6b-6: run the masked-line reveal (and its bounded revert) ONLY when
    // `headlineReveal` is true. On the full-motion WebGL path Byte itself
    // live-types phrase #1 into this headline (the entrance — see `main.ts`/
    // `createBytePet`), so the caller suppresses the reveal to keep the two
    // from driving the same two lines at once. The `ScrollTrigger.refresh()`
    // below still runs either way.
    if (headlineReveal) {
      const revealCleanup = revealLines(headline);

      // Revert the load-reveal SplitText once the mask-rise has played
      // (R-T6a-4): unwraps SplitText's line/mask wrappers so the retype caret's
      // offsetParent is `#hero-headline` itself (see REVEAL_REVERT_S). Bounded
      // (a single `delayedCall`, not a recurring one) and guarded — a failed
      // revert is a missed nice-to-have (the retype still finds its lines via
      // their `data-byte-line` tags), never a broken page, mirroring the
      // `ScrollTrigger.refresh()` guard below.
      gsap.delayedCall(REVEAL_REVERT_S, () => {
        try {
          revealCleanup();
        } catch {
          // Defensive only — see the comment above.
        }
      });
    }

    // The reveal ScrollTriggers (this section's own, plus manifesto/work/
    // footer's — all booted synchronously earlier in the same `bootstrap()`
    // call, see main.ts) were created before webfonts swapped in; the
    // `font-display: swap` metric shift can leave their cached start
    // positions slightly stale. A single refresh here, once fonts have
    // settled, recomputes every trigger's start/end against the now-final
    // layout. Not a recurring call — ScrollTrigger already auto-refreshes on
    // load/resize on its own — and guarded so this best-effort recompute can
    // never throw its way into breaking the load reveal above it.
    try {
      ScrollTrigger.refresh();
    } catch {
      // Defensive only (mirrors theme.ts's storage guards) — a failed
      // recompute here is a missed nice-to-have, not a broken page.
    }
  });

  const labels = Array.from(hero.querySelectorAll<HTMLElement>('[data-parallax]'));
  initParallax(hero, headline, labels);
}

/* ==========================================================================
   Nav sound controls (T7, SPEC §8.3) — the EQ mute/unmute toggle, the
   `(click to enable sound)` gate hint, and the one-time first-gesture unlock.
   ADDED alongside the hero reveal/parallax above; it shares none of that code.
   ========================================================================== */

/**
 * Fine-pointer gate for the follow behaviour — the exact string `lib/cursor.ts`
 * uses (ruling R7-5), so the hint trails the pointer precisely where the custom
 * cursor lives; a touch/coarse device gets a static hint instead.
 */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
/**
 * Smoothing gate for the follow — mirrors `lib/cursor.ts`: reduced motion skips
 * the `quickTo` tween and snaps the hint to the pointer instantly instead.
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Pre-unlock hint copy (SPEC §8.3's first-gesture sound gate). */
const SOUND_GATE_TEXT = '(click to enable sound)';
/**
 * Root-state class carried on `<html>` while the audio gate is shut (T11, SPEC
 * §8.3/§8.7). A boolean state class on the document element, exactly like
 * `lib/cursor.ts`'s `.byte-cursor-active` — `global.css` hangs the cursor-pill
 * suppression rule off it, which is the whole point: the cursor mechanism and
 * `main.ts`'s zone→label resolver both stay zone-blind (R7-4), and the gate is
 * serialized ahead of the pills purely in CSS.
 */
const SOUND_LOCKED_CLASS = 'byte-sound-locked';
/** Offset (px) so the hint trails below-right of the pointer, never under it. */
const SOUND_GATE_OFFSET_X = 16;
const SOUND_GATE_OFFSET_Y = 18;
/** Follow smoothing — a hair softer than the cursor dot, nearer the hero's parallax feel. */
const SOUND_GATE_FOLLOW_VARS = { duration: 0.3, ease: 'power3' };

/**
 * `window.matchMedia` guard, treated as "does not match" when the API is absent
 * (mirrors `main.ts`'s `prefersReducedMotion` / `lib/cursor.ts`'s `queryMatches`).
 */
function matchesMedia(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/**
 * Nav sound controls (T7, SPEC §8.3): the EQ mute/unmute toggle, the
 * `(click to enable sound)` gate hint, and the one-time first-gesture unlock.
 *
 * State it reconciles: the engine owns `enabled()` (the persisted mute
 * preference, default on) but NOT whether audio has been unlocked — WebAudio is
 * silent until a user gesture resumes it (see `pet/sound/webAudioSynth.ts`), and
 * the `SoundEngine` interface exposes no `unlocked()`, so this function tracks
 * `unlocked` itself (starts false, flips on the first `pointerdown`). Sound is
 * AUDIBLE only when both are true — which is exactly when the equalizer animates
 * (`.is-on`); `aria-pressed` tracks the mute preference the button toggles.
 *
 * Every DOM lookup is guarded: with the nav EQ button absent (a stripped page, a
 * test fixture without it) the whole function is a silent no-op.
 *
 * Takes only `engine` — an earlier draft also accepted an optional
 * custom-cursor handle for a later task's zone→label wiring, but that
 * wiring landed directly in `main.ts` instead (R7-4), leaving the param
 * unused here; T8 dropped it (its own `cursor` handle still drives the
 * `pointermove` zone resolver in `main.ts`, just never passed into this
 * function).
 */
export function initSoundControls({ engine }: { engine: SoundEngine }): void {
  const button = document.querySelector<HTMLButtonElement>('[data-eq-toggle]');
  if (!button) {
    return;
  }

  // The engine owns `enabled()`; `unlocked` is this module's own gate flag —
  // nothing is audible until the first gesture resumes the AudioContext.
  let unlocked = false;

  // Audible — and the equalizer animates — only when the user hasn't muted AND
  // the first-gesture gate has opened.
  const isAudible = (): boolean => engine.enabled() && unlocked;

  const syncButton = (): void => {
    // `aria-pressed` reflects the mute preference the button toggles; the
    // `is-on` class (the animated/accent look) reflects actual audibility.
    button.setAttribute('aria-pressed', String(engine.enabled()));
    button.classList.toggle('is-on', isAudible());
  };

  syncButton();

  button.addEventListener('click', () => {
    engine.setEnabled(!engine.enabled());
    syncButton();
  });

  // ---- Gate hint: `(click to enable sound)` until the first gesture. ----

  // Flag the document as sound-locked so `global.css` can suppress EVERY
  // cursor pill until the gate opens (T11). Without this, a first visit shows
  // two cursor messages ~18px apart — the zone pill and the hint below — both
  // describing the same single click, since the unlock is a capture-phase
  // `pointerdown` on `window` and a first click in the hero also feeds Byte.
  // ALL pills, not just `FEED`: suppressing `FEED` alone merely relocates the
  // collision to the `OPEN` and `TOGGLE` zones, and CSS cannot know which
  // label the pill currently holds. Deliberately AFTER the `!button` guard
  // above — a page with no EQ button never builds the hint and never attaches
  // an unlock listener, so setting this there would suppress the pills
  // permanently. Inert on touch/coarse, where `initCursor()` builds no pill
  // DOM at all.
  document.documentElement.classList.add(SOUND_LOCKED_CLASS);

  const label = document.createElement('div');
  label.className = 'sound-gate-label';
  label.textContent = SOUND_GATE_TEXT;
  label.setAttribute('aria-hidden', 'true');

  // Set only on the fine-pointer path; the unlock cleanup calls it to drop the
  // `pointermove` follow listener + kill the hint's tweens.
  let removeFollow: (() => void) | null = null;

  if (matchesMedia(FINE_POINTER_QUERY)) {
    // Fine pointer: the hint trails the cursor. Start invisible so it never
    // flashes in the top-left corner before the first move positions it.
    label.style.opacity = '0';
    document.body.appendChild(label);

    // Reduced motion snaps instead of smoothing — mirrors `lib/cursor.ts`.
    const reduced = matchesMedia(REDUCED_MOTION_QUERY);
    const setX = reduced ? null : gsap.quickTo(label, 'x', SOUND_GATE_FOLLOW_VARS);
    const setY = reduced ? null : gsap.quickTo(label, 'y', SOUND_GATE_FOLLOW_VARS);

    let revealed = false;
    const handlePointerMove = (event: PointerEvent): void => {
      const x = event.clientX + SOUND_GATE_OFFSET_X;
      const y = event.clientY + SOUND_GATE_OFFSET_Y;
      if (setX && setY) {
        setX(x);
        setY(y);
      } else {
        gsap.set(label, { x, y });
      }
      if (!revealed) {
        revealed = true;
        label.style.opacity = '1';
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    removeFollow = (): void => {
      window.removeEventListener('pointermove', handlePointerMove);
      gsap.killTweensOf(label);
    };
  } else {
    // Touch/coarse: nothing to follow, so the hint rests quietly in the corner.
    label.classList.add('sound-gate-label--static');
    document.body.appendChild(label);
  }

  const removeGateLabel = (): void => {
    removeFollow?.();
    label.remove();
    // The pills' turn: the page now carries no cursor message, so drop the
    // suppression flag in the same breath as the hint it was serializing
    // ahead of (T11).
    document.documentElement.classList.remove(SOUND_LOCKED_CLASS);
  };

  // ---- First-gesture unlock (SPEC §8.3): one-shot, capture-phase, on window. ----
  // Listen for BOTH `pointerdown` and `keydown`: a keyboard-only user never
  // fires `pointerdown` (they Tab to a control and press Enter/Space), and
  // browsers accept `keydown` as valid user activation for
  // `AudioContext.resume()` exactly like a pointer gesture — so keying anywhere
  // must be able to unlock sound too (SPEC §12 keyboard operability, §15 QA).
  // `capture` so this runs before — and independently of — the EQ button's own
  // click handler; the handler removes BOTH siblings up front (and each is
  // `once` as a belt-and-suspenders self-removal), so whichever gesture lands
  // first tears the other listener down as well. If that first gesture happens
  // to land on the EQ button, this unlock runs first, then the click toggles
  // `enabled` (an accepted edge case; both engine calls are order-safe).
  const handleFirstGesture = (): void => {
    window.removeEventListener('pointerdown', handleFirstGesture, { capture: true });
    window.removeEventListener('keydown', handleFirstGesture, { capture: true });
    unlocked = true;
    engine.unlock();
    removeGateLabel();
    syncButton();
  };
  window.addEventListener('pointerdown', handleFirstGesture, { capture: true, once: true });
  window.addEventListener('keydown', handleFirstGesture, { capture: true, once: true });
}
