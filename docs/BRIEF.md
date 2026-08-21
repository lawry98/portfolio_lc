> **Note (added T0):** This is the original brief, verbatim. It describes "Pixel the Caret." During the grill the character became **Byte, a little robot from a user-supplied GLB**, and a few other decisions changed. See [`SPEC.md`](SPEC.md) §2 for the authoritative, superseding decisions — where this brief and the SPEC differ, the SPEC wins.

---

# CLAUDE CODE PROMPT — "Pixel the Caret" · a full-3D feed-the-pet hero for my dev portfolio

> **How to use this file (for me, Lawrence):** open a terminal in a NEW empty folder, run `claude`, and paste everything below the line. Keep this file in the repo as `docs/BRIEF.md` so future sessions can re-read it.

---

## 0) Mission

Build me a **super-polished, standalone one-page demo** of an interactive 3D mascot: **Pixel the Caret** — a real-time **Three.js** character shaped like a code-editor caret with tiny eyes, living inside my hero headline like an insertion point. Visitors click to feed it stray code glyphs (`{` `;` `>` `*`); it dashes over in 3D, eats them, and as a reward it **backspaces and re-types my headline to a new phrase** — the pet IS the typewriter.

Directly inspired by the feed-the-bee interaction on https://www.leoparpeix.com/ (Three.js character + GSAP + Lenis + sound design + character-weaving-through-typography). We borrow the **techniques**, never his assets/characters. Section 4 maps every technique from that site to its equivalent here — **use all of them**.

**The bar is "scary good":** this page should feel like an Awwwards-nominee hero. Smoothness is the product. If a motion feels default, it's not done (see §9 quality bar).

The standalone page comes first and must be portfolio-grade on its own. Integration into my actual portfolio is a later phase, so architect the pet as a reusable module from day one (`createCaretPet(mount, options)` → `{ feed(x,y), setTheme(t), destroy() }`, no globals).

**I am the product owner. You do not start coding until you have grilled me and I have approved the ticket plan.**

---

## 1) Working agreement (non-negotiable)

1. **Use your skills.** If the Superpowers plugin is installed, drive the project with it: `brainstorming` for §2, `writing-plans` for the ticket plan, `executing-plans` for implementation, `systematic-debugging` when anything misbehaves, TDD where it pays (FSM transitions + retype queue are unit-testable). If a `/grill`-style interrogation skill is installed, use it for §2. If any are missing, emulate them honestly — never skip the step.
2. **Grill me first.** Before any code or scaffolding, interview me using §2. Batch questions, challenge my assumptions, propose defaults I can accept with one word. Lock answers into `docs/SPEC.md`.
3. **Divide everything into tickets.** After the grill, write `docs/TICKETS.md` using §6 as the starting shape (refine it — split/merge/add with reasoning). Get my approval on the ticket list before ticket 1.
4. **Stay in the smart zone (~200k tokens per session).** One ticket per session. Persist all state to disk so a fresh session resumes cold:
   - `docs/SPEC.md` — locked decisions · `docs/TICKETS.md` — plan + status · `docs/PROGRESS.md` — running log with QA evidence · `docs/DECISIONS.md` — technical choices + why
   - END of every ticket: update docs, commit, tell me to `/clear` before the next ticket. START of every session: read `docs/*` first, then only the files the ticket touches. Never re-read the whole repo. Use subagents for wide searches and QA passes so raw output stays out of the main context.
5. **QA in the real browser, every ticket.** Use your built-in browser tools (Claude in Chrome / your browser automation) against the Vite dev server. A ticket is not done until §7 passes and screenshot evidence is logged in `docs/PROGRESS.md`.
6. **Git discipline.** `git init` at scaffold; ≥1 commit per ticket, conventional commits (`feat(pet): ...`); never commit broken main.
7. **Stop points.** Stop and ask me: after the grill, after the ticket plan, after T6 (core loop playable — I want to play with it), and before any dependency beyond the approved stack.

---

## 2) Grill me (before anything else)

Ask at least the following, plus anything my answers expose. Offer a recommended default for each so I can answer fast:

