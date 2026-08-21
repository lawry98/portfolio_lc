# SPEC — "Byte" interactive 3D pet demo

- **Status:** Locked (T0). Supersedes `docs/BRIEF.md` where they differ.
- **Date:** 2026-08-21
- **Owner:** Lawrence Crasto — Full-stack + AI Product Engineer
- **Branch / worktree:** `feat/byte-pet-demo` (off `main`), at `.claude/worktrees/byte-pet-demo`
- **Related docs:** [`BRIEF.md`](BRIEF.md) (original brief, verbatim) · [`ASSET_SPEC.md`](ASSET_SPEC.md) (GLB contract) · `TICKETS.md` (plan, written next) · `DECISIONS.md` + `PROGRESS.md` (added as we build)

---

## 1. Concept & goal

A super-polished, standalone one-page demo of an interactive 3D mascot — **Byte**, a little dev robot who lives inside the hero headline. Visitors click to feed Byte stray code glyphs (`{ ; > *`); it dashes over in 3D, eats them, and as a reward it **backspaces and re-types the headline** to a new phrase. The bar is Awwwards-nominee hero quality; smoothness is the product.

The standalone page ships first. Later phase: integrate Byte into Lawrence's real portfolio (Next.js 16 / React 19 / Tailwind 4 / shadcn / framer-motion). Byte is therefore built as a **framework-agnostic module** from day one.

Directly inspired by the feed-the-bee interaction on leoparpeix.com — we borrow the **techniques** (two-canvas occlusion sandwich, GSAP choreography, Lenis, sound gate, character weaving through typography), never his assets or character.

---

## 2. Deviations from BRIEF (intentional, approved in the grill)

The original brief describes "Pixel the Caret," a procedural caret. During the grill these were consciously changed:

| # | Brief said | SPEC decision | Why |
|---|---|---|---|
| D1 | Procedural caret character | **Byte, a little robot**, from a **user-supplied rigged `.glb`** | Owner wants a real modeled creature, not a caret. |
| D2 | Procedural everything, zero downloads | **GLB pipeline** (GLTFLoader + DRACO) + a **model budget** | Consequence of D1. |
| D3 | Build the final character now | **Placeholder bot now, swap real GLB later** | Owner supplies the GLB; I can't produce it. Avoids stalling. |
| D4 | Pet motion via GSAP CustomEase (implied hybrid) | **Full GSAP** for all motion (timelines / `quickTo` / `ticker`) + `AnimationMixer` for baked clips | Owner wants to learn GSAP; GSAP already in the bundle; frame-sync via `gsap.ticker`. |
| D5 | `createCaretPet(...)` | **`createBytePet(...)`** | Rename to the character. |
| D6 | Character "chunkiness" body presets (rect/plump/chunky) | **Dropped** — final look is the GLB | Body-shape presets were caret-specific. |
| D7 | Retype = the caret itself types | **Byte operates a DOM caret** — dashes to the line end and drives the backspace/retype (spark links them) | Byte isn't a caret; keeps the code-editor magic. |

Everything else in the brief stands unless noted below.

---

## 3. Locked decisions

