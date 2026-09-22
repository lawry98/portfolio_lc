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

## T7 — Sound & custom cursor  ✅ DONE

> **DONE (2026-08-25, commits `f15f18e..06f689e`, 8 commits).** A swappable **`SoundEngine`** interface (`src/pet/sound/SoundEngine.ts` — `unlock/setEnabled/enabled/play/setMaster`; `Cue = typeTick|eatA|eatB|spawnPop|themeWhoosh|wakeBoing|chirp`; + a `silentSoundEngine` no-op) with a **zero-asset WebAudio synth** (`webAudioSynth.ts` `createWebAudioSynth()` — lazy AudioContext, first-gesture `unlock()`, ON-after-gate with `byte:sound` localStorage persistence, `[0,1]` master clamp, degrade-to-silent, `resume()`-rejection safe). **Howler NOT added** (D-07 swap stays later); call sites are engine-agnostic (only `sound.play`). All 7 cues wired (`createBytePet.ts`/`feed.ts`): `typeTick` at the per-edit retype detector under a SHARED throttle with the caret spark (every 3rd edit; skips `total===0` + `reducedActive`; gate stays `retyping||entering` so the **entrance types audibly**); `eatA`/`eatB` alternate on the two chomps (single `eatA` reduced); `spawnPop` on toss; `themeWhoosh` in the `setTheme` wrapper (not construction); `wakeBoing` on wake; `chirp` on peek. Custom cursor (`src/lib/cursor.ts` `initCursor()`): fixed dot → labeled pills **FEED/TOGGLE/OPEN** via a `main.ts` zone resolver (`a[href]`→OPEN, toggles→TOGGLE, `#hero`→FEED), gsap.quickTo follow, **no pills on touch** (`matchMedia('(hover:hover) and (pointer:fine)')`). Nav **EQ 3-bar toggle** + `(click to enable sound)` gate label + first-gesture `pointerdown`/`keydown` unlock (`index.html` / `page/hero.ts` `initSoundControls` / CSS; EQ animates only when `enabled && unlocked`; reduced-motion static). Style-Lab **tooltip on/off axis** (`page/lab.ts`, flips `data-tooltip`) + a `still hungry` runtime tooltip (`main.ts`, eaten≥3 AND `data-tooltip='on'`, CLS-safe). `fsm.ts`/`retype.ts` stay PURE. **No new deps.** Budgets: JS **207.34KB gz** / CSS **3.26KB gz** (≪ 280/20). Build/lint/format/`vitest` (**207/207**; +31: 14 synth, 10 cursor, 7 hero-sound) green. Via `subagent-driven-development`: **6 tasks + per-task reviews + 2 fix rounds (T1 rejected-`resume()`; T4 keyboard unlock) + scoped re-reviews + Opus whole-branch review (Ready=YES; all 12 deferred minors carried) + controller browser QA (PASS)**. DECISIONS **D-15**; rulings R7-1..8. Branch stays OPEN (no merge; T8–T10). Audit trail: `.superpowers/sdd/t7-plan/`.

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

## T8 — Migration, theme reaction & Style-Lab complete  ✅ DONE

> **DONE (2026-08-26, commits `6c92333..eb38c80`).** Byte now travels hero↔footer, retypes the footer CTA, happy-spins when fed mid-travel, reacts to theme toggles, and the Style Lab is complete. Shipped: pure **`pickAnchor`** home-selection (`pet/anchor.ts` + 7 tests); reachable **`traveling`** state + **`MIGRATE`/`ARRIVED`** events + feed-while-traveling routing (`eating --ATE--> traveling`, `feedFromTraveling` flag provably cleared on every exit; +15 fsm tests); switchable **active-home** model (`setHomeAnchor`, per-home caret/`data-byte-line`/cycle/`phraseIndex`) + **footer retype by REUSING the single `createRetype`/`onTick` engine** (D-13/D-14 — no second typing path); scroll-driven **REVERSIBLE** hero↔footer **migration lane** (live `pickAnchor` every tick drives lane + arrival, so a mid-trip scroll reversal re-homes — R8-2); **feed-while-traveling = eat + 360° `rotation.y` spin, NO retype** + single-source `GLYPH_KINDS` (union derived from the list); **theme reaction** — `scene.ts` GSAP lights lerp + `applyTheme(t,{animate})` ~400ms Body/Glow crossfade + Byte full-height `scale.y` stretch (~1.18×`unitPx`) + dark phosphor glow, coexisting with T7's single `themeWhoosh`, reduced-motion instant; **Style Lab** glow(4)+phrase-set(3) axes + **"Copy locked config"** (prints the 4 defaults); **lab→Byte wiring** (`setGlowAccent`/`setPhrases` via a `<html>` `MutationObserver` reading the `--glow` token); + T7 cleanups (memoized cursor label, dropped the vestigial `initSoundControls` `cursor?`). `fsm.ts`/`retype.ts`/`anchor.ts` stay **PURE** (no gsap/three/wall-clock/`Math.random`). **No new deps.** Budgets: JS **209.41KB gz** / CSS **3.29KB gz** (≪ 280/20). Build/lint/format/`vitest` (**229/229**, +22 vs T7's 207) green. Via **subagent-driven-development**: 8 tasks + per-task reviews (2 fix rounds — T3 committed-`__byteQA` + one-caret R8-1; T4 reversible migration R8-2) + **Opus whole-branch review** (Ready-with-fixes) + 1 final fix wave (`eb38c80`: `traveling` reacquire-kill; reduced-motion migration in-band gate; glow-accent encapsulation) + scoped re-review (all addressed) + **controller browser QA — PASS (both themes × 3 viewports 1440/768/390, zero console errors)**. One account session-limit blip (an Opus implementer dispatch failed once mid-T4; Sonnet sufficed). DECISIONS **D-16**; rulings **P-1/P-2/P-3, R8-1..R8-4**. Branch stays **OPEN** (no merge; T9–T10). Full audit trail: `.superpowers/sdd/t8-plan/progress.md`.

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

