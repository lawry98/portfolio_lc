import type { Metadata } from "next";
import { site } from "@/data/site";

// The canonical origin: the custom domain once NEXT_PUBLIC_SITE_URL is set,
// Vercel's production URL until then, localhost for local builds.
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

// Preview cards print the domain only once a real one is set, so they never
// advertise a vercel.app or localhost address.
export const siteHost = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(siteUrl).host
  : null;

export const openGraphBase = { siteName: site.name, locale: "en_US" };

type PageSeo = {
  path: `/${string}`;
  title?: string;
  description: string;
  type?: "website" | "article";
};

// Next merges metadata shallowly, so a page that sets `openGraph` replaces the
// layout's whole object; this rebuilds it with the page's own URL and type.
export function pageMetadata({
  path,
  title,
  description,
  type = "website",
}: PageSeo): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, type, url: path },
  };
}

// The home page's schema.org graph: the site, and the person it's about.
// `sameAs` is what ties the GitHub and LinkedIn profiles to this name.
export function homeJsonLd() {
  const sameAs = Object.values(site.profiles).filter(
    (url): url is string => url !== null,
  );
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: site.name,
        publisher: { "@id": `${siteUrl}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#person`,
        name: site.name,
        url: siteUrl,
        jobTitle: site.jobTitle,
        alumniOf: { "@type": "CollegeOrUniversity", name: site.alumniOf },
        sameAs,
      },
    ],
  };
}
