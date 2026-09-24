# Integrating Byte into the Next.js portfolio

This is the release guide for lifting `src/pet/` out of this standalone demo and mounting it
inside the owner's Next.js portfolio. It documents the real, shipped API — every name below is
cross-checked against `src/pet/types.ts` and `src/pet/createBytePet.ts` (no invented options or
methods) — plus the DOM/CSS contract the module expects from its host and a concrete
`'use client'` React sketch.

**Source of truth**, if this doc and the code ever disagree, trust the code:

- `src/pet/createBytePet.ts` — the `createBytePet(mount, opts)` factory.
- `src/pet/types.ts` — `PetOptions`, `BytePetHandle`, `PetRig`, `SceneOptions`/`SceneHandle`.
- `src/phrases.ts` — the `Phrase` type + the shipped phrase sets.
- `src/main.ts` (search `createBytePet(`) — the reference wiring this guide's sketch mirrors.

**Contents:** [Overview](#1-overview) · [What to copy](#2-what-to-copy) ·
[DOM contract](#3-dom-contract) · [React sketch](#4-react-sketch) ·
[Options reference](#5-options-reference) · [Theme, glow & phrases](#6-theme-glow--phrases) ·
[Fonts](#7-fonts) · [Fallbacks](#8-fallbacks) · [Cleanup checklist](#9-cleanup-checklist) ·
[Serving the model](#10-serving-the-model)

## 1. Overview

`src/pet/` is a framework-agnostic module: plain TypeScript on top of `three` and `gsap` that
talks only to the DOM elements it's handed and to the canvases it creates itself. It has exactly
one import outside its own folder — the `Phrase` type (and the shipped phrase sets) from
`src/phrases.ts`. Everything else in this repo — `index.html`, `src/main.ts`, `src/page/*`, the
Style Lab, the preloader, the custom cursor, Lenis smooth-scroll — is **demo-only** scaffolding
that proves `pet/` works and gives a reference wiring to copy from. None of that scaffolding
ships into the portfolio.

Integration is: mount `createBytePet` from a Next.js **client component** (`'use client'`), once
your headline element actually exists in the DOM, passing it **live element refs**; call the
returned handle's `destroy()` when that component unmounts.

Byte's own motion rides `gsap.ticker` (`src/pet/motion.ts`'s `startTicker`) — a single internal
clock GSAP drives itself. That's a different, independent driver from framer-motion's own
scheduler. Two animation libraries driving two disjoint sets of properties don't fight; the only
way they'd conflict is if both tried to animate the *same* CSS/WebGL property on the *same* node,
which nothing in this module does. In short: **GSAP (and Byte) coexist with framer-motion with no
extra wiring** — just import and mount both normally.

Byte also self-detects `prefers-reduced-motion` **live**, via its own `gsap.matchMedia()`
registration inside `createBytePet` (`docs/DECISIONS.md` D-17) — it re-evaluates on a real OS-level
change while the page stays open, matching how every other module in this project reacts. Do not
compute a `reducedMotion` boolean yourself and pass it in on the strength of a one-time check;
just omit the option (see [§5](#5-options-reference)).

## 2. What to copy

| From this repo | To the portfolio | Notes |
| --- | --- | --- |
| `src/pet/` (whole folder, incl. `sound/`) | e.g. `src/pet/` | The module. `.test.ts` files are optional — only needed if the host also runs Vitest over them. |
| `src/phrases.ts` | e.g. `src/phrases.ts` | The **only** import `pet/` makes outside its own folder (verified: `grep -rn "from '\.\./"` under `src/pet` turns up nothing else). |
| `src/styles/tokens.css` (or the relevant slice) | your global CSS | The `--glow`/theme/type custom properties Byte's Style-Lab-style wiring reads, plus the locked `@font-face` — see [§7](#7-fonts). |
| The hero headline rules in `src/styles/global.css` | your global CSS / component styles | `.hero__headline`, `.hero__line`, `.byte-char`, `[data-byte-caret]` — see [§3](#3-dom-contract) for the exact rules. |
| `src/styles/grain.css` (optional) | your global CSS | Cosmetic film-grain overlay; unrelated to Byte's own rendering, skip it if you don't want the texture. |

The sketch below assumes the portfolio's own `@/*` → `./src/*` path alias (already present in
this project's `tsconfig.json`), so `pet/` lands at `@/pet/*` and phrases at `@/phrases`. Adjust
the import paths if your copy lands somewhere else.

**Runtime dependencies.** `pet/` itself hard-imports exactly two packages — `three` and `gsap`
(verified by grepping every `import` in `src/pet/*.ts`; there is no `lenis` import anywhere under
`src/pet/`). Both are already regular `dependencies` in this demo's `package.json`; Next.js
bundles them like any other npm package, no special config required. `gsap` is already common
alongside `framer-motion` in Next projects (see [§1](#1-overview)).

`lenis` is a *page*-level dependency in this demo (`src/lib/lenisScroll.ts`, wired from
`src/main.ts`) for its own smooth-scroll feel — it is **not** required by `pet/`. Byte's
hero↔footer migration logic (`pickAnchor()`, `src/pet/anchor.ts`) reads
`getBoundingClientRect()` fresh on every `gsap.ticker` tick, so it works correctly whether the
page scrolls natively or through Lenis. Only add Lenis if you want that page-wide smooth-scroll
feel for its own sake, not because Byte needs it.

## 3. DOM contract

**The headline.** `createBytePet` expects `headlineEl` to already have its two text lines as its
first two child elements at construction time — it runs `Array.from(el.children).slice(0, 2)`
synchronously and tags whatever it finds `data-byte-line="0"` / `data-byte-line="1"`. In React
terms: render the two line elements as `headlineEl`'s own JSX children in the *same* render that
owns the ref (as the [sketch](#4-react-sketch) below does), so they're already in the DOM the
moment the mount effect runs. Don't add any other child before them.

**Reserve the height (CLS 0).** A retype transiently deletes every character before typing the
next phrase; if the headline's box isn't height-locked, that box collapses and reflows the page
under it. Copy (or replicate) this contract from `global.css`:

```css
.hero__headline {
  font-family: var(--font-display, inherit);
  line-height: 1.05;
  min-height: calc(1.05em * 2); /* 2 lines, in em, so it scales with a fluid font-size */
  position: relative; /* offsetParent for the caret's transform below */
}

.hero__line {
  display: block;
  white-space: nowrap;
  min-height: 1.05em; /* an emptied line mid-retype still reserves its row */
}

/* Per-character spans createBytePet's retype engine rebuilds every frame. */
.byte-char {
  display: inline;
}

/* Byte's own DOM caret. createBytePet creates + appends this element itself
   (class="byte-caret" + data-byte-caret) — you only ever provide the CSS,
   never the element. Positioned by `transform` writes only, so it can never
   reflow the headline. */
[data-byte-caret] {
  position: absolute;
  top: 0;
  left: 0;
  width: 0.06em;
  height: 1.05em;
  background: var(--accent, currentColor);
  pointer-events: none;
  animation: byte-caret-blink 1s steps(1, end) infinite;
}

@keyframes byte-caret-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
```

Note `[data-byte-caret]` uses an ordinary DOM color token (`--accent` in this demo) — it is
**independent of `--glow`**. `--glow` only feeds Byte's dark-mode WebGL emissive material via
`setGlowAccent()` (see [§6](#6-theme-glow--phrases)); don't conflate the two.

**The footer (optional second home).** If you pass `footerEl` + `footerPhrases`, that element
needs the *identical* contract: two line children, reserved height, its own caret. Copy the
`.footer__headline`/`.footer__line` rules the same way.

**The feed zone.** `createBytePet` wires its own `pointerdown` listener on
`headlineEl.closest('section') ?? headlineEl.parentElement ?? headlineEl` at construction — you
don't need to wire a click handler yourself for basic click-to-feed. `feed(x, y)` is exposed on
the handle only for an *extra* trigger, e.g. a keyboard-accessible button (see [§5](#5-options-reference)).

**The two canvases.** `createBytePet(mount, opts)` creates `#gl-back` (`z-index: -1`) and
`#gl-front` (`z-index: 40`) as direct children of `mount` — both `position: fixed`, full-viewport,
`pointer-events: none`. `document.body` (what both this demo and the sketch below use) is the
simplest, safest choice. One caveat: `position: fixed` escapes normal stacking *unless* an
ancestor establishes a new containing block for fixed descendants (a `transform`, `filter`,
`will-change`, or `contain` on an ancestor does this) — if your root layout wraps the app in an
animated/transformed page-transition container, verify the two canvases still cover the full
viewport rather than getting trapped inside that ancestor's box.

## 4. React sketch

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function BytePet({ theme }: { theme: 'light' | 'dark' }) {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const handleRef = useRef<{
    setTheme: (t: 'light' | 'dark') => void;
    enterAndType: () => Promise<void>;
    destroy: () => void;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    // Dynamic import keeps three/gsap out of the server bundle (client-only).
    (async () => {
      const [{ createBytePet }, { phrases }] = await Promise.all([
        import('@/pet/createBytePet'),
        import('@/phrases'),
      ]);
      if (disposed || !headlineRef.current) return;
      handleRef.current = createBytePet(document.body, {
        headlineEl: headlineRef.current,
        theme,
        phrases: phrases.identity, // phrases[0] === the static headline #1 already rendered
        entrance: true,            // starts hidden — enterAndType() below reveals it
        // footerEl / footerPhrases / sound are optional — wire them like src/main.ts if wanted.
      });
      await handleRef.current.enterAndType(); // drop-in + live-type phrase #1 (reduced-motion → instant)
    })();
    return () => {
      disposed = true;
      handleRef.current?.destroy(); // frees renderers, canvases, tweens, listeners
      handleRef.current = null;
    };
  }, []); // mount once; theme changes go through the effect below

  // Re-theme the live scene when the app's theme flips (don't recreate Byte).
  useEffect(() => {
    handleRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <h1 id="hero-headline" ref={headlineRef} className="hero__headline">
      <span className="hero__line">FULL-STACK</span>
      <span className="hero__line">+AI</span>
    </h1>
  );
}
```

**Why the `enterAndType()` call is there:** passing `entrance: true` only parks the FSM in a
`hidden` state at construction — under full motion it *also* immediately blanks the headline to
empty text — and hides Byte and its shadow. `enterAndType()` is what actually drives the reveal:
the drop-in bounce, then a live-type of phrase #1 (an instant, un-animated reveal under reduced
motion), resolving once the entrance settles into `idle`. This demo's own reference wiring calls
it the same way, just from a different trigger — `src/page/preloader.ts`'s `runEntrance` `await`s
`bytePet.enterAndType()` once the page's preloader is ready to lift, rather than right after
construction as above. Gate it behind your own loading signal if you have one; calling it
immediately after construction, as above, is the simplest option if you don't.

If you skip both `entrance` and `enterAndType()`, Byte boots straight into `idle`, immediately
visible, and the headline's static server-rendered text is left alone — the simpler path if you
don't need the drop-in beat.

## 5. Options reference

`PetOptions` (`src/pet/types.ts`), passed as `createBytePet(mount, opts)`'s second argument:

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `headlineEl` | `HTMLElement` | — *(required)* | The live headline Byte anchors to and sizes itself from — `unitPx` (its whole scale) is `parseFloat(getComputedStyle(headlineEl).fontSize)`, read once at construction. See [§3](#3-dom-contract) for its DOM shape. |
| `footerEl` | `HTMLElement` | `undefined` | The footer CTA's 2-line headline — Byte's second home. Needs `footerPhrases` too, or no footer home is built (hero-only). |
| `footerPhrases` | `readonly Phrase[]` | `undefined` | The footer's retype cycle. `footerPhrases[0]` should equal the footer's static on-screen text so the first footer feed deletes what's actually shown. |
| `theme` | `'light' \| 'dark'` | `'light'` | Starting theme. Your own theme controller stays the source of truth after boot — call `setTheme()` on every later flip. |
| `reducedMotion` | `boolean` | *(self-detected)* | Hard override. Omit it — `createBytePet` self-detects `prefers-reduced-motion` live (see [§1](#1-overview)). |
| `phrases` | `readonly Phrase[]` | `undefined` | The hero retype cycle. `phrases[0]` should equal the on-screen headline #1. Omitted (or a single entry) → retype becomes a no-op pass-through: the state machine still advances, the headline text just never changes. |
| `entrance` | `boolean` | `false` | Run the drop-in + live-type-phrase-#1 entrance. Requires an explicit `handle.enterAndType()` call — see [§4](#4-react-sketch). |
| `sound` | `SoundEngine` | *(silent no-op)* | The engine every cue (`typeTick`/`eatA`/`eatB`/`spawnPop`/`themeWhoosh`/`wakeBoing`/`chirp`) plays through. Omit it and Byte stays silent with no extra wiring — every call site already speaks only to this interface (`src/pet/sound/SoundEngine.ts`), so nothing branches on whether sound exists. |
| `modelUrl` | `string` | *(placeholder only)* | The URL of Byte's rigged `byte.glb` (T-GLB). The host serves the file at this URL; the fetch starts at `createBytePet` construction, behind a dynamic `import('./glbLoader')` (its own lazy chunk). A failure keeps the procedural placeholder for the session — see [§10](#10-serving-the-model). |

`Phrase` (`src/phrases.ts`): `type Phrase = readonly [string, string]` — a `[line1, line2]` tuple.

`BytePetHandle` (`src/pet/types.ts`), returned by `createBytePet`:

| Method | Signature | Purpose |
| --- | --- | --- |
| `feed` | `(x: number, y: number) => void` | Tosses a glyph at viewport point `(x, y)` (client/pointer coordinates, e.g. `event.clientX/Y` or a `getBoundingClientRect()` center) and drives the dash → eat → retype loop. Rarely needed directly — `createBytePet` already self-wires a `pointerdown` listener on the feed zone (see [§3](#3-dom-contract)); call this yourself only for an *extra* trigger, e.g. a keyboard "Feed Byte" button, exactly as `src/main.ts` does: `bytePet.feed(rect.left + rect.width / 2, rect.top + rect.height / 2)`. |
| `setTheme` | `(t: 'light' \| 'dark') => void` | Re-themes the live scene + rig (lights, body color, glow) with a short crossfade. Call it whenever your app's own theme flips. |
| `onEat` | `(cb: (total: number) => void) => void` | Subscribes to the running eaten-glyph total; fires on every eat. Register-many, no unsubscribe — register once (e.g. in the mount effect) and rely on `destroy()` to stop further calls. |
| `enterAndType` | `() => Promise<void>` | Drops Byte in and live-types phrase #1 (instant under reduced motion). Resolves once the entrance settles into `idle`. A no-op-ish resolve if `entrance: true` wasn't passed at construction. |
| `setHomeAnchor` | `(el: HTMLElement) => void` | Switches Byte's active home between the hero and footer elements (anchor, caret, retype target, phrase cycle all follow). No-op if `el` is already active; ignored if `el` matches neither known home. Does **not** itself decide *when* to switch — see [§6](#6-theme-glow--phrases). |
| `setGlowAccent` | `(color: THREE.ColorRepresentation) => void` | Swaps the dark-mode-only WebGL glow accent live, re-applied against the current theme immediately. Default is the mint `#38e8a8` (`DEFAULT_GLOW_ACCENT`, `src/pet/scene.ts`) until you call this. |
| `setPhrases` | `(cycle: readonly Phrase[]) => void` | Replaces the **hero's** retype cycle live and resets its position to index 0 (the footer's cycle is untouched — it isn't affected by this call). |
| `modelReady` | `Promise<void>` | (T-GLB) Settles once the GLB from `modelUrl` is live or has failed to load; never rejects. Resolves immediately if no `modelUrl` was passed. Useful for gating your own loading UI on the real model the same way this demo's preloader does — see [§10](#10-serving-the-model). |
| `destroy` | `() => void` | Tears down everything this instance created — tweens/timelines, `matchMedia`, listeners, the rig, the shadow, and the scene (both renderers **and** canvases, which are removed from the DOM, not just disposed). Always call this on unmount — see [§9](#9-cleanup-checklist). |

## 6. Theme, glow & phrases

- **Theme:** call `handle.setTheme(t)` from your own theme-toggle callback whenever the app's
  theme flips — as the sketch's second `useEffect` does. Don't recreate Byte on a theme change;
  `setTheme` crossfades the existing instance in place.
- **Glow accent:** `setGlowAccent(color)` only has a visible effect in dark mode (the glow is a
  dark-mode-only phosphor effect; light mode stays off regardless). If you expose a glow/accent
  axis in your own design tokens, feed it through the same bridge this demo's `main.ts` uses:
  ```ts
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--glow').trim();
  handle.setGlowAccent(hex);
  ```
  The locked default is mint, `--glow: #38e8a8` (`src/styles/tokens.css`). If you never call
  `setGlowAccent`, Byte's glow already defaults to that same mint.
- **Phrases:** `setPhrases(cycle)` swaps the hero's retype cycle live (e.g. from a settings panel
  or an A/B choice) — it resets the hero's cycle position and, if the hero is currently active,
  re-seeds the retype engine against the on-screen text so the very next retype deletes correctly.
- **Footer as a second home:** supplying `footerEl` + `footerPhrases` builds a second home with
  its own caret and cycle; `setHomeAnchor(footerEl)` points Byte's retype target at it manually.
  `createBytePet` never decides *when* to switch on its own — this demo's own scroll-driven
  hero↔footer travel is a `pickAnchor()` decision (`src/pet/anchor.ts`, pure) fed live
  `getBoundingClientRect()` numbers by `createBytePet`'s internal per-tick loop. If you only want
  a static "second home" (no travel), call `setHomeAnchor` manually when appropriate; port the
  anchor-picking/travel behavior only if you want the full migration.

## 7. Fonts

The demo ships **Space Grotesk** (weights 500/700) as the locked display family, self-hosted as
subset `woff2`, mapped through a `--font-display` custom property (`src/styles/tokens.css`). In
Next, self-host the same family — via `next/font/local` (bring the same woff2 files) or
`next/font/google` (`Space_Grotesk`) — and map its generated font-family/variable to whatever your
headline's `font-family` resolves through.

One functional nuance, not just a cosmetic one: `unitPx` — Byte's entire size scale — is read via
`getComputedStyle(headlineEl).fontSize`, **once**, synchronously, inside `createBytePet`, and never
re-measured afterward (no resize or font-load re-derive). Practically: make sure the headline's
CSS (font-family *and* font-size, including a fluid `clamp()` if you use one) is already applied
in the same render that creates the ref, exactly as the sketch does — and know that a later
viewport resize which changes a fluid font-size will not rescale Byte to match; it keeps the size
it was born at. This is true of the demo itself too, not a Next-specific gap — worth a note in
your own QA if your layout resizes the headline drastically (e.g. a large breakpoint jump).

## 8. Fallbacks

Guard construction behind a WebGL capability check, mirroring `src/main.ts`'s own gate:

```ts
import { hasWebGL } from '@/pet/scene';

if (!hasWebGL()) {
  // Render the static headline only — no canvases, no Byte, page fully usable.
} else {
  // ...construct createBytePet as in §4.
}
```

- **JS disabled:** nothing to guard — without JS your component's effect never runs, so make sure
  the headline's server-rendered markup already reads correctly as static content on its own.
- **WebGL unavailable:** `hasWebGL()` (copied with the rest of `pet/`) returns `false`; skip
  construction entirely and leave the static headline in place, exactly as above.
- **`prefers-reduced-motion`:** handled internally, live — don't gate mounting on it and don't
  pass `reducedMotion` (see [§1](#1-overview)/[§5](#5-options-reference)).
- **One instance per page.** `createBytePet` self-wires `window`/`document`-level listeners
  (pointermove, the feed zone's pointerdown, plus an internal `resize` and `visibilitychange`
  inside `scene.ts`/`motion.ts`) — a second live instance would double all of them up.

## 9. Cleanup checklist

- **Always call `destroy()`** in the mount effect's cleanup function. It kills every
  tween/timeline this instance created, reverts its `gsap.matchMedia()` registration, removes its
  `pointermove`/`pointerdown`/`resize`/`visibilitychange` listeners, removes the hint element and
  both homes' carets, tears down the accessibility live-region, and removes **and** disposes both
  WebGL canvases/renderers — nothing is left behind for a remount to collide with.
- **The `disposed` guard is what makes this StrictMode-safe**, not a second `destroy()` call.
  React's dev-only double-invoke runs mount → cleanup → mount; setting `disposed = true` in that
  first cleanup stops the still-in-flight dynamic import from constructing a throwaway instance
  after its own effect has already been torn down (at that point `handleRef.current` is still
  `null`, so there is nothing for that cleanup to destroy — the guard prevents the wasted
  construction in the first place). The second, real mount then runs cleanly.
- **One instance per page** — see [§8](#8-fallbacks).
- **If you used `entrance: true`, remember `enterAndType()`** (see [§4](#4-react-sketch)) —
  otherwise Byte, and under full motion the headline text itself, never appears.

## 10. Serving the model

Copy `public/models/byte.glb` from this repo to your host's static directory (Next's `public/`
works the same way this demo's does) and pass its URL as `modelUrl`:

```ts
createBytePet(document.body, {
  headlineEl: headlineRef.current,
  modelUrl: '/models/byte.glb',
  // ...
});
```

The fetch starts the moment `createBytePet` runs. `GLTFLoader` and three's `MeshoptDecoder` arrive
through a separate, lazy `import('./glbLoader')` chunk (~21 KB gz) — they never inflate your
entry bundle, and there's nothing to configure beyond `modelUrl` itself. Until the model resolves
(or if it fails to load at all), Byte runs on the procedural placeholder; a late or failed load
never blocks or breaks the page. Await `handle.modelReady` if you want to know when the real
model is actually on screen.
