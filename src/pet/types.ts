/**
 * T3 type contract for Byte's WebGL layer — shapes shared across `scene.ts`
 * (this ticket + Task 2), the placeholder rig (T4), and the real GLB rig
 * (T-GLB). Task 1 only defines these shapes; nothing here is implemented yet
 * (see `scene.ts` for the pure pixel-space math + `hasWebGL()`).
 */
import type * as THREE from 'three';

/**
 * Inputs to `createScene()` (Task 2). `headlineEl` sizes/positions the rig
 * and both canvases against the live DOM headline; `mount` defaults to
 * `document.body` when omitted; `reducedMotion` lets Task 2/T4 skip
 * hop/dash motion per the project's `prefers-reduced-motion` contract.
 */
export interface SceneOptions {
  headlineEl: HTMLElement;
  theme: 'light' | 'dark';
  mount?: HTMLElement;
  reducedMotion?: boolean;
}

/**
 * Public surface `createScene()` (Task 2) returns. Later tickets — `rig.ts`,
 * `feed.ts`, `createBytePet.ts` (T4+) — drive Byte and the tossed glyphs
 * through this handle instead of touching three/GSAP internals directly.
 */
export interface SceneHandle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Byte + shadow group — drawn to whichever renderer `setBehind` selects. */
  readonly petLayer: THREE.Group;
  /** Tossed-glyph + particle group — always drawn to the front renderer. */
  readonly frontLayer: THREE.Group;
  /** Render only the front (`#gl-front`) canvas for the current frame. */
  renderFront(): void;
  /** Render only the back (`#gl-back`) canvas for the current frame. */
  renderBack(): void;
  /** Render both canvases per the current `behind` flag; `dt` from `gsap.ticker`. */
  render(dt: number): void;
  /** Subscribe a callback to the shared render tick (driven off `gsap.ticker`). */
  onTick(cb: (dt: number) => void): void;
  /** Flip whether Byte draws behind or in front of the DOM headline. */
  setBehind(b: boolean): void;
  /** Add an object to the pet layer (Byte) and immediately (re)apply the current behind/front
   *  render layer to it + its descendants — so it is never stranded on layer 0 (rendered on neither
   *  canvas). Use this instead of scene.petLayer.add(...) + a manual setBehind(...). */
  addToPet(object: THREE.Object3D): void;
  /** Add an object to the front layer (food/shadow/particles — always in front) and set
   *  FRONT_RENDER_LAYER on it + its descendants (three.js layers don't cascade from the Group). */
  addToFront(object: THREE.Object3D): void;
  /** Re-lerp the scene's hemisphere/key lights for a theme change. Byte's own Body/Glow
   *  materials are themed by the rig instead (see `bodyColorForTheme`/`DEFAULT_GLOW_ACCENT`
   *  in `scene.ts`, consumed by `createBytePet` via `rig.setBodyColor`/`rig.setGlow`). */
  setTheme(t: 'light' | 'dark'): void;
  /** Pixel-space screen coords → world coords at z=0 (wraps `scene.ts`'s pure fn). */
  worldFromScreen(x: number, y: number): { x: number; y: number };
  /** A DOM element's `getBoundingClientRect()`, expressed in the same pixel-space as `worldFromScreen`. */
  screenFromRect(el: HTMLElement): { x: number; y: number; w: number; h: number };
  /** Re-sync camera + both renderers to the current viewport (resize, font load). */
  resize(): void;
  /** Tear down renderers, GL contexts, and listeners. */
  dispose(): void;
}

/**
 * Byte's baked animation clip names. Defined here (not in `rig.ts`) so both
 * the placeholder rig (T4) and the real GLB rig (T-GLB) — plus the FSM that
 * calls `play(name)` — share one enum without a circular import (R-T3-9).
 */
export type ClipName = 'Idle' | 'Hop' | 'Dash' | 'Eat' | 'Sleep' | 'Wake' | 'Peek';

/**
 * Normalized shape both the procedural placeholder (T4) and `glbLoader.ts`
 * (T-GLB) produce, so `rig.ts` can drive either uniformly. Optional fields
 * reflect parts a given source may not expose (e.g. the placeholder's first
 * cut before a dedicated glow material or eye node exists).
 */
export interface RigSource {
  scene: THREE.Object3D;
  body?: THREE.MeshStandardMaterial;
  glow?: THREE.MeshStandardMaterial;
  eye?: THREE.Object3D;
  mouth?: THREE.Object3D;
  clips: Partial<Record<ClipName, THREE.AnimationClip>>;
}

/** Byte's states (SPEC §6). Full union defined once here; T4 drives the idle-brain subset,
 *  later tickets drive dashing/eating/retyping/traveling behaviour (R-T4-9). */
export type PetState =
  | 'hidden'
  | 'entering'
  | 'idle'
  | 'curious'
  | 'invited'
  | 'dashing'
  | 'eating'
  | 'retyping'
  | 'traveling'
  | 'sleeping'
  | 'waking'
  | 'peeking';

/** External inputs to the FSM. Interaction events come from createBytePet's pointer
 *  wiring; PEEK comes from createBytePet's micro-behaviour scheduler (R-T4-3);
 *  REACHED/ATE come from the feeder (T5) marking dash-arrival and eat-animation-
 *  complete respectively — the FSM only reacts to them, it never times a real
 *  dash/eat itself. Time-based transitions are NOT events — they happen inside
 *  tickTimers(). */
