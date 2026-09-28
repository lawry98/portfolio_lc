/**
 * Theme reveal — the page's half of a theme switch (spec D10): swap the theme
 * inside a View Transition and expand the new view as a circle from `origin`
 * (Byte's chest light, or the toggle when Byte can't act). Reduced motion gets
 * an opacity crossfade instead of the circle (D8).
 *
 * Page-agnostic on purpose: it knows nothing about Byte or about how the theme
 * is stored — `apply` does the actual swap — so the portfolio can reuse it
 * with its own `.dark` class. Browsers without View Transitions just apply.
 * The animations run through WAAPI (`element.animate`), which the global
 * reduced-motion CSS freeze doesn't touch — the crossfade is chosen by `opts`.
 */

/** Circle reveal length; `THEME_SWITCH_LERP_S` (pet/themeGesture.ts) matches it. */
export const REVEAL_MS = 620;
/** Reduced-motion crossfade length. */
export const CROSSFADE_MS = 400;
const REVEAL_EASE = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
const NEW_VIEW = '::view-transition-new(root)';

/** Radius that covers the whole viewport from `(x, y)`: the distance to the farthest corner. */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function revealTheme(
  apply: () => void,
  origin: { x: number; y: number },
  opts: { reduced: boolean },
): Promise<void> {
  if (typeof document.startViewTransition !== 'function') {
    apply();
    return Promise.resolve();
  }
  const transition = document.startViewTransition(apply);
  // A transition the browser skips (tab hidden, superseded) rejects these, but
  // the update callback still ran — the theme is applied either way.
  transition.finished.catch(() => {});
  transition.updateCallbackDone.catch(() => {});

  const width = window.innerWidth;
  const height = window.innerHeight;
  const x = clamp(origin.x, 0, width);
  const y = clamp(origin.y, 0, height);
  const root = document.documentElement;

  return transition.ready
    .then(() => {
      const animation = opts.reduced
        ? root.animate(
            { opacity: [0, 1] },
            { duration: CROSSFADE_MS, easing: 'ease', pseudoElement: NEW_VIEW },
          )
        : root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${revealRadius(x, y, width, height)}px at ${x}px ${y}px)`,
              ],
            },
            { duration: REVEAL_MS, easing: REVEAL_EASE, pseudoElement: NEW_VIEW },
          );
      return animation.finished.then(() => undefined);
    })
    .catch(() => undefined);
}
