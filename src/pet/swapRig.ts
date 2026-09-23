/**
 * `createSwappableRig()` — TICKETS T-GLB row 7: the ONE `PetRig`
 * `createBytePet` and `feed.ts` hold for Byte's whole life. It owns the
 * stable `object3d` (world placement + the `unitPx` scale, R-GLB-7, driven
 * by createBytePet/feed.ts exactly as before) and `pose` (the entrance
 * drop-in scale, the reduced-motion peek rise, and this module's swap pop),
 * and hangs the current leaf rig — the procedural placeholder at boot, the
 * GLB once it loads — inside `pose`. Every `PetRig` call forwards to the
 * leaf and is remembered, so `swap()` can hand the new leaf the current
 * clip, body colour, glow level, opacity, blink and look. (Rebuilding the
 * pet instead would lose FSM, phrase and FED state — row 7.)
 *
 * **When** to swap is createBytePet's call (row 8, R-GLB-13); this module
 * only performs it. `animate: false` swaps instantly (Byte hidden, or
 * reduced motion). `animate: true` plays the ~0.3 s pop: `pose` squashes
 * the old leaf out, the leaves trade places at the bottom of the squash, and
 * the new one springs back with `back.out`.
 *
 * R-GLB-3: three.js layers don't cascade — `scene.addToPet` stamps the
 * current behind/front render layer onto every descendant at add time — so
 * a leaf added later would sit on layer 0 and draw on neither canvas.
 * `swap()` copies `pose`'s layer mask onto every descendant of the incoming
 * leaf.
 *
 * R-GLB-9: the incoming leaf replays the last LOOPING clip requested (or a
 * clip played with `loop: true`); if the last request was a one-shot it
 * plays `Idle` — the GLB hands one-shots back to Idle anyway — and if no
 * clip was ever requested (hidden, or reduced motion, where `rig.play()` is
 * never called) it plays nothing. An in-flight one-shot's `onComplete` is
 * dropped, exactly as when a new `play()` interrupts it.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { LOOPING_CLIPS } from './rig';
import type { ClipName, ClipPlayOptions, PetRig } from './types';

/** Pop timing (row 8, "~0.3 s"): the squash-out leg, then the spring-back leg. Exported for swapRig.test.ts. */
export const SWAP_POP_OUT_S = 0.12;
export const SWAP_POP_IN_S = 0.18;
/** How flat (`pose.scale.y`) and how wide (x/z) the squash gets at the swap — hand-picked, free to retune visually. */
const SWAP_POP_SQUASH_Y = 0.2;
const SWAP_POP_SQUASH_XZ = 1.2;
const SWAP_POP_SPRING_EASE = 'back.out(2.2)';

/** `PetRig` plus the one extra verb the swap needs (TICKETS T-GLB Produces). */
export type SwappableRig = PetRig & { swap(next: PetRig, opts: { animate: boolean }): void };

