/**
 * Theme gesture — the pure half of "Byte flips the theme" (spec:
 * docs/superpowers/specs/2026-09-28-byte-theme-gesture-design.md).
 *
 * `createBytePet` owns every side effect (pose/glow writes, FSM sends, the
 * page's reveal callback, the corner visit's placement); this module decides
 * WHICH plan a toggle click runs and builds the paused GSAP timelines over a
 * plain `GestureState` object, so all of it is unit-testable under jsdom with
 * no WebGL. No `three`, no DOM.
 *
 * `GestureState` is a layer ON TOP of Byte, never a replacement: `sqY`/`sqXZ`
 * go to `rig.pose.scale` (consumer-owned; no clip touches it), and the glow
 * the rig shows is `composeGlow(themeLevel, state)` — the theme crossfade keeps
 * owning the base level while the gesture scales it (`glowMul`) and adds to it
 * (`boost`). That is what lets the gesture play over a running feed or retype
 * (spec D6) without fighting their writers.
 */
import gsap from 'gsap';
import type { Point, Size, StageRect } from './stage';
import type { PetState } from './types';

/** How a toggle click plays out (spec D5, D6, D8). */
export type SwitchPlan =
  /** Resting/sleeping Byte, visible: gesture where it stands (FSM `switching`). */
  | 'home'
  /** Resting/sleeping Byte, offscreen: rise from the bottom-right edge, gesture, sink back. */
  | 'corner'
  /** Feeding/retyping Byte, visible: gesture layered over the running state. */
  | 'layer'
  /** Byte can't act (entrance, travel, busy + offscreen): the page reveals from the toggle. */
  | 'button'
  /** Reduced motion, Byte visible: one glow pulse, crossfade on its peak. */
  | 'pulse'
  /** Reduced motion, Byte not visible: plain crossfade. */
  | 'instant';

/** Share of Byte's screen box that must be on screen (inside its stage) to gesture in place (D5). */
export const VISIBLE_THRESHOLD = 0.5;

/** States the gesture may interrupt: they go through the FSM's `switching` (sleeping/waking via a wake first). */
const INTERRUPTIBLE: ReadonlySet<PetState> = new Set<PetState>([
  'idle',
  'curious',
  'invited',
  'peeking',
  'sleeping',
  'waking',
]);

/** States the gesture layers over instead of interrupting — each has its own single-writer driver (D6). */
const LAYERABLE: ReadonlySet<PetState> = new Set<PetState>(['dashing', 'eating', 'retyping']);

export function chooseSwitchPlan(state: PetState, visible: number, reduced: boolean): SwitchPlan {
  const seen = visible >= VISIBLE_THRESHOLD;
  const able = INTERRUPTIBLE.has(state) || LAYERABLE.has(state);
  if (reduced) {
    return seen && able ? 'pulse' : 'instant';
  }
  if (INTERRUPTIBLE.has(state)) {
    return seen ? 'home' : 'corner';
  }
  if (LAYERABLE.has(state)) {
    return seen ? 'layer' : 'button';
  }
  // hidden/entering (the drop-in), traveling (fading between homes), and a
  // switch already in flight.
  return 'button';
}

/** Fraction (0…1) of `box` inside `clip` — `clip` is the stage already intersected with the viewport, `null` when off screen. */
export function visibleFraction(box: StageRect, clip: StageRect | null): number {
  if (!clip || box.width <= 0 || box.height <= 0) {
    return 0;
  }
  const w = Math.min(box.x + box.width, clip.x + clip.width) - Math.max(box.x, clip.x);
  const h = Math.min(box.y + box.height, clip.y + clip.height) - Math.max(box.y, clip.y);
  return w <= 0 || h <= 0 ? 0 : (w * h) / (box.width * box.height);
}

/** Byte's width as a fraction of its height — a loose screen box for the visibility test only. */
const BYTE_BOX_ASPECT = 0.6;

/** Byte's screen box, standing on `feet` (screen px, y-down) and `unitPx` tall. */
export function byteScreenBox(feet: Point, unitPx: number): StageRect {
  const width = unitPx * BYTE_BOX_ASPECT;
  return { x: feet.x - width / 2, y: feet.y - unitPx, width, height: unitPx };
}

/** Gap between Byte and the viewport's right edge during a corner visit. */
const CORNER_INSET_PX = 24;

/** Where Byte's feet stand for a corner visit: on the viewport's bottom edge, at the right (D5). */
export function cornerFeetScreen(viewport: Size, unitPx: number): Point {
  return {
    x: viewport.width - CORNER_INSET_PX - (unitPx * BYTE_BOX_ASPECT) / 2,
    y: viewport.height,
  };
}

