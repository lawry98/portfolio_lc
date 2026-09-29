import { ImageResponse } from "next/og";
import { site } from "@/data/site";
import { siteHost } from "@/lib/seo";
import { HeroBackdrop, loadOgFonts, ogColors, ogSize } from "@/lib/og";

export const alt = `${site.name}, ${site.jobTitle}`;
export const size = ogSize;
export const contentType = "image/png";

// The site's preview card: the hero, as a still.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: ogColors.background,
          color: ogColors.foreground,
          fontFamily: "Inter",
        }}
      >
        <HeroBackdrop />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: -24,
          }}
        >
          <div
            style={{
              fontSize: 32,
              color: ogColors.mutedForeground,
              marginBottom: 18,
            }}
          >
            Hey, I&apos;m
          </div>
          <div
            style={{
              fontSize: 116,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              marginBottom: 30,
            }}
          >
            {site.name}
          </div>
          <div style={{ fontSize: 46, fontWeight: 500 }}>{site.jobTitle}</div>
        </div>
        {siteHost && (
          <div
            style={{
              position: "absolute",
              bottom: 50,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              fontSize: 27,
              color: ogColors.mutedForeground,
            }}
          >
            {siteHost}
          </div>
        )}
      </div>
    ),
    { ...size, fonts: await loadOgFonts() },
  );
}
