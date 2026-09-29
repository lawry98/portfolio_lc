import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const ogSize = { width: 1200, height: 630 };

// The dark tokens from globals.css as hex, since Satori can't parse oklch().
export const ogColors = {
  background: "#0a0a0a", // --background oklch(0.145 0 0)
  foreground: "#fafafa", // --foreground oklch(0.985 0 0)
  mutedForeground: "#a1a1a1", // --muted-foreground oklch(0.708 0 0)
  muted: "#262626", // --muted oklch(0.269 0 0)
  border: "rgba(255, 255, 255, 0.1)", // --border oklch(1 0 0 / 10%)
  gradientEnd: "#121212", // the hero's to-muted/30 over --background
};

const fontDir = join(process.cwd(), "src/assets/fonts");

// Satori reads ttf/otf/woff but not the woff2 that next/font serves, so the
// cards load Inter's Latin woff files from the repo.
export function loadOgFonts() {
  return Promise.all(
    ([400, 500, 600, 700] as const).map(async (weight) => ({
      name: "Inter",
      data: await readFile(join(fontDir, `inter-latin-${weight}-normal.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
}

const fill = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  display: "flex",
} as const;

// The hero's backdrop: a fade toward --muted, under a 60px grid at 3%.
export function HeroBackdrop() {
  const { background, foreground, gradientEnd } = ogColors;
  return (
    <div style={fill}>
      <div
        style={{
          ...fill,
          backgroundImage: `linear-gradient(to bottom, ${background}, ${background}, ${gradientEnd})`,
        }}
      />
      <div
        style={{
          ...fill,
          opacity: 0.03,
          backgroundImage: `linear-gradient(${foreground} 1px, transparent 1px), linear-gradient(90deg, ${foreground} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

// The favicon's LC mark (src/app/icon.svg), scaled from its 64px geometry.
export function LcMark({ size }: { size: number }) {
  const unit = size / 64;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14 * unit,
        background: "#111111",
        border: `2px solid ${ogColors.border}`,
        color: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 26 * unit,
        fontWeight: 700,
        letterSpacing: -unit,
      }}
    >
      LC
    </div>
  );
}
