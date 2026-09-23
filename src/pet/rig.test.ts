import gsap from 'gsap';
import * as THREE from 'three';
import {
  applyOpacity,
  createPetRig,
  EYE_CLOSED_SCALE_Y,
  EYE_OPEN_SCALE_Y,
  GLOW_ON_INTENSITY,
  RIG_POSE_GROUP_NAME,
} from './rig';
import { createPlaceholderBot, POSE_GROUP_NAME } from './placeholderBot';
import type { RigSource } from './types';

/**
 * Minimal `RigSource` — just a `body` material on a bare root. `createPetRig`
 * only reads `scene`/`body` here (no `eye`, so it creates no `quickTo` tweens
 * and starts no ticker), so this needs neither the full procedural bot nor
 * WebGL/canvas, and leaves nothing to tear down.
 */
function makeRig(): { rig: ReturnType<typeof createPetRig>; body: THREE.MeshStandardMaterial } {
  const body = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const source: RigSource = { scene: new THREE.Object3D(), body, clips: {} };
  return { rig: createPetRig(source), body };
}

/**
 * Guards the copy contract the theme-lerp's per-frame allocation optimization
 * depends on (`createBytePet.ts`'s `applyTheme` reuses ONE scratch `THREE.Color`
 * across every frame of the crossfade, and `setDimmed` reuses another). That
 * reuse is only safe because `setBodyColor` COPIES its argument into the
 * material's own `Color` (`color.set(c)`) rather than storing the reference —
 * if it stored the reference, mutating the shared scratch on the next frame
 * would corrupt the material. If a future refactor makes `setBodyColor` retain
 * the reference, this test fails loudly instead of shipping a silent, only-
 * visible-in-motion color-corruption bug.
 */
describe('createPetRig setBodyColor', () => {
  it('copies its argument into the material (does not store the reference)', () => {
    const { rig, body } = makeRig();

    const scratch = new THREE.Color(0x112233);
    rig.setBodyColor(scratch);
    expect(body.color.getHex()).toBe(0x112233);

    // Mutate the caller's Color AFTER passing it. A copy leaves the material
    // untouched; a stored reference would drag the material to white with it.
    scratch.setHex(0xffffff);
    expect(body.color.getHex()).toBe(0x112233);
  });

  it('accepts a raw hex representation too (the setDimmed off-branch path)', () => {
    const { rig, body } = makeRig();
    rig.setBodyColor(0x44aa88);
    expect(body.color.getHex()).toBe(0x44aa88);
  });
});

/**
 * Freezes GSAP's global timeline so a test can render every tween at an exact
 * time: `seek(t)` jumps to `t` seconds after the freeze, firing callbacks on
 * the way (a timeline's `onComplete` runs when a seek passes it). The
 * placeholder fakes every clip, and eases every look, with GSAP, so this is
 * how its timing is tested deterministically. `release()` must run in
 * `afterEach`, or every later suite inherits a paused GSAP.
 */
function freezeGsap(): { seek(t: number): void; release(): void } {
  gsap.globalTimeline.pause();
  const start = gsap.globalTimeline.time();
  return {
    seek: (t) => {
      gsap.globalTimeline.seek(start + t, false);
    },
    release: () => {
      gsap.globalTimeline.resume();
    },
  };
}

/** The real procedural placeholder at unit scale, plus its clip-driven group. */
function placeholderRig(): {
  source: RigSource;
  rig: ReturnType<typeof createPetRig>;
  clipPose: THREE.Object3D;
} {
  const source = createPlaceholderBot({ unitPx: 1, theme: 'light' });
  const rig = createPetRig(source);
  const clipPose = source.scene.getObjectByName(POSE_GROUP_NAME);
  if (!clipPose) {
    throw new Error('placeholder has no clip pose group');
  }
  return { source, rig, clipPose };
}

describe('createPetRig pose (T-GLB, R-GLB-6)', () => {
  let clock: ReturnType<typeof freezeGsap>;
  beforeEach(() => {
    clock = freezeGsap();
  });
  afterEach(() => {
    clock.release();
  });

  it('inserts a named pose group directly under the root, wrapping the clip-driven group', () => {
    const { rig, clipPose } = placeholderRig();
    expect(rig.pose.name).toBe(RIG_POSE_GROUP_NAME);
    expect(rig.pose.parent).toBe(rig.object3d);
    expect(clipPose.parent).toBe(rig.pose);
    rig.dispose();
  });

  it('never writes pose from a clip: at the Hop apex a consumer-set pose is untouched', () => {
    const { rig, clipPose } = placeholderRig();
    rig.pose.scale.setScalar(0.6); // e.g. the entrance drop-in's start scale
    rig.play('Hop');
    clock.seek(0.229); // anticipation 0.08 s + rise 0.15 s ≈ the apex
    expect(clipPose.position.y).toBeCloseTo(0.5, 3); // HOP_APEX_FRACTION
    expect(rig.pose.scale.x).toBe(0.6);
    expect(rig.pose.position.y).toBe(0);
    rig.dispose();
  });
});

