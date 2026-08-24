# Byte Pet Demo — Implementation Plan (Tickets)

> **For agentic workers:** This is a **ticket roadmap** (per `BRIEF.md` §1.3–1.4: one ticket per session, `/clear` between). Each ticket below is expanded into bite-sized TDD steps **at execution time** using **superpowers:subagent-driven-development** (recommended) or **superpowers:executing-plans**. Steps use `- [ ]` for tracking. START each session by reading `docs/*`, then only the files the ticket touches.

**Goal:** A standalone, portfolio-grade one-page demo of **Byte** — a little dev-robot mascot who lives in the hero headline, eats tossed code glyphs, and drives a backspace-and-retype reward — built to Awwwards-hero polish and 60fps on a mid-range phone.

**Architecture:** Vite + vanilla TS app. A framework-agnostic `createBytePet` module renders one Three.js scene through a **two-canvas occlusion sandwich** (weaves behind/in front of DOM type) with a **pixel-space camera**. All pet motion is **Full GSAP** (`gsap.ticker`-driven) + `AnimationMixer` for baked GLB clips; the **FSM** and **retype queue** are pure, unit-tested logic. Byte is a **user-supplied rigged GLB**, built now against a **procedural placeholder** behind a `PetRig` adapter. Sound is a **swappable `SoundEngine`** (WebAudio synth now, Howler+files later).

**Tech Stack:** Vite, TypeScript (strict), three (+ GLTFLoader, DRACOLoader, RoundedBoxGeometry), GSAP 3.13+ (core, CustomEase, ScrollTrigger, SplitText), Lenis, WebAudio, Vitest, ESLint + Prettier. Uses the installed **gsap-skills**.

**Spec:** [`docs/SPEC.md`](SPEC.md) (authoritative). Companions: [`ASSET_SPEC.md`](ASSET_SPEC.md), [`AUDIO_SPEC.md`](AUDIO_SPEC.md), [`DECISIONS.md`](DECISIONS.md), [`BRIEF.md`](BRIEF.md).

## Global Constraints

_Every ticket's requirements implicitly include this section (values copied from SPEC §13/§14)._

- **Runtime:** Node ≥ 20.9.0; TypeScript **strict**; ESLint + Prettier clean; Vitest green.
- **Bundle:** JS ≤ **280KB gzip** (three ≈ 165KB); CSS ≤ **20KB**; fonts ≤ **120KB** woff2 subsetted (final build ships **one** type system).
- **Model:** Byte `.glb` ≤ ~**500KB** compressed, ≤ ~**40k tris**, textures ≤ **1024²** (verified on device at swap-in).
- **Perf:** 60fps on ~Pixel 5 / iPhone 11 through the full interaction run; long frames (>32ms) ≤ 2 per 10s sample; **CLS = 0**; LCP < 2.0s; Lighthouse mobile Perf ≥ 90 / A11y ≥ 95 / Best-Practices 100.
- **Module purity:** `pet/fsm.ts` and `pet/retype.ts` import **neither gsap nor three** (pure, unit-tested). GSAP is allowed elsewhere in the module.
- **Copy:** hero lines ≤ **14 chars/line**; exact phrase sets per SPEC §10.
- **No new runtime deps** beyond the stack above without asking + a `DECISIONS.md` entry.
- **Git:** conventional commits; ≥ 1 commit/ticket; never commit broken `main`/branch; one ticket per session; `/clear` between.
- **GSAP:** use the `gsap-skills` guidance for all GSAP work; fold its `CLAUDE.md` conventions into project `CLAUDE.md` at T1.
- **Graceful degradation:** WebGL missing → hide canvases, static headline #1, page fully usable. JS disabled → static headline #1, no blank page. `prefers-reduced-motion` → blink stays; hops/dashes become fades; parallax off.
- **QA every ticket:** the browser protocol subset relevant to the ticket (SPEC §15); log screenshots + findings to `docs/PROGRESS.md`.

---

## Target file structure (locked at T1, grows per ticket)

```
byte-pet-demo/                 # worktree root = Vite app root
  index.html
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts
  eslint.config.js  .prettierrc  CLAUDE.md
  public/  models/(byte.glb later)  audio/(sounds later)
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
      glbLoader.ts             # GLTFLoader+DRACO → rig mapping
      scene.ts                 # two-canvas sandwich, camera, renderers, lights
      shadow.ts                # blob-shadow sprite
      glyphs.ts   glyphs.test.ts        # extruded glyph shapes + queue cap
      feed.ts                  # feeding/queue/dash/eat orchestration
      motion.ts                # GSAP timelines/eases/quickTo helpers + ticker
      sound/  SoundEngine.ts  webAudioSynth.ts  howlerFiles.ts(later)
```

