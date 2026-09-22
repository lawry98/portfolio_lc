/**
 * T3 type contract for Byte's WebGL layer — shapes shared across `scene.ts`
 * (this ticket + Task 2), the placeholder rig (T4), and the real GLB rig
 * (T-GLB). Task 1 only defines these shapes; nothing here is implemented yet
 * (see `scene.ts` for the pure pixel-space math + `hasWebGL()`).
 */
import type * as THREE from 'three';
import type { Phrase } from '../phrases';
import type { SoundEngine } from './sound/SoundEngine';
import type { StageRect } from './stage';

/**
 * Re-exported (an `import ... from`, above, is not by itself visible to
 * importers — the two are separate statements) so `SceneHandle.setStage`
 * callers can pull the stage shape from this file alongside the rest of
 * the pet-module type surface, without a second import from `./stage`
 * (Task 1's pure geometry core; T12). Type-only on both sides — `stage.ts`
 * has zero runtime imports of its own and this file shouldn't gain one
 * just to move a shape through.
 */
export type { StageRect } from './stage';

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
  /**
   * T12 stage clip (Task 2): confines `render()`/`renderFront()`/
   * `renderBack()` to `rect` via the WebGL scissor test, so Byte and the
   * front layer never paint outside the active hero/footer stage.
   * Tri-state, mirroring `stage.ts`'s `intersectViewport` contract: passing
   * a `StageRect` clips both renderers to it; passing `null` means no
   * stage is on screen anywhere, so the next render clears both canvases
   * and skips drawing entirely (R12-3) instead of freezing the last frame
   * on screen. Never calling this at all renders unclipped, byte-identical
   * to pre-T12 behaviour.
   */
  setStage(rect: StageRect | null): void;
  /**
   * T12 hero/footer hand-off fade (Task 2, R12-5): sets CSS `opacity`
   * directly on both `#gl-back`/`#gl-front` canvas elements. No tween
   * lives here — `createBytePet`'s migration driver owns the GSAP tween
   * across a trip and calls this setter on every tick of it.
   */
  setOpacity(a: number): void;
  /** Add an object to the pet layer (Byte) and immediately (re)apply the current behind/front
   *  render layer to it + its descendants — so it is never stranded on layer 0 (rendered on neither
   *  canvas). Use this instead of scene.petLayer.add(...) + a manual setBehind(...). */
  addToPet(object: THREE.Object3D): void;
  /** Add an object to the front layer (food/shadow/particles — always in front) and set
   *  FRONT_RENDER_LAYER on it + its descendants (three.js layers don't cascade from the Group). */
  addToFront(object: THREE.Object3D): void;
  /** Re-lerp the scene's hemisphere/key lights for a theme change. Byte's own Body/Glow
   *  materials are themed by the rig instead (see `bodyColorForTheme`/`DEFAULT_GLOW_ACCENT`
   *  in `scene.ts`, consumed by `createBytePet` via `rig.setBodyColor`/`rig.setGlow`).
   *  `durationS` (T8, "theme reaction"): omitted/`0` sets the lights instantly (construction
   *  path); `> 0` GSAP-lerps from their current values to the target theme's preset over that
   *  many seconds instead — see `scene.ts`'s own `setTheme` doc comment for the mechanism. */
  setTheme(t: 'light' | 'dark', durationS?: number): void;
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

/** Byte's states (SPEC §6). Full union defined once here. T4 drove the idle-brain
 *  subset; T5 added the feed beats (dashing/eating); T6a added the retype reward
 *  (retyping); T6b's entrance drives hidden/entering (hidden --SHOWN--> entering
 *  --ENTERED--> idle); T8 makes `traveling` reachable — the scroll-driven
 *  hero<->footer migration (a resting home state --MIGRATE--> traveling
 *  --ARRIVED--> idle). Every state in the union is now reachable. */
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
 *  complete respectively; RETYPED comes from the retype-driver (T6) marking
 *  retype-animation-complete; SHOWN/ENTERED come from the entrance driver (T6b)
 *  marking the drop-in start and phrase-#1 live-type completion respectively;
 *  MIGRATE/ARRIVED come from the T8 scroll/migration driver marking the start of
 *  a hero<->footer trip and its arrival respectively — the FSM only reacts to
 *  these, it never times a real dash/eat/retype/entrance/trip itself. Time-based
 *  transitions are NOT events — they happen inside tickTimers(). */
export type PetEvent =
  | 'POINTER_NEAR'
  | 'POINTER_FAR'
  | 'POINTER_DOWN'
  | 'FEED'
  | 'PEEK'
  | 'REACHED' // feeder: Byte arrived at the food (dashing -> eating)
  | 'ATE' // feeder: the eat animation finished (eating -> retyping, or -> traveling for a feed begun mid-trip)
  | 'RETYPED' // engine: retype animation finished (retyping -> idle)
  | 'SHOWN' // entrance: overlay lifted / drop-in begins (hidden -> entering)
  | 'ENTERED' // entrance: phrase #1 typed (entering -> idle)
  | 'MIGRATE' // scroll: pull Byte from a resting home state into the hero<->footer trip (idle/curious/invited -> traveling)
  | 'ARRIVED'; // scroll: Byte reached the migration destination (traveling -> idle)

/** Timer durations (ms) plus the initial state. All optional; createFSM applies the
 *  defaults below (`initialState` excepted — it's a start value, not a duration). */
