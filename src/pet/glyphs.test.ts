import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createGlyphQueue, GLYPH_KINDS, makeGlyph, MAX_LIVE_GLYPHS } from './glyphs';

/**
 * `makeGlyph` builds real `THREE.Shape`/`ExtrudeGeometry`/`Mesh`/
 * `MeshStandardMaterial` objects — all CPU-only (no renderer, no GL
 * context), so it's exercised directly here under jsdom (see `glyphs.ts`'s
 * module doc comment). `createGlyphQueue` is plain data (no gsap, no
 * three) and is tested with trivial numeric stand-ins for the glyph handle,
 * exactly as the feeder will instantiate it with `THREE.Mesh` later.
 *
 * `GLYPH_KINDS` is imported from `glyphs.ts` itself (T5 task-5 fold) rather
 * than re-declared as a local literal — this file, `feed.ts`, and
 * `glyphs.ts`'s own `GlyphKind` union used to each keep an independent copy
 * of the same six kinds.
 */

describe('makeGlyph', () => {
  it.each(GLYPH_KINDS)(
    'kind %s builds a mesh with populated geometry, without throwing',
    (kind) => {
      let mesh!: THREE.Mesh;
      expect(() => {
        mesh = makeGlyph(kind);
      }).not.toThrow();

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);

      const position = mesh.geometry.getAttribute('position');
      expect(position).toBeDefined();
      expect(position.count).toBeGreaterThan(0);
    },
  );

  it('names the mesh after its kind', () => {
    expect(makeGlyph('+').name).toBe('byte-glyph-+');
    expect(makeGlyph(';').name).toBe('byte-glyph-;');
  });

  it('gives each call its own unique geometry + material instance', () => {
    const a = makeGlyph('*');
    const b = makeGlyph('*');

    expect(a.geometry).not.toBe(b.geometry);
    expect(a.material).not.toBe(b.material);
  });

  it('uses a MeshStandardMaterial (roughness ~0.4, metalness 0), not metallic/shiny', () => {
    const mesh = makeGlyph('=');
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeCloseTo(0.4, 5);
  });

  it('centers the geometry so the mesh origin sits at its own visual center', () => {
    const mesh = makeGlyph('{');
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);

    // geometry.center() re-origins the bounding box to (0,0,0); a tiny
    // numerical epsilon is allowed for the bevel/curve tessellation.
    expect(center.length()).toBeLessThan(1e-6);
  });

  it('keeps every kind within roughly a 1x1xsmall-depth local box', () => {
    for (const kind of GLYPH_KINDS) {
      const mesh = makeGlyph(kind);
      mesh.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      mesh.geometry.boundingBox!.getSize(size);

      expect(size.x).toBeLessThanOrEqual(1.2);
      expect(size.y).toBeLessThanOrEqual(1.2);
      expect(size.z).toBeLessThan(0.5);
    }
  });
});

describe('createGlyphQueue: MAX_LIVE_GLYPHS', () => {
  it('is 3 and is the default cap', () => {
    expect(MAX_LIVE_GLYPHS).toBe(3);
  });
});

describe('createGlyphQueue: cap', () => {
  it('adding a 4th glyph pops the oldest; liveCount stays at the cap (3)', () => {
    const queue = createGlyphQueue<number>();

    const first = queue.add(1);
    queue.add(2);
    queue.add(3);

    expect(queue.liveCount()).toBe(3);
    expect(first.popped).toBeNull();

    const fourth = queue.add(4);

    expect(queue.liveCount()).toBe(3);
    expect(fourth.popped).not.toBeNull();
    expect(fourth.popped?.id).toBe(first.entry.id);
    expect(fourth.popped?.glyph).toBe(1);

    // The popped entry is gone, not just skipped.
    expect(queue.next()?.id).not.toBe(first.entry.id);
  });

  it('respects a custom cap passed to createGlyphQueue', () => {
    const queue = createGlyphQueue<number>(1);

    const first = queue.add(1);
    expect(first.popped).toBeNull();
    expect(queue.liveCount()).toBe(1);

    const second = queue.add(2);
    expect(second.popped?.id).toBe(first.entry.id);
    expect(queue.liveCount()).toBe(1);
  });
});

