"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics page views, minus any browser with localStorage
 * "va-disable" set (the owner's own). Vercel's script already ignores
 * automated and headless browsers. It's a client wrapper because a server
 * layout can't pass a function prop like beforeSend.
 */
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        try {
          if (localStorage.getItem("va-disable")) return null;
        } catch {
          // Storage is blocked, so this can't be the owner's flagged browser.
        }
        return event;
      }}
    />
  );
}
