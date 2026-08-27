import { describe, it, expect } from 'vitest';
import { stripUnlockedFontFaces } from './vite.plugins';

// Mirrors tokens.css: 3 families × @font-face + the 3 data-type variant rules
// (which also NAME the families as CSS custom-property strings).
const CSS = `
@font-face { font-family: 'Space Grotesk'; src: url('./fonts/space-grotesk-500.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'Space Grotesk'; src: url('./fonts/space-grotesk-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'JetBrains Mono'; src: url('./fonts/jetbrains-mono-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'JetBrains Mono'; src: url('./fonts/jetbrains-mono-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Clash Display'; src: url('./fonts/clash-display-600.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Clash Display'; src: url('./fonts/clash-display-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
:root[data-type='grotesk'] { --font-display: 'Space Grotesk', sans-serif; }
:root[data-type='mono'] { --font-display: 'JetBrains Mono', monospace; }
:root[data-type='clash'] { --font-display: 'Clash Display', sans-serif; }
`;
const faceCount = (s: string) => (s.match(/@font-face/g) ?? []).length;

describe('stripUnlockedFontFaces', () => {
  it('drops every non-locked @font-face block (only Space Grotesk survives)', () => {
    const out = stripUnlockedFontFaces(CSS, ['Space Grotesk']);
    expect(faceCount(out)).toBe(2); // both grotesk weights
    const faces = out.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces.every((f) => f.includes('Space Grotesk'))).toBe(true);
    expect(out).not.toMatch(/@font-face[^}]*JetBrains Mono/);
    expect(out).not.toMatch(/@font-face[^}]*Clash Display/);
    // the release will not emit these woff2 (no surviving url() references them):
    expect(out).not.toContain('jetbrains-mono');
    expect(out).not.toContain('clash-display');
    expect(out).toContain('space-grotesk-700.woff2');
  });
  it('preserves non-@font-face rules (the data-type variant vars stay)', () => {
    const out = stripUnlockedFontFaces(CSS, ['Space Grotesk']);
    expect(out).toContain("data-type='mono'"); // variant rule untouched
    expect(out).toContain('--font-display');
  });
  it('keeps multiple families when asked', () => {
    const out = stripUnlockedFontFaces(CSS, ['Space Grotesk', 'Clash Display']);
    expect(faceCount(out)).toBe(4);
    expect(out).toContain('clash-display-700.woff2');
    expect(out).not.toContain('jetbrains-mono');
  });
  it('is a no-op when all families are kept (dev parity)', () => {
    const out = stripUnlockedFontFaces(CSS, ['Space Grotesk', 'JetBrains Mono', 'Clash Display']);
    expect(faceCount(out)).toBe(6);
  });
});