describe('createPetRig hoverHeight (T-GLB)', () => {
  it("is the clip lift plus the consumer pose offset, in fractions of Byte's height", () => {
    const { rig, clipPose } = placeholderRig();
    expect(rig.hoverHeight()).toBe(0);
    clipPose.position.y = 0.3; // as a Hop would
    rig.pose.position.y = 0.1; // as the reduced-motion peek rise would
    expect(rig.hoverHeight()).toBeCloseTo(0.4, 10);
    rig.dispose();
  });
});

describe('createPetRig setBlink (T-GLB)', () => {
  it('squashes the eye shut, then opens it again', () => {
    const { rig, source } = placeholderRig();
    rig.setBlink(true);
    expect(source.eye?.scale.y).toBe(EYE_CLOSED_SCALE_Y);
    rig.setBlink(false);
    expect(source.eye?.scale.y).toBe(EYE_OPEN_SCALE_Y);
    rig.dispose();
  });

  it('does nothing without an eye node', () => {
    const { rig } = makeRig();
    expect(() => rig.setBlink(true)).not.toThrow();
  });
});

describe('createPetRig setGlowLevel / setGlow (T-GLB)', () => {
  it('maps level 0–1 onto the on-intensity, in the accent colour', () => {
    const { rig, source } = placeholderRig();
    rig.setGlowLevel(0.5, 0x112233);
    expect(source.glow?.emissiveIntensity).toBeCloseTo(GLOW_ON_INTENSITY / 2, 10);
    expect(source.glow?.emissive.getHex()).toBe(0x112233);
    rig.dispose();
  });

  it('treats setGlow(on) as setGlowLevel(on ? 1 : 0)', () => {
    const { rig, source } = placeholderRig();
    rig.setGlow(true, 0x38e8a8);
    expect(source.glow?.emissiveIntensity).toBe(GLOW_ON_INTENSITY);
    rig.setGlow(false, 0x38e8a8);
    expect(source.glow?.emissiveIntensity).toBe(0);
    rig.dispose();
  });
});

describe('applyOpacity (T-GLB, R-GLB-2)', () => {
  it('fades every material and recompiles only when transparent actually flips', () => {
    const a = new THREE.MeshStandardMaterial();
    const b = new THREE.MeshStandardMaterial();
    const start = a.version;

    applyOpacity([a, b], 0.45);
    expect([a.opacity, b.opacity]).toEqual([0.45, 0.45]);
    expect(a.transparent).toBe(true);
    expect(a.version).toBe(start + 1); // needsUpdate: drops the compiled OPAQUE define

    applyOpacity([a, b], 0.3); // a mid-fade frame
    expect(a.version).toBe(start + 1);

    applyOpacity([a, b], 1);
    expect(a.transparent).toBe(false);
    expect(a.version).toBe(start + 2);
  });
});

describe('createPetRig setOpacity (T-GLB)', () => {
  it("fades the source's listed materials (Body + Glow on the placeholder)", () => {
    const { rig, source } = placeholderRig();
    rig.setOpacity(0.45);
    expect(source.materials?.map((m) => m.opacity)).toEqual([0.45, 0.45]);
    rig.dispose();
  });

  it('falls back to body + glow when a source lists no materials', () => {
    const { rig, body } = makeRig();
    rig.setOpacity(0.5);
    expect(body.opacity).toBe(0.5);
  });
});

describe('createPetRig setLook depth (T-GLB, R-GLB-7)', () => {
  let clock: ReturnType<typeof freezeGsap>;
  beforeEach(() => {
    clock = freezeGsap();
  });
  afterEach(() => {
    clock.release();
  });

  it('measures the look against world scale, so a unit root under a scaled parent tracks gently', () => {
    const { rig, source } = placeholderRig();
    const parent = new THREE.Group();
    parent.scale.setScalar(100); // where the swappable rig puts unitPx
    parent.add(rig.object3d);
    rig.setLook(20, 0); // 20 px right of the feet, level with them
    clock.seek(2); // the 0.3 s quickTo has long settled
    expect(source.eye?.rotation.y).toBeCloseTo(Math.atan2(20, 100), 3); // ≈ 0.197, not the 0.35 clamp
    rig.dispose();
  });
});