| Area | Decision |
|---|---|
| **Character** | **Byte**, a little robot. Owner supplies a rigged `.glb` with baked clips. Built now against a **procedural placeholder bot** conforming to `ASSET_SPEC.md`; real model swapped in later. |
| **Animation** | **Full GSAP** (timelines, `quickTo`, `gsap.ticker`) drives motion-through-space + choreography. **`AnimationMixer`** plays baked clips (`Idle/Hop/Dash/Eat/Sleep/Wake/Peek`). GSAP orchestrates state transitions. **FSM + retype-queue logic stay pure & unit-tested** (they decide; GSAP/Mixer execute). |
| **Retype** | A blinking **DOM caret** remains in the headline. Byte is its **operator**: on feed it glides to the line end and drives backspace → retype (with a small spark linking them). Zero layout shift (2-line container reserved). |
| **Interaction (kept in full)** | Two-canvas weave (behind/in front of type); toss-to-feed 3D glyphs `{ ; > *`; dash + banking + chomp + particles + counter; peek-behind; curious/invited hint; sleep/wake; traveling lane + footer migration; theme reaction. |
| **Workspace** | New worktree `feat/byte-pet-demo` off `main`; standalone **Vite + vanilla TypeScript (strict)** app at worktree root. |
| **Page scope** | **Full one-pager**: preloader → hero → manifesto → selected-work (fake) → footer CTA. |
| **Deploy** | **Local only** this phase (`vite dev` + `vite preview` + a recorded loop GIF). No hosting. |
| **Perf floor** | **Mid-range phone, 60fps** (~Pixel 5 / iPhone 11 class) through the full interaction run. |
| **Typography** | Ship **3 lab-swappable presets** — ① Space Grotesk 700 + `ui-monospace`, ② JetBrains Mono (full-mono), ③ Clash Display + mono. Owner locks the winner. |
| **Glow accent** | Ship **4 lab-selectable** — mint / amber / white / cyan — applied to Byte's emissive `Glow` material + bloom halo (dark mode). Owner locks one. |
| **Palette** | Derive tasteful dark + light ink/paper pairs; owner reviews swatches at T1. |
| **Theme default** | Follow OS preference on load + persisted manual toggle; no-flash inline script. |
| **Sound** | WebAudio-synthesized (zero assets). Muted until first-click gate; **ON after gate**. Byte gets an **occasional soft chirp**. Set: eat blips, type tick, spawn pop, theme whoosh, wake boing. |
| **Mobile / touch** | Tap = feed, larger invisible hit target, **no cursor-pill labels on touch**; retype + migration still play; hold 60fps. |
| **Copy** | Hero cycles **both** phrase sets (lab-selectable Identity / Punchy / combined). Nav identity, footer CTA, hint, tooltip, counter — see §10. |
| **Contact** | Placeholder `hello@lawrence.dev` + placeholder GitHub / LinkedIn (`#`). Real values at integration. |
| **Style Lab** | `?lab` query-param panel to live-swap **typography, glow, phrase-set, tooltip**; production build hides it and hard-locks chosen defaults. |
| **Never-do** | No restrictions — full behavior repertoire (sleep, glow, sound, peek, migration). |

---

## 4. Architecture

### 4.1 Two-canvas WebGL sandwich + pixel-space camera
Two full-viewport, fixed, transparent canvases sandwich the DOM: `#gl-back` (behind all content) and `#gl-front` (above content, `pointer-events: none`). The crisp, selectable DOM headline sits between them. One Three.js scene + camera; **two `WebGLRenderer`s** render it each frame. Byte draws to **front or back** per a `behind` flag (food + shadow always front). Flip only at hop apexes / letter gaps so the switch is invisible — this makes Byte genuinely weave behind and in front of the letterforms while type stays DOM-crisp.

**Pixel-space camera:** `PerspectiveCamera` (fov ≈ 30°) at `z = (viewportHeight/2) / tan(fov/2)` → 1 world unit = 1 CSS px at the DOM plane (z=0). `world.x = screenX − w/2`, `world.y = h/2 − screenY`. DOM↔WebGL sync is `getBoundingClientRect()` → world coords. Handle resize + DPR (`setPixelRatio` clamped ≤ 2).

**Look:** soft clay. Hemisphere + gentle key light; no realtime shadows — ground contact is a **blob-shadow sprite** (radial gradient) that scales/fades with hover height. Dark mode adds a subtle emissive phosphor tint + faint glow halo sprite. No postprocessing pipeline in v1 (budget); film grain is a CSS overlay.

