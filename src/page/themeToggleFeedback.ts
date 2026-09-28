/**
 * Toggle feedback — what the theme toggle shows between the click and Byte's
 * flip, so the wait reads as Byte charging rather than as lag (2026-09-28).
 * Two layers, both from the click:
 *  - a charge ring around the button (`--accent`) that fills over the plan's
 *    lead time and pops outward on the flip;
 *  - a spark (Byte's `--glow`) that arcs from the button to Byte's chest, or
 *    to the bottom-right edge Byte is about to rise from on a corner visit.
 *
 * Page-side and pet-agnostic like lib/themeReveal.ts: `main.ts` gets the lead
 * time and target from the pet's `onPlan` cue and calls `flip()` from its
 * `apply`. The caller skips it under reduced motion. Without WAAPI it no-ops.
 */

/** The spark's flight, button → target. */
export const SPARK_MS = 300;
/** The ring's pop-and-fade on the flip. */
export const RING_POP_MS = 380;

/** Ring radius in its 52-unit viewBox: 44px button + 4px each side, stroke centred at 24. */
const RING_R = 24;
const RING_LENGTH = 2 * Math.PI * RING_R;
const FILL_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)';
const SPARK_EASE = 'cubic-bezier(0.5, 0, 0.3, 1)';
/** Samples along the spark's arc (WAAPI interpolates straight lines between them). */
const SPARK_STEPS = 12;
/** How far the arc bows up, as a share of the flight distance. */
const SPARK_BOW = 0.15;
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface ToggleCharge {
  /** The flip beat: stop the fill and pop the ring. Idempotent. */
  flip(): void;
  /** Drop everything now (the switch ended without a flip). */
  cancel(): void;
}

const NOOP: ToggleCharge = { flip() {}, cancel() {} };

function ringFor(button: HTMLElement): SVGSVGElement {
  const existing = button.querySelector<SVGSVGElement>('svg.nav__theme-ring');
  if (existing) {
    return existing;
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'nav__theme-ring');
  svg.setAttribute('viewBox', '0 0 52 52');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '26');
  circle.setAttribute('cy', '26');
  circle.setAttribute('r', String(RING_R));
  circle.setAttribute('stroke-dasharray', String(RING_LENGTH));
  circle.setAttribute('stroke-dashoffset', String(RING_LENGTH));
  svg.append(circle);
  button.append(svg);
  return svg;
}

function launchSpark(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { el: HTMLElement; flight: Animation } {
  const spark = document.createElement('div');
  spark.className = 'theme-spark';
  spark.setAttribute('aria-hidden', 'true');
  document.body.append(spark);
  const bow = Math.hypot(to.x - from.x, to.y - from.y) * SPARK_BOW;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= SPARK_STEPS; i++) {
    const t = i / SPARK_STEPS;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * bow;
    frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 - t * 0.4})` });
  }
  const flight = spark.animate(frames, { duration: SPARK_MS, easing: SPARK_EASE });
  void flight.finished.then(
    () => spark.remove(),
    () => spark.remove(),
  );
  return { el: spark, flight };
}

export function startToggleCharge(
  button: HTMLElement,
  opts: { leadMs: number; target: { x: number; y: number } | null },
): ToggleCharge {
  if (typeof button.animate !== 'function') {
    return NOOP;
  }
  const ring = ringFor(button);
  const circle = ring.querySelector('circle') as SVGCircleElement;
  button.classList.add('is-charging');

  const fill = circle.animate([{ strokeDashoffset: RING_LENGTH }, { strokeDashoffset: 0 }], {
    duration: opts.leadMs,
    easing: FILL_EASE,
    fill: 'forwards',
  });

  let spark: { el: HTMLElement; flight: Animation } | null = null;
  if (opts.target) {
    const r = button.getBoundingClientRect();
    spark = launchSpark({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, opts.target);
  }

  let pop: Animation | null = null;
  let done = false;
  const end = (): void => {
    button.classList.remove('is-charging');
  };

  return {
    flip() {
      if (done) {
        return;
      }
      done = true;
      fill.cancel();
      pop = ring.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.35)', opacity: 0 },
        ],
        { duration: RING_POP_MS, easing: 'ease-out' },
      );
      // The pop starts from a full ring whatever the fill had reached.
      circle.style.strokeDashoffset = '0';
      void pop.finished.then(
        () => {
          circle.style.strokeDashoffset = '';
          end();
        },
        () => {
          circle.style.strokeDashoffset = '';
          end();
        },
      );
    },
    cancel() {
      done = true;
      fill.cancel();
      pop?.cancel();
      spark?.flight.cancel();
      spark?.el.remove();
      circle.style.strokeDashoffset = '';
      end();
    },
  };
}
