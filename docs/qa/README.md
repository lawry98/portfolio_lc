# QA — Byte Pet Demo (T10 release)

Release-QA record for the Byte demo. Two halves: **what was verified in-session** (prod-build
packaging QA + a real Lighthouse mobile run) and the **on-device residuals** — checks the session
environment can't produce (a rAF-frozen headless Browser pane, no `prefers-reduced-motion`
emulation, no animated-GIF/pixel capture), each listed with how to run it and the code/unit evidence
that already backs it.

All numbers below are from the production build + `vite preview` (`:4173`) at **`feat/byte-pet-demo`
HEAD `c7995dd`** (T10 complete). Reproduce with:

```bash
mise exec node@22 -- npm run build
mise exec node@22 -- npm run preview   # serves the prod build on http://localhost:4173
```

---

## 1. Prod-build packaging QA — ✅ PASS

Verified against the real production artifact in the browser (via `vite preview`, not the dev
server):

- **One type system:** `document.fonts` lists **only Space Grotesk** (500 + 700); no JetBrains Mono
  / Clash Display. `dist/assets/*.woff2` = the two `space-grotesk-*` files only (the build-time
  `lockFontsPlugin` strips the non-locked `@font-face` blocks — SPEC §13).
- **Locked config ships:** `#hero-headline` computed font = Space Grotesk; `<html>` dataset
  `theme` (light/dark per OS), `type=grotesk`, `glow=mint`; Byte's dark-mode emissive = **mint
  `#38e8a8`**; hero cycle = the **Identity** phrase set; **no tooltip**.
- **`?lab` hidden in prod:** no Style-Lab panel at `/` **or** `/?lab` — the panel is
  `import.meta.env.DEV`-gated and tree-shaken out of the release bundle (SPEC §7).