## T9 — Hardening (a11y, reduced-motion, memory, mobile)  ✅ DONE

> **DONE (2026-08-27, commits `97a7d6e..89f740f`, 6).** Byte is now accessible, reduced-motion-correct, leak-free, and mobile-solid. New **pure** `pet/a11y.ts`: `createPhraseThrottle` (leading + trailing-coalesce, injected time, zero imports) + an `announcePhrase` executor (a lazily-built, visually-hidden **polite `aria-live`** region — **pre-created EMPTY at construction** so the FIRST announce registers with the AT, **torn down in `destroy()`**), wired at the single `handleEnterRetyping` seam so the retyped phrase is announced verbatim (hero + footer, full + reduced) but the **entrance is not** (+9 throttle + 3 region-lifecycle tests). **Keyboard feed**: a reveal-on-focus `<button>Feed Byte</button>` (visually-hidden until `:focus-visible`, revealed ≥44px `position:fixed` with an `--accent` ring, wired in `main.ts`, hidden on the no-WebGL floor); `feed()` now sends `POINTER_DOWN` (wake) **then** feeds, with `onPointerDown` collapsed to reuse it — ONE wake-then-feed entry for pointer AND keyboard. **Reduced-motion audit**: Byte self-detects **live** (`main.ts` drops `reducedMotion` from the `createBytePet` call → its own `gsap.matchMedia()` — matching every page module; the boot capture still keys the one-time entrance branch), verify-sweep confirmed (parallax off / migration simplified / blink stays / grain frozen). **Memory**: the per-frame `THREE.Color` allocation is hoisted out of `applyTheme`'s lerp `onUpdate` (+ `setDimmed`) into reused scratch Colors (copy contract `rig.setBodyColor`→`.set()` verified + guarded, +2 tests); the 50-feed heap is QA-confirmed leak-free (scene mesh count 6→6, front-layer children → 1). **Mobile**: ≥44×44 touch targets (nav toggles 40→44 via `min-inline/block-size`, footer email padded to ~46) with the visual icons untouched; no cursor pills on touch + no horizontal overflow re-verified. Canvases were **already** `aria-hidden` + `pointer-events:none` + non-focusable (verified, no change). **No new deps.** JS **209.90KB gz** / CSS **3.41KB gz** (≪ 280/20; +0.49/+0.12 vs T8) / **243 tests** (+14). Via subagent-driven-development: 5 tasks + per-task Opus reviews (Task 2 recovered after a mid-edit machine-sleep crash — working tree ADOPTED + verified, not reset) + **Opus whole-branch review** (Ready-with-1-fix) + 1 fix wave (a11y first-announce region pre-create + teardown) + scoped re-review + **controller browser QA — PASS** (both themes × 1440/768/390, live-region announce incl. first feed, keyboard feed, feed()-wakes, 50-feed heap, touch targets, zero console errors). **DECISIONS D-17**; the P-2 halo sprite stays deferred (owner/T10 polish). Branch stays **OPEN** (no merge; T10). Reduced-motion-live behavior + a true 60fps sample are the on-device T10 checks (not pane-emulable). Audit trail: `.superpowers/sdd/t9-plan/progress.md`.

**Goal:** Accessible, reduced-motion-correct, leak-free, mobile-solid.

**Depends on:** T8.

**Files — Modify:** across `src/` as needed. **Create:** `src/pet/a11y.ts` (live-region announcer).

**Produces:** `announcePhrase(text:string): void` (throttled polite `aria-live` region announcing the final phrase after a retype).

**Key work:** canvases `aria-hidden`; keyboard path (feed via keyboard on focused zone; visible focus styles); full `prefers-reduced-motion` audit (blink stays; hops/dashes→fades; parallax off; migration simplified); **50-feed heap check** stable; mobile pass (hit areas, 60fps, no pills, layout).

**DoD / QA:** keyboard-only run completes the loop; reduced-motion run has no hops/parallax; live-region announces phrases (throttled); heap stable after 50 feeds; mobile screenshots clean. Commit `feat: a11y, reduced-motion audit, memory + mobile hardening`.

---

## T10 — Perf & release  ✅ DONE