1. **Copy** — hero phrases Pixel cycles through (2 short lines each, ≤14 chars/line; tone minimal + a little playful), my real name/role line, footer CTA phrase set, email/socials.
2. **Type** — grotesk display + system-mono accents (e.g. Space Grotesk 700 + `ui-monospace` stack), or full terminal-mono? (Léo uses Monument Grotesk — pick a free alternative, never his fonts.)
3. **Theming** — exact dark + light palettes or derive tasteful ink/paper pairs? Dark-mode phosphor glow on Pixel: which accent (mint terminal green? amber? pure white bloom)? System-pref default + manual toggle override?
4. **Character chunkiness** — how cute: strictly rectangular caret (more "authentic") vs slightly plump rounded body (more "pet")? Eye size? Should it ever make sounds of its own (tiny chirp)?
5. **Sound** — Léo pattern: everything muted until first click, `(click to enable sound)` cursor label, equalizer toggle in nav. After the gate: sound ON by default, or OFF? WebAudio-synthesized blips (zero asset downloads) OK?
6. **Touch/mobile** — tap = feed, bigger hit area, no cursor labels on touch — agreed?
7. **My portfolio stack** — (for the later integration phase and module design): Next/Astro/Vue/plain? Deploy target for the demo (Vercel?).
8. **Scope of demo page** — hero + manifesto section + fake work list + footer CTA (recommended, shows scroll choreography), or hero-only?
9. **Performance floor** — must hold 60fps on a mid-range phone; anything older to target?
10. **Never-do list** — anything Pixel must never do (sleep state? glow? sound entirely?).

Write locked answers to `docs/SPEC.md` and echo a 10-line summary for my sign-off.

---

## 3) Product spec — the page and the pet (full 3D)

### 3.1 WebGL architecture — the two-canvas occlusion sandwich (Léo's exact trick)

- **Two full-viewport, fixed, transparent WebGL canvases** sandwich the DOM: `#gl-back` (behind all content) and `#gl-front` (above all content, `pointer-events: none`). The crisp, selectable DOM headline sits between them.
- One Three.js scene + camera, rendered by both renderers each frame; the pet is drawn to **front or back** depending on a `behind` flag (food + its shadow always front). Flip the flag only at hop apexes / letter gaps so the switch is invisible. Result: Pixel genuinely weaves **behind and in front of the letterforms** while the type stays DOM-crisp. (The scene is tiny — double render is cheap.)
- **Pixel-space camera:** PerspectiveCamera (fov ≈ 30°) at `z = (viewportHeight/2) / tan(fov/2)` so **1 world unit = 1 CSS pixel** at the DOM plane (z=0). World x = screenX − w/2, world y = h/2 − screenY. This makes DOM↔WebGL sync trivial: `getBoundingClientRect()` → world coords. Handle resize + DPR (clamp `setPixelRatio` at 2).
- **Look:** soft clay. Hemisphere + gentle key light, no harsh realtime shadows — the pet's ground contact is a **blob shadow** (radial-gradient sprite) that scales/fades with hover height. Light mode: soft-touch ink material (MeshStandard, roughness ≈ 0.35). Dark mode: light ink + **subtle** emissive phosphor tint + a faint glow halo sprite. No postprocessing pipeline in v1 (budget); grain is a CSS overlay.
- **Robustness:** WebGL unavailable → hide canvases, page stays fully functional and beautiful (static headline, no pet). `visibilitychange` pauses the ticker. Dispose geometries/materials for eaten food (verify no leak after 50 feeds).

### 3.2 The character

Body = `RoundedBoxGeometry`, sized from the **live headline font-size** (height ≈ 0.85em, width ≈ 0.15em, depth = width, radius ≈ 45% width; re-measure on resize). Two knocked-out eyes — sockets in the page background color so they read as holes, pupils in ink — pupils track the cursor (lerp ≈ 0.08, max travel ~30% of socket). Slight yaw toward the cursor (±0.35 rad) and idle Y-wobble so the 3D reads constantly. All discrete moves get **anticipation + follow-through + squash & stretch** via scale.