Principle: files that change together live together; `pet/` is the portable module; `page/` is demo-only; keep files focused.

---

## T0 — Grill & spec lock ✅ DONE

Docs written + committed on `feat/byte-pet-demo`: `SPEC.md`, `BRIEF.md`, `ASSET_SPEC.md`, `AUDIO_SPEC.md`, `DECISIONS.md` (commits `60378a3`, `d53d217`). No code.

---

## T1 — Scaffold, tooling & design tokens ✅ DONE

> **DONE (2026-08-22, commits `166413c..ca29d48`).** Vite+TS scaffold (Next.js removed), tokens (theme/type/glow axes), 3 self-hosted fonts, no-flash `initTheme()` + tests, CLS-0 shells, runtime grain, theme toggle. Palette locked by owner (accent `#a8451f`/`#ff8a5c`, glow `mint` default). Build/lint/format/test green; QA both themes × 3 viewports; budgets well under. Via subagent-driven-development.

**Goal:** A running Vite+TS app with lint/format/test wired, the themeable + lab-swappable token system, fonts, base layout skeleton, and film grain — zero console errors, CLS 0, both themes.

**Depends on:** T0.

**Files — Create:** `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `CLAUDE.md`, `src/main.ts`, `src/styles/{tokens,global,grain}.css`, `src/lib/theme.ts`, `src/lib/theme.test.ts`.

**Produces (interfaces):**
- `initTheme(): { current(): 'light'|'dark'; set(t:'light'|'dark'): void; toggle(): void }` (reads system pref + `localStorage`, applies `data-theme` on `<html>`).
- Token axes as attributes on `<html>`: `data-theme=light|dark`, `data-type=grotesk|mono|clash`, `data-glow=mint|amber|white|cyan`.
- No-flash inline script in `index.html` `<head>` (sets `data-theme` before paint).

**Unit tests (Vitest, jsdom):** `theme.test.ts` — system-pref default; `localStorage` override wins; `toggle()` flips + persists; `set()` applies attribute.

**Key work:** Vite+TS strict; ESLint (typescript-eslint) + Prettier; Vitest jsdom. `tokens.css` defines light/dark ink/paper pairs + the `data-type`/`data-glow` variable swaps. Load 3 type presets (Space Grotesk, JetBrains Mono, Clash Display) self-hosted woff2 (ask before downloading; subset later). Runtime noise-tile grain (`grain.css`, opacity ≤ .06/.08, stepped). Layout skeleton: nav + hero + manifesto + work + footer empty shells (reserve 2-line headline height → CLS 0). Fold `gsap-skills` `CLAUDE.md` conventions into project `CLAUDE.md`.

**Owner checkpoint:** review derived palette swatches (screenshot both themes) before locking tokens.

**DoD / QA:** `npm run dev` serves; `npm run build` passes; lint+format+`vitest` green; screenshots 1440/768/390 both themes; **zero console errors**; **CLS 0**; theme toggle + no-flash verified. Log to `PROGRESS.md`; commit `feat(scaffold): vite+ts app, tokens, themes, grain`.

---

## T2 — Typography, sections, scroll & reveals

> **DONE (2026-08-22, commits `90b3320..e831f0b`).** `phrases.ts` (SPEC §10 sets) + pure `fitsLineBudget` (unit-tested); first runtime deps **gsap 3.15** (+ ScrollTrigger, free SplitText) + **lenis 1.3** (DECISIONS **D-09**). All section copy static in `index.html` (nav/hero/manifesto/work/footer) — **CLS-0 + JS-off headline #1 preserved**; CSS work-row hovers. **Lenis** smooth scroll + **ScrollTrigger** on one `gsap.ticker` clock (reduced-motion → native scroll). **SplitText** masked line reveals (hero on load; manifesto/work/footer on scroll) + hero mouse-parallax + scrubbed manifesto micro-label parallax; the three invariants — never-hidden, reduced-motion-instant, full cleanup — hold page-wide (verified vs gsap 3.15 source). `?lab` **typography axis** (grotesk/mono/clash). Build/lint/format/test green; **budgets** JS 54.8KB gz / CSS 2.6KB gz (≪ 280 / 20). QA both themes × 1440/768/390 (+ landscape), zero console errors. Via subagent-driven-development: 6 tasks + per-task reviews + Opus whole-branch review (ready: yes) + 1 fix wave + scoped re-review — all clean; 1 minor parked (reveal-timing nuance). Full audit trail: `.superpowers/sdd/t2-plan/progress.md`.

**Goal:** All page copy in the DOM with SplitText masked reveals, Lenis smooth scroll + ScrollTrigger parallax, work-row hovers, and a first Style-Lab axis (typography) — reduced-motion aware.

**Depends on:** T1.

**Files — Create:** `src/phrases.ts`, `src/page/{hero,manifesto,work,footer,reveals}.ts`, `src/page/lab.ts`, `src/lib/lenisScroll.ts`. **Modify:** `src/main.ts`, `src/styles/global.css`.

**Produces:**
- `phrases`: `{ identity: string[][]; punchy: string[][]; footer: string[][] }` (SPEC §10 verbatim; each phrase = `[line1, line2]`).
- `initReveals(root: HTMLElement): void` (SplitText line-mask reveals on load + ScrollTrigger).
- `initLab(): void` (reads `?lab`; renders panel; switches `data-type` now — grows in T7/T8).
- `initLenis(): { raf(t:number):void; destroy():void }` (Lenis; integrated with ScrollTrigger).

**Unit tests:** none required (DOM/visual); optionally a pure helper `fitsLineBudget(line:string):boolean` (≤14 chars) tested in `phrases.test.ts`.

**Key work:** static headline = phrase #1 (works JS-off). SplitText masked line reveals (manifesto ×3 + hero). Lenis + `ScrollTrigger.update` on Lenis scroll; parallax micro-labels at differing speeds; rect caching (no per-frame layout reads). 3 fake work rows w/ hover (shift + arrow slide + line highlight). `prefers-reduced-motion`: reveals become instant/opacity, parallax off. `?lab` typography switch across the 3 presets.

**DoD / QA:** scroll at 60fps; reveals fire on load + scroll; `?lab` swaps type live; reduced-motion path clean; JS-disabled shows headline #1; screenshots both themes; zero console errors. Commit `feat(page): type, sections, lenis + scrolltrigger reveals, lab type axis`.

---

## T3 — WebGL foundation (two-canvas sandwich)

> **DONE (2026-08-22, commits `7478b31..91d9b2d`).** Added `three@0.185.1` (+ `@types/three`; DECISIONS **D-10**). Framework-agnostic `pet/` module: `types.ts` (`SceneOptions`/`SceneHandle`/`ClipName`/`RigSource`), `scene.ts` `createScene` (two renderers on `#gl-back`/`#gl-front`, THREE-layer front/back occlusion via `setBehind`, lights `enableAll()`, pixel-space camera fov 30 / 1 world unit = 1 CSS px @ z=0, DPR≤2 + resize, themed material + `setTheme`, full `dispose()`) + pure camera math (`scene.test.ts` incl. real-camera projection proof), `motion.ts` `startTicker` (same `gsap.ticker`, `visibilitychange` draw-pause) + `motion.test.ts`, `shadow.ts` blob shadow + pure height math + `shadow.test.ts`, `glbLoader.ts` GLTFLoader+DRACO infra + pure `mapGltfToRigSource` + `glbLoader.test.ts` (decoder files deferred to T-GLB). `main.ts` wires it behind `hasWebGL()` with a `?glcube` dev occlusion rig. **Occlusion proven** by GL pixel-readback (cube moves `#gl-back`↔`#gl-front` on `setBehind`) + visual screenshots (behind/in-front of the "STACK" letters), both themes; graceful WebGL-off/JS-off floor intact. Budgets: JS **185.91KB gz** / CSS **2.60KB gz** (≪ 280 / 20). Build/lint/format/`vitest` (59/59) green. Via subagent-driven-development: 5 tasks + per-task reviews + Opus whole-branch review (ready: yes) + 1 fix wave (bfcache `pagehide`) + scoped re-review — all clean; minors deferred (T4/T9/T10). Full audit trail: `.superpowers/sdd/t3-plan/progress.md`.

