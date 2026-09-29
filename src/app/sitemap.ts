import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// No lastModified: a build timestamp would claim every page changed on every
// deploy, and Google stops trusting lastmod that's always new.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl }, { url: `${siteUrl}/work/quill-and-pigeon` }];
}