export function createSwappableRig(initial: PetRig): SwappableRig {
  const object3d = new THREE.Group();
  object3d.name = 'byte';
  const pose = new THREE.Group();
  pose.name = 'byte-pose';
  object3d.add(pose);

  let leaf = initial;
  pose.add(leaf.object3d);

  // Remembered state for the next leaf. Colours are COPIED, never stored by
  // reference: createBytePet reuses one scratch `THREE.Color` across every
  // frame of the theme lerp (the copy contract rig.test.ts guards).
  const bodyColor = new THREE.Color();
  let hasBodyColor = false;
  const glowAccent = new THREE.Color();
  let glowLevel: number | null = null;
  let opacity = 1;
  let blinkClosed = false;
  const look = { x: 0, y: 0 };
  let hasLook = false;
  let lastClip: { clip: ClipName; forcedLoop: boolean } | null = null;

  let popTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let pendingLeaf: PetRig | null = null;

  function replaceLeaf(next: PetRig): void {
    if (next === leaf) {
      return;
    }
    const previous = leaf;
    pose.remove(previous.object3d);
    const mask = pose.layers.mask;
    next.object3d.traverse((child) => {
      child.layers.mask = mask; // R-GLB-3
    });
    pose.add(next.object3d);
    leaf = next;

    if (hasBodyColor) {
      next.setBodyColor(bodyColor);
    }
    if (glowLevel !== null) {
      next.setGlowLevel(glowLevel, glowAccent);
    }
    next.setOpacity(opacity);
    next.setBlink(blinkClosed);
    if (hasLook) {
      next.setLook(look.x, look.y);
    }
    if (lastClip) {
      const loops = LOOPING_CLIPS.has(lastClip.clip) || lastClip.forcedLoop;
      if (!loops) {
        lastClip = { clip: 'Idle', forcedLoop: false }; // R-GLB-9
      }
      next.play(lastClip.clip, lastClip.forcedLoop ? { loop: true } : {});
    }
    previous.dispose();
  }

  /** Lands an in-flight pop immediately: the pending leaf swaps in and `pose` returns to identity scale. */
  function settlePop(): void {
    if (!popTimeline) {
      return;
    }
    popTimeline.kill();
    popTimeline = null;
    if (pendingLeaf) {
      const next = pendingLeaf;
      pendingLeaf = null;
      replaceLeaf(next);
    }
    pose.scale.set(1, 1, 1);
  }

  function swap(next: PetRig, opts: { animate: boolean }): void {
    settlePop();
    if (!opts.animate) {
      replaceLeaf(next);
      return;
    }
    pendingLeaf = next;
    const tl = gsap.timeline({
      onComplete: () => {
        popTimeline = null;
      },
    });
    tl.to(pose.scale, {
      x: SWAP_POP_SQUASH_XZ,
      y: SWAP_POP_SQUASH_Y,
      z: SWAP_POP_SQUASH_XZ,
      duration: SWAP_POP_OUT_S,
      ease: 'power2.in',
    });
    tl.call(() => {
      if (pendingLeaf) {
        const incoming = pendingLeaf;
        pendingLeaf = null;
        replaceLeaf(incoming);
      }
    });
    tl.to(pose.scale, { x: 1, y: 1, z: 1, duration: SWAP_POP_IN_S, ease: SWAP_POP_SPRING_EASE });
    popTimeline = tl;
  }

  function play(clip: ClipName, opts: ClipPlayOptions = {}): void {
    lastClip = { clip, forcedLoop: opts.loop === true };
    leaf.play(clip, opts);
  }

  function setLook(x: number, y: number): void {
    look.x = x;
    look.y = y;
    hasLook = true;
    leaf.setLook(x, y);
  }

  function setBodyColor(color: THREE.ColorRepresentation): void {
    bodyColor.set(color);
    hasBodyColor = true;
    leaf.setBodyColor(color);
  }

  function setGlowLevel(level: number, accent: THREE.ColorRepresentation): void {
    glowLevel = level;
    glowAccent.set(accent);
    leaf.setGlowLevel(level, accent);
  }

  function setGlow(on: boolean, accent: THREE.ColorRepresentation): void {
    setGlowLevel(on ? 1 : 0, accent);
  }

  function setOpacity(a: number): void {
    opacity = a;
    leaf.setOpacity(a);
  }

  function setBlink(closed: boolean): void {
    blinkClosed = closed;
    leaf.setBlink(closed);
  }

  function hoverHeight(): number {
    return pose.position.y + leaf.hoverHeight();
  }

  function mouthWorld(): { x: number; y: number; z: number } {
    return leaf.mouthWorld();
  }

  function update(dt: number): void {
    leaf.update(dt);
  }

  function dispose(): void {
    popTimeline?.kill();
    popTimeline = null;
    pendingLeaf?.dispose();
    pendingLeaf = null;
    leaf.dispose();
  }

  return {
    object3d,
    pose,
    play,
    setLook,
    setBodyColor,
    setGlow,
    setGlowLevel,
    setOpacity,
    setBlink,
    hoverHeight,
    mouthWorld,
    update,
    dispose,
    swap,
  };
}
