/**
 * Procedural placeholder bot (T4, ticket "placeholder bot + rig adapter") —
 * `createPlaceholderBot()` assembles Byte from `RoundedBoxGeometry` +
 * primitives and returns the same `RigSource` shape `glbLoader.ts`'s
 * `mapGltfToRigSource()` produces (Task 1, `types.ts`), so `rig.ts` can drive
 * either uniformly and the future real `.glb` (T-GLB) drops in without
 * reshaping the rig. SPEC §4.2: "a procedural robot assembled from Three.js
 * primitives (RoundedBox body/head, small antenna, eye)... sized from the
 * live headline font-size"; ASSET_SPEC §9: "keep it chunky and readable at
 * small size — this appears at headline scale, sometimes half-behind a
 * letter."
 *
 * **Sizing:** every mesh below is authored in a normalized space where the
 * bot's total height (feet at y=0 to the antenna tip) is ~1 unit — see the
 * "Total height sanity check" comment near the bottom of the proportion
 * consts. T-GLB (R-GLB-7): the returned root stays at unit scale.
 * `createBytePet` scales the swappable rig's root (`swapRig.ts`) by `unitPx`
 * instead, so the placeholder and the GLB (also one unit tall, `glbRig.ts`)
 * share one size seam.
 *
 * **Root vs. "pose" split:** every visible part nests under an internal
 * `POSE_GROUP_NAME` group, itself the sole child of the returned root
 * (`RigSource.scene`), rather than sitting directly on the root. Task 4's
 * `createBytePet` re-positions the returned root every tick to track the
 * headline anchor (SPEC §4.2/§8.2); `rig.ts`'s GSAP-faked `play(clip)`
 * motion (bob/hop/lean/squash) animates the inner pose group's LOCAL
 * transform instead of the root's. Without this split, both would be
 * fighting over the same node's `position`/`rotation`/`scale` every frame
 * (last write wins on `gsap.ticker`), which would cancel visible hop/dash
 * motion as soon as Task 4's anchor-tracking runs. This mirrors — for a
 * skeleton-less placeholder — the same "root motion in place" principle
 * ASSET_SPEC §6 requires of the real GLB's baked clips ("I drive world
 * position via GSAP — don't translate the character across the scene inside
 * the clip"). `rig.ts` finds the pose group via `POSE_GROUP_NAME` +
 * `getObjectByName` (falling back to the root itself if absent) rather than
 * through a new `RigSource` field, so the Task 1 contract is unchanged and
 * Task 4 never needs to know this node exists.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DEFAULT_GLOW_ACCENT, createThemedMaterial } from './scene';
import type { RigSource } from './types';

/** Name of the internal pose group `rig.ts` looks up via `getObjectByName()`
 *  to animate clip motion independent of the root's world placement — see
 *  the module doc comment's "Root vs. pose split". Exported so `rig.ts`
 *  imports this exact string instead of duplicating a literal that could
 *  drift out of sync. */
export const POSE_GROUP_NAME = 'byte-placeholder-pose';

// --- Body / head proportions (ASSET_SPEC §2 "roughly humanoid-unit so
// proportions read"; §9 "chunky and readable at small size") — fractions of
// the bot's own total height, not absolute px (see module doc comment). ---
const BODY_WIDTH = 0.6;
const BODY_HEIGHT = 0.4;
const BODY_DEPTH = 0.48;
const BODY_RADIUS = 0.11;
const BODY_SEGMENTS = 4;

const HEAD_WIDTH = 0.46;
const HEAD_HEIGHT = 0.34;
const HEAD_DEPTH = 0.44;
const HEAD_RADIUS = 0.1;
const HEAD_SEGMENTS = 4;

// Stacked flush (no gap) on top of the body — a visible seam between two
// distinct rounded-box "parts" reads clearer/chunkier at small size than a
// single blended blob would (ASSET_SPEC §9).
const BODY_CENTER_Y = BODY_HEIGHT / 2;
const HEAD_CENTER_Y = BODY_HEIGHT + HEAD_HEIGHT / 2;

// --- Antenna: thin cylinder + tip sphere (brief 3a). ---
const ANTENNA_RADIUS = 0.02;
const ANTENNA_HEIGHT = 0.16;
const ANTENNA_RADIAL_SEGMENTS = 8;
const ANTENNA_TIP_RADIUS = 0.05;
const ANTENNA_TIP_WIDTH_SEGMENTS = 12;
const ANTENNA_TIP_HEIGHT_SEGMENTS = 8;

const ANTENNA_CENTER_Y = BODY_HEIGHT + HEAD_HEIGHT + ANTENNA_HEIGHT / 2;
const ANTENNA_TIP_CENTER_Y = BODY_HEIGHT + HEAD_HEIGHT + ANTENNA_HEIGHT + ANTENNA_TIP_RADIUS;

// Total height sanity check (feet at y=0 to the antenna tip's highest
// point): BODY_HEIGHT + HEAD_HEIGHT + ANTENNA_HEIGHT + 2*ANTENNA_TIP_RADIUS
// = 0.4 + 0.34 + 0.16 + 0.1 = 1.0 — confirms the "~1 unit tall" sizing
// premise the module doc comment describes. Retune any proportion const
// freely; this is documentation, not an enforced invariant.

// --- Eye/visor: a single wide visor (a "Face/Screen node" per ASSET_SPEC
// §5) rather than two separate eyes — simpler, and `RigSource.eye` is one
// node anyway. Mounted just proud of the head's front (+Z, ASSET_SPEC §2
// "faces +Z") face. ---
const EYE_WIDTH = 0.22;
const EYE_HEIGHT = 0.09;
const EYE_DEPTH = 0.05;
const EYE_RADIUS = 0.02;
const EYE_SEGMENTS = 3;

