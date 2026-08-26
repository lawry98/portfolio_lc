import './styles/tokens.css';
import './styles/global.css';
import './styles/grain.css';
import { initTheme, type ThemeController } from './lib/theme';
import { initGrain } from './lib/grain';
import { initLenis } from './lib/lenisScroll';
import { initCursor, type CursorLabel } from './lib/cursor';
import { initHero, initSoundControls } from './page/hero';
import { initManifesto } from './page/manifesto';
import { initWork } from './page/work';
import { initFooter } from './page/footer';
import { initLab } from './page/lab';
import { runEntrance } from './page/preloader';
import { hasWebGL } from './pet/scene';
import { createBytePet } from './pet/createBytePet';
import { createWebAudioSynth } from './pet/sound/webAudioSynth';
import type { BytePetHandle } from './pet/types';
import { phrases } from './phrases';

/**
 * Byte demo entry point.
 *
 * Import order matters: tokens.css first so every CSS custom property is
 * available before anything else runs, then global.css (consumes the
 * tokens for the base/reset/layout styles), then grain.css (the overlay
 * painted above everything). `initTheme()` reconciles the `data-theme`
 * attribute the no-flash inline script (see `index.html`) already applied
 * pre-paint; `initGrain()` paints the runtime noise tile once.
 *
 * WebGL pet layer (T3 laid the foundation; T4 wires the real Byte):
 * `bootstrap()` delegates to `createBytePet()` behind a `hasWebGL()` guard
 * (SPEC's no-WebGL degradation: hide the canvases, keep the static
 * headline, page fully usable) — see the guard block below.
 * `createBytePet()` owns the scene, the render ticker, the rig, the
 * shadow, and the FSM internally; this module only holds the returned
 * `BytePetHandle` (for the theme-toggle callback and the pagehide
 * teardown). T3's `?glcube` QA rig (which proved the two-canvas occlusion
 * sandwich) was removed once its job was done.
 *
 * Entrance (T6b, SPEC §8.1): `bootstrap()` also composes the preloader
 * entrance via `runEntrance()` (see `page/preloader.ts`). The branch is
 * decided once up front from `hasWebGL()` + `prefersReducedMotion()`:
 *  - full WebGL + full motion → preloader lift → Byte drops in + live-types
 *    phrase #1, and the hero's own masked reveal is suppressed so the two
 *    don't drive the same headline;
 *  - WebGL + reduced motion → Byte still participates (`entrance: webgl`)
 *    but places instantly and keeps the static phrase #1; the hero reveal
 *    stays on (its own instant branch);
 *  - no WebGL → preloader lift → static headline, no Byte;
 *  - JS off → index.html's `<noscript>` hides the overlay; this module never
 *    runs at all.
 * `runEntrance()` is driven un-awaited and rejection-guarded so it can never
 * block first paint or break the page.
 */

/**
 * Wires the nav theme-toggle button to the theme controller and keeps its
 * `aria-pressed` state + icon glyph in sync with the active theme. `onToggle`
 * (added in T3) fires after the sync, once the DOM/ARIA state already
 * reflects the new theme — `bootstrap()` uses it to re-theme Byte without
 * this module needing to know `bytePet` exists at bind time (it's created
 * later, after the section inits and the `hasWebGL()` guard; the callback
 * closes over the module-scope `bytePet` binding below, which may still be
 * `undefined` at click time on the no-WebGL path — hence the `?.`).
 */
function bindThemeToggle(root: HTMLElement, theme: ThemeController, onToggle?: () => void): void {
  const button = root.querySelector<HTMLButtonElement>('#theme-toggle');
  if (!button) {
    return;
  }
  const icon = button.querySelector<HTMLElement>('[data-theme-toggle-icon]');

  const sync = (): void => {
    const isDark = theme.current() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    if (icon) {
      icon.textContent = isDark ? '☾' : '☀';
    }
  };

  sync();
  button.addEventListener('click', () => {
    theme.toggle();
    sync();
    onToggle?.();
  });
}

