import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from writing AGENTS.md and CLAUDE.md into the repo root
  // whenever it detects an AI coding agent.
  agentRules: false,
};

export default nextConfig;