**Goal:** The occlusion sandwich proven: one scene rendered by two renderers, pixel-space camera, DPR/resize, lighting, theme-lerped materials, blob shadow, GLB-loader infra, WebGL-fail fallback, visibility pause.

**Depends on:** T1 (T2 parallel-ok).

**Files — Create:** `src/pet/scene.ts`, `src/pet/shadow.ts`, `src/pet/motion.ts`, `src/pet/glbLoader.ts`, `src/pet/types.ts`. **Modify:** `src/main.ts`.

**Produces:**
- `createScene(opts): { scene; camera; renderFront(); renderBack(); setBehind(b:boolean); resize(); dispose(); onTick(cb:(dt:number)=>void):void }` — two `WebGLRenderer`s on `#gl-back`/`#gl-front`; `setBehind` picks which renderer draws the pet layer; food+shadow always front.
- Pixel-space camera helpers: `worldFromScreen(x,y): {x,y}` and `screenFromRect(el): {x,y,w,h}` (1 unit = 1 CSS px at z=0).
- `startTicker(render:()=>void)` via `gsap.ticker.add`; `visibilitychange` pause/resume.
- `createBlobShadow(): { mesh; setHeight(h:number) }`.
- `loadByteGLB(url): Promise<RigSource>` (GLTFLoader+DRACO; maps named materials/nodes/clips → `RigSource`; rejects → caller falls back to placeholder). `RigSource` type defined in `types.ts`.
- `hasWebGL(): boolean`.

