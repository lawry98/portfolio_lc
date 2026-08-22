/**
 * GLB → `RigSource` loading infra (T3 task 4, "WebGL foundation"). Split into
 * two deliberately separate pieces so the interesting logic stays pure and
 * unit-testable without a filesystem, a network, or a WebGL context:
 *
 * - `mapGltfToRigSource()` — pure. Walks an already-parsed glTF's scene graph
 *   and picks out the named materials/nodes/clips `rig.ts` (T4/T-GLB) needs,
 *   per the artist-facing naming contract in `docs/ASSET_SPEC.md` §4-6.
 *   Unit-tested below against a synthetic in-memory scene graph — no real
 *   GLB is ever loaded in T3 (R-T3-8).
 * - `loadByteGLB()` — the I/O shell. Wires a `GLTFLoader` + `DRACOLoader`
 *   (decoder path `/draco/`; the addon import path is confirmed for this
 *   three version per R-T3-1/context7) and feeds the parsed result to
 *   `mapGltfToRigSource()`. Nothing in T3 calls this yet — it's infra for
 *   `rig.ts`'s future "try the GLB, fall back to the placeholder" wiring
 *   (T4/T-GLB). The `/draco/` decoder files themselves don't exist until
 *   T-GLB adds them, which is fine: T3 never attempts a real fetch through
 *   this function (R-T3-8), so nothing needs to decode anything yet.
 *
 * Per ASSET_SPEC §8 ("If a name doesn't match or a clip is missing, the demo
 * still runs ... nothing hard-crashes"), a missing/misnamed material, node,
 * or clip must never throw — `mapGltfToRigSource()` leaves the field
 * `undefined`/omitted instead, so the caller can fall back to the
 * placeholder/procedural piece for just that part.
 */
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ClipName, RigSource } from './types';

/** `RigSource.clips` keys, in the order `mapGltfToRigSource` scans `gltf.animations` for a match. */
const CLIP_NAMES: readonly ClipName[] = ['Idle', 'Hop', 'Dash', 'Eat', 'Sleep', 'Wake', 'Peek'];

/** `DRACOLoader` decoder base path (ASSET_SPEC/R-T3-8) — the decoder files themselves land at T-GLB. */
const DRACO_DECODER_PATH = '/draco/';

/** Case-insensitive name compare — every lookup below (materials, nodes, clips) matches names this way per ASSET_SPEC §4/§5. */
function sameName(actual: string, target: string): boolean {
  return actual.toLowerCase() === target.toLowerCase();
}

/**
 * Picks the `MeshStandardMaterial` named `target` (case-insensitive) out of
 * a mesh's `.material`, which three.js types as either a single material or
 * an array (one per geometry group). A same-named material that isn't a
 * `MeshStandardMaterial` is ignored — `RigSource.body`/`.glow` are typed as
 * `MeshStandardMaterial`, so a mismatched type is treated the same as no
 * match at all rather than coerced or thrown on.
 */
function namedStandardMaterial(
  material: THREE.Material | THREE.Material[],
  target: string,
): THREE.MeshStandardMaterial | undefined {
  const candidates = Array.isArray(material) ? material : [material];
  return candidates.find(
    (m): m is THREE.MeshStandardMaterial =>
      m instanceof THREE.MeshStandardMaterial && sameName(m.name, target),
  );
}

/**
 * Maps an already-parsed glTF's scene graph to Byte's `RigSource` (the T1
 * shape shared with the procedural placeholder rig). **Pure** — reads but
 * never mutates `gltf`, performs no I/O, and is safe to call against a
 * synthetic in-memory scene graph in tests. `gltf` is typed as only the two
 * fields this function actually reads, rather than the full `GLTF` loader
 * result, so callers/tests don't need to fabricate the rest of it.
 *
 * - `body`/`glow`: the `MeshStandardMaterial` named `Body`/`Glow` on any mesh
 *   in the graph (ASSET_SPEC §4).
 * - `eye`: the node named `Eye`, preferred, else the node named `Head`
 *   (ASSET_SPEC §5 — either is acceptable art-side); omitted if neither
 *   exists.
 * - `mouth`: the node named `Mouth`.
 * - `clips`: for each `ClipName`, the `gltf.animations` entry with a
 *   matching name; a `ClipName` with no matching clip is simply absent from
 *   the map rather than present-but-`undefined` (ASSET_SPEC §6: "a subset is
 *   fine — at minimum `Idle` + `Eat`").
 *
 * All name matching is case-insensitive; anything not found is left
 * `undefined`/omitted rather than throwing (ASSET_SPEC §8).
 */
export function mapGltfToRigSource(gltf: {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}): RigSource {
  let body: THREE.MeshStandardMaterial | undefined;
  let glow: THREE.MeshStandardMaterial | undefined;
  let eye: THREE.Object3D | undefined;
  let head: THREE.Object3D | undefined;
  let mouth: THREE.Object3D | undefined;

  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      body ??= namedStandardMaterial(object.material, 'Body');
      glow ??= namedStandardMaterial(object.material, 'Glow');
    }
    if (!eye && sameName(object.name, 'Eye')) eye = object;
    if (!head && sameName(object.name, 'Head')) head = object;
    if (!mouth && sameName(object.name, 'Mouth')) mouth = object;
  });

  const clips: Partial<Record<ClipName, THREE.AnimationClip>> = {};
  for (const clipName of CLIP_NAMES) {
    const match = gltf.animations.find((candidate) => sameName(candidate.name, clipName));
    if (match) clips[clipName] = match;
  }

  return { scene: gltf.scene, body, glow, eye: eye ?? head, mouth, clips };
}

/**
 * Loads `url` as a Byte GLB: a `GLTFLoader` with a `DRACOLoader` attached,
 * mapped through `mapGltfToRigSource()` once parsed. Rejects on any
 * load/parse error — falling back to the placeholder rig is the caller's
 * job (T4/T-GLB), not this function's.
 */
export function loadByteGLB(url: string): Promise<RigSource> {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  return new Promise<RigSource>((resolve, reject) => {
    loader.load(url, (gltf) => resolve(mapGltfToRigSource(gltf)), undefined, reject);
  });
}