export interface PetFSMConfig {
  initialState?: PetState; // default 'idle' — the entrance (T6b) starts it in 'hidden'
  curiousToInvitedMs?: number; // default 2500  (SPEC "~2.5s curious, no click")
  idleToSleepMs?: number; // default 30000 (SPEC "30s idle")
  peekMs?: number; // default 1200  (SPEC "peek over for ~1.2s")
  wakeMs?: number; // default 600   (startled jump/shake, then counts as feed)
  dashMs?: number; // default 1200 — SAFETY cap only; dashing normally exits on REACHED. Feeder dash is 380-600ms by distance; this must stay > that so it never pre-empts a real dash.
  eatMs?: number; // default 1500 — SAFETY cap only; eating normally exits on ATE.
  retypeMs?: number; // default 4000 — SAFETY cap only; retyping normally exits on RETYPED.
  enteringMs?: number; // default 8000 — SAFETY cap only; entering normally exits on ENTERED.
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
 * Inputs to `createBytePet()` (SPEC §4.4). Only the fields there's a real
 * consumer for — `noUnusedParameters` is on, so an option nothing reads
 * would fail the build. Later tickets extend this (`modelUrl` for T-GLB)
 * once they have a real consumer for each; adding them now would be dead
 * weight. (T7 added the `sound` seam below; T8 un-deferred `footerEl` +
 * `footerPhrases` for the switchable footer home.)
 */
export interface PetOptions {
  /** The live headline element Byte anchors to and sizes itself from (`unitPx` = its computed font-size). */
  headlineEl: HTMLElement;
  /**
   * The footer CTA's 2-line headline — Byte's SECOND home (T8). Supplied
   * together with `footerPhrases`, `createBytePet` builds a footer home (its
   * own DOM caret + `data-byte-line` lines + phrase cycle) that
   * `setHomeAnchor(footerEl)` can switch Byte's retype target to. Omit either
   * one and there is no footer home — hero-only, byte-identical to before.
   */
  footerEl?: HTMLElement;
  /**
   * The footer retype cycle (SPEC §6/§10). `footerPhrases[0]` should equal the
   * static footer headline #1 (`phrases.footer[0] = ["LET'S","BUILD"]`) so the
   * first footer feed deletes the text actually shown there. Only consumed
   * when `footerEl` is also present (both gate the footer home).
   */
  footerPhrases?: readonly Phrase[];
  /** Starting theme; defaults to `'light'` if omitted (the caller's own theme controller is the source of truth thereafter via `setTheme`). */
  theme?: 'light' | 'dark';
  /** Caller-supplied reduced-motion override. `createBytePet` also self-detects via `matchMedia` when this is absent — see its `gsap.matchMedia()` wiring. */
  reducedMotion?: boolean;
  /**
   * Ordered phrase cycle for the retype reward (SPEC §6/§10). `phrases[0]`
   * should equal the static headline #1 (the phrase currently on-screen), so
   * the first eat retypes into `phrases[1]`. Omitted (or a single-entry
   * cycle) → the retype is a no-op pass-through: the FSM still advances
   * eating→retyping→idle, the driver just fires `RETYPED` without editing the
   * headline.
   */
  phrases?: readonly Phrase[];
  /** Run the SPEC §8.1 entrance: start hidden, drop in, live-type phrase #1 (default false → start idle, as before). */
  entrance?: boolean;
  /**
   * T7 sound seam (R7-1): the engine Byte plays named cues through. Every call
   * site speaks ONLY to this `SoundEngine` interface — the concrete engine
   * (WebAudio synth today, a Howler sample bank later) is constructed and
   * injected by `main.ts`. Omitted → `createBytePet` defaults to the exported
   * `silentSoundEngine` no-op, so cue-emitting code paths stay byte-identical
   * whether or not sound was ever wired up (no `if (sound)` guards).
   */
  sound?: SoundEngine;
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
  /** SPEC §8.1: drop Byte in + live-type phrase #1 (reduced-motion: instant). Resolves when the entrance settles into idle. Safe no-op-ish if not constructed with `{ entrance: true }`. */
  enterAndType(): Promise<void>;
  /**
   * Switch Byte's active home between the hero headline and the footer CTA
   * (T8): the anchor, DOM caret, retype target, and phrase cycle all follow.
   * No-op if `el` is already the active home; ignored if `el` matches neither
   * home (defensive). Does NOT itself drive the scroll migration — that (the
   * FSM `MIGRATE`/`ARRIVED` beats) is wired by a later task; for now this is
   * called manually (browser QA) to point Byte at the footer.
   */
  setHomeAnchor(el: HTMLElement): void;
  /**
   * Style Lab wiring (T8, SPEC §7/§11): swap the dark-mode phosphor Glow's
   * accent color live and re-apply it immediately against the CURRENT theme
   * (light mode stays off — the glow is a dark-mode-only effect, so this is
   * a no-op-looking call until dark mode is active). `main.ts` drives this
   * from the `data-glow` axis's live `--glow` CSS token.
   */
  setGlowAccent(color: THREE.ColorRepresentation): void;
  /**
   * Style Lab wiring (T8, SPEC §7): replace the HERO home's retype cycle
   * live (the footer's own cycle is untouched — it isn't a lab axis) and
   * reset its position to the cycle's first entry; if the hero is currently
   * the active home, re-seeds the retype engine to the on-screen text so the
   * next retype deletes correctly. `main.ts` drives this from the
   * `data-phrase-set` axis.
   */
  setPhrases(cycle: readonly Phrase[]): void;
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
