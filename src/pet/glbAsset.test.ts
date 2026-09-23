// @vitest-environment node
/**
 * Real-file smoke test for `public/models/byte.glb` (TICKETS T-GLB). Decodes
 * the committed model with three's own GLTFLoader + MeshoptDecoder and
 * asserts the contract the runtime depends on — every name the mapper
 * reads, all seven clips at their authored lengths, the two Eat bites
 * feed.ts times the glyph to, the 1.8-unit height glbRig.ts normalizes by,
 * the tri budget and the byte size — so a bad re-export fails the suite
 * instead of the page. ASSET_SPEC's clip-beat table is the human half of
 * the same contract; re-exports come from the owner's Blender source.
 *
 * R-GLB-4: runs in Vitest's NODE environment. Under jsdom, GLTFLoader's
 * `data instanceof ArrayBuffer` check fails across realms and the parse
 * throws "Unsupported asset"; the path comes from `__dirname` because
 * jsdom's `URL` breaks `fileURLToPath(import.meta.url)`.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { mapGltfToRigSource } from './glbLoader';
import { GLB_MODEL_HEIGHT } from './glbRig';
import type { ClipName } from './types';

const MODEL_PATH = resolve(__dirname, '../../public/models/byte.glb');
/** The delivered file (TICKETS T-GLB audit, 2026-09-22). A re-export changes this on purpose — update it together with ASSET_SPEC's audit. */
const DELIVERED_BYTES = 728_928;
/** ASSET_SPEC §3's tri budget. */
const MAX_TRIS = 40_000;
/** Authored clip lengths (s), TICKETS T-GLB clip-beat table. createBytePet's WAKE_MS/PEEK_MS follow Wake/Peek. */
const CLIP_LENGTHS_S: Record<ClipName, number> = {
  Idle: 3,
  Hop: 1.167,
  Dash: 0.667,
  Eat: 1.333,
  Sleep: 4,
  Wake: 1.25,
  Peek: 1.667,
};
/** Eat's two bites (head-nod peaks, s) — feed.ts's EAT_BITE_1_S/EAT_BITE_2_S and the placeholder's chomps land here. */
const EAT_BITES_S = [0.33, 0.6];
/** The real peaks sit at 0.333 s and 0.625 s (probed); the table rounds them. */
const BITE_TOLERANCE_S = 0.04;

let gltf: GLTF;

beforeAll(async () => {
  const file = readFileSync(MODEL_PATH);
  const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, '');
});

describe('public/models/byte.glb', () => {
  it('is the delivered file, byte for byte in size', () => {
    expect(statSync(MODEL_PATH).size).toBe(DELIVERED_BYTES);
  });

  it('maps every name the rig reads (Head stands in for Eye)', () => {
    const source = mapGltfToRigSource(gltf);
    expect(source.body?.name).toBe('Body');
    expect(source.glow?.name).toBe('Glow');
    expect(source.eye?.name).toBe('Head');
    expect(source.mouth?.name).toBe('Mouth');
    expect(source.torso?.name).toBe('Torso');
    expect(source.eyes?.map((eye) => eye.name)).toEqual(['EyeL', 'EyeR']);
    expect(source.materials?.map((m) => m.name).sort()).toEqual(['Body', 'Glow', 'Visor']);
  });

  it('carries all seven clips at their authored lengths', () => {
    const { clips } = mapGltfToRigSource(gltf);
    for (const [name, length] of Object.entries(CLIP_LENGTHS_S) as [ClipName, number][]) {
      expect(clips[name], name).toBeDefined();
      expect(clips[name]?.duration, name).toBeCloseTo(length, 2);
    }
  });

  it('bites on the Eat beats feed.ts times the glyph to', () => {
    const { clips, eye } = mapGltfToRigSource(gltf);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(clips.Eat!).play();
    const euler = new THREE.Euler();
    const pitch: number[] = [];
    const step = 1 / 240;
    for (let t = 0; t <= clips.Eat!.duration; t += step) {
      mixer.setTime(t);
      pitch.push(euler.setFromQuaternion(eye!.quaternion, 'YXZ').x);
    }
    const nodDownRad = THREE.MathUtils.degToRad(4);
    const peaks = pitch
      .map((p, i) => ({ p, t: i * step }))
      .filter(
        ({ p }, i) =>
          i > 0 && i < pitch.length - 1 && p > nodDownRad && p > pitch[i - 1] && p >= pitch[i + 1],
      )
      .map(({ t }) => t);
    expect(peaks).toHaveLength(2);
    peaks.forEach((t, i) =>
      expect(Math.abs(t - EAT_BITES_S[i])).toBeLessThanOrEqual(BITE_TOLERANCE_S),
    );
    mixer.stopAllAction();
  });

  it('stands 1.8 units tall with its feet at y = 0', () => {
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y - box.min.y).toBeCloseTo(GLB_MODEL_HEIGHT, 2);
  });

  it('stays within the 40k tri budget', () => {
    let tris = 0;
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry as THREE.BufferGeometry;
        tris += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      }
    });
    expect(tris).toBeLessThanOrEqual(MAX_TRIS);
  });
});