> **DONE** (2026-08-27; T10 range `1a2028c..c7995dd` + the DONE-docs commit; **D-18**). Release-ready: a build-time `lockFontsPlugin` ships **one type system** (Space Grotesk only, ~26 KB) while dev keeps all 3 for `?lab` (dev-gated out of prod); `vite.config.ts` pins ports, accepts the raw-chunk exception (**R10-3**), and emits source maps; `README.md` + `docs/INTEGRATION.md` + `docs/qa/README.md` written. Budgets JS **206.4** / CSS **3.34** / fonts **26.15** KB gz (≪ 280/20/120). **Lighthouse mobile: Perf 96 / A11y 100 / BP 100 / CLS 0** after the a11y+BP fix wave (SplitText `aria:'none'`, AA-contrast `--muted`, favicon, source maps); **LCP 2.3 s accepted** (eager `three` — lazy-load is a noted future perf ticket). GIF + true-60fps/heap/reduced-motion/migration-2nd-leg + a screen-reader spot-check are on-device residuals recorded in `docs/qa/`. No `src/pet/*` change; **250 tests** green. **Branch stays OPEN (no merge — owner's call, for the late T-GLB / T-Audio swap-ins).** Audit trail: `.superpowers/sdd/t10-plan/`.

**Goal:** Budgets enforced, documented, and a recorded loop — ready to show.

**Depends on:** T9.

**Files — Create:** `README.md`, `docs/INTEGRATION.md`, `docs/qa/` (GIF + shots). **Modify:** `vite.config.ts` (final subsetting/analyze).

**Key work:** subset the **chosen** font only; bundle analysis vs the JS/CSS/font budgets; 10s rAF fps sampling during the full run; Lighthouse mobile; production `vite build` + `vite preview`; record a ~30s loop GIF via browser tooling → `docs/qa/`. `INTEGRATION.md`: how to mount `createBytePet` in the Next.js portfolio (React sketch: a client component mounts it in `useEffect`, passes `headlineEl`/`footerEl` refs, calls `destroy()` on cleanup; GSAP coexists with framer-motion).

**DoD / QA:** all budgets met (or documented exceptions); Lighthouse Perf ≥ 90 / A11y ≥ 95 / BP 100; GIF recorded; README + INTEGRATION complete. Commit `chore(release): perf pass, budgets, README + integration guide + loop gif`.

---

## T11 — First-visit cursor messaging _(owner play-test feedback)_

**Goal:** On a first visit the cursor carries exactly ONE message. Today it carries two — the `FEED`/`TOGGLE`/`OPEN` zone pill (T7, SPEC §8.7) and the `(click to enable sound)` gate hint (T7, SPEC §8.3) — stacked ~18px apart and describing the *same single click*, since the first-gesture unlock is a capture-phase `pointerdown` on `window` and a first click in the hero also feeds Byte.

**Depends on:** T7.

**Trigger:** Owner T6/T7 play-test feedback (recorded as pending in `PROGRESS.md`).

**Files — Modify:** `src/page/hero.ts` (set/clear the root flag), `src/styles/global.css` (one suppression rule), `src/page/hero.sound.test.ts` (flag lifecycle), `docs/SPEC.md` (§8.3 + §8.7), `docs/DECISIONS.md` (D-19).

**Explicitly NOT modified:** `src/lib/cursor.ts`, `src/main.ts` — the fix is a root-level CSS gate, so the cursor mechanism stays zone-blind and `main.ts`'s resolver stays the sole zone→label authority (**R7-4 preserved**, not re-litigated).

**Produces:**

- `.byte-sound-locked` on `document.documentElement` while audio is gated — a boolean root-state class mirroring `lib/cursor.ts`'s existing `.byte-cursor-active`, set in `initSoundControls` and cleared in `handleFirstGesture` alongside `removeGateLabel()`.
- `global.css`: `.byte-sound-locked .byte-cursor__pill { display: none; }` — specificity (0,2,1), so it beats both `.byte-cursor__pill` (0,1,0) and the existing `.byte-cursor__pill[hidden]` (0,2,0).

**Unit tests** (`hero.sound.test.ts`): the class is present on `<html>` after `initSoundControls`; removed after a first `pointerdown`; removed after a first `keydown` (keyboard-only parity, SPEC §12); and NOT set at all when the EQ button is absent (the existing early-return no-op path, so a stripped page never suppresses pills forever).

**Key work:** ALL pills suppressed pre-unlock, not just `FEED` — suppressing `FEED` alone merely relocates the collision to the `OPEN` and `TOGGLE` zones (verified by enumeration: `scope=feed` yields two simultaneous cursor messages over any link and over the theme/EQ buttons) and, since CSS cannot know which label the pill holds, would force exactly the `hero.ts`→`main.ts` coupling R7-4 rejected. Touch/coarse is unaffected: `initCursor()` builds no pill DOM there, so the rule is inert, and the gate keeps its `--static` corner variant. No new deps; no `src/pet/*` change.

**Out of scope (owner decision, recorded in D-19):** `createBytePet.ts`'s `(click to feed Byte)` invited hint stays as-is — it is page copy anchored under the headline, not a cursor label, so it never stacks with the gate. Note it is retired by `markHintPermanentlyDismissed()` on the *feed action*, not on being seen, so hiding it pre-unlock would permanently destroy the affordance for any visitor whose first click lands in the hero. Its post-unlock redundancy with the `FEED` pill is pre-existing and untouched.

**DoD / QA:** pre-unlock, no zone pill in ANY zone (hero, link, toggle, elsewhere) while the gate hint follows the cursor; after the first gesture (pointer OR key) the gate is gone and pills resume in all zones; `tsc --noEmit` strict + lint + `format:check` + full `vitest` green; before/after visual of the hero on a fine pointer. Commit `fix(cursor): serialize the sound gate ahead of the zone pills on first visit`.

**Owner-approved SPEC wording** (pin — do not re-derive):

- **§8.3** (currently _"muted until first click; `(click to enable sound)` label follows cursor until then; EQ icon animates when on."_) → append after "until then": _"; the cursor's zone pills stay suppressed until that gate opens, so a first-time visitor sees exactly one cursor message."_
- **§8.7** (currently _"custom cursor dot → labeled pills (`FEED` / `TOGGLE` / `OPEN`)"_) → qualify to _"custom cursor dot → labeled pills (`FEED` / `TOGGLE` / `OPEN`, post-unlock only — see §8.3)"_.

**Handoff notes (no owner input required to execute):**

- `npm install` has already been run in this worktree (clean, 0 vulnerabilities). Node via mise: `mise exec node@22 -- <cmd>`.
- The class goes in **after** `initSoundControls`'s `if (!button) return` guard — a page with no EQ button must never suppress pills (that's the 4th unit test).
- `D-19` is the next DECISIONS number (D-18 is the current head). Record the shipped test count in it, per the D-15/D-17/D-18 pattern.
- Execution: this is small enough to implement directly; the `subagent-driven-development` expansion `BRIEF.md` prescribes for T7-sized tickets would cost more coordination than the change contains.
- Suggested commits: `docs(t11): ticket for first-visit cursor messaging`, then the `fix(cursor): …` above carrying code + tests + D-19 + the SPEC amendments.

