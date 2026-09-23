import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGlbRig, GLB_MODEL_HEIGHT, GLOW_DEPTH_BIAS } from './glbRig';
import {
  EYE_CLOSED_SCALE_Y,
  EYE_OPEN_SCALE_Y,
  EYE_PITCH_CLAMP_RAD,
  EYE_YAW_CLAMP_RAD,
  GLOW_ON_INTENSITY,
} from './rig';
import type { ClipName, RigSource } from './types';

/**
 * A synthetic Byte shaped like byte.glb (probed 2026-09-22: Root → Torso
 * (rest y 0.22) → Head → EyeL/EyeR/Mouth/visor, a skinned Body mesh, Body/
 * Glow/Visor materials) with hand-keyed clips. AnimationMixer needs no WebGL,
 * so the real mixer runs against it under jsdom.
 */
const TORSO_REST_Y = 0.22;
const HOP_APEX_Y = 0.39;
const HOP_END_Y = 0.3; // Hop lands HIGHER than Idle, so the hand-back to Idle is observable
const DASH_Y = 0.1; // far from every other clip, so a crossfade reads as "strictly between"

function torsoTrack(times: number[], ys: number[]): THREE.VectorKeyframeTrack {
  return new THREE.VectorKeyframeTrack(
    'Torso.position',
    times,
    ys.flatMap((y) => [0, y, 0]),
  );
}

/** Keys the head but never moves it — the case where the mixer skips its scene-graph write (R-GLB-1). */
function stillHeadTrack(duration: number): THREE.QuaternionKeyframeTrack {
  return new THREE.QuaternionKeyframeTrack(
    'Head.quaternion',
    [0, duration],
    [0, 0, 0, 1, 0, 0, 0, 1],
  );
}

function makeSource(): RigSource & {
  eyes: THREE.Object3D[];
  torso: THREE.Object3D;
  eye: THREE.Object3D;
  mouth: THREE.Object3D;
  body: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  materials: THREE.Material[];
} {
  const scene = new THREE.Group();
  const root = new THREE.Bone();
  root.name = 'Root';
  const torso = new THREE.Bone();
  torso.name = 'Torso';
  torso.position.y = TORSO_REST_Y;
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 0.66;
  scene.add(root);
  root.add(torso);
  torso.add(head);

  const body = new THREE.MeshStandardMaterial({ name: 'Body' });
  const glow = new THREE.MeshStandardMaterial({ name: 'Glow' });
  const visor = new THREE.MeshStandardMaterial({ name: 'Visor' });
  scene.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(), body));

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(), glow);
  eyeL.name = 'EyeL';
  eyeL.position.set(0.17, 0.41, 0.41);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(), glow);
  eyeR.name = 'EyeR';
  eyeR.position.set(-0.17, 0.41, 0.41);
  const mouth = new THREE.Object3D();
  mouth.name = 'Mouth';
  mouth.position.set(0, 0.165, 0.41);
  head.add(eyeL, eyeR, new THREE.Mesh(new THREE.BoxGeometry(), visor), mouth);

  const clips: Partial<Record<ClipName, THREE.AnimationClip>> = {
    Idle: new THREE.AnimationClip('Idle', 3, [
      torsoTrack([0, 1.5, 3], [TORSO_REST_Y, 0.25, TORSO_REST_Y]),
      stillHeadTrack(3),
    ]),
    Hop: new THREE.AnimationClip('Hop', 1.2, [
      torsoTrack([0, 0.5, 1.2], [TORSO_REST_Y, HOP_APEX_Y, HOP_END_Y]),
      stillHeadTrack(1.2),
    ]),
    Dash: new THREE.AnimationClip('Dash', 0.6, [
      torsoTrack([0, 0.6], [DASH_Y, DASH_Y]),
      stillHeadTrack(0.6),
    ]),
  };

  return {
    scene,
    body,
    glow,
    eye: head, // the mapper's Eye → Head fallback (byte.glb has no Eye node)
    mouth,
    eyes: [eyeL, eyeR],
    torso,
    materials: [body, glow, visor],
    clips,
  };
}

/** Advances the rig in 60 fps steps for `seconds`. */
function run(rig: ReturnType<typeof createGlbRig>, seconds: number): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    rig.update(1 / 60);
  }
}

/** The head's yaw/pitch (YXZ, the order the rig composes the look in). */
function headAngles(source: RigSource): { yaw: number; pitch: number } {
  const e = new THREE.Euler().setFromQuaternion(source.eye!.quaternion, 'YXZ');
  return { yaw: e.y, pitch: e.x };
}

