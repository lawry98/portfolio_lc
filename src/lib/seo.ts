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

// The home page's schema.org graph: the site, and the person it's about.
// `sameAs` is what ties the GitHub and LinkedIn profiles to this name.
export function homeJsonLd() {
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
        sameAs: Object.values(site.profiles),
      },
    ],
  };
}
