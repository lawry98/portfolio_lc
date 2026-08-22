# Self-hosted fonts — Byte pet demo (T1)

Latin-subset woff2, downloaded 2026-08-21. Wire these via `@font-face` at the top of `src/styles/tokens.css`
(`src: url('./fonts/<file>') format('woff2')`, `font-display: swap`, matching weight/style).

| family (`font-family`) | weight | style  | file                       | source                    | license                            |
| ---------------------- | ------ | ------ | -------------------------- | ------------------------- | ---------------------------------- |
| `Space Grotesk`        | 700    | normal | `space-grotesk-700.woff2`  | Fontsource CDN (jsDelivr) | OFL 1.1                            |
| `Space Grotesk`        | 500    | normal | `space-grotesk-500.woff2`  | Fontsource CDN (jsDelivr) | OFL 1.1                            |
| `JetBrains Mono`       | 400    | normal | `jetbrains-mono-400.woff2` | Fontsource CDN (jsDelivr) | OFL 1.1                            |
| `JetBrains Mono`       | 700    | normal | `jetbrains-mono-700.woff2` | Fontsource CDN (jsDelivr) | OFL 1.1                            |
| `Clash Display`        | 600    | normal | `clash-display-600.woff2`  | Fontshare CDN (ITF)       | Fontshare (free, incl. commercial) |
| `Clash Display`        | 700    | normal | `clash-display-700.woff2`  | Fontshare CDN (ITF)       | Fontshare (free, incl. commercial) |

Total ≈ 99 KB (already Latin-subset; final per-glyph subsetting deferred to T10 per SPEC §13).