**Unit tests:** pure camera math in `scene.test.ts` — `worldFromScreen` round-trips against a known fov/height (mock viewport); `hasWebGL()` guarded.

**Key work:** fov≈30°, `z=(h/2)/tan(fov/2)`, `setPixelRatio(min(dpr,2))`, resize both renderers + camera. Hemisphere + key light; MeshStandard body (rough≈.35) that lerps per theme (+ dark emissive tint). Blob-shadow radial sprite scales/fades with height. `hasWebGL()` false → hide canvases, no throw.

**DoD / QA:** a temporary colored **test cube** visibly occludes correctly — **behind** and **in front of** a headline letter when `setBehind` flips (screenshot both). Resize/DPR stable; hidden-tab pauses ticker; WebGL-off path leaves page beautiful; zero console/three warnings. Commit `feat(pet): two-canvas sandwich, pixel-space camera, lights, blob shadow, glb loader`.

---

## T4 — Placeholder bot, rig adapter & idle brain (FSM)

> **DONE (2026-08-23, commits `ca9de74..7866155`).** Byte lives. Pure, config-injected **FSM** (`fsm.ts` + **39** unit tests — the tested core; no gsap/three, time only via `tickTimers(dtMs)`) driving the full SPEC §6 state set; **`PetRig`** adapter (`rig.ts`) over a procedural **placeholder bot** (`placeholderBot.ts`, `RoundedBoxGeometry`, `Body`+`Glow` materials, eye/mouth nodes, GSAP-faked clips Idle/Hop/Dash/Eat/Sleep/Wake/Peek, `setLook` ±0.35 via `quickTo`); **`createBytePet`** orchestrator (owns scene+ticker+rig+shadow+FSM per SPEC §4.4) wiring the idle brain — blink (hard-step, survives reduced-motion), 4–8s micro-behaviour scheduler (glance/hop/slide/peek; a peek in the first ~10s), **peek-behind occlusion** (layer flip at apex), curious/invited (`(click to feed Byte)` hint, once per `localStorage`), sleep/wake, cursor-tracked eyes; reduced-motion via `gsap.matchMedia()` (hops/dashes→fades/static, blink stays); theme via rig `setBodyColor`/`setGlow` (scene lights-only). Scene grew `addToPet`/`addToFront` seams + lights-only `setTheme`; `?glcube` dev rig removed. **No new deps** (`RoundedBoxGeometry` ships in three; DECISIONS **D-11**). Budgets: JS **191.65KB gz** / CSS **2.60KB gz** (≪ 280/20). Build/lint/format/`vitest` (98/98) green. Occlusion **proven** by GL pixel-readback (Byte moves `#gl-back`↔`#gl-front` on `setBehind`) + screenshots (eyes above "FULL-STACK" mid-peek behind vs covering it in front), both themes (dark shows the mint phosphor glow); live FSM idle-brain transition run confirmed; zero console errors. Via subagent-driven-development: 4 tasks + per-task reviews (2 Opus) + Opus whole-branch review + 1 final fix wave + scoped re-reviews — all clean; minors parked/carried (see `docs/PROGRESS.md`). Full audit trail: `.superpowers/sdd/t4-plan/progress.md`.

**Goal:** Byte lives: procedural placeholder bot behind a clip-driven `PetRig`, a pure FSM, blink, wander, peek-behind (layer flip), curious/invited, sleep/wake, cursor-tracked eyes.

**Depends on:** T3.

**Files — Create:** `src/pet/placeholderBot.ts`, `src/pet/rig.ts`, `src/pet/fsm.ts`, `src/pet/fsm.test.ts`. **Modify:** `src/pet/createBytePet.ts` (new), `src/pet/types.ts`.