/**
 * OS/browser reduced-motion preference, guarding environments without
 * `matchMedia` (mirrors `lenisScroll.ts`'s `shouldUseNativeScroll` guard) —
 * treated as "no preference" rather than "reduce" when the API is missing,
 * since there's no way to ask.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Cursor zone → pill label (ruling R7-4). A PURE hit-test over the element
 * under the pointer, resolved by `closest()` in priority order: any link is an
 * `OPEN` affordance, the theme/EQ buttons are `TOGGLE`, anywhere else inside
 * the hero is `FEED` (Byte lives there), and everything else clears the pill.
 * `lib/cursor.ts` is a blind mechanism — this is the only place that knows
 * which zone maps to which label, driving the dot purely through `setLabel()`.
 * On touch `initCursor()` returns an inert handle, so the delegated
 * `pointermove` listener that calls this resolves labels no one ever shows —
 * harmless, hence no touch-branch here.
 */
function resolveCursorLabel(target: EventTarget | null): CursorLabel {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest('a[href]')) {
    return 'OPEN';
  }
  if (target.closest('#theme-toggle, [data-eq-toggle]')) {
    return 'TOGGLE';
  }
  if (target.closest('#hero')) {
    return 'FEED';
  }
  return null;
}

/**
 * `still hungry` tooltip runtime (ruling R7-8). An INLINE-STYLED element (the
 * precedent is the pet's own `(click to feed Byte)` hint in `createBytePet.ts`,
 * styled in JS rather than via a page CSS class), anchored just under the
 * headline. It reveals only once Byte has eaten `FEED_THRESHOLD`+ glyphs AND
 * the Style Lab's Tooltip axis is `on` (`<html data-tooltip="on">`) — the axis
 * defaults to `off`, so in production the tooltip stays hidden.
 *
 * Mounted on `#hero` (a `position: relative` box), NOT inside `#hero-headline`:
 * the hero's SplitText line-reveal can replace the headline's children with
 * clones (see `retype.ts`), which would strand a child appended there. Position
 * is expressed as bounding-rect DELTAS relative to the hero — the same
 * offsetParent-immune technique `renderRetype` uses for the caret — so it never
 * depends on `.container` being positioned. `position: absolute` +
 * `pointer-events: none` + opacity-only fades mean it can never shift page
 * layout (CLS 0) or intercept input. Only reads layout when actually shown.
 */
function createHungryTooltip(
  hero: HTMLElement,
  headlineEl: HTMLElement,
): { setCount(total: number): void } {
  /** SPEC §8.6 / ruling R7-8: "still hungry" appears after 3+ feeds. */
  const FEED_THRESHOLD = 3;
  /** Gap (px) between the headline's bottom edge and the tooltip, below it. */
  const GAP_PX = 12;

  const el = document.createElement('p');
  el.textContent = 'still hungry';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    margin: '0',
    // Above #gl-front (z-index 40, scene.ts), below the grain overlay (9999) —
    // mirrors the pet hint's own layering in `createBytePet.ts`.
    zIndex: '41',
    pointerEvents: 'none',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    letterSpacing: '0.02em',
    opacity: '0',
    transition: 'opacity 0.3s ease',
    willChange: 'opacity',
  } satisfies Partial<CSSStyleDeclaration>);
  hero.appendChild(el);

  let count = 0;

  const position = (): void => {
    const heroRect = hero.getBoundingClientRect();
    const headRect = headlineEl.getBoundingClientRect();
    el.style.left = `${headRect.left - heroRect.left}px`;
    el.style.top = `${headRect.bottom - heroRect.top + GAP_PX}px`;
  };

  const sync = (): void => {
    const on = document.documentElement.dataset.tooltip === 'on';
    const show = count >= FEED_THRESHOLD && on;
    if (show) {
      position();
    }
    el.style.opacity = show ? '1' : '0';
  };

  // The lab flips `data-tooltip` with a plain attribute write and no event to
  // listen for, so observe `<html>` directly: this lets the tooltip appear the
  // instant the axis is turned on even between feeds (e.g. the QA flow that
  // feeds Byte first, then enables the axis to see the reward).
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-tooltip'],
  });

  // Re-anchor on resize (the headline's fluid clamp() font-size moves it a lot
  // across breakpoints); `sync` only reads layout while the tooltip is shown.
  window.addEventListener('resize', sync, { passive: true });

  sync();

  return {
    setCount(total: number): void {
      count = total;
      sync();
    },
  };
}

// Kept in module scope (rather than dropped like `initLenis()`'s handle) so
// both the theme-toggle callback and the `pagehide` teardown below can reach
// it — `undefined` on the no-WebGL path, where there is no Byte to theme or
// tear down.
let bytePet: BytePetHandle | undefined;