describe('createGlbRig structure', () => {
  it('nests the model as object3d → pose → a 1/1.8 content group, so the rig is one unit tall', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const content = source.scene.parent;
    expect(rig.pose.parent).toBe(rig.object3d);
    expect(content?.parent).toBe(rig.pose);
    expect(content?.scale.x).toBeCloseTo(1 / GLB_MODEL_HEIGHT, 10);
    expect(rig.object3d.scale.x).toBe(1);
    expect(rig.pose.scale.x).toBe(1);
    rig.dispose();
  });

  it('turns frustum culling off on skinned meshes only (their bounds ignore the animation)', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    source.scene.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) {
        expect(o.frustumCulled).toBe(false);
      }
    });
    expect(source.eyes[0].frustumCulled).toBe(true);
    rig.dispose();
  });
});

describe('createGlbRig clips (row 11)', () => {
  it('reports the Torso lift above its rest as a fraction of the 1.8-unit height', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.play('Hop');
    rig.update(0.5);
    expect(rig.hoverHeight()).toBeCloseTo((HOP_APEX_Y - TORSO_REST_Y) / GLB_MODEL_HEIGHT, 5);
    rig.dispose();
  });

  it('plays a one-shot once, fires onComplete on finish, and hands back to Idle', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const onComplete = vi.fn();
    rig.play('Hop', { onComplete });
    rig.update(1.0);
    expect(onComplete).not.toHaveBeenCalled();
    rig.update(0.3); // crosses 1.2 s: finished → Idle fades in over 0.2 s
    expect(onComplete).toHaveBeenCalledTimes(1);
    rig.update(0.25); // fade done — Idle alone drives the torso again
    expect(source.torso.position.y).toBeLessThan(0.24); // Hop's clamped 0.3 is gone
    expect(source.torso.position.y).toBeGreaterThanOrEqual(TORSO_REST_Y);
    rig.dispose();
  });

  it('crossfades every clip change over 0.2 s', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.play('Dash');
    rig.update(0.3);
    expect(source.torso.position.y).toBeCloseTo(DASH_Y, 5);
    rig.play('Hop');
    rig.update(0.1); // halfway through the fade
    const hopAlone = TORSO_REST_Y + (HOP_APEX_Y - TORSO_REST_Y) * (0.1 / 0.5);
    expect(source.torso.position.y).toBeGreaterThan(DASH_Y);
    expect(source.torso.position.y).toBeLessThan(hopAlone);
    rig.update(0.2); // fade done at Hop time 0.3 s
    expect(source.torso.position.y).toBeCloseTo(
      TORSO_REST_Y + (HOP_APEX_Y - TORSO_REST_Y) * (0.3 / 0.5),
      3,
    );
    rig.dispose();
  });

  it('never restarts a looping clip that is already playing', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.play('Idle');
    rig.update(1.0);
    const before = source.torso.position.y;
    rig.play('Idle');
    rig.update(0);
    expect(source.torso.position.y).toBeCloseTo(before, 10); // a restart would snap to 0.22
    rig.dispose();
  });

  it('repeats a one-shot forced to loop — no onComplete, no hand-back', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const onComplete = vi.fn();
    rig.play('Hop', { loop: true, onComplete });
    rig.update(1.0);
    rig.update(1.0);
    rig.update(0.3); // 2.3 s — 1.1 s into the second loop
    expect(onComplete).not.toHaveBeenCalled();
    expect(source.torso.position.y).toBeGreaterThan(HOP_END_Y); // still Hop (≈0.313), not Idle
    rig.dispose();
  });

  it('holds the current clip for a missing one, warns once per name, and completes next update (row 12)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.play('Dash');
    rig.update(0.1);
    const onComplete = vi.fn();
    rig.play('Wake', { onComplete });
    rig.play('Wake');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    rig.update(1 / 60);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(source.torso.position.y).toBeCloseTo(DASH_Y, 5); // Dash still drives it
    warn.mockRestore();
    rig.dispose();
  });
});

describe('createGlbRig look (row 4)', () => {
  it('turns the head at half strength and slides both eyes, at the clamps', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.play('Idle');
    rig.setLook(10_000, 10_000); // far up-right: yaw +clamp, pitch −clamp
    run(rig, 2); // ≫ the 0.12 s smoothing
    const { yaw, pitch } = headAngles(source);
    expect(yaw).toBeCloseTo(EYE_YAW_CLAMP_RAD * 0.5, 3);
    expect(pitch).toBeCloseTo(-EYE_PITCH_CLAMP_RAD * 0.5, 3);
    expect(source.eyes[0].position.x).toBeCloseTo(0.17 + 0.07 * 0.8, 3);
    expect(source.eyes[1].position.x).toBeCloseTo(-0.17 + 0.07 * 0.8, 3);
    expect(source.eyes[0].position.y).toBeCloseTo(0.41 + 0.045 * 0.8, 3);
    rig.dispose();
  });

  it('never compounds the head turn while the clip holds the head still (R-GLB-1)', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.play('Idle'); // keys Head with a constant rotation → the mixer stops writing it
    rig.setLook(10_000, 10_000);
    run(rig, 2);
    const settled = headAngles(source).yaw;
    run(rig, 10);
    expect(headAngles(source).yaw).toBeCloseTo(settled, 6);
    rig.dispose();
  });

  it('keeps a steady look with no clip playing at all (reduced motion never calls play)', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.setLook(10_000, 10_000);
    run(rig, 5);
    expect(headAngles(source).yaw).toBeCloseTo(EYE_YAW_CLAMP_RAD * 0.5, 3);
    rig.dispose();
  });

  it('measures the look against its rendered size (world scale), not model units', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const parent = new THREE.Group();
    parent.scale.setScalar(100); // where the swappable rig puts unitPx
    parent.add(rig.object3d);
    const headWorld = source.eye.getWorldPosition(new THREE.Vector3());
    rig.setLook(headWorld.x + 20, headWorld.y); // 20 px right, level with the head
    run(rig, 2);
    expect(headAngles(source).yaw).toBeCloseTo(Math.atan2(20, 100) * 0.5, 3);
    rig.dispose();
  });
});

