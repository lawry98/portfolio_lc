import * as THREE from 'three';
import { createPetRig } from './rig';
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