const EYE_CENTER_Y = HEAD_CENTER_Y + 0.03; // upper-middle of the head face
const EYE_CENTER_Z = HEAD_DEPTH / 2 + EYE_DEPTH / 2 - 0.01; // tiny overlap, no seam gap

// --- Mouth: an empty locator low on the body's front face, just under the
// head/body seam — ASSET_SPEC §5 "position it where eating should visually
// happen". ---
const MOUTH_Y = BODY_HEIGHT - 0.02;
const MOUTH_Z = BODY_DEPTH / 2;

/**
 * `Glow` material's base (non-emissive) color — a dark, inert "unlit glass"
 * tone so the visor still reads as a visor before `rig.setGlow(true, ...)`
 * ever runs (e.g. light theme, where Byte's glow stays off — SPEC §3 "Dark
 * → on; light → off"). The emissive channel defaults to
 * `DEFAULT_GLOW_ACCENT` at `emissiveIntensity: 0` (brief 3a: "starting
 * emissiveIntensity 0 (off)") purely so the material is fully configured
 * even if a caller never calls `setGlow` at all; `createBytePet` (Task 4)
 * is expected to call it at least once at init regardless.
 */
const GLOW_BASE_COLOR = 0x1c1b22;

/**
 * Builds Byte's procedural placeholder body: a chunky `RoundedBoxGeometry`
 * body + head, a thin cylinder-and-sphere antenna, and a single wide
 * eye/visor, under one root `THREE.Group` (`name = 'byte-placeholder'`),
 * one unit tall (the swappable rig above it applies `unitPx`, T-GLB).
 * Returns the `RigSource` shape (Task 1, `types.ts`) `rig.ts` (3b) adapts
 * into a `PetRig`. `clips` is always `{}` — the placeholder has no baked
 * `THREE.AnimationClip`s; `rig.ts` fakes every clip with GSAP instead.
 */
export function createPlaceholderBot(opts: { theme: 'light' | 'dark' }): RigSource {
  const { theme } = opts;

  // "Body" — the bulk of the robot (ASSET_SPEC §4). One shared material
  // instance across body/head/antenna so `rig.setBodyColor()` recolors the
  // whole robot in one call.
  const bodyMaterial = createThemedMaterial(theme);
  bodyMaterial.name = 'Body';

  // "Glow" — the eye/visor's emissive accent (ASSET_SPEC §4).
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: GLOW_BASE_COLOR,
    roughness: 0.3,
    metalness: 0.1,
    emissive: DEFAULT_GLOW_ACCENT,
    emissiveIntensity: 0,
  });
  glowMaterial.name = 'Glow';

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH, BODY_SEGMENTS, BODY_RADIUS),
    bodyMaterial,
  );
  body.name = 'byte-body';
  body.position.set(0, BODY_CENTER_Y, 0);

  const head = new THREE.Mesh(
    new RoundedBoxGeometry(HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH, HEAD_SEGMENTS, HEAD_RADIUS),
    bodyMaterial,
  );
  head.name = 'byte-head';
  head.position.set(0, HEAD_CENTER_Y, 0);

  const antennaStem = new THREE.Mesh(
    new THREE.CylinderGeometry(
      ANTENNA_RADIUS,
      ANTENNA_RADIUS,
      ANTENNA_HEIGHT,
      ANTENNA_RADIAL_SEGMENTS,
    ),
    bodyMaterial,
  );
  antennaStem.name = 'byte-antenna-stem';
  antennaStem.position.set(0, ANTENNA_CENTER_Y, 0);

  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(
      ANTENNA_TIP_RADIUS,
      ANTENNA_TIP_WIDTH_SEGMENTS,
      ANTENNA_TIP_HEIGHT_SEGMENTS,
    ),
    bodyMaterial,
  );
  antennaTip.name = 'byte-antenna-tip';
  antennaTip.position.set(0, ANTENNA_TIP_CENTER_Y, 0);

  const eyeVisor = new THREE.Mesh(
    new RoundedBoxGeometry(EYE_WIDTH, EYE_HEIGHT, EYE_DEPTH, EYE_SEGMENTS, EYE_RADIUS),
    glowMaterial,
  );
  eyeVisor.name = 'byte-eye-visor';

  // `eye` is a pivot `Group` wrapping the visible visor mesh, not the mesh
  // itself — brief 3a: "give it a sensible local pivot". `rig.ts`'s look-at
  // rotation and Task 4's blink `scale.y` squash (owned by `createBytePet`,
  // not a `PetRig` method — see `rig.ts`'s doc comment) both apply to this
  // one node; rotation and scale are independent `THREE.Object3D` channels,
  // so the two compose without conflict regardless of which one the visor
  // mesh's own geometry happens to be centered on.
  const eye = new THREE.Group();
  eye.name = 'Eye';
  eye.position.set(0, EYE_CENTER_Y, EYE_CENTER_Z);
  eye.add(eyeVisor);

  const mouth = new THREE.Object3D();
  mouth.name = 'Mouth';
  mouth.position.set(0, MOUTH_Y, MOUTH_Z);

  const pose = new THREE.Group();
  pose.name = POSE_GROUP_NAME;
  pose.add(body, head, antennaStem, antennaTip, eye, mouth);

  const root = new THREE.Group();
  root.name = 'byte-placeholder';
  root.add(pose);

  return {
    scene: root,
    body: bodyMaterial,
    glow: glowMaterial,
    eye,
    mouth,
    // T-GLB: every material this bot owns — what `rig.setOpacity` fades.
    materials: [bodyMaterial, glowMaterial],
    clips: {},
  };
}