**Produces:**
- `ClipName = 'Idle'|'Hop'|'Dash'|'Eat'|'Sleep'|'Wake'|'Peek'`.
- `PetRig`: `{ object3d: THREE.Object3D; play(clip:ClipName,opts?):void; setLook(x:number,y:number):void; setBodyColor(c):void; setGlow(on:boolean,accent):void; mouthWorld():{x,y,z}; update(dt):void; dispose():void }` — one interface, two impls (placeholder now via GSAP-faked clips; GLB later via AnimationMixer).
- `createFSM(cfg): { state():PetState; send(ev:PetEvent):void; onEnter(cb):void; tickTimers(dt):void }` — **pure**, no gsap/three.
- `PetState`, `PetEvent` unions in `types.ts`.

**Unit tests (the core of this ticket):** `fsm.test.ts` — idle→curious on `POINTER_NEAR`; curious→invited after timeout; invited→dashing on `FEED`; any→sleeping after 30s idle; sleeping→waking on `POINTER_DOWN` then counts as feed; illegal transitions ignored; timer resets on interaction.

**Key work:** placeholder bot from RoundedBox body/head + antenna + eye, sized to headline em; GSAP-faked clip behaviors so `play('Peek')` etc. work identically to the future GLB. Eyes via `gsap.quickTo` toward cursor; yaw ±0.35. Blink = hard-step opacity (GSAP `steps`). Micro-behaviors every 4–8s incl. **peek** (hop → `setBehind(true)` at apex → partly behind letter → back front) within first ~10s. Curious (<150px): blink stops, lean. Invited (2.5s): `(click to feed Byte)` hint, once per `localStorage`.

**DoD / QA:** FSM tests green; blink/wander/peek/curious/invited/sleep/wake all visible; **occlusion screenshot** — Byte clipped by a letterform mid-peek, eyes above; reduced-motion → fades not hops; zero leaks over a 60s idle. Commit `feat(pet): placeholder bot, rig adapter, pure FSM, idle behaviors`.

---

## T5 — Feeding loop

