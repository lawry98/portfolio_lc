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
  /** Re-lerp scene materials/lights/glow color for a theme change. */
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
