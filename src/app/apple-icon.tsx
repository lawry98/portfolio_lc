import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The favicon's LC mark as a full-bleed square, since iOS rounds the corners
// itself.
export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          color: "#fafafa",
          fontFamily: "Inter",
          fontSize: 73,
          fontWeight: 700,
          letterSpacing: -3,
        }}
      >
        LC
      </div>
    ),
    { ...size, fonts: await loadOgFonts() },
  );
}
