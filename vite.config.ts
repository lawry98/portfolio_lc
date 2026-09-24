import { defineConfig } from 'vite';
import { lockFontsPlugin } from './vite.plugins.js';

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
    // three + gsap are ~800KB RAW but ~220KB gz. SPEC §13's budget is on gzip
    // (T-GLB: ~225/280 entry + a ~21KB lazy GLTFLoader/meshopt chunk) — accept
    // the raw-size warning rather than code-split the core further (ruling
    // R10-3, revised by T-GLB row 9 / R-GLB-5: only the loader is split out).
    chunkSizeWarningLimit: 850,
    // Lighthouse BP `valid-source-maps`. Emitted `.map` files are separate
    // assets (not counted in the JS gz budget).
    sourcemap: true,
  },
});
