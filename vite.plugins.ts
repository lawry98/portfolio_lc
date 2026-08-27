import type { Plugin } from 'vite';

/**
 * PURE. Remove every `@font-face { … }` block whose `font-family` is not in
 * `keepFamilies`. `@font-face` blocks contain no nested braces, so a single
 * non-greedy `{[^}]*}` match is safe. All other CSS (the `[data-type]` variant
 * rules, tokens, etc.) is returned untouched — so the family NAMES still appear
 * as CSS custom-property strings; only the asset-referencing @font-face (and
 * thus the emitted woff2) is dropped.
 */
export function stripUnlockedFontFaces(css: string, keepFamilies: string[]): string {
  return css.replace(/@font-face\s*\{[^}]*\}\s*/g, (block) => {
    const m = block.match(/font-family:\s*['"]([^'"]+)['"]/);
    const family = m ? m[1] : '';
    return keepFamilies.includes(family) ? block : '';
  });
}

/**
 * Build-only: dev serves all 3 font families (for the ?lab chooser, over budget
 * by design — SPEC §7); the release ships ONLY the locked display family. This
 * transforms tokens.css BEFORE Vite resolves its url()s (`enforce: 'pre'`), so
 * the non-locked woff2 are never emitted (SPEC §13 "one type system").
 */
export function lockFontsPlugin(keepFamilies: string[]): Plugin {
  return {
    name: 'byte:lock-fonts',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\?.*$/, '').endsWith('/styles/tokens.css')) return null;
      return { code: stripUnlockedFontFaces(code, keepFamilies), map: null };
    },
  };
}