describe('createGlbRig blink, materials, mouth', () => {
  it('blinks by squashing EyeL/EyeR — never the head', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.setBlink(true);
    expect(source.eyes.map((e) => e.scale.y)).toEqual([EYE_CLOSED_SCALE_Y, EYE_CLOSED_SCALE_Y]);
    expect(source.eye.scale.y).toBe(1);
    rig.setBlink(false);
    expect(source.eyes.map((e) => e.scale.y)).toEqual([EYE_OPEN_SCALE_Y, EYE_OPEN_SCALE_Y]);
    rig.dispose();
  });

  it('recolours Body, drives the Glow level in the accent, and fades all three materials', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    rig.setBodyColor(0x3c3946);
    expect(source.body.color.getHex()).toBe(0x3c3946);
    rig.setGlowLevel(1, 0x38e8a8);
    expect(source.glow.emissiveIntensity).toBe(GLOW_ON_INTENSITY);
    expect(source.glow.emissive.getHex()).toBe(0x38e8a8);
    rig.setGlow(false, 0x38e8a8);
    expect(source.glow.emissiveIntensity).toBe(0);
    rig.setOpacity(0.45);
    expect(source.materials.map((m) => [m.opacity, m.transparent])).toEqual([
      [0.45, true],
      [0.45, true],
      [0.45, true],
    ]);
    rig.setOpacity(1);
    expect(source.materials.every((m) => !m.transparent)).toBe(true);
    rig.dispose();
  });

  it('biases the Glow material toward the camera so the eyes never z-fight the visor', () => {
    const source = makeSource();
    createGlbRig(source);
    expect(source.glow?.polygonOffset).toBe(true);
    expect(source.glow?.polygonOffsetFactor).toBe(GLOW_DEPTH_BIAS.factor);
    expect(source.glow?.polygonOffsetUnits).toBe(GLOW_DEPTH_BIAS.units);
    // Body and Visor keep their authored depth.
    expect(source.body?.polygonOffset).toBe(false);
  });

  it('reports the Mouth world position, and the head when there is no Mouth', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const expected = source.mouth.getWorldPosition(new THREE.Vector3());
    expect(rig.mouthWorld()).toEqual({ x: expected.x, y: expected.y, z: expected.z });
    rig.dispose();

    const noMouth = makeSource();
    const headOnly = createGlbRig({ ...noMouth, mouth: undefined });
    const head = noMouth.eye.getWorldPosition(new THREE.Vector3());
    expect(headOnly.mouthWorld()).toEqual({ x: head.x, y: head.y, z: head.z });
    headOnly.dispose();
  });
});

describe('createGlbRig degrading (row 12)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs every member without throwing on a bare scene with nothing named', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rig = createGlbRig({ scene: new THREE.Group(), clips: {} });
    expect(() => {
      rig.play('Idle');
      rig.setLook(5, 5);
      rig.setBlink(true);
      rig.setBodyColor(0xffffff);
      rig.setGlowLevel(1, 0x38e8a8);
      rig.setOpacity(0.5);
      rig.update(1 / 60);
      rig.mouthWorld();
    }).not.toThrow();
    expect(rig.hoverHeight()).toBe(0);
    rig.dispose();
  });

  it('stops the mixer and frees geometry + materials on dispose', () => {
    const source = makeSource();
    const rig = createGlbRig(source);
    const geometryDispose = vi.spyOn((source.eyes[0] as THREE.Mesh).geometry, 'dispose');
    const bodyDispose = vi.spyOn(source.body, 'dispose');
    rig.play('Idle');
    rig.update(0.1);
    rig.dispose();
    expect(geometryDispose).toHaveBeenCalled();
    expect(bodyDispose).toHaveBeenCalledTimes(1);
    expect(() => rig.update(0.1)).not.toThrow();
  });
});