export type PetEvent =
  | 'POINTER_NEAR'
  | 'POINTER_FAR'
  | 'POINTER_DOWN'
  | 'FEED'
  | 'PEEK'
  | 'REACHED' // feeder: Byte arrived at the food (dashing -> eating)
  | 'ATE'; // feeder: the eat animation finished (eating -> idle)

/** Timer durations (ms). All optional; createFSM applies the defaults below. */
export interface PetFSMConfig {
  curiousToInvitedMs?: number; // default 2500  (SPEC "~2.5s curious, no click")
  idleToSleepMs?: number; // default 30000 (SPEC "30s idle")
  peekMs?: number; // default 1200  (SPEC "peek over for ~1.2s")
  wakeMs?: number; // default 600   (startled jump/shake, then counts as feed)
  dashMs?: number; // default 1200 — SAFETY cap only; dashing normally exits on REACHED. Feeder dash is 380-600ms by distance; this must stay > that so it never pre-empts a real dash.
  eatMs?: number; // default 1500 — SAFETY cap only; eating normally exits on ATE.
}

/** The pure FSM handle (ticket "createFSM(cfg): { state(), send(ev), onEnter(cb), tickTimers(dt) }"). */
export interface PetFSM {
  state(): PetState;
  send(event: PetEvent): void;
  /** Subscribe to state CHANGES. Fires (next, prev) on each transition; never for a no-op event; never for the initial state. */
  onEnter(cb: (state: PetState, prev: PetState) => void): void;
  /** Advance all timers by dtMs milliseconds; may cause timer-driven transitions (fires onEnter). */
  tickTimers(dtMs: number): void;
}

/** Optional per-clip playback options for the rig (Task 3 implements; defined here so the shape is shared). */
export interface ClipPlayOptions {
  loop?: boolean;
  onComplete?: () => void;
}

/**
 * Inputs to `createBytePet()` (Task 4, SPEC §4.4). Only the fields Task 4
 * actually consumes — `noUnusedParameters` is on, so an option nothing reads
 * would fail the build. Later tickets extend this (`footerEl` for T8's
 * migration, `phrases`/`sounds` for T6/T7, `modelUrl` for T-GLB) once they
 * have a real consumer for each; adding them now would be dead weight.
 */
export interface PetOptions {
  /** The live headline element Byte anchors to and sizes itself from (`unitPx` = its computed font-size). */
  headlineEl: HTMLElement;
  /** Starting theme; defaults to `'light'` if omitted (the caller's own theme controller is the source of truth thereafter via `setTheme`). */
  theme?: 'light' | 'dark';
  /** Caller-supplied reduced-motion override. `createBytePet` also self-detects via `matchMedia` when this is absent — see its `gsap.matchMedia()` wiring. */
  reducedMotion?: boolean;
}

/**
 * Public surface `createBytePet()` returns (SPEC §4.4). `feed`/`setTheme`
 * are stable across tickets; `destroy()` is the one required teardown path
 * (kills every tween/timer/listener/GL resource this module created).
 */
export interface BytePetHandle {
  /** Tosses a glyph at screen point `(x, y)` (a click/tap) and feeds it into the dash-to-food + eat loop (T5). */
  feed(x: number, y: number): void;
  /** Re-themes the live scene + rig (lights, body color, glow) — call after flipping the page's own theme. */
  setTheme(t: 'light' | 'dark'): void;
  /** Subscribe to the running eaten-glyph total (the demo wires this to the footer's FED counter). Register-many; fires on each eat. */
  onEat(cb: (total: number) => void): void;
  /** Tears down everything this instance created: tweens/timelines, matchMedia, listeners, the rig, the shadow, and the scene (renderers + canvases). */
  destroy(): void;
}

/** The clip-driven rig adapter (SPEC §4.2/§4.3). Two impls: placeholder (Task 3, GSAP-faked clips)
 *  and GLB-via-AnimationMixer (T-GLB). Defined once here, consumed by createBytePet (Task 4). */
export interface PetRig {
  /** Byte's root node — createBytePet adds this to scene.petLayer via scene.addToPet(). */
  readonly object3d: THREE.Object3D;
  /** Play a named clip (placeholder fakes it with GSAP; GLB routes to the mixer). */
  play(clip: ClipName, opts?: ClipPlayOptions): void;
  /** Aim Byte's eye/head at a world-space point on the z=0 plane (createBytePet passes cursor world coords). */
  setLook(x: number, y: number): void;
  /** Recolour the Body material (per theme). */
  setBodyColor(color: THREE.ColorRepresentation): void;
  /** Toggle the emissive Glow (dark-mode phosphor) in the given accent colour. */
  setGlow(on: boolean, accent: THREE.ColorRepresentation): void;
  /** World position of the Mouth intake node (T5 glyphs converge here). */
  mouthWorld(): { x: number; y: number; z: number };
  /** Per-tick update (placeholder: apply damped look etc.; GLB: advance the mixer). */
  update(dt: number): void;
  /** Kill tweens + free anything this rig created. */
  dispose(): void;
}
