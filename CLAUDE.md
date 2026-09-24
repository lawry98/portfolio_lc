# CLAUDE.md — Byte pet demo

Byte is a standalone, portfolio-grade one-page demo starring a little dev-robot
mascot that lives in the hero headline, eats tossed code glyphs, and drives a
backspace-and-retype reward. Built with **Vite + vanilla TypeScript** (no
framework) to Awwwards-hero polish and 60fps on a mid-range phone. Authoritative
spec: [`docs/SPEC.md`](docs/SPEC.md). Ticket-by-ticket build plan:
[`docs/TICKETS.md`](docs/TICKETS.md).

## Node via mise

Node has no global default on this machine — every `node`/`npm`/`npx` call must
go through mise: `mise exec node@22 -- <cmd>` (e.g.
`mise exec node@22 -- npm run dev`). The pin lives in `.tool-versions`
(`node 22.23.0`); with that file present, the shorter `mise exec -- <cmd>` (no
`@22`) also resolves to the same version from this directory.

## Commands

| Command                | Does                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`          | Vite dev server, fixed port 5180                                     |
| `npm run build`        | `tsc --noEmit` (strict) then `vite build`                            |
| `npm run preview`      | Serve the production build                                           |
| `npm run lint`         | ESLint over the whole project                                        |
| `npm run format`       | Prettier, writes                                                     |
| `npm run format:check` | Prettier, check only (CI-safe)                                       |
| `npm test`             | Vitest single run (`--passWithNoTests`; real tests land from Task 2) |
| `npm run test:watch`   | Vitest watch mode                                                    |

Run all of the above through `mise exec node@22 -- npm run <script>`.

## Target file structure

Locked at T1, grows per ticket — see `docs/TICKETS.md` for what each ticket adds.

```
byte-pet-demo/                 # worktree root = Vite app root
  index.html
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts
  eslint.config.js  .prettierrc  CLAUDE.md
  public/  models/byte.glb  audio/(sounds later)
  src/
    main.ts                    # bootstraps page + createBytePet
    phrases.ts                 # Identity / Punchy / footer phrase sets
    styles/  tokens.css  global.css  grain.css
    lib/    theme.ts  lenisScroll.ts  cursor.ts  dom.ts
    page/   preloader.ts  hero.ts  manifesto.ts  work.ts  footer.ts
            reveals.ts  lab.ts
    pet/
      createBytePet.ts         # public API + orchestrator
      types.ts                 # PetOptions, PhraseSet, ClipName, PetState…
      fsm.ts        fsm.test.ts        # PURE
      retype.ts     retype.test.ts     # PURE
      rig.ts                   # PetRig adapter (placeholder + GLB), clip API
      placeholderBot.ts        # procedural robot
      glbLoader.ts             # GLTFLoader+MeshoptDecoder → RigSource (dynamic import)
      glbRig.ts     glbRig.test.ts     # GLB PetRig (AnimationMixer)
      swapRig.ts    swapRig.test.ts    # the one swappable rig
      glbAsset.test.ts         # real byte.glb smoke test
      scene.ts                 # two-canvas sandwich, camera, renderers, lights
      shadow.ts                # blob-shadow sprite
      glyphs.ts   glyphs.test.ts        # extruded glyph shapes + queue cap
      feed.ts                  # feeding/queue/dash/eat orchestration
      motion.ts                # GSAP timelines/eases/quickTo helpers + ticker
      sound/  SoundEngine.ts  webAudioSynth.ts  howlerFiles.ts(later)
```

Files that change together live together; `pet/` is the portable module;
`page/` is demo-only.

## Global constraints

Full detail in `docs/SPEC.md` §13/§14; every ticket implicitly includes this:

- **Runtime:** Node ≥ 20.9.0; TypeScript strict; ESLint + Prettier clean;
  Vitest green.
- **Bundle:** JS ≤ 280KB gzip (three ≈ 165KB); CSS ≤ 20KB; fonts ≤ 120KB woff2
  subsetted (ship one type system).
- **Model:** Byte `.glb` ≤ ~500KB compressed, ≤ ~40k tris, textures ≤ 1024².
- **Perf:** 60fps on ~Pixel 5 / iPhone 11 through the full run; long frames
  (>32ms) ≤ 2 per 10s; CLS = 0; LCP < 2.0s; Lighthouse mobile Perf ≥ 90 /
  A11y ≥ 95 / Best-Practices 100.
- **Module purity:** `pet/fsm.ts` and `pet/retype.ts` import neither gsap nor
  three (pure, unit-tested). GSAP is allowed everywhere else in the module.
- **Copy:** hero lines ≤ 14 chars/line; exact phrase sets per SPEC §10.
- **No new runtime deps** beyond the locked stack without asking + a
  `DECISIONS.md` entry.
- **Git:** conventional commits; ≥ 1 commit/ticket; never commit a broken
  branch; one ticket per session, `/clear` between.
- **Graceful degradation:** no WebGL → hide canvases, static headline #1, page
  fully usable. JS disabled → static headline #1, no blank page.
  `prefers-reduced-motion` → blink stays; hops/dashes become fades; parallax
  off.
- **QA every ticket:** run the relevant browser-protocol subset (SPEC §15); log
  screenshots + findings to `docs/PROGRESS.md`.

## GSAP conventions

This project uses the installed `gsap-skills` for all GSAP work (see
`~/.claude/skills/gsap-core`, `~/.claude/skills/gsap-performance`, and sibling
skills for timelines/ScrollTrigger/plugins/utils). Conventions that apply
project-wide:

- **Register plugins once**, at module init — not per-call, not per-component.
- **Prefer transforms and opacity** (`x`, `y`, `scale`, `rotation`, `autoAlpha`)
  over layout-triggering properties (`width`, `height`, `top`, `left`); they
  stay on the compositor and avoid jank.
- **Scope with `gsap.context()`** and **branch with `gsap.matchMedia()`** —
  matchMedia covers both responsive breakpoints and
  `(prefers-reduced-motion: reduce)`; reduced motion should shorten/skip
  animation, not just look the same faster.
- **Use `gsap.quickTo()`** for anything updated at high frequency (cursor
  follower, eye tracking) instead of creating a new tween per update.
- **Drive the render loop off `gsap.ticker`** so animation and any WebGL/rAF
  draw share one clock.
- **Always `revert()`/`kill()` on teardown** — contexts, matchMedia instances,
  and any stored tween/timeline reference — so nothing keeps animating or
  leaking after a scene or component goes away.
