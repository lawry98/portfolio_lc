# Byte — pet demo

A standalone, portfolio-grade one-page demo starring **Byte**, a small dev-robot mascot
who lives in the hero headline. Byte eats code glyphs you toss at it and rewards each
feed with a backspace-and-retype of the headline. Built with Vite + vanilla TypeScript
(strict) — no framework — on top of three.js, GSAP, and Lenis, with Vitest for tests and
ESLint + Prettier for lint/format.

## Highlights

- **Two-canvas WebGL occlusion sandwich** (`#gl-back` / `#gl-front`) with a pixel-space
  camera, so Byte can duck convincingly behind and in front of the headline's letterforms.
- **Full-GSAP motion** — every tween and timeline rides one shared `gsap.ticker`; no
  competing rAF loops.
- **Pure, unit-tested core** — the finite-state machine and the retype engine are plain
  functions with no DOM/GSAP dependency, covered by Vitest.
- **Feed → dash → eat → retype reward loop** — toss a glyph at Byte, it dashes over, eats
  it, and the headline backspaces + retypes as the payoff.
- **Hero ↔ footer migration** — Byte relocates between its two homes (the hero headline
  and the footer CTA) as the page scrolls.
- **Theme reaction** — Byte's glow and materials respond to the light/dark toggle.
- **Accessibility** — a throttled, polite live-region announces the retyped phrase; a
  keyboard-reachable "Feed Byte" control; Byte self-detects `prefers-reduced-motion` live.
- **Sound** — a code-generated WebAudio synth behind a swappable `SoundEngine` interface
  (recorded audio via Howler is a planned drop-in swap, no call-site changes).
- **Custom cursor** — a dot that expands into labeled pills (`FEED` / `TOGGLE` / `OPEN`)
  over interactive targets.
- **Style Lab** (`?lab`, dev-only) — a live control panel for typography, glow accent,
  phrase set, and tooltip, with a "Copy locked config" button.

## Getting started

Node is pinned via [mise](https://mise.jdx.dev) (see `.tool-versions`). Run all commands
through it:

```bash
mise exec node@22 -- npm install
mise exec node@22 -- npm run dev
```

Dev is fixed at [http://localhost:5180](http://localhost:5180) (`strictPort` — it fails
loudly instead of hopping to another port).

## Scripts

| Command                                     | What it does                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `mise exec node@22 -- npm run dev`          | Start the Vite dev server on **:5180** (serves all 3 font families, for `?lab`) |
| `mise exec node@22 -- npm run build`        | Type-check (`tsc --noEmit`) then build the production bundle to `dist/`         |
| `mise exec node@22 -- npm run preview`      | Serve the production build on **:4173**                                         |
| `mise exec node@22 -- npm run lint`         | Run ESLint                                                                      |
| `mise exec node@22 -- npm run format`       | Run Prettier — write                                                            |
| `mise exec node@22 -- npm run format:check` | Run Prettier — check only                                                       |
| `mise exec node@22 -- npm run test`         | Run the Vitest suite once                                                       |
| `mise exec node@22 -- npm run test:watch`   | Run Vitest in watch mode                                                        |

## Production build & preview

```bash
mise exec node@22 -- npm run build
mise exec node@22 -- npm run preview
```

`preview` serves the real `dist/` output on :4173. The production build ships **one type
system** (Space Grotesk only, ~26 KB woff2) and hides the `?lab` panel entirely — both are
dev-only conveniences that are stripped/tree-shaken out of the release bundle at build
time.

## Performance budgets

Enforced per `docs/SPEC.md` §13:

| Budget        | Limit    | Shipped (production)                        |
| ------------- | -------- | ------------------------------------------- |
| JS (gzip)     | ≤ 280 KB | ~206 KB                                     |
| CSS (gzip)    | ≤ 20 KB  | ~3.3 KB                                     |
| Fonts (woff2) | ≤ 120 KB | ~26 KB — Space Grotesk, 2 weights (500/700) |

Dev intentionally ships all 3 font families (~99 KB total) so the `?lab` type chooser can
preview each one live; only the locked family ships in production.

The production JS chunk is >500 KB **uncompressed** (three.js + GSAP) — that's expected
and accepted; the gzip figures above are the budget that actually governs, not raw chunk
size (see the `chunkSizeWarningLimit` comment in `vite.config.ts`).

## Style Lab (`?lab`)

Open [http://localhost:5180/?lab](http://localhost:5180/?lab) in dev for a live control
panel over four axes — **Type** (3 families), **Glow** accent (4 colors), **Phrase set**
(3) and **Tooltip** (on/off) — plus a "Copy locked config" button that serializes the
current picks. It's dev-only (query-param-gated) and not present in the production
bundle. See `docs/SPEC.md` §7 for the full contract.

**Locked/shipped defaults:** Space Grotesk · mint glow (`#38e8a8`) · Identity phrase set ·
tooltip off.

## Graceful degradation

- **JS disabled:** the page still renders a static first headline (no Byte, no
  animation).
- **WebGL unavailable:** the page stays fully usable; the two canvases stay hidden rather
  than breaking layout.
- **`prefers-reduced-motion`:** the blinking caret stays, hops/dashes become simple
  fades, and parallax is disabled.

## Testing & QA

```bash
mise exec node@22 -- npm run test
```

Vitest covers the pure cores — FSM transitions/guards, the retype queue, the glyph queue,
anchor math, and the a11y announcer — with no DOM/GSAP dependency.

Manual browser QA follows the protocol in `docs/SPEC.md` §15 (cross-theme screenshots,
the full interaction run, occlusion, reduced-motion, keyboard-only, zero console errors).
On-device residuals that can't be captured headlessly — a 10s rAF fps sample, heap
stability after 50 feeds, and a mobile Lighthouse run (Perf ≥ 90 / A11y ≥ 95 / Best
Practices 100) — live in `docs/qa/`.

## Integration

The `pet/` module is framework-agnostic and built to be lifted into the Next.js
portfolio via `createBytePet(mount, opts)`. See [`docs/INTEGRATION.md`](docs/INTEGRATION.md)
for the mount/cleanup contract, the DOM requirements, and a React sketch.

## Project docs

- [`docs/SPEC.md`](docs/SPEC.md) — full design spec
- [`docs/TICKETS.md`](docs/TICKETS.md) — build plan
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decision log
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — build progress / evidence log
- [`docs/ASSET_SPEC.md`](docs/ASSET_SPEC.md) — contract for Byte's rigged `.glb`
- [`docs/AUDIO_SPEC.md`](docs/AUDIO_SPEC.md) — contract for the recorded-audio swap-in

## Status & pending owner deliverables

This is a complete, playable demo, but three pieces are still placeholders pending
assets/details from the project owner:

- **Byte's model** — a procedural placeholder bot stands in until a rigged `byte.glb`
  (see `docs/ASSET_SPEC.md`) lands at the **T-GLB** ticket.
- **Sound** — the WebAudio synth stands in until recorded audio (see
  `docs/AUDIO_SPEC.md`) lands at the **T-Audio** ticket.
- **Contact links** — the email and social links are placeholders
  (`hello@lawrence.dev`, GitHub `#`, LinkedIn `#`) pending real values.
