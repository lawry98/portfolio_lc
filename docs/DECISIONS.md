# DECISIONS — technical choices + why

Running log (append per ticket). Newest first. See [`SPEC.md`](SPEC.md) for the full locked spec.

---

## D-09 · T2 runtime deps: gsap 3.15 (+ ScrollTrigger, SplitText) + lenis — 2026-08-22
**Choice:** Added the first runtime deps beyond tooling — `gsap@^3.15.0` (core + `ScrollTrigger` + `SplitText`) and `lenis@^1.3.0` — under `dependencies`. SplitText is used only for the manifesto/hero masked line reveals (per D-03, the headline retype stays a custom span engine, not SplitText). Lenis drives smooth scroll, wired to ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)` and driven off `gsap.ticker` (one clock).
**Why:** All three are in the locked stack (SPEC §14) and first earn their keep in T2 (scroll + reveals). SplitText is free on npm since gsap 3.13, so no Club/paid dependency. Recording per the "no new runtime deps without a DECISIONS entry" rule; installing lazily at first-use (not T1) kept earlier tickets lean (D-08 §5). Reduced-motion + JS-off paths do not depend on any of them.

## D-08 · T1 scaffold, tokens & fonts — 2026-08-22
**Choices:** (1) Removed the inherited Next.js portfolio; the worktree root is the Vite + vanilla-TS app (SPEC §3/§14). (2) Tokens as CSS custom properties, combined `:root, :root[data-theme='light']` (etc.) selectors; axes `data-theme` (light/dark), `data-type` (grotesk/mono/clash), `data-glow` (mint/amber/white/cyan). **Palette locked (owner):** light paper `#f4f1ea`/ink `#16151a`; dark paper `#0e0d12`/ink `#f2f0f5`; accent `#a8451f` light (AA-clean) / `#ff8a5c` dark; glow default `mint #38e8a8`. (3) Fonts self-hosted Latin-subset woff2 — Space Grotesk + JetBrains Mono (Fontsource), Clash Display (Fontshare); `@font-face` at top of `tokens.css`; ~99KB, per-glyph subsetting deferred to T10. (4) `initTheme()`: system pref default, `localStorage['byte-theme']` override, no-flash inline script sets all 3 axes pre-paint; storage access guarded (degrades to system pref, never throws). (5) Node via mise + `.tool-versions` (node 22); T1 installs tooling deps only (three/gsap/lenis deferred to the tickets that first use them).
**Why:** Matches SPEC's Vite/token/lab architecture; keeps T1 unblocked and in-budget; guarded storage + no-flash + CLS-0 groundwork protect the graceful-degradation constraints from the start.

## D-07 · Sound: `SoundEngine` interface, synth now + Howler/files later — 2026-08-21
**Choice:** WebAudio synth behind a thin swappable `SoundEngine` interface; Howler + recorded audio files are a later drop-in swap (see `AUDIO_SPEC.md`).
**Why:** Howler only earns its keep with recorded audio *files*; synth needs no library. The interface means adding Howler is never wasted and switching touches no call sites — mirrors the placeholder→GLB pattern. Unblocked now (zero downloads), asset-rich later. Brief §5 explicitly sanctioned Howler "if we choose assets."

## D-06 · Uses installed `gsap-skills` plugin — 2026-08-21
**Choice:** Installed GreenSock's official `gsap-skills` (8 skills) to `~/.claude/skills/`; use for all GSAP work; fold its `CLAUDE.md` conventions into the project at scaffold.
**Why:** Owner wants to learn GSAP; official guidance keeps usage idiomatic (timelines, `quickTo`, ScrollTrigger, cleanup).

## D-05 · Sound gate ON after first click — 2026-08-21
**Choice:** Muted until first click (Léo pattern); ON after the gate. Byte also gets an occasional soft chirp.
**Why:** Autoplay policy compliance + owner preference.

## D-04 · Two `WebGLRenderer`s (front/back) sharing one scene+camera — 2026-08-21
**Choice:** The two-canvas occlusion sandwich uses two renderers; Byte draws to front or back per a `behind` flag (food+shadow always front).
**Why:** Only way to truly weave a WebGL character behind/in front of crisp DOM type. 2 GL contexts is a non-issue; the scene is tiny so the double render is cheap.

## D-03 · Custom span-based retype engine (not SplitText) — 2026-08-21
**Choice:** Headline backspace/type is a custom, pure, unit-tested engine over per-char spans. SplitText is used only for the manifesto masked reveals.
**Why:** The retype needs per-char control synced to the caret + a testable queue; SplitText is the wrong tool for that.

## D-02 · Byte = user-supplied GLB robot; placeholder now, swap later — 2026-08-21
**Choice:** Character is a little robot from a rigged `.glb` the owner provides (baked clips). Built now against a procedural placeholder + `PetRig` adapter; real model swapped in via GLTFLoader+DRACO later (see `ASSET_SPEC.md`).
**Why:** Owner wants a real modeled creature, not a caret; I can't produce a rigged GLB. Placeholder keeps the whole build unblocked and the real model drops into the same interface. (Deviates from brief's procedural caret — see SPEC §2 D1–D3, D6–D7.)

## D-01 · Full GSAP for all pet motion — 2026-08-21
**Choice:** All Byte motion runs through GSAP (timelines, `CustomEase`/`back`/`elastic`, `quickTo`) with rendering driven off `gsap.ticker`; `AnimationMixer` plays baked clips. FSM + retype-queue *logic* stay pure and GSAP-free for unit tests.
**Why:** Owner wants to learn GSAP; GSAP is already in the bundle for scroll; `gsap.ticker` gives one clock with the WebGL draw; keeping decision-logic pure preserves testability. Cost accepted: the pet module depends on GSAP at Next.js integration (coexists fine with framer-motion).
