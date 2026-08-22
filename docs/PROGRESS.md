# PROGRESS — running log

> **Start every session here.** Read `docs/*` first — [`SPEC.md`](SPEC.md) (authoritative), [`TICKETS.md`](TICKETS.md) (plan), [`DECISIONS.md`](DECISIONS.md), [`ASSET_SPEC.md`](ASSET_SPEC.md), [`AUDIO_SPEC.md`](AUDIO_SPEC.md) — then only the files the current ticket touches. Never re-read the whole repo.

## Workspace
- **Branch / worktree:** `feat/byte-pet-demo` at `/Volumes/SD500/Documents/personal/portfolio_lc/.claude/worktrees/byte-pet-demo`
- The Vite + TS app root = **worktree root**. Keep the **SD500 drive mounted** (a disconnect deletes the worktree from view until remounted).

## Execution model
- **Style:** `superpowers:subagent-driven-development` (chosen 2026-08-21).
- Per ticket: expand into bite-sized TDD steps → fresh subagent per step-group → review between → commit per ticket → **`/clear` between tickets**. T6 is a hard **owner play-test** stop.

## Log (newest first)
- **2026-08-22 — T2 DONE.** Typography, sections, scroll & reveals. `phrases.ts` (SPEC §10) + pure `fitsLineBudget`; first runtime deps **gsap 3.15** (core + ScrollTrigger + free SplitText) + **lenis 1.3** (DECISIONS **D-09**). Static section copy (nav/hero/manifesto/work/footer) keeping **CLS-0 + JS-off headline #1**; CSS work-row hovers. **Lenis + ScrollTrigger** on one `gsap.ticker` clock (reduced-motion → native). **SplitText** masked reveals (hero load; manifesto/work/footer on scroll) + hero mouse-parallax + scrubbed manifesto parallax; never-hidden / reduced-motion-instant / full-cleanup invariants page-wide. `?lab` **typography** axis (grotesk/mono/clash). Executed via subagent-driven-development: 6 tasks + per-task reviews + **Opus** whole-branch review (ready: yes) + 1 fix wave + scoped re-review — all clean; **1 minor parked** (reveal `revealed`-flag set at tween-creation → a resize before a scroll-gated section's first scroll skips its entrance; non-blocking, never strands content). Budgets: JS **54.8KB gz** / CSS **2.6KB gz** (≪ 280 / 20); fonts ~99KB (3 families, subset→one at T10). Ticket commits `90b3320..e831f0b` (7). Full audit trail: `.superpowers/sdd/t2-plan/progress.md`.
- **2026-08-22 — T2 QA (controller browser pass) — PASS.** Vite dev @ :5180; both themes across 1440×900 / 768×1024 / 390×844 (+ 844×390 landscape).
  - Zero console errors (all viewports/themes).
  - **No-flash + JS-off floor:** axes `data-theme`/`data-type`/`data-glow` set pre-paint; static headline #1 `FULL-STACK`/`+AI` present; footer #1 `LET'S`/`BUILD`. **Theme toggle** flips + persists across navigations.
  - **Reveals:** hero masked line-rise reaches final state (opacity 1); below-fold sections in expected pending state (visible under JS-off — no CSS `opacity:0` — and under reduced-motion). Lenis active (`html.lenis`).
  - **`?lab`:** no panel at `/`; panel at `/?lab` (legend "Type", 3 accessible radios); live font swap verified via `getComputedStyle` — grotesk→Space Grotesk, mono→JetBrains Mono, clash→Clash Display.
  - **No horizontal overflow** at any tested width (carry-forward `.hero__line` nowrap: static #1 max real line 10 chars, fits; ≤14 budget unit-tested). Lab panel fits within viewport at 390px.
  - **Known edge (minor, deferred):** scroll cue sits ~37px below fold at extreme short landscape (~390px tall).
  - **Tooling caveats (logged, not blockers):** this session's Browser pane throttles `requestAnimationFrame` to 0 (tab reports `visibilityState:hidden` even when fronted) → GSAP-driven motion isn't visually sampled in-pane and a true **60fps** sample isn't reliable here; reveals/parallax verified **structurally + via per-task runtime proofs against gsap 3.15 source**; `prefers-reduced-motion` not emulable in-pane (verified at task-review level: reduce branches create zero tweens + set final state). Formal 60fps is an on-device check at **T10** (SPEC §13); the perf argument rests on transforms/opacity-only + ScrollTrigger rect-caching + the small JS bundle. SDD ledger: `.superpowers/sdd/t2-plan/progress.md`.
- **2026-08-22 — T1 DONE.** Vite+TS app scaffolded (Next.js removed), design tokens (light/dark + type/glow axes), 3 self-hosted font families, no-flash `initTheme()` + tests, CLS-0 layout shells, runtime film grain, theme toggle. Executed via subagent-driven-development: 3 tasks + per-task reviews + Opus whole-ticket review + owner palette lock + fix wave — all clean. **Palette locked (owner):** warm-paper/near-black-ink light, near-black-paper/soft-white-ink dark, accent `#a8451f` light / `#ff8a5c` dark (AA-clean), glow `mint` default. Budgets: fonts ~99KB, built CSS 4.95KB, built JS 2.05KB (all well under). Ticket commits `166413c..ca29d48`. Full audit trail: `.superpowers/sdd/t1-plan/progress.md`.
- **2026-08-21 — T1 QA (controller browser pass) — PASS.** Vite dev @ :5180; verified both themes across 1440×900 / 768×1024 / 390×844.
  - Zero console errors (all viewports/themes).
  - **CLS-0:** hero `<h1>` `min-height` 218px, rect height identical (218px) across a theme toggle → no shift.
  - **No-flash + persistence:** reload applies `localStorage['byte-theme']` before paint; `data-theme`/`data-type`/`data-glow` all set on `<html>` (grotesk/mint defaults).
  - **Theme toggle** button flips + persists; ~400ms token crossfade.
  - **Grain:** `position:fixed`, `pointer-events:none`, `z-index:9999`, runtime noise tile; opacity .06 light / .08 dark (exactly at ceilings).
  - No horizontal overflow at 390px. Tokens resolve (light paper `#f4f1ea`/ink `#16151a`; dark paper `#0e0d12`/ink `#f2f0f5`); Space Grotesk active.
  - **Open for owner:** lock derived palette; `--accent` light `#c1502c`=4.18:1 on paper & `::selection` accent/glow ≈3:1 (WCAG AA caveats — see swatch review). Build/lint/format/test all green (per task reports). SDD ledger: `.superpowers/sdd/t1-plan/progress.md`.
- **2026-08-21 — T0 DONE (no code).** Grill complete; SPEC + companions written & committed (`60378a3`, `d53d217`); ticket roadmap written & committed (`dcab4c3`); roadmap approved; execution style = subagent-driven. `gsap-skills` plugin installed to `~/.claude/skills/`.
- **NEXT → T3 — WebGL foundation (two-canvas sandwich).** On session start: read `docs/*`, then invoke `superpowers:subagent-driven-development` to execute T3 from `TICKETS.md`. Builds on T1 tokens/theme + T2 scroll/ScrollTrigger + `gsap.ticker`. ⚠️ Carry-forwards from T2:
  1. **T3 adds `three`** (~165KB gz — the bulk of the JS budget) → **DECISIONS.md** entry required (locked stack SPEC §14). Drive the WebGL render loop off the **same `gsap.ticker`** T2 already established (see `lib/lenisScroll.ts`).
  2. **`.hero__line` is `white-space:nowrap`** — re-check each dynamic phrase for 390px horizontal overflow **when retype/rotation lands (T6)**; the ≤14-char budget is unit-tested and the static #1 (max 10 chars) fits today.
  3. **Reveal timing (parked minor):** `page/reveals.ts` sets its one-shot `revealed` flag at tween-*creation*, so a resize/font-swap of a still-off-screen scroll-gated section before first scroll makes it skip its entrance. Refine (completion-time flag / per-target gating) only if it bothers in practice.
  4. **`ScrollTrigger.refresh()` is called once post-fonts** in `page/hero.ts` — when T3 adds canvases/DOM/triggers, keep start-position recomputation in mind.
  5. **Minor polish deferred:** scroll cue ~37px below fold at extreme short landscape (~390px tall); plus the small carried-minors list in the SDD ledger (`.superpowers/sdd/t2-plan/progress.md`).
  6. **Browser-pane QA caveat:** this session's pane throttles rAF to 0 (verify GSAP/WebGL animation structurally or on-device, not by scroll-and-watch); formal 60fps + Lighthouse are on-device at T10.

## Open owner deliverables (not blocking)
- Byte's rigged `.glb` per `ASSET_SPEC.md` → triggers **T-GLB** (late).
- Recorded sounds per `AUDIO_SPEC.md` → triggers **T-Audio** (late).
- Real email + social URLs (placeholders stand in until then).
