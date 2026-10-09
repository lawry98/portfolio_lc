"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import {
  useAnimationControls,
  useInView,
  type UseInViewOptions,
} from "framer-motion";

// One document listener serves every subscriber on the page.
const subscribers = new Set<(targetId: string) => void>();

function handleClick(event: MouseEvent) {
  if (event.button !== 0) return;
  // Modified clicks open a new tab, so nothing here should replay.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
  const href = link?.getAttribute("href");
  if (typeof href === "string") {
    subscribers.forEach((notify) => notify(href.slice(1)));
  }
}

/**
 * Calls `onClick` with the target id whenever an in-page link (navbar, mobile
 * menu, hero buttons) is clicked. The "#" link to the top gives "".
 */
export function useInPageLinkClick(onClick: (targetId: string) => void) {
  const notify = useEffectEvent(onClick);

  useEffect(() => {
    const subscriber = (targetId: string) => notify(targetId);
    if (subscribers.size === 0) document.addEventListener("click", handleClick);
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        document.removeEventListener("click", handleClick);
      }
    };
  }, []);
}

/**
 * Plays the "visible" variant the first time the element scrolls into view,
 * like `whileInView` with `once`, and again whenever a link jumps to its
 * section. Put `ref` on the motion element, with `initial="hidden"` and
 * `animate={controls}`.
 */
export function useReveal(margin: UseInViewOptions["margin"]) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const inView = useInView(ref, { margin });
  const inViewNow = useRef(false);
  const pending = useRef(true);

  useEffect(() => {
    inViewNow.current = inView;
    if (inView && pending.current) {
      pending.current = false;
      controls.start("visible");
    }
  }, [inView, controls]);

  useInPageLinkClick((sectionId) => {
    if (!sectionId || ref.current?.closest("section")?.id !== sectionId) return;
    controls.set("hidden");
    // Already on screen: play now. Otherwise play on arrival, which the
    // link's smooth scroll is about to cause.
    if (inViewNow.current) controls.start("visible");
    else pending.current = true;
  });

  return { ref, controls };
}
