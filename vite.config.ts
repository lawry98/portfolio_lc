import { defineConfig } from 'vite';

// Minimal Vite config. Root is the worktree root; the dev server port is
// pinned so local QA and screenshots hit a reproducible URL.
export default defineConfig({
  root: '.',
  server: {
    port: 5180,
    strictPort: true,
  },
});