- **Scene intact:** both WebGL canvases (`#gl-back` / `#gl-front`) present; **zero console errors**.
- **CLS 0** and the favicon/​source-map/​icon-link additions all serve correctly (`/favicon.svg` →
  200, `/assets/index-*.js.map` → 200, `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
  in `<head>`).

Byte's runtime interaction (feed → dash → eat → retype reward, sleep/wake, hero↔footer migration,
theme reaction) is **byte-identical to T9's passing full-QA** — T10 changed no `src/pet/*` runtime
(only the prod `?lab` dev-gate + this ticket's a11y/BP fixes), confirmed by the whole-branch review.

## 2. Bundle budgets (SPEC §13) — ✅ under

| Asset | Size (gz) | Ceiling | |
|---|---|---|---|
| JS | **206.4 KB** (`gzip -c`; Vite-log `gzip-size` reports 208.9 KB — same bytes, different convention) | ≤ 280 KB | ✅ |
| CSS | **3.34 KB** | ≤ 20 KB | ✅ |
| Fonts (prod) | **26.15 KB** — Space Grotesk 500 + 700 only | ≤ 120 KB, one family | ✅ |

The raw (uncompressed) JS chunk is ~738 KB (three + gsap) — a pre-existing size **orthogonal to the
gz budget** (206.4 ≪ 280). Accepted + documented (ruling **R10-3**): `build.chunkSizeWarningLimit`
is raised so `vite build` is clean; no code-splitting of a single-page demo. Source maps
(`build.sourcemap`, T10) are separate `.map` assets and do **not** count toward the JS gz budget.

## 3. Lighthouse mobile — ✅ PASS (DoD met)

Real headless-Chrome run (`lighthouse@12`), mobile form factor, against `vite preview` (`:4173`):

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  mise exec node@22 -- npx --yes lighthouse@12 http://localhost:4173/ \
  --only-categories=performance,accessibility,best-practices \
  --form-factor=mobile --screenEmulation.mobile --quiet \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
  --output=json --output-path=/tmp/lh-byte.json
```

| Metric | Before (a11y/BP fixes) | **After (T10)** | DoD | |
|---|---|---|---|---|
| Performance | 95 | **96** | ≥ 90 | ✅ |
| Accessibility | 89 | **100** | ≥ 95 | ✅ |
| Best-Practices | 96 | **100** | = 100 | ✅ |
| CLS | 0 | **0** | 0 | ✅ |
| LCP | 2.3 s | 2.3 s | < 2.0 s | ⚠️ **accepted** |
| TBT | 90 ms | 20 ms | — | ✅ |

**Four audits fixed (FAIL → PASS)** — the T10 a11y/BP wave:

1. `aria-prohibited-attr` — GSAP SplitText's default `aria:'auto'` put an `aria-label` on the
   role-less `.manifesto__line` `<span>`s. Fixed by `aria:'none'` in `revealLines()`
   (`src/page/reveals.ts`); the visible line text is the accessible name.
2. `color-contrast` — the muted label token failed WCAG AA. `--muted` darkened to `#65636f` (light)
   / lightened to `#838093` (dark), clearing **4.5:1 on both `--paper` and `--paper-2` in both
   themes** (measured: light 5.22 / 4.69, dark 5.05 / 4.68).
3. `errors-in-console` — `/favicon.ico` 404. Fixed with `public/favicon.svg` (a mint `>_` prompt
   glyph) + `<link rel="icon">`.
4. `valid-source-maps` — enabled `build.sourcemap` (the `lockFontsPlugin` transform returns a valid
   empty map so the build stays warning-free).

**LCP 2.3 s is accepted** (owner ruling): FCP/LCP/Speed-Index are all bounded by the eager
`three` + `gsap` parse on LH's 4× mobile-CPU throttle. Performance still scores **96**. The real
remedy — lazy-loading `three` — is deferred as a **future perf ticket** (it complicates the Next.js
integration story, where Next owns chunking, for no gz win). The remaining Perf "opportunities"
(render-blocking, unused-JS, forced-reflow, network-dependency-tree) are the same one cause.

---

## 4. On-device residuals (owner / real-device checks)

These are **not producible in this session** (the Browser pane forces `visibilityState:hidden` →
the GSAP ticker/rAF is frozen; there is no `prefers-reduced-motion` emulation; animated-GIF and
canvas-pixel capture are blocked). Each is already backed by code + unit tests + prior in-pane QA;
run these on a real device/browser to close them out. **Reconnecting the Claude-in-Chrome extension
would let the controller capture the GIF + a device Lighthouse + screenshots directly.**

Rows 7–12 are **T12**'s residuals (scroll-bounds stage clip, containment clamp, hand-off fade) —
the same limitation, stated plainly for this ticket: `document.visibilityState` was permanently
`hidden` in the session's Browser pane, so rAF never fired, `gsap.ticker` never ran, and Byte
never drew; no real Chrome was connected either. **Nothing below was seen animated on screen** —
each row is backed by the geometry/unit evidence cited, drawn from the full controller sweep at
`.superpowers/sdd/t11-plan/qa-geometry.md`.

| # | Check | How to run | Evidence already in place |
|---|---|---|---|
| 1 | **True 60 fps** across the full run | Real browser; record a 10 s rAF/Performance trace during entrance → feed×N → retype → migrate; expect > 32 ms long frames ≤ 2 / 10 s (SPEC §13) | All motion on one `gsap.ticker`; TBT 20 ms (LH); compositor-friendly transforms/opacity; per-frame `THREE.Color` allocations hoisted in T9 |
| 2 | **Heap stable after 50 feeds** | DevTools Memory: heap snapshot, feed 50×, force GC, snapshot again; expect no unbounded growth | T9 proved leak-free via `stepGsap`: scene mesh/points **6 → 6**, front-layer children → 1, glyph queue 0; every eaten/popped glyph geometry+material disposed |
| 3 | **`prefers-reduced-motion`** on a real device | OS "Reduce Motion" on → reload: blink stays, hops/dashes → fades, parallax off, reveals instant, grain frozen; toggle live mid-session (Byte self-detects) | Live `gsap.matchMedia()` self-detect (D-17, R9-3); reduced branches unit-tested + review-verified across hero/manifesto/reveals/pet |
| 4 | **Migration 2nd-leg feel** (footer → hero re-home) | Scroll down (Byte migrates to footer, retypes CTA) then back up; the reversible lane should re-home smoothly with no snap | Reversible live-`pickAnchor` lane (R8-2); lane pair halted (not killed) at arrival, return leg verified in headless Chrome 2026-09-24 (`PROGRESS.md`); `anchor.ts` pure + unit-tested |
| 5 | **~30 s loop GIF + hero stills** | Record the signature loop (entrance → feed → retype reward → migrate) → `docs/qa/`; grab light + dark hero screenshots | Deliverable pending a real-browser capture (see the Claude-in-Chrome note above) |
| 6 | **Screen-reader spot-check** of the manifesto reveals (new, T10) | VoiceOver / NVDA over the manifesto: confirm the three lines read cleanly as text now that SplitText's `aria:'none'` leaves the line text (not an `aria-label`) as the accessible content | Line-level split (not chars) preserves word order; Lighthouse `aria-prohibited-attr` now PASS; the accepted tradeoff behind fix #1 above |
| 7 | **Mid-trip feed** (T12 — highest-value check, most likely to look broken) | Start a hero→footer scroll trip, then click/feed Byte in the hero mid-trip (before `ARRIVED`): expect the spawnPop sound to play and the FED counter to increment immediately, but **nothing visible happens for ~1–2 s**, then Byte pops back in partway through the 0.3 s reacquire glide | `fsm.ts`'s `traveling --FEED--> dashing` edge restores opacity to 1 while the active stage is still the *old* (hero) one and Byte dashes to the lane point outside it — the "opacity is ~0 throughout `traveling`" rationale was ruled FALSE in review (D-21/R12-2: **the fade is not the guarantee, the scissor is**); the empirical DPR-2 GL scissor proof (Y-flip exact to the pixel; ghost-clear bug confirmed real) backs the clip that keeps Byte hidden here; settled design row 1 in `docs/TICKETS.md`, "Byte is never visible between them" — this is the design working as specified, not a dropped frame |
| 8 | **The hand-off fade**, both directions, plus a mid-trip reversal (T12) | Scroll hero→footer (watch the dip-out/fade-in at the footer) then scroll straight back up mid-trip; expect Byte to dip out and fade back in on the hero cleanly, no snap | `STAGE_FADE_DURATION_S` (0.3 s per leg) opacity tween wired through `fsm.onEnter` only, no FSM edit (R12-5); T8's reversible live-`pickAnchor` lane (R8-2, same evidence as row 4 above) already covers the no-snap reversal mechanics, unit-tested in `anchor.ts` |
| 9 | **Byte's resting position at ≤768px** (T12 containment clamp) | Load at 768×1024 and 390×844 in both themes; confirm Byte's hero rest reads intentional against the headline text, not cramped | Measured clamp deltas (`qa-geometry.md`): a complete no-op at 1440×900 (Δx 0 at both homes); pulls the **hero** anchor left **−23px @768×1024**, **−14px @390×844** (the footer never clamps at any viewport) because the bound is the section box — scrollbar-excluded — not the viewport. `STAGE_CLAMP_PAD_PX` (12, `src/pet/createBytePet.ts:281`) is the single tunable if it reads too tight against the text |
| 10 | **Reduced motion** re-home (T12) | OS "Reduce Motion" on → trigger a hero↔footer migration; confirm it reads as a clean instant switch, not a flicker | The 0.3 s hand-off fade does not branch on `reducedActive`, and `runMigrationReduced`'s `traveling` span is ~1 tick, so the dip is arithmetically ~0.6% of the fade — effectively invisible; code-level evidence only, since an animated fade has no geometry-sweep equivalent in `qa-geometry.md` |
| 11 | **A feed clicked near the far right of the hero** (T12, cosmetic/marginal) | Feed Byte while it dashes toward a point near the hero's right edge; check whether Byte/the glyph is sliced noticeably earlier than the screen edge | R12-7: the containment clamp guards the steady-state hard-pin and the reacquire target, not the dash — "a dash may still reach the clip edge by design," with the scissor as the stated backstop (design row 5); the dash target's X is unclamped and the stage's right edge is the section box (scrollbar-excluded), the same effect the measured **11px** hero-anchor overflow @768×1024 (`qa-geometry.md`) already demonstrates against the viewport edge |
| 12 | **Occlusion weave intact through the clip**, and true 60 fps with T12's two extra per-frame full clears (T12) | Real browser; confirm Byte still passes behind a letterform (SPEC §15) inside the clipped stage, and record a 10 s rAF/Performance trace to confirm the scissor-off full clear on both renderers, every frame (R12-2/R12-3's clear-order requirement), doesn't push long frames past row 1's budget | Empirical DPR-2 GL scissor proof: clear order is scissor-bound and correct (R12-2 confirmed empirically — stale pixels persist without the scissor-off full clear, so the ghost bug the ordering prevents is real, not theoretical); theme invariance (byte-identical rects light↔dark, `qa-geometry.md`) confirms the clip geometry itself never shifts with theme, so this check needs no separate run per theme |
| 13 | **`prefers-reduced-motion` with the real GLB** (T-GLB) | OS "Reduce Motion" on → reload and trigger a load: confirm the swap is instant (no pop), Byte holds its rest pose with blink/look still running, and the reduced-peek fade (R-GLB-2) is visible | Headless Chrome *did* emulate reduced motion for this ticket (R-GLB-20) and confirmed the logic: swap instant / no pop, Body opacity 1→0.45→1 with `transparent` toggled correctly, blink continues — but that is emulation, not a real OS toggle; the real-device pass is this row |
| 14 | **True 60 fps with the 36k-tri skinned mesh** on a real phone (T-GLB) | Real mobile browser; record a 10 s rAF/Performance trace through the full run (entrance → feed×N → sleep/wake → migrate) with the GLB (not the placeholder) live. Also watch the swap moment and the first peek behind specifically for a one-off shader-compile hitch — each WebGL canvas compiles the skinned programs on its first draw, a cost the 10 s idle trace won't surface | Headless Chrome's 10 s idle trace measured 60.1 fps, 0 frames > 33 ms, max 16.8 ms — but headless Chrome's GPU path can differ materially from a real phone's with a real skinned mesh; the mobile-GPU pass is this row |
| 15 | **DoubleSided inner faces during the reduced fade** on real hardware (T-GLB) | OS "Reduce Motion" on, trigger the reduced-peek fade, look for the model's doubleSided inner geometry showing through at partial opacity | Headless Chrome QA observed this directly under emulation ("doubleSided inner faces are faintly visible through the fade") — confirming it's real, not a headless-only artifact — but a real GPU's blending/depth behavior can still look different; worth a real-device eyeball |
| 16 | **Slow-network placeholder-then-pop** on a real throttled connection (T-GLB) | Real browser, real network throttling (not CDP `Fetch` interception, R-GLB-21) at a slow profile; confirm the preloader lifts with the placeholder at its cap and the real model pops in once it lands | Headless Chrome held the model request 7 s via CDP `Fetch` and confirmed the mechanism (preloader lifted at its 4 s cap with the placeholder; model resolved ≈7.3 s later and swapped in at `idle` with the pop, `pose.scale.y` 1→0.47→1.12→1.00) — a real throttled connection is the row this leaves open |
| 17 | **The visor bottom-rim speckle and the eyes** on a real GPU / DPR 3 phone (T-GLB, R-GLB-19 watch) | Real phone at DPR ≥ 3; look at Byte's eyes and the visor's bottom rim — both should read clean, with no head-shell speckle through the visor | **Fixed by D-23**: the camera's clip planes now scale with its distance (near = distance / 10), taking the depth step at Byte from ≈ 1.7px to ≈ 0.001px; headless Chrome at DPR 1 + 2, light + dark, shows a clean rim and eyes. Real-phone confirmation is what's left of this row |

> Media (GIF + screenshots) is intentionally absent from this commit — it can't be captured in the
> current environment. Drop the files into `docs/qa/` when captured on a real browser.
