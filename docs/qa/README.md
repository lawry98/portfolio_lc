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

| # | Check | How to run | Evidence already in place |
|---|---|---|---|
| 1 | **True 60 fps** across the full run | Real browser; record a 10 s rAF/Performance trace during entrance → feed×N → retype → migrate; expect > 32 ms long frames ≤ 2 / 10 s (SPEC §13) | All motion on one `gsap.ticker`; TBT 20 ms (LH); compositor-friendly transforms/opacity; per-frame `THREE.Color` allocations hoisted in T9 |
| 2 | **Heap stable after 50 feeds** | DevTools Memory: heap snapshot, feed 50×, force GC, snapshot again; expect no unbounded growth | T9 proved leak-free via `stepGsap`: scene mesh/points **6 → 6**, front-layer children → 1, glyph queue 0; every eaten/popped glyph geometry+material disposed |
| 3 | **`prefers-reduced-motion`** on a real device | OS "Reduce Motion" on → reload: blink stays, hops/dashes → fades, parallax off, reveals instant, grain frozen; toggle live mid-session (Byte self-detects) | Live `gsap.matchMedia()` self-detect (D-17, R9-3); reduced branches unit-tested + review-verified across hero/manifesto/reveals/pet |
| 4 | **Migration 2nd-leg feel** (footer → hero re-home) | Scroll down (Byte migrates to footer, retypes CTA) then back up; the reversible lane should re-home smoothly with no snap | Reversible live-`pickAnchor` lane (R8-2); `quickTo.resetTo`-after-kill reacquire; `anchor.ts` pure + unit-tested |
| 5 | **~30 s loop GIF + hero stills** | Record the signature loop (entrance → feed → retype reward → migrate) → `docs/qa/`; grab light + dark hero screenshots | Deliverable pending a real-browser capture (see the Claude-in-Chrome note above) |
| 6 | **Screen-reader spot-check** of the manifesto reveals (new, T10) | VoiceOver / NVDA over the manifesto: confirm the three lines read cleanly as text now that SplitText's `aria:'none'` leaves the line text (not an `aria-label`) as the accessible content | Line-level split (not chars) preserves word order; Lighthouse `aria-prohibited-attr` now PASS; the accepted tradeoff behind fix #1 above |

> Media (GIF + screenshots) is intentionally absent from this commit — it can't be captured in the
> current environment. Drop the files into `docs/qa/` when captured on a real browser.
