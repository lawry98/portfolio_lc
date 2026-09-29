import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { featuredExperience } from "@/data/experience";
import { site } from "@/data/site";
import { siteHost } from "@/lib/seo";
import { HeroBackdrop, LcMark, loadOgFonts, ogColors, ogSize } from "@/lib/og";

const qp = featuredExperience!;

export const alt = `${qp.company} case study by ${site.name}`;
export const size = ogSize;
export const contentType = "image/png";

// Satori can't decode webp, so the card reads a JPEG copy of
// public/projects/quill-and-pigeon-homepage.webp.
const screenshotPath = join(
  process.cwd(),
  "src/assets/og/quill-and-pigeon-homepage.jpg",
);

// The case study's preview card: title and summary beside the storefront.
export default async function Image() {
  const screenshot = `data:image/jpeg;base64,${await readFile(screenshotPath, "base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: ogColors.background,
          color: ogColors.foreground,
          fontFamily: "Inter",
        }}
      >
        <HeroBackdrop />
        <div
          style={{
            width: 600,
            padding: "72px 0 64px 84px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "0.14em",
                color: ogColors.mutedForeground,
              }}
            >
              CASE STUDY
            </div>
            <div
              style={{
                fontSize: 92,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginTop: 18,
              }}
            >
              {qp.company}
            </div>
            <div
              style={{
                fontSize: 31,
                lineHeight: 1.3,
                color: ogColors.mutedForeground,
                marginTop: 22,
                maxWidth: 470,
              }}
            >
              Multi-tenant commerce platform with subscriptions, context-aware
              AI and search
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 25,
              color: ogColors.mutedForeground,
            }}
          >
            <LcMark size={52} />
            <span style={{ color: ogColors.foreground, fontWeight: 600 }}>
              {site.name}
            </span>
            {siteHost && <span>· {siteHost}</span>}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 640,
            top: 112,
            width: 720,
            display: "flex",
            flexDirection: "column",
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${ogColors.border}`,
            background: ogColors.muted,
            boxShadow:
              "0 30px 60px rgba(0, 0, 0, 0.18), 0 8px 20px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div
            style={{
              height: 38,
              display: "flex",
              alignItems: "center",
              gap: 9,
              paddingLeft: 18,
              borderBottom: `1px solid ${ogColors.border}`,
            }}
          >
            {[0, 1, 2].map((dot) => (
              <div
                key={dot}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  background: ogColors.mutedForeground,
                  opacity: 0.45,
                }}
              />
            ))}
          </div>
          <img
            src={screenshot}
            width={720}
            height={404}
            alt=""
            style={{ objectFit: "cover", objectPosition: "top left" }}
          />
        </div>
      </div>
    ),
    { ...size, fonts: await loadOgFonts() },
  );
}