/**
 * Corner visit timing and `pose.position.y` stops (pose units are fractions of
 * Byte's height; the pose origin is at the feet). Hidden sits a little over one
 * height below the edge; rest shows the top 70% — the visor and the chest light,
 * which sits ~0.39 of the height up.
 */
export const CORNER_RISE_S = 0.6;
export const CORNER_SINK_S = 0.45;
export const CORNER_SINK_DELAY_S = 0.1;
export const CORNER_HIDDEN_Y = -1.05;
export const CORNER_REST_Y = -0.3;

/** The gesture layer. Resting values are the identity: no squash, the theme glow untouched. */
export interface GestureState {
  sqY: number;
  sqXZ: number;
  glowMul: number;
  boost: number;
}

export function restingGesture(): GestureState {
  return { sqY: 1, sqXZ: 1, glowMul: 1, boost: 0 };
}

/** The glow level the rig shows: the theme's base level, scaled then boosted by the gesture. */
export function composeGlow(base: number, g: GestureState): number {
  return base * g.glowMul + g.boost;
}

/** Charge (crouch + glow dim/ignite) length, then the release. Values from the owner-approved demo (gesture B). */
const CHARGE_S = 0.56;
/** When the theme flips, measured from the gesture's start: on the flare (D2). */
export const FLIP_AT_S = 0.63;
/** Going dark, the off glow ignites to this level during the charge (D3). */
const IGNITE_LEVEL = 0.6;
/** Peak additive glow on release. */
const FLARE_LEVEL = 3.6;

/**
 * Charge & release (D2/D3), as a paused timeline over `state`. The caller
 * plays it, applies `state` every frame, and flips the theme at `FLIP_AT_S`.
 * Ends exactly at `restingGesture()` values (~1.45s).
 */
export function buildChargeRelease(state: GestureState, to: 'light' | 'dark'): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  // Charge: crouch-squash while the glow gathers — ignites from off going
  // dark (light mode has no glow to dim), dims going light.
  tl.to(state, { sqY: 0.8, sqXZ: 1.11, duration: CHARGE_S, ease: 'power2.inOut' }, 0);
  if (to === 'dark') {
    tl.to(state, { boost: IGNITE_LEVEL, duration: 0.5, ease: 'power2.in' }, 0);
  } else {
    tl.to(state, { glowMul: 0.1, duration: 0.5, ease: 'power2.in' }, 0);
  }
  // Release: snap to a stretch with the chest flare; the flip lands mid-snap.
  tl.to(state, { sqY: 1.18, sqXZ: 0.92, duration: 0.11, ease: 'power3.out' }, CHARGE_S);
  tl.to(state, { glowMul: 1, boost: FLARE_LEVEL, duration: 0.09, ease: 'power3.out' }, CHARGE_S);
  // Settle.
  tl.to(state, { sqY: 1, sqXZ: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 0.67);
  tl.to(state, { boost: 0, duration: 0.75, ease: 'power2.out' }, 0.7);
  return tl;
}

/** Reduced-motion pulse (D8): half-length, and the flip lands on its peak. */
export const PULSE_S = 0.15;
const PULSE_LEVEL = 1.2;

/** One soft glow pulse — the reduced-motion stand-in for the gesture. Touches `boost` only (no body motion). */
export function buildPulse(state: GestureState): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.to(state, { boost: PULSE_LEVEL, duration: PULSE_S, ease: 'sine.inOut' }, 0);
  tl.to(state, { boost: 0, duration: PULSE_S, ease: 'sine.inOut' }, PULSE_S);
  return tl;
}

/** Byte's light/material crossfade on a toggle switch — equals the page's circle reveal (`REVEAL_MS`, lib/themeReveal.ts) so both land together (D9). */
export const THEME_SWITCH_LERP_S = 0.62;

/**
 * How long after the click a plan's flip lands, in ms — the page paces the
 * toggle's charge ring on it. A sleeping Byte wakes first (FSM `wakeMs`); a
 * Byte already waking is given the whole window, an upper bound, since how
 * much of it is left isn't known here. The ring pops on the real flip either way.
 */
export function switchLeadMs(plan: SwitchPlan, state: PetState, wakeMs: number): number {
  const wake = state === 'sleeping' || state === 'waking' ? wakeMs : 0;
  switch (plan) {
    case 'home':
      return wake + FLIP_AT_S * 1000;
    case 'corner':
      return wake + (CORNER_RISE_S + FLIP_AT_S) * 1000;
    case 'layer':
      return FLIP_AT_S * 1000;
    case 'pulse':
      return PULSE_S * 1000;
    case 'button':
    case 'instant':
      return 0;
  }
}
