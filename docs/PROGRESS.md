# PROGRESS — running log

> **Start every session here.** Read `docs/*` first — [`SPEC.md`](SPEC.md) (authoritative), [`TICKETS.md`](TICKETS.md) (plan), [`DECISIONS.md`](DECISIONS.md), [`ASSET_SPEC.md`](ASSET_SPEC.md), [`AUDIO_SPEC.md`](AUDIO_SPEC.md) — then only the files the current ticket touches. Never re-read the whole repo.

## Workspace
- **Branch / worktree:** `feat/byte-pet-demo` at `/Volumes/SD500/Documents/personal/portfolio_lc/.claude/worktrees/byte-pet-demo`
- The Vite + TS app root = **worktree root**. Keep the **SD500 drive mounted** (a disconnect deletes the worktree from view until remounted).

## Execution model
- **Style:** `superpowers:subagent-driven-development` (chosen 2026-08-21).
- Per ticket: expand into bite-sized TDD steps → fresh subagent per step-group → review between → commit per ticket → **`/clear` between tickets**. T6 is a hard **owner play-test** stop.

## Log (newest first)
- **2026-08-21 — T1 QA (controller browser pass) — PASS.** Vite dev @ :5180; verified both themes across 1440×900 / 768×1024 / 390×844.
  - Zero console errors (all viewports/themes).
  - **CLS-0:** hero `<h1>` `min-height` 218px, rect height identical (218px) across a theme toggle → no shift.
  - **No-flash + persistence:** reload applies `localStorage['byte-theme']` before paint; `data-theme`/`data-type`/`data-glow` all set on `<html>` (grotesk/mint defaults).
  - **Theme toggle** button flips + persists; ~400ms token crossfade.
  - **Grain:** `position:fixed`, `pointer-events:none`, `z-index:9999`, runtime noise tile; opacity .06 light / .08 dark (exactly at ceilings).
  - No horizontal overflow at 390px. Tokens resolve (light paper `#f4f1ea`/ink `#16151a`; dark paper `#0e0d12`/ink `#f2f0f5`); Space Grotesk active.
  - **Open for owner:** lock derived palette; `--accent` light `#c1502c`=4.18:1 on paper & `::selection` accent/glow ≈3:1 (WCAG AA caveats — see swatch review). Build/lint/format/test all green (per task reports). SDD ledger: `.superpowers/sdd/t1-plan/progress.md`.
- **2026-08-21 — T0 DONE (no code).** Grill complete; SPEC + companions written & committed (`60378a3`, `d53d217`); ticket roadmap written & committed (`dcab4c3`); roadmap approved; execution style = subagent-driven. `gsap-skills` plugin installed to `~/.claude/skills/`.
- **NEXT → T1 — Scaffold, tooling & design tokens.** On session start: read `docs/*`, then invoke `superpowers:subagent-driven-development` to execute T1 from `TICKETS.md`. **Owner checkpoint mid-T1:** review derived palette swatches (both themes) before locking tokens. Ask before downloading fonts.

## Open owner deliverables (not blocking)
- Byte's rigged `.glb` per `ASSET_SPEC.md` → triggers **T-GLB** (late).
- Recorded sounds per `AUDIO_SPEC.md` → triggers **T-Audio** (late).
- Real email + social URLs (placeholders stand in until then).
