import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { site } from "@/data/site";
import { openGraphBase, siteUrl } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: site.title, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { ...openGraphBase, type: "website" },
  // Title, description and image are filled in from openGraph.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}