---

## T12 — Scroll bounds: stage clip, containment & hand-off fade  ✅ DONE

> **Renumbered on merge (2026-09-22).** Built and committed as **T11 / D-19 / R11-\*** on branch `lc/byte-pet-scroll-bounds-25b3c2`, in parallel with first-visit cursor messaging, which landed first under those numbers. Commit subjects and the `.superpowers/sdd/t11-plan/` audit trail keep the old label; everything else says **T12 / D-21 / R12-\***.

> **DONE (2026-09-01, commits `4288559..b9d7506`, 5 code commits + this docs commit; branch `lc/byte-pet-scroll-bounds-25b3c2`, base `4288559`).** Byte and everything the pet module draws are now confined to two bounded **stages**, so nothing paints over `#manifesto` or `#selected-work` at any scroll position — **supersedes SPEC §6's right-margin travel lane**. New **pure** `src/pet/stage.ts` (136 lines, **zero imports**, like `anchor.ts`/`fsm.ts`): `stageFromSection(section, furniture)` (the section box, bottom-inset to the topmost furniture rect — **one rule generates both stages**, design rows 2–3), `intersectViewport(stage, viewport)` (`null` = the render-skip signal, design row 8), `clampToStage(point, size, stage, pad)` (the point is the box **centre**) + `stage.test.ts` (**24 tests**). `scene.ts`: `SceneHandle.setStage(rect | null)` + `setOpacity(a)` — per frame both renderers take a **full clear with the scissor test OFF**, then the scissor box, then render; `null` clears both and skips the draws (**R12-3**: skipping `render()` alone freezes the last frame on the compositor). `setStage` is **tri-state** (`undefined` = unconfigured → unclipped, so `createScene` stays non-breaking — **R12-4**). The scissor takes **CSS px, not device px** (**R12-1** — three@0.185.1 multiplies by pixel ratio internally at `three.cjs:76805`; device px would clip to a quarter-size region on retina), Y-flipped `glY = viewportHeight - (stage.y + stage.height)`; the arithmetic was extracted in review fix rounds into exported pure **`scissorFromStage`** (+5 tests) and **`clampFeetToStage`** (+6 tests) beside `worldFromScreen`. `createBytePet.ts`: measures both sections + their furniture in `onTick`'s **existing** read batch (no second scroll listener), feeds the active stage (following `activeHome`) to `scene.setStage`, clamps Byte's root into it (`STAGE_CLAMP_PAD_PX` = 12, **R12-7** — at the home-pin seam, not `feed.ts`), and tweens opacity **1→0→1** across the hero↔footer hand-off over `STAGE_FADE_DURATION_S` (0.3s) via `fsm.onEnter` (**subscription only**, **R12-5**). `index.html`: three `data-byte-furniture` tags (`.hero__scroll`, `.footer__meta`, `.footer__copyright`) so `pet/` never names page CSS classes (**R12-6**); the footer lookup is `closest('section, footer')` (**R12-9** — `<footer id="footer">` is a `<footer>` tag and a sibling of `<main>`, so the bare selector returns `null` and the footer stage would silently never exist). **`fsm.ts` and all T8 migration logic UNTOUCHED** (design row 4; `fsm.test.ts`, 1103 lines, passes unchanged) — the lane still runs, clipped away for its whole traverse. **The fade is not the guarantee; the scissor is** (the "opacity is ~0 throughout traveling" rationale was ruled FALSE — `fsm.ts:388`'s `traveling --FEED--> dashing` restores opacity to 1 mid-trip — and corrected in the code comments). **Owner-visible:** the containment clamp is a **no-op at 1440×900** at both homes and the footer never clamps anywhere, but on narrower viewports it pulls the **hero** anchor left (**−23px @768×1024, −14px @390×844**) because the bound is the **section** box (scrollbar-excluded), not the viewport — required by the chosen edge behaviour (design demo option **C**, "the clip stays as a backstop that never fires"): unclamped, Byte's right edge overflows the section by 11px @768 and the scissor would visibly slice it. `STAGE_CLAMP_PAD_PX` (12) is the single tunable. **No new deps; no `src/` file outside `pet/` changed.** 928 insertions across 7 files. Budgets: JS **209.55KB gz** (T10 206.40; +3.15) / CSS **3.33KB gz** / fonts **26.15KB** unchanged (≪ 280/20). `npm test` (**285/285**, +35 vs T10's 250), `npm run lint`, `npm run format:check`, `npm run build` all clean. Via `subagent-driven-development`: **3 tasks + per-task reviews (Task 2 +1 fix round; Task 3 +1 fix round) + scoped re-reviews (all ADDRESSED) + controller geometry/scissor QA — 78 scroll positions × 3 viewports, ZERO overlaps, run against the real shipped `stage.ts`, plus an empirical DPR-2 WebGL scissor proof** (Y-flip exact to the pixel; R12-2's ghosting confirmed real). The 5 untracked `byte-bounds-*.html` design demos were deleted per the DoD. The **animated** DoD rows (hand-off fade on screen, mid-trip feed, occlusion weave, FED counter, reduced-motion on device) are **owner/on-device residuals** — the Browser pane's `visibilityState` is permanently `'hidden'` so rAF never fires and Byte never draws, and no real Chrome was connected; same limitation T10 recorded in `docs/qa/README.md` §4. DECISIONS **D-21**; rulings **R12-1..R12-9**. Branch stays **OPEN** — merging is the owner's call. Audit trail: `.superpowers/sdd/t11-plan/`.

**Goal:** Byte and everything the pet module draws stay inside the section they
belong to. Nothing ever paints over the APPROACH (`#manifesto`) or SELECTED WORK
sections — at any scroll position, in either theme, on any viewport.

**Depends on:** T8 (migration), T10 (release baseline).

**Why:** The two canvases are full-viewport `position: fixed` (`scene.ts:253–266`),
so nothing bounds them today. While `traveling`, Byte follows the visitor down a
right-margin lane (`MIGRATE_LANE_*`, `createBytePet.ts:201–218`) straight across
APPROACH. This ticket **supersedes** SPEC §6's "Between them it follows the
visitor down a right-margin lane."

**Settled design** (grilled with the owner 2026-09-01 — do not re-open a row
without asking):

1. Two bounded stages (hero + footer) with a fade hand-off; Byte is never visible between them.
2. Hero stage = `#hero`'s box, inset at the bottom to clear `.hero__scroll`.
3. Footer stage = `#footer`'s box, inset at the bottom to clear `.footer__meta` + `.footer__copyright`.
   One rule generates both: **the section box, inset to clear its furniture.**
4. `fsm.ts` and all T8 migration logic stay **untouched** — lane travel becomes invisible for free once the clip exists.
5. Clamp Byte's wander/dash targets into the active stage (containment); keep the hard clip underneath as a backstop.
6. Opacity is 1 whenever Byte is homed; a GSAP tween runs 1→0→1 **only** across the hero↔footer hand-off. No per-frame opacity math.
7. Clip via the **WebGL scissor test** on both renderers.
8. Skip both renderers entirely when neither stage intersects the viewport.

**Files — Create:** `src/pet/stage.ts`, `src/pet/stage.test.ts` (PURE).
**Modify:** `src/pet/scene.ts` (scissor + render skip), `src/pet/createBytePet.ts`
(stage tracking, target clamping, hand-off fade), `src/pet/types.ts`
(`StageRect` + `SceneHandle.setStage`), `docs/SPEC.md` (§6 travel lane),
`docs/DECISIONS.md` (**D-21**), `docs/PROGRESS.md` (QA log).

**Produces** — `pet/stage.ts`, pure like `anchor.ts`/`fsm.ts` (imports neither
gsap nor three; no DOM, no `window`, no clock, no `Math.random`):

- `interface StageRect { x: number; y: number; width: number; height: number }`
- `stageFromSection(section: Rect, furniture: readonly Rect[]): StageRect` — the section box inset at the bottom to clear the topmost furniture rect.
- `intersectViewport(stage: StageRect, viewport: Size): StageRect | null` — `null` when empty; that is the render-skip signal.
- `clampToStage(point: Point, size: Size, stage: StageRect, pad: number): Point` — containment.

**Key work:**

- `scene.ts`: add `setStage(rect: StageRect | null)` to `SceneHandle`. Per frame, when non-null set `setScissor`/`setScissorTest(true)` on **both** renderers (device px, Y flipped — GL's origin is bottom-left, the DOM's is top-left); when null, skip both `render()` calls.
- `createBytePet.ts`: measure both section boxes + their furniture on scroll/resize via the **existing** `onTick` measurement seam (do not add a second scroll listener); feed the active stage to `scene.setStage`; clamp wander/dash targets; tween opacity across the hand-off.
- Reduced motion: keep both the clip and the fade — opacity-only is the reduced-motion-safe idiom, and `runMigrationReduced` (`createBytePet.ts:1722`) already snaps without a lane.

**DoD / QA:**

- Full-page scroll in both themes at 1440×900 / 768×1024 / 390×844: Byte, its shadow, tossed glyphs and particles are **never** visible over `#manifesto` or `#selected-work`. Screenshots → `docs/PROGRESS.md`.
- Byte still retypes the hero headline, still migrates, still retypes the footer CTA; the FED counter still increments.
- Occlusion weave intact (Byte passes behind a letterform) — SPEC §15's occlusion screenshot.
- Reduced-motion pass: no lane, clip still holds.
- `npm test` green (250 baseline + new `stage.test.ts`); `npm run lint`, `npm run format:check`, `npm run build` clean.
- Delete the five untracked `byte-bounds-*.html` design demos from the repo root before the final commit.

Commits: `feat(pet): bound Byte to hero/footer stages via scissor clip + hand-off fade`, then `docs(t11): supersede SPEC §6 travel lane, add D-19`.

---

## T-GLB — Byte GLB swap-in _(model delivered 2026-08-27)_

**Goal:** The real Byte replaces the procedural placeholder everywhere it appears: entrance, idle brain, feeding, retype, peek, sleep/wake, migration and theme reaction. The placeholder survives only as the fallback while the model loads or if it fails.

**Depends on:** T4 (rig interface), T12 (stages; this ticket builds on PR #8).

**The delivered asset** (`/Volumes/SD500/Documents/blender/byte.glb`, audited 2026-09-22 against `ASSET_SPEC.md`):

- One glTF binary scene, Y-up, faces +Z, feet at y=0, **1.80 units** tall, a single `ByteRoot`, no cameras or lights. **36,283 tris**, no textures.
- `EXT_meshopt_compression` (required) and `KHR_materials_emissive_strength`. **728,928 B** raw, **525,126 B** gzipped.
- Materials `Body`, `Glow` (emissive mint, strength 1.86) and an extra `Visor`.
- A 15-bone skin (`Root`, `Torso`, `Head`, legs, arms). `EyeL`, `EyeR`, `VisorMesh` and the `Mouth` locator are children of the `Head` bone. There is no `Eye` node, so the mapper falls back to `Head`.
- All seven clips, every bone keyed with translation, rotation and scale. Root motion is in place: `Root` is constant in every clip, and vertical motion lives on `Torso`.

**Authored clip beats** (decoded with three's own loader, 2026-09-22):

| Clip | Length | Loop | Beats |
|---|---|---|---|
| `Idle` | 3.00 s | loop | ±1.3° torso sway, ±2.6° head tilt, no vertical bob |
| `Hop` | 1.17 s | once | crouch to 0.13 s, takeoff 0.20 s, apex **0.50 s** (+0.165 u, 9% of height), land 0.80 s |
| `Dash` | 0.67 s | loop | 12° forward lean, bouncing run cycle |
| `Eat` | 1.33 s | once | bites at **0.33 s** and **0.60 s** (head nods +8°), satisfied bounce at 0.90 s |
| `Sleep` | 4.00 s | loop | slumped (torso −0.025 u, head nod 10°), breathing |
| `Wake` | 1.25 s | once | starts from the Sleep pose, jolt at 0.20–0.33 s, head shake to 0.90 s, settled by 1.18 s |
| `Peek` | 1.67 s | once | starts and ends crouched (−0.34 u), rises through 0.1–0.7 s, peers 0.7–1.1 s, drops 1.3–1.6 s |

**Settled design** (grilled with the owner 2026-09-22 — do not re-open a row without asking):

1. **Load timing.** The fetch starts when `createBytePet` is constructed, and the preloader waits for it inside its existing 4 s cap: the gate becomes `Promise.all([whenFontsSettled(), delay(PRELOADER_MIN_MS), race(modelReady, delay(PRELOADER_FONTS_FALLBACK_MS))])`, so it still resolves within 0.9–4 s. Usually the real Byte drops in from the first frame. A late model means the placeholder drops in and the real Byte swaps in when it lands. A failed load keeps the placeholder for the session.
2. **Ship the asset as delivered.** Copy it to `public/models/byte.glb` unchanged. The 525 KB gzip (~5% over the soft 500 KB target) is an accepted exception, recorded in DECISIONS.
3. **Branching.** T12 lands first (PR #8). T-GLB builds on top of it.
4. **Cursor look = both.** A half-strength head turn (the rig's existing clamps, ±0.35 rad yaw and ±0.16 rad pitch, at 0.5×) is applied to the `Head` bone *after* each mixer update. At the same time `EyeL`/`EyeR` slide across the visor, up to 0.07 × 0.045 model units at 0.8× of the look.
5. **Size = 1.25 × the headline font-size.** One constant multiplies `unitPx` at its source, so it applies to both rigs and every Byte-relative distance (half-height pin, stage clamp box, shadow, glyph and toss sizes) scales with it.
6. **Timing follows the clips.** The choreography moves to the authored beats:
   - feed bites end at 0.33 s and 0.60 s;
   - the FSM wake window is 1.25 s, passed through `createFSM` config so `fsm.ts` stays untouched;
   - the peek lasts 1.667 s, with the behind/front canvas swaps at 0.2 s and 1.45 s.

   The placeholder's GSAP-faked `Eat`/`Wake`/`Peek` are retimed to the same beats so a fallback stays in sync.
7. **One swappable rig.** `createBytePet` and `feed.ts` keep a single `PetRig` whose `object3d` (root) and `pose` groups are stable. The placeholder lives inside at boot, and `swap()` replaces it with the GLB rig, re-applying the current clip, body color, glow level, opacity, blink and look. Rebuilding the pet was ruled out (it loses FSM, phrase and FED state), and so was "no late swap" (it contradicts row 1).
8. **The swap moment.** If Byte is `hidden`, the swap is instant and invisible. Otherwise it waits for the next resting state (`idle`, `curious`, `invited` or `sleeping`), never mid-dash, eat, retype, travel, peek or wake. It then plays a ~0.3 s pop: the old content squashes out on `pose.scale` and the new one springs back with `back.out`. Under reduced motion the swap is instant.
9. **The loader is a dynamic `import('./glbLoader')`.** `GLTFLoader` plus `MeshoptDecoder` form their own ~33 KB gz chunk and the entry chunk stays unchanged. This narrowly revises R10-3 ("no code-splitting") because here there's a real critical-path saving. The never-shipped DRACO wiring (`/draco/` path, `DRACOLoader`) is removed.
10. **Theming per D-11.** `Body` is recolored with today's palette (`bodyColorForTheme`), replacing the authored off-white. `Glow` is mint at 0.6 emissive in dark mode and 0 in light mode, where the eyes read as unlit mint. `Visor` stays as authored.
11. **Clip playback.** `Idle`, `Dash` and `Sleep` loop. `Hop`, `Eat`, `Wake` and `Peek` play once, clamp, and hand back to `Idle`. Every change crossfades over 0.2 s. `ClipPlayOptions.loop` forces a one-shot to repeat, and `onComplete` fires on the mixer's `finished` event. The mixer advances in `rig.update(dt)` on the shared `gsap.ticker`. Under reduced motion `rig.play()` is still never called (unchanged), so the model holds its rest pose while blink and look continue.
12. **Degrading per ASSET_SPEC §8.** A missing piece disables only that piece and never throws:
    - clip → hold the current pose, fire `onComplete` on the next tick, one `console.warn` per name;
    - `Body`/`Glow` → no recolor or glow;
    - `Head` → no head turn;
    - `EyeL`/`EyeR` → no eye slide or blink;
    - `Torso` → hover height 0;
    - `Mouth` → glyphs converge on the head.

    A load or parse failure logs one `console.warn` and resolves `modelReady` anyway.

**Files — Create:**
- `src/pet/glbRig.ts` + `glbRig.test.ts`: `createGlbRig`. Tests run the mixer against a synthetic skeleton, since `AnimationMixer` needs no WebGL.
- `src/pet/swapRig.ts` + `swapRig.test.ts`: `createSwappableRig`.
- `src/pet/glbAsset.test.ts`: a real-file smoke test that decodes `public/models/byte.glb` with `MeshoptDecoder` and asserts every name and clip, the height, tris ≤ 40k and the byte size, so a bad re-export fails the suite rather than the page.
- `public/models/byte.glb`.

**Modify:**
- `src/pet/types.ts`, `glbLoader.ts` + test (meshopt, new fields, DRACO removed), `rig.ts` + test (new methods, retimed fakes), `placeholderBot.ts` (unit-scaled content: `unitPx` moves to the swappable root).
- `createBytePet.ts`: `modelUrl` load, swap wiring, `modelReady`, and blink, hover, reduced-peek fade, theme glow lerp and entrance pose all go through the rig. The size constant and retimed peek/wake constants.
- `feed.ts` (bite beats), `src/page/preloader.ts` (model joins the gate) and `src/main.ts` (`modelUrl`, `modelReady`).
- Docs: `SPEC.md` (§4.2, §4.4, §6 peek/wake timing, §13, §14), `ASSET_SPEC.md` (delivered status, meshopt, the beats above as the re-export contract, 1.25×), `INTEGRATION.md` (host passes `modelUrl`, serves the file), `DECISIONS.md` (**D-22**), `PROGRESS.md`, `CLAUDE.md` (file map).

**Produces:**

- `PetOptions.modelUrl?: string`: absent means placeholder only, byte-identical to today.
- `BytePetHandle.modelReady: Promise<void>`: settles once the GLB is live or has failed. It never rejects, and resolves immediately when there's no `modelUrl`.
- `PetRig` additions:
  - `readonly pose: THREE.Object3D`, the stable inner group for the entrance drop-in scale, the reduced-peek rise and the swap pop;
  - `setBlink(closed: boolean)`;
  - `hoverHeight(): number`, the lift as a fraction of Byte's height, for the shadow;
  - `setGlowLevel(level: number, accent)`, where 0–1 maps onto the on-intensity and `setGlow(on, accent)` becomes `setGlowLevel(on ? 1 : 0, accent)`;
  - `setOpacity(a: number)`, covering every material the rig owns, `Visor` included.
- `RigSource` additions: `eyes?: THREE.Object3D[]` (`EyeL`, `EyeR`), `torso?: THREE.Object3D`, `materials?: THREE.Material[]`.
- `createGlbRig(source: RigSource): PetRig`.
- `createSwappableRig(initial: PetRig): PetRig & { swap(next: PetRig, opts: { animate: boolean }): void }`.

**DoD / QA:**

- `npm test` green (296 baseline plus the new suites), and `npm run lint`, `npm run format:check` and `npm run build` clean.
- Budgets:
  - entry JS ≈ today (209.65 KB gz);
  - loader chunk ≈ 33 KB gz;
  - total ≤ 280 KB gz;
  - the model accepted at 525 KB gz.
- Browser QA in the Browser pane (rAF runs there now: the T-GLB design demo hit 60 fps), at 1440×900, 768×1024 and 390×844 in both themes:
  - the entrance with the model ready before the lift;
  - a slow model (placeholder, then the pop at rest);
  - a forced 404 (placeholder for the session, no errors beyond the one warning);
  - feed ×3 with the glyph arriving on the two bites, then retype and the FED counter;
  - peek behind a letter (the occlusion screenshot);
  - curious, invited, and the look (head plus eyes);
  - blink on the eyes;
  - sleep 30 s, then wake, then dash;
  - hero↔footer migration inside the T12 stages, plus the footer retype;
  - a theme toggle mid-dash;
  - the shadow reacting to `Hop`;
  - a 10 s perf trace (long frames ≤ 2 per 10 s) and a heap check after 50 feeds.
- Anything the pane can't emulate (reduced motion, a real phone) goes to `docs/qa/README.md` as on-device rows.
- Delete the untracked `byte-glb-demo.html` design demo before the final commit.

Commits: `feat(pet): swappable rig + GLB rig (mixer, look, blink, materials)`, `feat(pet): load byte.glb behind the preloader gate (modelUrl, modelReady)`, `feat(pet): retime the choreography to the delivered clips`, then `docs(t-glb): record the swap-in, D-22, QA`.

---

## T-Audio — Howler swap-in _(when audio files delivered)_

**Depends on:** T7 (SoundEngine interface). **Trigger:** files in `public/audio/` per `AUDIO_SPEC.md`.

**Key work:** add `howler` dep (+ DECISIONS entry); implement `createHowlerFiles(): SoundEngine` loading the sprite/segment map; swap it in behind the same interface (no call-site changes); keep synth as fallback.

**DoD / QA:** all cues play from files; gate/unlock intact on mobile; bundle/asset budget checked. Commit `feat(sound): howler files engine + sprite swap-in`.

---

## Self-review (against SPEC)

- **Coverage:** SPEC §4 → T3/T4/T-GLB; §5 → T4/T-GLB (ASSET_SPEC); §6 states → T4/T5/T6/T8; §7 lab → T2/T7/T8; §8 page → T1/T2/T6/T7/T11; §9 sound → T7/T-Audio; §10 copy → T2/T6; §11 theming → T1/T8; §12 a11y/reduced-motion → T9 (+ per-ticket); §13 budgets → Global + T10; §14 stack → T1; §15 testing → per-ticket + T9/T10. No uncovered section.
- **Type consistency:** `ClipName`, `PetRig`, `SoundEngine`/`Cue`, `RetypeFrame`, `PhraseSet` are defined once (T3/T4/T6/T7) and reused by name downstream.
- **No vague steps:** each ticket names real files, real signatures, real test targets, and a concrete DoD; bite-sized code steps are produced per ticket at execution.

## Execution handoff

Per `BRIEF.md`: **one ticket per session, `/clear` between.** At each ticket start I'll expand it into bite-sized TDD steps using **superpowers:subagent-driven-development** (recommended — fresh subagent per step-group, review between) or **superpowers:executing-plans** (inline, batched with checkpoints). T6 is a hard owner play-test stop.