function bootstrap(): void {
  const theme = initTheme();
  initGrain();
  // Registers ScrollTrigger and boots smooth scroll before the reveal/section
  // inits (later tasks) run, so their triggers attach to a live scroller. No
  // teardown path exists yet in this single-page bootstrap, so the returned
  // handle is intentionally not stored (see `lenisScroll.ts` for the handle
  // callers would use once one does).
  initLenis();

  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    return;
  }

  bindThemeToggle(root, theme, () => bytePet?.setTheme(theme.current()));

  // Entrance branch, decided ONCE up front (before the section inits) so the
  // hero and Byte agree on who owns the headline:
  //  - `reducedMotion` / `webgl` are the two environment gates;
  //  - `willByteType` (WebGL AND full motion) is the ONLY case where Byte
  //    live-types phrase #1 INTO the headline, so it controls exactly one
  //    thing here: suppressing the hero's own masked-line reveal (R-T6b-6),
  //    so the two never double-animate the same two lines. Byte still
  //    PARTICIPATES in the entrance under reduced motion (see `entrance:
  //    webgl` below) — it just places instantly and keeps the static phrase
  //    #1, so the hero reveal is left ON to play its own instant branch.
  const reducedMotion = prefersReducedMotion();
  const webgl = hasWebGL();
  const willByteType = webgl && !reducedMotion;

  // Hero load reveal + mouse-parallax (T2 Task 4), the remaining sections'
  // scroll reveals + parallax (T2 Task 5), each guarding its own lookups
  // the same way `initHero()` does. `initLab()` (T2 Task 6) goes last: the
  // Style Lab typography control, which itself no-ops entirely unless
  // `?lab` is present (see `page/lab.ts`). `headlineReveal: !willByteType`
  // hands the headline to Byte's live-type on the full path, and keeps the
  // masked reveal on the reduced/no-WebGL floor.
  initHero({ headlineReveal: !willByteType });
  initManifesto();
  initWork();
  initFooter();
  initLab();

  // Sound + custom cursor (T7, SPEC §8.3/§8.7) — pure garnish: it must never
  // block first paint or throw into boot. ONE engine is constructed here (the
  // single WebAudio construction site; everything downstream — Byte's cues,
  // the nav controls — speaks only the `SoundEngine` interface) and is injected
  // into Byte below so every pet cue routes through it. The custom cursor, the
  // nav EQ toggle + `(click to enable sound)` gate, and the first-gesture
  // `unlock()` do NOT depend on WebGL, so they init HERE, before the no-WebGL
  // early return, and work on that floor too. `initCursor()` returns an inert
  // handle on touch, so the delegated zone listener that drives its pill is a
  // harmless no-op there (no touch-branching needed).
  const sound = createWebAudioSynth();
  const cursor = initCursor();
  initSoundControls({ engine: sound, cursor });
  document.addEventListener(
    'pointermove',
    (event) => cursor.setLabel(resolveCursorLabel(event.target)),
    { passive: true },
  );

  // WebGL pet layer (T3 foundation, T4 real Byte, T6b entrance) — graceful
  // degradation per SPEC/CLAUDE.md: no WebGL means no canvases at all, so the
  // page stays exactly as T2 left it (static headline #1, fully usable). The
  // preloader STILL runs on this floor and lifts to that static headline —
  // with no `bytePet`, `runEntrance` just counts %, lifts the overlay, and
  // staggers the page chrome in (its `enterAndType()` await is a no-op).
  // Driven un-awaited (never blocks first paint) and rejection-guarded (can
  // never break the page). `console.info` is fine here; an `error`/`warn` is
  // not, since this is an expected, handled path, not a failure. JS-off is
  // handled upstream by index.html's `<noscript>` (this module never runs).
  if (!webgl) {
    console.info('[byte] WebGL unavailable — static headline only, pet scene skipped.');
    void runEntrance({ reducedMotion, root }).catch(() => {});
    return;
  }

  const headlineEl = root.querySelector<HTMLElement>('#hero-headline');
  if (!headlineEl) {
    return;
  }

  // T8: the footer CTA is Byte's SECOND retype home. Resolve its 2-line
  // headline (guarded like `headlineEl` — a stripped page without it simply
  // gets no footer home, hero-only). `createBytePet` builds the footer home
  // only when BOTH `footerEl` and `footerPhrases` are present.
  const footerEl = root.querySelector<HTMLElement>('.footer__headline') ?? undefined;

  bytePet = createBytePet(document.body, {
    headlineEl,
    theme: theme.current(),
    reducedMotion,
    // Byte participates in the entrance whenever WebGL exists (R-T6b-9):
    // `entrance: webgl`, NOT `willByteType`. `enterAndType()` branches full
    // vs reduced INTERNALLY (drop-in + live-type under full motion; instant
    // place + static phrase #1 under reduced), and starting the FSM in
    // `hidden` keeps the `hidden → entering → idle` beats live in both modes.
    entrance: webgl,
    // The retype reward's phrase cycle (SPEC §6/§10). `phrases.identity[0]`
    // is the static headline #1 already in the markup, so the first eat
    // retypes into `identity[1]`, and so on, wrapping the cycle.
    phrases: phrases.identity,
    // T8 switchable footer home: `setHomeAnchor(footerEl)` re-points Byte's
    // retype at the footer's `phrases.footer` cycle (`footer[0] = ["LET'S",
    // "BUILD"]` == the static footer markup, so the first footer feed deletes
    // the right text). WHEN Byte migrates is a later task; the home just exists.
    footerEl,
    footerPhrases: phrases.footer,
    // T7 sound seam (R7-1): route every pet cue (typeTick / eat / spawnPop /
    // themeWhoosh / wakeBoing / chirp) through the one engine constructed
    // above. `createBytePet` speaks only the `SoundEngine` interface — this is
    // its single injection point; omitting it would fall back to silence.
    sound,
  });

  // Footer FED counter (T5, SPEC §8.6) — lives in the footer (`index.html`),
  // not the hero. Wired here rather than inside `createBytePet` (which stays
  // page-agnostic/portable, same reasoning as `bindThemeToggle` above) via
  // the `onEat` subscription the handle now exposes. No WebGL means this
  // never runs, so the counter simply stays at its static markup default
  // (`FED 0 GLYPHS`) — still correct.
  const fedCounter = document.querySelector<HTMLElement>('[data-fed-counter]');
  // `still hungry` tooltip (T7, ruling R7-8) — a WebGL-only garnish, so it is
  // created and wired HERE, inside the `bytePet` block, which naturally guards
  // its `onEat` subscription (no Byte, no feeds, so nothing to show). Anchored
  // to `#hero`; if that lookup ever fails on a stripped page it simply stays
  // absent rather than throwing. It REUSES the single `onEat` bridge below (the
  // handle's subscription is register-many, but one callback drives both the
  // footer counter and the tooltip off the same running `total` — no duplicate
  // count).
  const hero = headlineEl.closest<HTMLElement>('#hero');
  const hungryTooltip = hero ? createHungryTooltip(hero, headlineEl) : null;
  bytePet.onEat((total) => {
    if (fedCounter) {
      fedCounter.textContent = `FED ${total} GLYPH${total === 1 ? '' : 'S'}`;
    }
    hungryTooltip?.setCount(total);
  });

  // Gives the module-scope `bytePet` a genuine (if rarely exercised) reason
  // to exist beyond the theme-toggle callback above: tear it down (kills
  // every tween/timer/listener + the scene's renderers/canvases) on a *real*
  // page unload. `pagehide` also fires when the page is frozen into the
  // back/forward cache instead of destroyed (`event.persisted === true`) —
  // destroying there would strand a frozen, unresumable scene for a later
  // `pageshow` restore. Only a non-persisted `pagehide` (an actual unload)
  // calls `destroy()`; a bfcache round-trip is left entirely to
  // `startTicker`'s own internal `visibilitychange` pause/resume (see
  // `pet/motion.ts`). The single-page demo never navigates away internally,
  // so this rarely fires either way.
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      bytePet?.destroy();
    }
  });

  // Drive the SPEC §8.1 entrance now that the Byte handle exists (order
  // matters — `runEntrance` awaits `bytePet.enterAndType()`): preloader counts
  // % → bounded gate → lift the overlay → await Byte's drop-in + live-type
  // phrase #1 (full motion) or its instant place (reduced) → stagger the page
  // chrome in. `root` (`#app`) scopes the chrome lookups
  // (`.nav`/`.hero__micro-label`/`.hero__scroll` all live inside it); the
  // overlay itself is a body-level sibling, which `runEntrance` resolves via
  // its own `document` fallback. Un-awaited so bootstrap never blocks first
  // paint, and guarded so a rejection can never break the page — index.html's
  // own inline 6s overlay fallback is the last-resort floor if anything stalls.
  void runEntrance({ bytePet, reducedMotion, root }).catch((err) =>
    console.error('[byte] entrance failed', err),
  );
}

bootstrap();
