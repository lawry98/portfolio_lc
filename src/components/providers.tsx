"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * App-wide providers. MotionConfig with reducedMotion="user" makes Framer
 * Motion honor the user's prefers-reduced-motion setting for every animation
 * (transforms/layout are disabled, opacity is preserved).
 */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
