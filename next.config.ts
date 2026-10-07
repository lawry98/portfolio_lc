import type { NextConfig } from "next";
import { site } from "./src/data/site";

const nextConfig: NextConfig = {
  // Stop `next dev` from writing AGENTS.md and CLAUDE.md into the repo root
  // whenever it detects an AI coding agent.
  agentRules: false,
  // The résumé lists a phone number, so keep the PDF itself out of search
  // results. The site's pages stay indexable.
  async headers() {
    return [
      {
        source: site.resume,
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