**State machine** (`hidden | entering | idle | curious | invited | dashing | eating | retyping | traveling | sleeping | waking | peeking`):

- **idle** — editor-authentic blink: whole body hard-steps opacity 1→0→1 (~620ms on / 420ms off; hard steps, not fades). Every 4–8s one micro-behavior: eye glance, small hop onto the top of a nearby letter, a 2–3 character baseline slide, or a **peek** (below).
- **peeking** — hop above a random headline character, flip to the back canvas at the apex, drop so it's partially hidden behind the letterform, peek over the top for ~1.2s (eyes visible), hop back front. This is the money shot — make it happen within the first ~10 idle seconds.
- **curious** — cursor within ~150px: blink stops (solid), leans ≤6°, eyes lock on.
- **invited** — ~2.5s of curious with no click: parenthetical hint fades in under the headline, Léo-style: `(click to feed the caret)`. Gone forever after first feed (`localStorage`).
- **feed** (click/tap in the feed zone): spawn a random **3D glyph** at the click point — build glyphs (`; = > * + {`) as **bevel-extruded THREE.Shape paths, hand-modeled** (rounded-rect/circle/chevron/star primitives; chunky, toy-like). *Do not depend on `typeface.json` fonts — current `three` npm doesn't ship them, and hand-built rounded shapes look better here.* Toss in with a 450ms arc + spin, squash on landing. Pixel: 80ms anticipation squat → dash (380–600ms by distance, banks ±12° into travel, slight overshoot) → **eat**: glyph scales into the caret during two scaleY chomps, 4–6 `currentColor` particles, alternating blip sounds → satisfied wiggle. Queue clicks; max 3 live glyphs (oldest pops away).
- **reward — the signature move.** After each feed, Pixel glides to the headline end and **re-types it**: backspace right-to-left (~26ms/char, accelerating) with the caret visibly doing the deleting, then types the next phrase (~40ms/char, ±12ms human jitter, soft tick every 2–3 chars), caret gliding with each character. Phrases are 2-line sets; delete bottom line first; **zero layout shift** (container reserves 2 lines). DOM chars as spans (SplitText or manual — your call in DECISIONS.md).
- **traveling & footer migration** — the canvases are fixed, so Pixel lives in screen space: its home anchor is the end of whichever text block is in view (hero headline ↔ footer CTA). Between them it follows the visitor down a right-margin lane, playground-bee style. Feeding while traveling = eat + a happy 360° spin (no text to retype). Footer feeds re-type the footer CTA phrase set.
- **sleeping** — 30s without interaction: opacity 0.45, blink slows to ~1.6s, a small mono `z` floats up every ~2s. Click → **waking**: startled jump, shake, then the click counts as a feed.
- **theme reaction** — toggle: 400ms token crossfade; Pixel does a full-height stretch; materials/lights lerp; dark mode adds the phosphor glow. Stretch goal: Pixel dashes up and headbutts the toggle first.

### 3.3 The page (standalone demo)

