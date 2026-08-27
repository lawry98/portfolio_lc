import { defineConfig } from 'vite';
import { lockFontsPlugin } from './vite.plugins';

// Root is the worktree root; dev + preview ports are pinned so local QA and
// screenshots hit reproducible URLs.
export default defineConfig({
  root: '.',
  server: { port: 5180, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // Release ships only the locked display family (Space Grotesk); dev keeps all
  // three for the ?lab chooser (SPEC §7/§13).
  plugins: [lockFontsPlugin(['Space Grotesk'])],
  build: {
    // three + gsap are ~500KB+ RAW but ~200KB gz. SPEC §13's budget is on gzip
    // (currently 209.90/280) — accept the raw-size warning rather than
    // code-split a tiny single-page demo (ruling R10-3).
    chunkSizeWarningLimit: 750,
  },
});