**Robustness:** WebGL unavailable → hide canvases, page stays fully functional (static headline #1, no pet). `visibilitychange` pauses the ticker. Dispose geometries/materials/textures for eaten food and on `destroy()` (verify no leak after 50 feeds).

### 4.2 Character pipeline — placeholder now, GLB later
- **Placeholder bot:** a procedural robot assembled from Three.js primitives (RoundedBox body/head, small antenna, eye), sized from the live headline font-size, that satisfies the same runtime interface as the real model: a body material to theme, a `Glow` material, an eye/head node for look-at, a mouth anchor for eating, and a set of **named "clips"** faked via GSAP so the FSM can call `play('Dash')` etc. uniformly.
- **Real model:** loaded via `GLTFLoader` + `DRACOLoader` (meshopt-ready). On load, the loader **maps the GLB's named materials/nodes/clips to the same interface**, then the placeholder is disposed and swapped out. Contract lives in [`ASSET_SPEC.md`](ASSET_SPEC.md).
- `modelUrl` is an optional module option; absent → placeholder is used (also the graceful fallback if the GLB fails to load).

### 4.3 Animation model (Full GSAP + Mixer)
- **GSAP owns:** all locomotion (position/rotation/scale through space), squash/stretch, banking, entrance, retype caret-glide, theme stretch, migration — via `gsap.timeline()`, `CustomEase`/`back`/`elastic`, and `gsap.quickTo` for cursor/eye tracking + banking. Rendering is driven from `gsap.ticker.add(render)` so tweens, the Mixer, and the WebGL draw share **one clock**.
- **`AnimationMixer` owns:** playing/blending the GLB's baked skeletal clips. The FSM requests a clip by name; a thin `PetRig` adapter routes it to either the Mixer (real model) or GSAP-faked equivalents (placeholder).
- **Pure & tested:** the FSM (states, guards, timers) and the retype queue (what to delete/type next, per-char scheduling) are pure TS modules with **no GSAP/three import** — unit-tested with Vitest.

### 4.4 Module API
```ts
createBytePet(mount: HTMLElement, {
  headlineEl: HTMLElement,
  footerEl: HTMLElement,
  phrases: PhraseSet,          // { identity: string[][], punchy: string[][], footer: string[][] }
  theme?: 'light' | 'dark' | 'system',
  sounds?: boolean,
  reducedMotion?: boolean,
  modelUrl?: string,           // optional GLB; omitted → procedural placeholder
}): {
  feed(x: number, y: number): void;
  setTheme(t: 'light' | 'dark'): void;
  destroy(): void;
}
```
Framework-agnostic vanilla TS. GSAP is an accepted dependency (coexists with framer-motion at integration).

---

## 5. Character — Byte

A small, characterful dev robot that reads clearly at headline scale. Owner supplies the final rigged `.glb`; a procedural placeholder stands in until then. Full modeling/rig/material/node/clip requirements are in **[`ASSET_SPEC.md`](ASSET_SPEC.md)**. Summary: single `.glb`, Y-up / +Z forward / feet-origin / ~1.8u tall; ≤ ~40k tris, textures ≤ 1024², ≤ ~500KB compressed; named `Body` + `Glow` materials; `Eye`/`Head` + `Mouth` nodes; baked clips `Idle/Hop/Dash/Eat/Sleep/Wake/Peek`.

---

## 6. State machine & interaction

States: `hidden | entering | idle | curious | invited | dashing | eating | retyping | traveling | sleeping | waking | peeking`.

- **idle** — editor-authentic hard-step blink; every 4–8s a micro-behavior (eye glance, small hop onto a letter, short baseline slide, or a **peek**).
- **peeking** — hop above a headline char, flip to the back canvas at apex, drop partly behind the letterform, peek over for ~1.2s, hop front. Must happen within the first ~10 idle seconds.
- **curious** — cursor within ~150px: blink stops, slight lean, eyes lock on.
- **invited** — ~2.5s curious, no click: `(click to feed Byte)` hint fades in under the headline. Gone forever after first feed (`localStorage`).
- **feed** (click/tap): spawn a random hand-modeled 3D glyph (`; = > * + {`) as bevel-extruded `THREE.Shape` paths (rounded primitives; no `typeface.json`). Toss in with a 450ms arc + spin, squash on landing. Byte: 80ms anticipation → dash (380–600ms by distance, banks ±12°, slight overshoot) → **eat** (`Eat` clip; glyph scales into the mouth over two chomps; 4–6 `currentColor` particles; alternating blips) → satisfied wiggle. Queue clicks; max 3 live glyphs (oldest pops away).
- **retype (signature reward)** — Byte glides to the headline end; the DOM caret backspaces right-to-left (~26ms/char accelerating), then types the next phrase (~40ms/char, ±12ms jitter, soft tick every 2–3 chars), caret gliding per char. 2-line sets; delete bottom line first; **zero layout shift**. DOM chars as spans.
- **traveling & footer migration** — canvases are fixed; Byte lives in screen space. Home anchor = end of the in-view text block (hero headline ↔ footer CTA). Between them it follows the visitor down a right-margin lane. Feeding while traveling = eat + happy 360° spin (no retype). Footer feeds retype the footer CTA set.
- **sleeping** — 30s idle: dim, blink slows, a small mono `z` floats up every ~2s. Click → **waking** (startled jump + shake), then the click counts as a feed.
- **theme reaction** — toggle: ~400ms token crossfade; Byte does a full-height stretch; materials/lights lerp; dark adds the phosphor glow. Stretch goal: Byte headbutts the toggle first.

---

## 7. Style Lab (`?lab`)
A query-param-gated control panel to preview & lock variants live in the real page. Axes: **typography** (3), **glow accent** (4), **phrase set** (Identity / Punchy / combined), **tooltip** on/off. Presets are pure token/param swaps (CSS custom properties + a small config object); "locking" = setting the default. Production build hides the panel and ships only chosen assets (keeps font/JS budgets). Lab mode may load all fonts at once (dev-only, over budget by design).

---

## 8. Page structure
1. **Preloader** — blinking caret + % (`document.fonts.ready` + min duration), then choreographed entrance: overlay lifts, **Byte drops in with a bounce and types the initial headline live** (reuses the retype engine), hint + nav + micro-labels stagger in. Zero CLS.
2. **Hero** — nav (name / role / links + sound EQ toggle + theme toggle), giant 2-line headline (Byte's home), drifting micro-labels (`PORTFOLIO — 2026`), hint, scroll indicator.
3. **Sound gate** — muted until first click; `(click to enable sound)` label follows cursor until then; EQ icon animates when on.
4. **Manifesto** — 3 big masked line reveals on scroll (SplitText) + short paragraph + parallax micro-labels at different speeds (Lenis + ScrollTrigger).
5. **Selected work** — 3 fake rows (nr / name / tag / year / arrow) with tasteful hover (shift + arrow slide + line highlight).
6. **Footer CTA** — big 2-line phrase (Byte's second home) + email + live **`FED N GLYPHS`** counter + © line.
7. **Global garnish** — CSS film grain (runtime noise tile, opacity ≤ 0.06/0.08, stepped), custom cursor dot → labeled pills (`FEED` / `TOGGLE` / `OPEN`), Lenis smooth scroll, styled `::selection`, blinking favicon, hero mouse-parallax (few px, inverse on labels).

---

## 9. Sound design
WebAudio synth module (no Howler, no assets). Gated behind first click (Léo pattern), then ON. Sounds: type tick, two alternating eat blips, spawn pop, theme whoosh, wake boing, Byte's occasional soft chirp. All subtle, mixed low. EQ (3-bar) toggle in nav mutes/unmutes.

---

## 10. Copy
- **Hero — Identity set** (2 lines, ≤14 chars/line): `FULL-STACK / +AI` → `I SHIP / PRODUCTS` → `IDEAS → / SHIPPED` → `FEED / BYTE` → `LAWRENCE / CRASTO`.
- **Hero — Punchy set:** `MAKE IT / MOVE` → `MAKE IT / REAL` → `MAKE IT / SHIP` → `BUILT BY / LAWRENCE`.
- **Nav identity:** `Lawrence Crasto` · `Full-stack + AI Product Engineer`.
- **Footer CTA:** `LET'S / BUILD` → `SAY / HELLO` → `WORK / TOGETHER`.
- **Hint:** `(click to feed Byte)` · **Tooltip (lab, after 3+ feeds):** `still hungry` · **Counter:** `FED N GLYPHS`.
- **Contact (placeholders):** `hello@lawrence.dev`, GitHub `#`, LinkedIn `#`.

---

## 11. Theming & tokens
Design tokens as CSS custom properties, switched via `data-theme` (+ system pref + no-flash inline script) and `data-*` axes for the lab. Derived dark + light ink/paper pairs (near-black paper + soft-white ink dark; warm paper + near-black ink light), reviewed as swatches at T1. Three material/light state per theme lerps on toggle. Dark adds phosphor emissive on Byte's `Glow` + halo sprite in the chosen accent.

---

## 12. Accessibility & reduced motion
Canvases `aria-hidden`; a throttled polite live-region announces the final phrase after a retype. Keyboard path + visible focus styles. `prefers-reduced-motion`: blink stays; hops/dashes become fades; parallax off; migration simplified. Page works with JS disabled (static headline #1). WebGL-fail path stays beautiful.

---

## 13. Performance budgets & guardrails
- JS ≤ **280KB gzip** (three ≈ 165KB, GSAP already counted); CSS ≤ 20KB; fonts ≤ 120KB woff2 subsetted (final, one type system).
- **Model budget:** Byte `.glb` ≤ ~500KB compressed (DRACO/meshopt), ≤ ~40k tris, textures ≤ 1024² (verify on device).
- Lighthouse mobile: Perf ≥ 90, A11y ≥ 95, Best Practices 100. LCP < 2.0s (headline is DOM). CLS = 0.
- Transforms/opacity + WebGL only; batch DOM reads/writes; rect caching on scroll, not per frame. Long frames (>32ms) ≤ 2 per 10s sample; heap stable after 50 feeds.

---

## 14. Tech stack & tooling
- **Vite + vanilla TypeScript** (strict). ESLint + Prettier. **Vitest** (FSM + retype queue).
- **three** (^latest): core + `GLTFLoader`, `DRACOLoader`, `RoundedBoxGeometry` (placeholder).
- **GSAP 3.13+**: core, CustomEase, ScrollTrigger, SplitText (all free on npm).
- **lenis** smooth scroll. **WebAudio** synth (no Howler).
- **gsap-skills** installed (`~/.claude/skills/gsap-*`): use for all GSAP work; fold its `CLAUDE.md` conventions into the project at scaffold.
- No other runtime deps without approval (record in `DECISIONS.md`).

---

## 15. Testing strategy
- **Unit (Vitest):** FSM transitions/guards/timers; retype queue (delete/type scheduling, 2-line ordering, no-overflow); phrase cycling; glyph queue cap.
- **Browser QA (every ticket):** zero console errors; screenshots at 1440×900 / 768×1024 / 390×844 in both themes; the full interaction run (hover→invited→feed×3→retype→sleep→wake→migrate→footer retype→theme-toggle-mid-dash→sound gate); occlusion screenshot (Byte clipped by a letterform mid-peek); reduced-motion pass; 10s rAF perf sample; keyboard-only pass. Evidence logged to `PROGRESS.md`.

---

## 16. Ticket-plan deltas (full plan in `TICKETS.md`, via writing-plans)
- **T0** (this): worktree + `SPEC.md` + `BRIEF.md` + `ASSET_SPEC.md`.
- **T1** adds: runtime-swappable token system (for the lab) + palette swatch review.
- **T3** adds: `GLTFLoader` + `DRACOLoader` path alongside the two-renderer sandwich.
- **T4**: build the **procedural placeholder bot** + `PetRig` adapter (clip-name interface) + FSM; unit tests.
- **New "GLB swap-in" ticket:** integrate the real model when Lawrence delivers it (map materials/nodes/clips; dispose placeholder; re-verify budget/60fps).
- **Style-Lab** work folds into T1/T2 and grows per axis; body-preset axis removed.
- **T6** stop point (owner play-test) unchanged. **T10** = production build + `vite preview` + GIF (no deploy).

---

## 17. What we need from Lawrence (deliverables)
- **Blocking nothing to start** — build proceeds on the placeholder.
- **Byte's rigged `.glb`** per `ASSET_SPEC.md` — due at the GLB swap-in ticket (late). ⚠️ "Baked clips" implies Blender rigging/animation; fallback to static/segmented + procedural animation if needed.
- **Quick check-ins:** approve `SPEC.md` + `TICKETS.md`; pick palette (T1); lock Style-Lab choices; play-test at T6; `/clear` between tickets; OK downloads/installs when asked.
- **Optional/later:** real email + social URLs (+ resume); any copy tweaks.
- **Environment:** keep SD500 mounted; ensure Node is available for Vite (mise has no global default).

---

## 18. Decide-in-lab / open
- Final typography (1 of 3), glow accent (1 of 4), phrase set, tooltip on/off.
- Favicon: blinking caret vs. mini Byte glyph (decide at garnish).
- Byte↔caret spark styling detail (tune during T6).
