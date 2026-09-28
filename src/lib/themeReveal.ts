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
 *
 * The circle grows a registered `--theme-reveal-r` that global.css's
 * `clip-path` reads, instead of animating `clip-path` directly: Chrome runs a
 * WAAPI clip-path animation on the compositor and scales the circle by
 * 1/devicePixelRatio there, so on a Retina screen it grew from half the
 * origin's coordinates, up-left of Byte (2026-09-28). A custom property
 * animates on the main thread, which paints it at the right place.
 */

/** Circle reveal length; `THEME_SWITCH_LERP_S` (pet/themeGesture.ts) matches it. */
export const REVEAL_MS = 620;
/** Reduced-motion crossfade length. */
export const CROSSFADE_MS = 400;
const REVEAL_EASE = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
const NEW_VIEW = '::view-transition-new(root)';
/** Set on the root while a circle reveal runs; global.css scopes the clip to it. */
const REVEAL_ATTR = 'data-theme-reveal';

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
  const width = window.innerWidth;
  const height = window.innerHeight;
  const x = clamp(origin.x, 0, width);
  const y = clamp(origin.y, 0, height);
  const root = document.documentElement;
  if (!opts.reduced) {
    root.setAttribute(REVEAL_ATTR, '');
    root.style.setProperty('--theme-reveal-x', `${x}px`);
    root.style.setProperty('--theme-reveal-y', `${y}px`);
  }
  const clearOrigin = (): void => {
    root.removeAttribute(REVEAL_ATTR);
    root.style.removeProperty('--theme-reveal-x');
    root.style.removeProperty('--theme-reveal-y');
  };

  const transition = document.startViewTransition(apply);
  // A transition the browser skips (tab hidden, superseded) rejects these, but
  // the update callback still ran — the theme is applied either way.
  transition.finished.catch(() => {});
  transition.updateCallbackDone.catch(() => {});

  return transition.ready
    .then(() => {
      const animation = opts.reduced
        ? root.animate(
            { opacity: [0, 1] },
            { duration: CROSSFADE_MS, easing: 'ease', pseudoElement: NEW_VIEW },
          )
        : root.animate(
            { '--theme-reveal-r': ['0px', `${revealRadius(x, y, width, height)}px`] },
            // `forwards` holds the full radius until the transition tears the
            // pseudo down — the property's 0px initial value would hide the view.
            { duration: REVEAL_MS, easing: REVEAL_EASE, pseudoElement: NEW_VIEW, fill: 'forwards' },
          );
      return animation.finished.then(() => undefined);
    })
    .catch(() => undefined)
    .finally(clearOrigin);
}
