import gsap from 'gsap';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSwappableRig, SWAP_POP_IN_S, SWAP_POP_OUT_S } from './swapRig';
import type { PetRig } from './types';

/** A `PetRig` double that records every call — swapRig only ever speaks the interface. */
function stubRig(name: string, hover = 0) {
  const object3d = new THREE.Group();
  object3d.name = name;
  const pose = new THREE.Group();
  object3d.add(pose);
  pose.add(new THREE.Mesh());
  return {
    object3d,
    pose,
    play: vi.fn(),
    setLook: vi.fn(),
    setBodyColor: vi.fn(),
    setGlow: vi.fn(),
    setGlowLevel: vi.fn(),
    setOpacity: vi.fn(),
    setBlink: vi.fn(),
    hoverHeight: vi.fn(() => hover),
    mouthWorld: vi.fn(() => ({ x: 1, y: 2, z: 3 })),
    update: vi.fn(),
    dispose: vi.fn(),
  } satisfies PetRig;
}

describe('createSwappableRig', () => {
  it('hangs the initial leaf inside its own stable object3d → pose', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    expect(rig.object3d).not.toBe(a.object3d);
    expect(rig.pose.parent).toBe(rig.object3d);
    expect(a.object3d.parent).toBe(rig.pose);
  });

  it('forwards every call to the current leaf', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    const onComplete = vi.fn();
    rig.play('Hop', { onComplete });
    rig.setLook(3, 4);
    rig.setOpacity(0.5);
    rig.setBlink(true);
    rig.update(0.016);
    expect(a.play).toHaveBeenCalledWith('Hop', { onComplete });
    expect(a.setLook).toHaveBeenCalledWith(3, 4);
    expect(a.setOpacity).toHaveBeenCalledWith(0.5);
    expect(a.setBlink).toHaveBeenCalledWith(true);
    expect(a.update).toHaveBeenCalledWith(0.016);
    expect(rig.mouthWorld()).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("adds its own pose offset to the leaf's hover height (the reduced-peek rise)", () => {
    const rig = createSwappableRig(stubRig('a', 0.25));
    rig.pose.position.y = 0.1;
    expect(rig.hoverHeight()).toBeCloseTo(0.35, 10);
  });

  it('routes setGlow through setGlowLevel', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    rig.setGlow(true, 0x38e8a8);
    expect(a.setGlowLevel).toHaveBeenCalledWith(1, 0x38e8a8);
    expect(a.setGlow).not.toHaveBeenCalled();
  });

  it('swaps instantly: disposes the old leaf and re-applies colour, glow, opacity, blink, look and the loop', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    rig.setBodyColor(0x112233);
    rig.setGlowLevel(0.5, 0x38e8a8);
    rig.setOpacity(0.45);
    rig.setBlink(true);
    rig.setLook(5, 6);
    rig.play('Sleep');
    const b = stubRig('b');

    rig.swap(b, { animate: false });

    expect(a.object3d.parent).toBeNull();
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.object3d.parent).toBe(rig.pose);
    expect((b.setBodyColor.mock.calls[0][0] as THREE.Color).getHex()).toBe(0x112233);
    expect(b.setGlowLevel.mock.calls[0][0]).toBe(0.5);
    expect((b.setGlowLevel.mock.calls[0][1] as THREE.Color).getHex()).toBe(0x38e8a8);
    expect(b.setOpacity).toHaveBeenCalledWith(0.45);
    expect(b.setBlink).toHaveBeenCalledWith(true);
    expect(b.setLook).toHaveBeenCalledWith(5, 6);
    expect(b.play).toHaveBeenCalledWith('Sleep', {});
  });

  it('remembers colours by value, not by reference (the theme lerp reuses one scratch Color)', () => {
    const rig = createSwappableRig(stubRig('a'));
    const scratch = new THREE.Color(0x112233);
    rig.setBodyColor(scratch);
    scratch.setHex(0xffffff);
    const b = stubRig('b');
    rig.swap(b, { animate: false });
    expect((b.setBodyColor.mock.calls[0][0] as THREE.Color).getHex()).toBe(0x112233);
  });

  it('replays Idle after a one-shot, a forced loop as a loop, and nothing if no clip was ever played (R-GLB-9)', () => {
    const oneShot = createSwappableRig(stubRig('a'));
    oneShot.play('Hop');
    const b = stubRig('b');
    oneShot.swap(b, { animate: false });
    expect(b.play).toHaveBeenCalledWith('Idle', {});

    const forced = createSwappableRig(stubRig('a'));
    forced.play('Eat', { loop: true });
    const c = stubRig('c');
    forced.swap(c, { animate: false });
    expect(c.play).toHaveBeenCalledWith('Eat', { loop: true });

    const never = createSwappableRig(stubRig('a'));
    const d = stubRig('d');
    never.swap(d, { animate: false });
    expect(d.play).not.toHaveBeenCalled();
  });

  it("copies pose's render-layer mask onto every descendant of the incoming leaf (R-GLB-3)", () => {
    const rig = createSwappableRig(stubRig('a'));
    rig.object3d.traverse((o) => o.layers.set(2)); // what scene.addToPet/setBehind stamp
    const b = stubRig('b');
    rig.swap(b, { animate: false });
    b.object3d.traverse((o) => {
      expect(o.layers.mask).toBe(rig.pose.layers.mask);
    });
  });

  it('disposes the current leaf on dispose', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    rig.dispose();
    expect(a.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('createSwappableRig pop (row 8)', () => {
  let start = 0;
  beforeEach(() => {
    gsap.globalTimeline.pause();
    start = gsap.globalTimeline.time();
  });
  afterEach(() => {
    gsap.globalTimeline.resume();
  });
  const seek = (t: number): void => {
    gsap.globalTimeline.seek(start + t, false);
  };

  it('squashes the old leaf out, swaps at the bottom, and springs the new one back to 1', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    const b = stubRig('b');
    rig.swap(b, { animate: true });

    seek(SWAP_POP_OUT_S / 2);
    expect(rig.pose.scale.y).toBeLessThan(1);
    expect(a.object3d.parent).toBe(rig.pose);
    expect(b.object3d.parent).toBeNull();

    seek(SWAP_POP_OUT_S + 0.001);
    expect(b.object3d.parent).toBe(rig.pose);
    expect(a.dispose).toHaveBeenCalledTimes(1);

    seek(SWAP_POP_OUT_S + SWAP_POP_IN_S + 0.05);
    expect([rig.pose.scale.x, rig.pose.scale.y, rig.pose.scale.z]).toEqual([1, 1, 1]);
    rig.dispose();
  });

  it('lands an in-flight pop instantly before a second swap', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    const b = stubRig('b');
    const c = stubRig('c');
    rig.swap(b, { animate: true });
    seek(SWAP_POP_OUT_S / 2);
    rig.swap(c, { animate: false });
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(c.object3d.parent).toBe(rig.pose);
    expect(rig.pose.scale.y).toBe(1);
  });

  it('frees both the current and the pending leaf when disposed mid-pop', () => {
    const a = stubRig('a');
    const rig = createSwappableRig(a);
    const b = stubRig('b');
    rig.swap(b, { animate: true });
    seek(SWAP_POP_OUT_S / 2);
    rig.dispose();
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);
  });
});