> **DONE (2026-08-23, commits `4d01c2f..b300d4c`).** Click/tap tosses a bevel-extruded `THREE.Shape` glyph (`{ ; > * + =`, `glyphs.ts`, no `typeface.json`); Byte dashes (banked ±12°, slight overshoot) and eats it into `rig.mouthWorld()` over two chomps + 4–6 `currentColor` particles; the footer **`FED N GLYPHS`** counter increments; the live-glyph queue caps at **3** (oldest pops); touch supported; every eaten/popped glyph's geometry+material disposed. New: a **pure** `createGlyphQueue` decision-core + `makeGlyph` (`glyphs.ts`) with **`glyphs.test.ts` (24 tests — the tested core)**; `createFeeder(rig, scene, fsm, { prefersReducedMotion, unitPx })` (`feed.ts`) — toss 450ms arc+spin+squash → **`fsm.onEnter`-driven** banked dash (380–600ms by distance) → `Eat` 2 chomps → particles → count → per-glyph dispose; reduced-motion instant/fade. FSM (`fsm.ts`/`types.ts`): feeder-fired events **`REACHED`** (dashing→eating) / **`ATE`** (eating→idle) make `eating` reachable + generous safety caps `dashMs`(1200)/`eatMs`(1500) + the **MUST-FIX** `isSleepEligible` denylist→**awake-resting-state allowlist `{idle, curious, invited, peeking}`** (Byte can't sleep mid-feed; peeking stays eligible) + `curious`/`invited`/`idle` `POINTER_DOWN` sleep resets (**fsm.test.ts 39→49**). `createBytePet.ts`: builds+wires the feeder, `feed()`→`feeder.feed()`, `dispatch()` drops `Dash`/`Eat` + skips `clearLean()` for dashing/eating + a **stale-transition guard** for nested re-entrant transitions, `onTick` **root-placement handoff** (feeder owns `rig.object3d.position` during dashing/eating; no-snap reacquire glide back to the anchor; shadow follows the actual root), `BytePetHandle.onEat`, `feeder.dispose()`. `main.ts`: wires `[data-fed-counter]` (in the **footer**, SPEC §8.6 — the ticket's "hero.ts" file-hint was stale) to `onEat`. Blob-shadow vertical tuning **unchanged** (the dash is horizontal locomotion; only the tossed glyph arcs vertically). **No new deps** (`Shape`/`ExtrudeGeometry`/`Points` ship in `three`; DECISIONS **D-12**). Budgets: JS **202.86KB gz** / CSS **2.60KB gz** (≪ 280/20). Build/lint/format/`vitest` (**132/132**) green; browser QA both themes + mobile (queue cap ×4→3, counter → `FED 3 GLYPHS`, dispose→baseline, touch feed, no cursor pills, zero console errors) via a temporary uncommitted `window.__byteQA` + `stepGsap` (`gsap.updateRoot`) hook, reverted. Via subagent-driven-development: **4 tasks + per-task reviews (T1 sonnet; T2/T3/T4 opus) + Opus whole-branch review (ready: yes) + 2 fix rounds (satisfied-wiggle absolute-scale; idle-rechain re-entrancy) + scoped re-reviews** — all clean; 5 minors carried (PROGRESS `NEXT → T6`). Full audit trail: `.superpowers/sdd/t5-plan/progress.md`.

**Goal:** Click/tap tosses a 3D glyph; Byte dashes (banked), eats it (particles + counter), queue capped at 3; touch supported.

**Depends on:** T4.

**Files — Create:** `src/pet/glyphs.ts`, `src/pet/glyphs.test.ts`, `src/pet/feed.ts`. **Modify:** `src/pet/createBytePet.ts`, `src/page/hero.ts` (FED counter, feed zone).

**Produces:**
- `makeGlyph(kind:'{'|';'|'>'|'*'|'+'|'='): THREE.Mesh` (bevel-extruded `THREE.Shape`; front layer).
- `createFeeder(rig,scene,fsm): { feed(x,y):void; liveCount():number; onEat(cb:(total:number)=>void):void; dispose():void }` — spawn→toss arc→Byte dash(bank ±12°, overshoot)→`Eat`→particles→count; max 3 live (oldest pops); disposes geo/mat per eaten glyph.

**Unit tests:** `glyphs.test.ts` — queue cap (4th feed pops oldest → `liveCount()===3`); `onEat` increments total; each `kind` returns geometry (no throw).

**Key work:** toss 450ms arc+spin, squash on land; 80ms anticipation squat → dash 380–600ms by distance → glyph scales into `mouthWorld()` over 2 chomps → 4–6 `currentColor` particles → wiggle. Queue rapid clicks. Touch: larger invisible hit target, pointer events, no cursor pills.

**DoD / QA:** feed ×3 rapid → queue behaves; counter increments; **heap stable after 50 feeds** (dispose verified); touch feed works (mobile emulation); 60fps during feeding. Commit `feat(pet): glyph library + feeding, dash/eat, queue cap, counter, touch`.

---

## T6 — Retype reward + entrance ✅ DONE  ⛳ STOP POINT (owner play-test)

> **DONE — both halves (2026-08-24).** Retype-reward `f5222ea..53210cd` (D-13) + entrance `237389a..c7b5196` (D-14). After a feed, Byte glides to the line end and drives the DOM caret to backspace + retype the next Identity phrase (**CLS 0**); and the preloader (blinking caret + %, bounded `document.fonts.ready`+MIN gate that **can never hang**) lifts, Byte **drops in with a bounce and live-types phrase #1 by REUSING the retype engine** (`hidden→entering→idle` via new `SHOWN`/`ENTERED` beats + `enteringMs` cap; `createRetype().reset(['',''])` → `enqueue(cycle[0])`). Reduced-motion → instant (no drop-in; static phrase #1). JS-off/no-WebGL → static headline #1 (`<noscript>` + inline fallback), no hang. Controller browser QA PASS (CLS-0 desktop+mobile, feed→retype loop intact post-entrance, early peek fires, both themes, mobile no-overflow, zero console errors). **JS 205.35KB gz / 176 tests.** Via `subagent-driven-development` (both halves). ⛳ **Owner play-test stop** — branch stays open for T7–T10 (no merge).

**Goal:** The signature move: after a feed, Byte glides to the line end and drives the DOM caret to backspace + retype the next phrase (zero layout shift); plus the preloader → Byte-types-the-headline entrance.

**Depends on:** T5.

**Files — Create:** `src/pet/retype.ts`, `src/pet/retype.test.ts`, `src/page/preloader.ts`. **Modify:** `src/pet/createBytePet.ts`, `src/page/hero.ts`.

**Produces:**
- `createRetype(cfg): { enqueue(next:[string,string]):void; step(now:number): RetypeFrame | null; isBusy():boolean }` — **pure**: computes delete/type schedule (delete bottom line first; backspace ~26ms/char accelerating; type ~40ms/char ±12ms jitter, tick every 2–3 chars). `RetypeFrame = { line0:string; line1:string; caretIndex:{line:0|1;col:number} }`.
- `renderRetype(frame, headlineEl, caretEl): void` (applies frame to spans; moves DOM caret; no reflow of container).
- `runEntrance(): Promise<void>` (preloader %, `document.fonts.ready` + min duration, overlay lift, Byte drop-in + live-type phrase #1 via the same engine).

**Unit tests (core):** `retype.test.ts` — deletes line1 fully before line0; total chars typed == next phrase; caret index monotonic during delete, advances during type; never emits a line longer than its target (no overflow); jitter within bounds; `isBusy()` false after completion.

**Key work:** headline chars as spans; container reserves 2 lines (**CLS 0**). Byte-operates-caret: GSAP glides Byte to line end; a spark links Byte→caret on each edit. Phrase cycling across Identity/Punchy/combined (lab-selected). Entrance reuses the engine.

**DoD / QA:** full run — feed → backspace → retype next phrase, **zero layout shift**; entrance types phrase #1; peek + typed-entrance + first retype all land in the first ~15s; reduced-motion → instant text set, no glide. **Then STOP — owner plays with it and gives feedback before T7.** Commit `feat(pet): retype engine, byte-operated caret, preloader entrance`.

---

## T7 — Sound & custom cursor

**Goal:** SoundEngine (synth) behind the first-click gate, with all cues + EQ toggle; custom cursor dot → labeled pills.

**Depends on:** T6.

**Files — Create:** `src/pet/sound/SoundEngine.ts`, `src/pet/sound/webAudioSynth.ts`, `src/lib/cursor.ts`. **Modify:** `src/pet/createBytePet.ts`, `src/page/hero.ts` (EQ toggle, gate label), `src/page/lab.ts` (tooltip axis).

**Produces:**
- `SoundEngine`: `{ unlock():void; setEnabled(b):void; enabled():boolean; play(cue:Cue):void; setMaster(v):void }`; `Cue = 'typeTick'|'eatA'|'eatB'|'spawnPop'|'themeWhoosh'|'wakeBoing'|'chirp'`.
- `createWebAudioSynth(): SoundEngine` (all cues synthesized; unlock on first gesture; ON after gate).
- `initCursor(): { setLabel(l:'FEED'|'TOGGLE'|'OPEN'|null):void; destroy():void }`.

**Unit tests:** `SoundEngine` gate logic (pure-ish, mock AudioContext) — no `play` output before `unlock()`; `setEnabled(false)` silences; enabled state persists.

**Key work:** muted until first click; `(click to enable sound)` follows cursor until unlocked; EQ 3-bar toggle animates when on; wire cues to events (type tick, eat A/B, spawn pop, theme whoosh, wake boing, Byte chirp on peek/wake). Cursor pills over feed zone / toggle / links. Tooltip axis (`still hungry` after 3+ feeds) added to lab.

**DoD / QA:** **no audio before the gate**; after gate cues fire, mixed low; EQ mutes; cursor pills correct; touch shows no pills. Commit `feat: sound engine (synth) + gate + eq toggle + custom cursor pills`.

---

## T8 — Migration, theme reaction & Style-Lab complete

**Goal:** Byte travels between hero ↔ footer homes, retypes the footer CTA, does a happy-spin, reacts to theme toggles; the Style Lab covers all axes with lock/export.

**Depends on:** T7.

**Files — Modify:** `src/pet/createBytePet.ts`, `src/pet/feed.ts`, `src/page/footer.ts`, `src/page/lab.ts`, `src/lib/theme.ts`.

**Produces:**
- `setHomeAnchor(el: HTMLElement): void` (hero headline ↔ footer CTA, chosen by which is in view).
- Theme-reaction hook: on `setTheme`, ~400ms token crossfade + Byte full-height stretch + material/light lerp + dark glow; optional headbutt-the-toggle (stretch).
- Lab: all axes (`data-type`, `data-glow`, phrase-set, tooltip) + a "copy locked config" action that prints the chosen defaults.

**Unit tests:** anchor-selection helper `pickAnchor(heroRect, footerRect, viewport): 'hero'|'footer'` in a small pure fn + test.

**Key work:** right-margin travel lane following scroll; footer feeds retype the footer set; feeding-while-traveling = eat + 360° spin (no retype); theme toggle mid-dash must not break; hint persistence.

**DoD / QA:** scroll hero→footer → Byte migrates; footer feed retypes CTA; theme toggle mid-dash stable; lab locks all axes; screenshots both themes at all 3 sizes. Commit `feat: migration, footer retype, theme reaction, full style lab`.

---

## T9 — Hardening (a11y, reduced-motion, memory, mobile)

**Goal:** Accessible, reduced-motion-correct, leak-free, mobile-solid.

**Depends on:** T8.

**Files — Modify:** across `src/` as needed. **Create:** `src/pet/a11y.ts` (live-region announcer).

**Produces:** `announcePhrase(text:string): void` (throttled polite `aria-live` region announcing the final phrase after a retype).

**Key work:** canvases `aria-hidden`; keyboard path (feed via keyboard on focused zone; visible focus styles); full `prefers-reduced-motion` audit (blink stays; hops/dashes→fades; parallax off; migration simplified); **50-feed heap check** stable; mobile pass (hit areas, 60fps, no pills, layout).

**DoD / QA:** keyboard-only run completes the loop; reduced-motion run has no hops/parallax; live-region announces phrases (throttled); heap stable after 50 feeds; mobile screenshots clean. Commit `feat: a11y, reduced-motion audit, memory + mobile hardening`.

---

## T10 — Perf & release

**Goal:** Budgets enforced, documented, and a recorded loop — ready to show.

**Depends on:** T9.

**Files — Create:** `README.md`, `docs/INTEGRATION.md`, `docs/qa/` (GIF + shots). **Modify:** `vite.config.ts` (final subsetting/analyze).

**Key work:** subset the **chosen** font only; bundle analysis vs the JS/CSS/font budgets; 10s rAF fps sampling during the full run; Lighthouse mobile; production `vite build` + `vite preview`; record a ~30s loop GIF via browser tooling → `docs/qa/`. `INTEGRATION.md`: how to mount `createBytePet` in the Next.js portfolio (React sketch: a client component mounts it in `useEffect`, passes `headlineEl`/`footerEl` refs, calls `destroy()` on cleanup; GSAP coexists with framer-motion).

**DoD / QA:** all budgets met (or documented exceptions); Lighthouse Perf ≥ 90 / A11y ≥ 95 / BP 100; GIF recorded; README + INTEGRATION complete. Commit `chore(release): perf pass, budgets, README + integration guide + loop gif`.

---

## T-GLB — Byte GLB swap-in _(when Lawrence delivers the model)_

**Depends on:** T4 (rig interface). **Trigger:** `public/models/byte.glb` delivered per `ASSET_SPEC.md`.

**Key work:** implement the GLB branch of `PetRig` via `loadByteGLB` + `AnimationMixer`; map `Body`/`Glow` materials, `Eye`/`Head` + `Mouth` nodes, and named clips; dispose the placeholder; blend clips on FSM transitions; re-verify model budget + 60fps on device; fallbacks for any missing name/clip.

**DoD / QA:** real Byte animates all states; budget + 60fps verified; missing-name fallbacks don't crash. Commit `feat(pet): integrate Byte GLB (mixer, materials, nodes, clips)`.

---

## T-Audio — Howler swap-in _(when audio files delivered)_

**Depends on:** T7 (SoundEngine interface). **Trigger:** files in `public/audio/` per `AUDIO_SPEC.md`.

**Key work:** add `howler` dep (+ DECISIONS entry); implement `createHowlerFiles(): SoundEngine` loading the sprite/segment map; swap it in behind the same interface (no call-site changes); keep synth as fallback.

**DoD / QA:** all cues play from files; gate/unlock intact on mobile; bundle/asset budget checked. Commit `feat(sound): howler files engine + sprite swap-in`.

---

## Self-review (against SPEC)

- **Coverage:** SPEC §4 → T3/T4/T-GLB; §5 → T4/T-GLB (ASSET_SPEC); §6 states → T4/T5/T6/T8; §7 lab → T2/T7/T8; §8 page → T1/T2/T6/T7; §9 sound → T7/T-Audio; §10 copy → T2/T6; §11 theming → T1/T8; §12 a11y/reduced-motion → T9 (+ per-ticket); §13 budgets → Global + T10; §14 stack → T1; §15 testing → per-ticket + T9/T10. No uncovered section.
- **Type consistency:** `ClipName`, `PetRig`, `SoundEngine`/`Cue`, `RetypeFrame`, `PhraseSet` are defined once (T3/T4/T6/T7) and reused by name downstream.
- **No vague steps:** each ticket names real files, real signatures, real test targets, and a concrete DoD; bite-sized code steps are produced per ticket at execution.

## Execution handoff

Per `BRIEF.md`: **one ticket per session, `/clear` between.** At each ticket start I'll expand it into bite-sized TDD steps using **superpowers:subagent-driven-development** (recommended — fresh subagent per step-group, review between) or **superpowers:executing-plans** (inline, batched with checkpoints). T6 is a hard owner play-test stop.