describe('createGlyphQueue: markEating protects the eat target from the cap-pop', () => {
  it('pops the oldest NON-eating entry, skipping the one being eaten', () => {
    const queue = createGlyphQueue<number>();

    const first = queue.add(1);
    const second = queue.add(2);
    const third = queue.add(3);

    queue.markEating(first.entry.id);

    const fourth = queue.add(4);

    expect(fourth.popped?.id).toBe(second.entry.id);
    expect(fourth.popped?.id).not.toBe(first.entry.id);
    expect(queue.liveCount()).toBe(3);

    // The eating entry (first) survived; oldest non-eating live entry is now third.
    expect(queue.next()?.id).toBe(third.entry.id);
  });

  it('degenerate case: every pre-existing entry is eating -> force-evicts the oldest of THOSE; the just-tossed glyph survives', () => {
    const queue = createGlyphQueue<number>(2);

    const first = queue.add(1);
    const second = queue.add(2);
    queue.markEating(first.entry.id);
    queue.markEating(second.entry.id);

    const third = queue.add(3);

    expect(queue.liveCount()).toBe(2);
    expect(third.popped?.id).toBe(first.entry.id);
    // The glyph just added is never the casualty of its own toss.
    expect(third.popped?.id).not.toBe(third.entry.id);
  });
});

describe('createGlyphQueue: next()', () => {
  it('returns null when empty', () => {
    const queue = createGlyphQueue<number>();
    expect(queue.next()).toBeNull();
  });

  it('returns the oldest live entry that is not eating', () => {
    const queue = createGlyphQueue<number>();

    const first = queue.add(1);
    const second = queue.add(2);

    expect(queue.next()?.id).toBe(first.entry.id);

    queue.markEating(first.entry.id);
    expect(queue.next()?.id).toBe(second.entry.id);

    queue.markEating(second.entry.id);
    expect(queue.next()).toBeNull();
  });
});

describe('createGlyphQueue: onEat / total', () => {
  it('increments total and fires onEat with the running total after each markEaten', () => {
    const queue = createGlyphQueue<number>();
    const onEat = vi.fn();
    queue.onEat(onEat);

    const first = queue.add(10);
    const second = queue.add(20);

    const removedFirst = queue.markEaten(first.entry.id);
    expect(removedFirst?.glyph).toBe(10);
    expect(onEat).toHaveBeenNthCalledWith(1, 1);

    const removedSecond = queue.markEaten(second.entry.id);
    expect(removedSecond?.glyph).toBe(20);
    expect(onEat).toHaveBeenNthCalledWith(2, 2);

    expect(queue.total()).toBe(2);
    expect(queue.liveCount()).toBe(0);
  });

  it('supports multiple onEat subscribers; both fire', () => {
    const queue = createGlyphQueue<number>();
    const first = vi.fn();
    const second = vi.fn();
    queue.onEat(first);
    queue.onEat(second);

    const entry = queue.add(1);
    queue.markEaten(entry.entry.id);

    expect(first).toHaveBeenCalledExactlyOnceWith(1);
    expect(second).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('markEaten returns null and does not fire onEat for an unknown id', () => {
    const queue = createGlyphQueue<number>();
    const onEat = vi.fn();
    queue.onEat(onEat);

    expect(queue.markEaten(999)).toBeNull();
    expect(onEat).not.toHaveBeenCalled();
    expect(queue.total()).toBe(0);
  });
});

describe('createGlyphQueue: remove()', () => {
  it('removes an entry without counting it toward total or firing onEat', () => {
    const queue = createGlyphQueue<number>();
    const onEat = vi.fn();
    queue.onEat(onEat);

    const entry = queue.add(1);
    const removed = queue.remove(entry.entry.id);

    expect(removed?.id).toBe(entry.entry.id);
    expect(removed?.glyph).toBe(1);
    expect(queue.liveCount()).toBe(0);
    expect(queue.total()).toBe(0);
    expect(onEat).not.toHaveBeenCalled();
  });

  it('returns null for an unknown id', () => {
    const queue = createGlyphQueue<number>();
    expect(queue.remove(999)).toBeNull();
  });
});

describe('createGlyphQueue: id stability', () => {
  it('assigns a monotonically increasing id to each added entry, even across removals', () => {
    const queue = createGlyphQueue<number>();

    const a = queue.add(1);
    const b = queue.add(2);
    queue.markEaten(a.entry.id);
    const c = queue.add(3);

    expect(b.entry.id).toBeGreaterThan(a.entry.id);
    expect(c.entry.id).toBeGreaterThan(b.entry.id);
  });
});