1. **Preloader** — centered blinking caret + % counter (`document.fonts.ready` + min duration), then a choreographed entrance: overlay lifts, **Pixel drops in with a bounce and TYPES the initial headline live** (reuse the retype engine — this is the entrance moment), hint + nav + micro-labels stagger in. Zero CLS.
2. **Hero** — nav (name / role / links + sound EQ toggle + theme toggle), giant 2-line headline (the pet's home), drifting micro-labels (`PORTFOLIO — 2026` etc.), hint, scroll indicator.
3. **Sound gate** — Léo pattern: muted until first click; `(click to enable sound)` label follows the cursor until then; EQ icon (3 bars) animates when on. Sounds are WebAudio-synthesized: type tick, two eat blips, spawn pop, theme whoosh, wake boing — all subtle, mixed low.
4. **Manifesto section** — 3 big masked line reveals on scroll + short paragraph + parallax micro-labels at different speeds (Lenis + ScrollTrigger).
5. **Selected work** — 3 fake rows (nr / name / tag / year / arrow) with a tasteful hover (shift + arrow slide + line highlight).
6. **Footer CTA** — big 2-line phrase (Pixel's second home) + email + a live **`FED N GLYPHS` counter** + © line.
7. **Global garnish** — film grain overlay (runtime-generated noise tile, opacity ≤ 0.06/0.08, subtly stepped animation), custom cursor dot that grows into labeled pills (`FEED` / `TOGGLE` / `OPEN`), Lenis smooth scroll, styled `::selection`, blinking-caret favicon, mouse-parallax on hero (few px, inverse on labels).

---

## 4) Technique map — leoparpeix.com ➜ this build (use all of these)

| Léo's site | Pixel the Caret |
|---|---|
| 3D bee (GLB) wandering the headline in Three.js | 3D caret (procedural RoundedBox rig) wandering the headline in Three.js |
| Two-canvas sandwich: character weaves behind/in front of DOM type | Same architecture, §3.1 |
| Click drops 3D fruit; bee dashes over and eats | Click tosses hand-modeled 3D glyph; caret dashes, banks, chomps |
| Feed reward: headline copy swaps | Reward: pet backspaces + re-types the headline |
| Blob shadow under the character falling on the page/type | Blob shadow sprite, height-reactive |
| `(Click to feed the bee)` parenthetical hint | `(click to feed the caret)` |
| Sound gated behind first click + equalizer toggle (Howler) | Same gate + toggle; WebAudio synth (no assets) |
| Lenis smooth scroll + scroll-mapped reveals | Lenis + ScrollTrigger |
| SplitText masked line/char reveals, staggered custom eases | Same (GSAP 3.13+: SplitText/CustomEase free) |
| Custom cursor with labeled pill states (DRAG / DISCOVER MORE) | Cursor dot → `FEED` / `TOGGLE` / `OPEN` pills |
| Preloader with progress, choreographed scene settle | Preloader + Pixel-types-the-headline entrance |
| Bee follows you down the Playground page | Traveling lane + footer migration |
| Character tooltip ("Bzzzzz again") | Optional tiny label near Pixel after multiple feeds (`still hungry`) — ask me in the grill |
| Film grain over everything | Same, both themes |
| Page transition wipe + whoosh | Theme-toggle transition now; route wipe ready for integration phase |
| DRACO/KTX2 compressed GLB assets | N/A (procedural geometry — zero downloads). If I opt into a Blender-modeled GLB pet in the grill, add a DRACO pipeline ticket |

---

## 5) Stack

- **Vite + vanilla TypeScript**, strict. Framework-agnostic pet module for the integration phase.
- **three** (^latest): core + `RoundedBoxGeometry` from examples/jsm. No loaders needed in v1.
- **GSAP 3.13+** (core, CustomEase, ScrollTrigger, SplitText — all free on npm).
- **lenis** for smooth scroll. **WebAudio** synth module (no Howler unless we choose assets — record in DECISIONS.md).
- No other runtime deps without asking. ESLint + Prettier. Vitest for FSM + retype queue.
- Pet API: `createCaretPet(mount, { headlineEl, footerEl, phrases, theme, sounds, reducedMotion }) → { feed(x,y), setTheme(t), destroy() }`.

---

## 6) Ticket plan (starting shape — refine, then get my sign-off)

> Every ticket ships: code + unit tests where sensible + §7 QA evidence + `docs/PROGRESS.md` update + commit. One ticket per session; `/clear` between.

- **T0 — Grill & spec lock.** §2 → `docs/SPEC.md`, refined `docs/TICKETS.md`. *(No code.)*
- **T1 — Scaffold.** Vite+TS, lint/format/test, design tokens dark/light (`data-theme` + system pref + no-flash script), fonts subsetted/preloaded, layout skeleton, grain. QA: both themes, zero console errors, CLS 0.
- **T2 — Type & scroll.** Headline/sections/footer DOM, SplitText masked reveals (load + scroll), Lenis + ScrollTrigger, parallax micro-labels, work-row hovers, reduced-motion variants.
- **T3 — WebGL foundation.** Two-canvas sandwich, pixel-space camera, resize/DPR, lighting, theme-lerped materials, blob shadow, WebGL-fail fallback, visibility pause. QA: colored test cube occludes correctly behind/in front of the headline.
- **T4 — Character rig + idle brain.** Body/eyes build, FSM, blink, wander, micro-behaviors incl. peek-behind (layer flip), curious/invited, sleep/wake. Unit tests on FSM transitions.
- **T5 — Feeding.** Glyph shape library, toss/spin/squash, click queue + zones, dash with banking, eat + particles + counter, touch support.
- **T6 — Retype reward + entrance.** Backspace/type engine, phrase cycling, pet glide, preloader + Pixel-types-the-headline entrance. **Stop point: I play with it.**
- **T7 — Sound & cursor.** Gate + follower label, WebAudio blips, EQ toggle, cursor pills.
- **T8 — Migration & theme polish.** Traveling lane, footer home + CTA retype, happy-spin, theme-toggle reaction (+ optional headbutt), hint persistence.
- **T9 — Hardening.** A11y (canvases `aria-hidden`, throttled polite live-region announcing the final phrase after a retype, keyboard path, focus styles), `prefers-reduced-motion` audit (blink stays; hops/dashes become fades; parallax off), memory check (50 feeds, stable heap), mobile pass.
- **T10 — Perf & release.** §8 budgets enforced, fps sampling, bundle analysis, README + `docs/INTEGRATION.md` (mounting Pixel in React/Astro/Vue sketches), deploy preview, 30s GIF of the loop recorded via your browser tooling → `docs/qa/`.

---

## 7) Browser QA protocol (every ticket, log evidence)

Using your built-in browser automation against `vite dev`:

1. Zero console errors/warnings (incl. Three warnings).
2. Screenshots: 1440×900, 768×1024, 390×844 — **both themes**, toggled via the UI.
3. Real interaction run: hover (curious) → wait (invited hint) → feed ×3 rapid (queue) → full retype → idle 35s (sleep) → click (wake+feed) → scroll to footer (migration) → feed footer (CTA retype) → toggle theme mid-dash (nothing breaks) → sound on/off (no audio before gate).
4. Occlusion check: screenshot Pixel mid-peek — body visibly clipped by a letterform, eyes above it.
5. `prefers-reduced-motion` emulation → loop still works, no hops/parallax.
6. Perf: 10s rAF sampling during interaction — long frames (>32ms) ≤ 2; scroll 60fps; input→visual response <100ms; heap stable after 50 feeds.
7. Keyboard-only pass. Log all screenshots + findings to `docs/PROGRESS.md`; bugs >30min become tickets.

---

## 8) Budgets & guardrails

- JS ≤ **280KB gzip total** (three ≈ 165KB of it), CSS ≤ 20KB, fonts ≤ 120KB woff2 subsetted, **zero image/model downloads** (procedural everything).
- Lighthouse (mobile): Perf ≥ 90, A11y ≥ 95, Best Practices 100. LCP < 2.0s (headline is DOM — canvas never blocks it), CLS = 0.
- Animation via transforms/opacity + WebGL only; batch DOM reads/writes; rect caching on scroll, not per frame.
- Page works with JS disabled: static headline phrase #1, no blank page.

---

## 9) The "scary good" quality bar (Definition of Done, project)

- No default/linear eases anywhere near the pet — every discrete move has anticipation, overshoot or settle, on `CustomEase` curves.
- The peek-behind-letters moment, the typed entrance, and the retype reward all land within a visitor's first 15 seconds.
- 60fps on a mid-range phone through the whole §7 interaction run.
- Both themes look intentional (not inverted-by-filter); dark glow is subtle enough that a screenshot still reads "minimal".
- Standalone page deployed to a preview URL, all tickets green with QA evidence, README + `docs/INTEGRATION.md` complete, loop GIF recorded.
- Then: fresh grill for the portfolio-integration phase.

---

**Begin now with §1.1/§2: check which skills you have available, then grill me. Do not write code yet.**
