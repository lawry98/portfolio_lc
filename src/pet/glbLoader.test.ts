import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { loadByteGLB, mapGltfToRigSource } from './glbLoader';

/**
 * `mapGltfToRigSource` only reads `scene`/`animations`, so tests build that
 * minimal shape directly rather than a real `GLTF` — no loader, no network,
 * no WebGL context involved (jsdom has none). Byte's real GLB is never
 * loaded in T3 (R-T3-8); this is the synthetic scene graph the mapper is
 * unit-tested against instead.
 */
function gltfOf(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[] = [],
): { scene: THREE.Object3D; animations: THREE.AnimationClip[] } {
  return { scene, animations };
}

/** Minimal named clip — only `.name` matters to the mapper. */
function clip(name: string): THREE.AnimationClip {
  return new THREE.AnimationClip(name, -1, []);
}

describe('mapGltfToRigSource', () => {
  it('returns an all-empty RigSource without throwing for a bare, childless scene', () => {
    const scene = new THREE.Group();

    expect(() => mapGltfToRigSource(gltfOf(scene))).not.toThrow();
    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.scene).toBe(scene);
    expect(result.body).toBeUndefined();
    expect(result.glow).toBeUndefined();
    expect(result.eye).toBeUndefined();
    expect(result.mouth).toBeUndefined();
    expect(result.clips).toEqual({});
  });

  it('finds Body and Glow materials by name, case-insensitively', () => {
    const scene = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial();
    bodyMat.name = 'body'; // lowercase — proves case-insensitive match
    const glowMat = new THREE.MeshStandardMaterial();
    glowMat.name = 'gLoW'; // mismatched case — proves case-insensitive match

    scene.add(new THREE.Mesh(undefined, bodyMat), new THREE.Mesh(undefined, glowMat));

    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.body).toBe(bodyMat);
    expect(result.glow).toBe(glowMat);
  });

  it('finds a named material inside a multi-material array on a single mesh', () => {
    const scene = new THREE.Group();
    const trim = new THREE.MeshStandardMaterial();
    trim.name = 'Trim';
    const bodyMat = new THREE.MeshStandardMaterial();
    bodyMat.name = 'Body';

    scene.add(new THREE.Mesh(undefined, [trim, bodyMat]));

    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.body).toBe(bodyMat);
  });

  it('ignores a same-named material that is not a MeshStandardMaterial', () => {
    const scene = new THREE.Group();
    const notStandard = new THREE.MeshBasicMaterial();
    notStandard.name = 'Body';

    scene.add(new THREE.Mesh(undefined, notStandard));

    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.body).toBeUndefined();
  });

  it('finds Eye and Mouth nodes by name, case-insensitively, nested at any depth', () => {
    const scene = new THREE.Group();
    const torso = new THREE.Group();
    torso.name = 'Torso';
    const eye = new THREE.Object3D();
    eye.name = 'EYE'; // proves case-insensitivity
    torso.add(eye);
    const mouth = new THREE.Object3D();
    mouth.name = 'mouth'; // proves case-insensitivity

    scene.add(torso, mouth);

    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.eye).toBe(eye);
    expect(result.mouth).toBe(mouth);
  });

  it('prefers an Eye node over a Head node when both are present', () => {
    const scene = new THREE.Group();
    const head = new THREE.Object3D();
    head.name = 'Head';
    const eye = new THREE.Object3D();
    eye.name = 'Eye';

    scene.add(head, eye);

    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.eye).toBe(eye);
  });

  it('falls back to a Head node when no Eye node exists', () => {
    const scene = new THREE.Group();
    const head = new THREE.Object3D();
    head.name = 'Head';

    scene.add(head);

    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.eye).toBe(head);
  });

  it('leaves eye/mouth undefined without throwing when neither node exists', () => {
    const scene = new THREE.Group();
    scene.add(new THREE.Object3D());

    expect(() => mapGltfToRigSource(gltfOf(scene))).not.toThrow();
    const result = mapGltfToRigSource(gltfOf(scene));

    expect(result.eye).toBeUndefined();
    expect(result.mouth).toBeUndefined();
  });

  it('maps animation clips by ClipName, case-insensitively, omitting non-matching and missing ones', () => {
    const scene = new THREE.Group();
    const idle = clip('idle'); // lowercase — proves case-insensitivity
    const eat = clip('Eat');
    const unrelated = clip('Explode'); // not a ClipName — must be ignored

    const result = mapGltfToRigSource(gltfOf(scene, [idle, eat, unrelated]));

    expect(result.clips.Idle).toBe(idle);
    expect(result.clips.Eat).toBe(eat);
    expect(result.clips.Hop).toBeUndefined();
    expect(result.clips.Dash).toBeUndefined();
    expect(result.clips.Sleep).toBeUndefined();
    expect(result.clips.Wake).toBeUndefined();
    expect(result.clips.Peek).toBeUndefined();
    expect(Object.keys(result.clips).sort()).toEqual(['Eat', 'Idle']);
  });

  it('maps a realistic mixed scene end-to-end: materials, nodes (Eye over Head), and clips together', () => {
    const scene = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial();
    bodyMat.name = 'Body';
    const glowMat = new THREE.MeshStandardMaterial();
    glowMat.name = 'gLoW'; // mismatched case

    const head = new THREE.Object3D();
    head.name = 'Head';
    const eye = new THREE.Object3D();
    eye.name = 'Eye';
    const mouth = new THREE.Object3D();
    mouth.name = 'Mouth';

    scene.add(
      new THREE.Mesh(undefined, bodyMat),
      new THREE.Mesh(undefined, glowMat),
      head,
      eye,
      mouth,
    );

    const idle = clip('Idle');
    const eatClip = clip('Eat');
    const explode = clip('Explode'); // non-matching — must be ignored, not thrown on

    const result = mapGltfToRigSource(gltfOf(scene, [idle, eatClip, explode]));

    expect(result.scene).toBe(scene);
    expect(result.body).toBe(bodyMat);
    expect(result.glow).toBe(glowMat);
    expect(result.eye).toBe(eye); // Eye wins even though Head is also present
    expect(result.mouth).toBe(mouth);
    expect(result.clips.Idle).toBe(idle);
    expect(result.clips.Eat).toBe(eatClip);
    expect(result.clips.Hop).toBeUndefined(); // missing clip — omitted, never thrown
  });
});

describe('loadByteGLB', () => {
  /**
   * A real `loader.load()` would hit the network — flaky/noisy under jsdom
   * and explicitly out of scope for T3 (R-T3-8: infra only, no real GLB
   * fetched). Spying on `GLTFLoader.prototype.load` (an own method — see
   * `GLTFLoader.js`, not inherited) intercepts before any fetch happens and
   * synchronously drives the `onError` callback, so this stays fast,
   * deterministic, and pristine while still proving the promise-rejection
   * wiring works.
   */
  it('rejects with the GLTFLoader error, without performing a real network fetch', async () => {
    const loadError = new Error('boom');
    const loadSpy = vi
      .spyOn(GLTFLoader.prototype, 'load')
      .mockImplementation((_url, _onLoad, _onProgress, onError) => {
        onError?.(loadError);
      });

    await expect(loadByteGLB('nonexistent.glb')).rejects.toBe(loadError);

    loadSpy.mockRestore();
  });
});
