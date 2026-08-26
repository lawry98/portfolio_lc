/**
 * Tossable 3D code-glyph meshes + the pure feeding queue that decides which
 * ones are "live" (SPEC §6 "toss-to-feed 3D glyphs `{ ; > *`... max 3 live
 * glyphs (oldest pops away)"). Two independent pieces, one file:
 *
 * - `createGlyphQueue()` — a **pure** (no gsap, no three) queue/counter:
 *   plain glyph handles (generic `T`, so this section never touches a
 *   `three` value) plus a monotonic id and a running eaten total. It
 *   decides *which* glyphs are live (`add`'s cap-pop), *which* one to dash
 *   to next (`next()`), and fans out `onEat(total)` — fully unit-tested
 *   below without gsap/WebGL. `feed.ts` (Task 3) is the only thing that
 *   drives it with real state and actually animates/disposes glyphs.
 * - `makeGlyph(kind)` — builds one tossable glyph mesh: a hand-built
 *   `THREE.Shape` silhouette (rounded bars/blobs, no `typeface.json`/
 *   `FontLoader` — SPEC §6) bevel-extruded into a small-depth 3D token via
 *   `THREE.ExtrudeGeometry`, centered (`geometry.center()`) so the feeder
 *   can position + scale it from its own origin. Shape/ExtrudeGeometry/
 *   Mesh/MeshStandardMaterial construction is CPU-only (no renderer, no GL
 *   context), so this is also exercised directly under jsdom in
 *   `glyphs.test.ts` — unlike `shadow.ts`'s canvas-texture builder, nothing
 *   here needs to be skipped in tests.
 *
 * Neither piece is added to a scene/layer or given a size — `feed.ts` does
 * both (via `scene.addToFront` and scaling the returned mesh by `unitPx`),
 * the same "this module owns no placement" split `shadow.ts` uses for the
 * blob-shadow mesh.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// `createGlyphQueue()` — the pure live-glyph queue/counter (unit-tested).
// ---------------------------------------------------------------------------

/**
 * One entry the queue tracks: the caller's own glyph handle (`T` — a
 * `THREE.Mesh` for the real feeder, a plain stand-in in tests), a stable
 * `id`, and whether it's the in-progress eat target (protects it from the
 * cap-pop in `add`).
 */
export interface GlyphQueueEntry<T> {
  id: number;
  glyph: T;
  eating: boolean;
}

export interface GlyphQueue<T> {
  /** Enqueue a glyph. If this pushes the live count over the cap, the OLDEST
   *  non-`eating` entry is removed and returned as `popped` (caller disposes it);
   *  otherwise `popped` is null. Returns the new entry + any popped one. */
  add(glyph: T): { entry: GlyphQueueEntry<T>; popped: GlyphQueueEntry<T> | null };
  /** Oldest live entry not yet being eaten (the feeder's next dash target), or null. */
  next(): GlyphQueueEntry<T> | null;
  /** Mark an entry as the in-progress eat target (so `add`'s cap-pop skips it). */
  markEating(id: number): void;
  /** Remove an eaten entry, increment the eaten total, fire `onEat(total)`. Returns the removed entry (caller disposes it) or null if unknown id. */
  markEaten(id: number): GlyphQueueEntry<T> | null;
  /** Remove an entry WITHOUT counting it (used for a popped/aborted glyph); returns it (caller disposes) or null. */
  remove(id: number): GlyphQueueEntry<T> | null;
  /** Entries currently in the queue (tossed, not yet eaten/removed). */
  liveCount(): number;
  /** Cumulative eaten count (drives the FED counter). */
  total(): number;
  /** Register-many: fires on each `markEaten`. */
  onEat(cb: (total: number) => void): void;
}

/** SPEC §6 "max 3 live glyphs (oldest pops away)" — `createGlyphQueue()`'s default cap. */
export const MAX_LIVE_GLYPHS = 3;

/**
 * Builds the pure queue/counter. Generic over the glyph handle type `T` so
 * this module never has to import `three` for it — `feed.ts` instantiates
 * `createGlyphQueue<THREE.Mesh>()`; `glyphs.test.ts` uses plain numbers as
 * stand-in handles.
 */
export function createGlyphQueue<T = unknown>(cap: number = MAX_LIVE_GLYPHS): GlyphQueue<T> {
  const entries: Array<GlyphQueueEntry<T>> = [];
  const onEatListeners: Array<(total: number) => void> = [];
  let nextId = 0;
  let eatenTotal = 0;

  /** Removes and returns the entry with `id`, or null if none matches — the
   *  shared splice-by-id `markEaten` and `remove` both use (they differ only
   *  in whether the removal counts toward `total()`/fires `onEat`). */
  function takeById(id: number): GlyphQueueEntry<T> | null {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) {
      return null;
    }
    return entries.splice(index, 1)[0];
  }

  function add(glyph: T): { entry: GlyphQueueEntry<T>; popped: GlyphQueueEntry<T> | null } {
    const entry: GlyphQueueEntry<T> = { id: nextId, glyph, eating: false };
    nextId += 1;
    entries.push(entry);

    let popped: GlyphQueueEntry<T> | null = null;
    if (entries.length > cap) {
      // Eviction candidates are every PRE-EXISTING entry (every index
      // except the one just pushed, at entries.length - 1) — the glyph
      // just tossed is never the casualty of its own toss. Prefer the
      // oldest non-eating candidate (protects the in-progress eat target,
      // per `markEating`'s contract); if every pre-existing entry is
      // eating (degenerate — the whole queue is mid-eat), fall back to
      // evicting the oldest pre-existing one anyway so the cap still holds.
      let popIndex = -1;
      for (let i = 0; i < entries.length - 1; i++) {
        if (!entries[i].eating) {
          popIndex = i;
          break;
        }
      }
      popped = entries.splice(popIndex === -1 ? 0 : popIndex, 1)[0];
    }

    return { entry, popped };
  }

  function next(): GlyphQueueEntry<T> | null {
    return entries.find((e) => !e.eating) ?? null;
  }

  function markEating(id: number): void {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      entry.eating = true;
    }
  }

  function markEaten(id: number): GlyphQueueEntry<T> | null {
    const removed = takeById(id);
    if (!removed) {
      return null;
    }
    eatenTotal += 1;
    for (const cb of onEatListeners) {
      cb(eatenTotal);
    }
    return removed;
  }

  function remove(id: number): GlyphQueueEntry<T> | null {
    return takeById(id);
  }

  function liveCount(): number {
    return entries.length;
  }

  function total(): number {
    return eatenTotal;
  }

  function onEat(cb: (total: number) => void): void {
    onEatListeners.push(cb);
  }

  return { add, next, markEating, markEaten, remove, liveCount, total, onEat };
}

// ---------------------------------------------------------------------------
// `makeGlyph()` — hand-built THREE.Shape glyphs, bevel-extruded into chunky
// 3D tokens. CPU-only (Shape/ExtrudeGeometry/Mesh/MeshStandardMaterial need
// no renderer or GL context), so `glyphs.test.ts` exercises this directly.
// ---------------------------------------------------------------------------

/**
 * The six code-glyph kinds Byte can be fed (SPEC §6 "`{ ; > *`" plus `+`/`=`)
 * — the single exported source of truth (T8 task-5 carry-forward fold: this
 * used to be duplicated three ways — this file's own `GlyphKind` union,
 * `feed.ts`'s local `GLYPH_KINDS` const, and `glyphs.test.ts`'s own literal).
 * `GlyphKind` below is DERIVED from this array rather than declared as an
 * independent literal union, so the two can never drift out of lockstep.
 * `feed.ts`'s `randomGlyphKind()` imports this directly for its runtime
 * pick; `glyphs.test.ts` imports it for its `it.each` sweep.
 */
export const GLYPH_KINDS = ['{', ';', '>', '*', '+', '='] as const;

/** Every kind `makeGlyph()` can build — derived from `GLYPH_KINDS` above. */
export type GlyphKind = (typeof GLYPH_KINDS)[number];

/** Stroke thickness shared by every bar-built glyph, in the ~1-unit local
 *  box `makeGlyph` authors in before `geometry.center()` re-centers it — a
 *  "chunky" width chosen to read clearly once scaled down to headline size
 *  (mirrors `placeholderBot.ts`'s "chunky and readable at small size"). */
const BAR_THICKNESS = 0.2;

/** Extrusion depth: shallow relative to the ~1-unit footprint so the glyph
 *  reads as a flat-ish token rather than a cube, per the brief's "small
 *  depth ... chunky 3D token." */
const GLYPH_DEPTH = 0.22;

/** Bevel size/thickness: small and equal, softening every edge without
 *  eroding the silhouette. */
const GLYPH_BEVEL = 0.035;

/** Modest curve/bevel tessellation — keeps triangle count low (up to 3 live
 *  glyphs at once, plus the 60fps mid-range-phone budget in SPEC §13) and
 *  matches the placeholder bot's low-poly "soft-clay" look rather than a
 *  glassy-smooth extrusion. */
const CURVE_SEGMENTS = 8;
const BEVEL_SEGMENTS = 2;

/**
 * Neutral ink-ish default, hand-picked near `shadow.ts`'s `--ink`-pitched
 * tint rather than imported from page CSS (`pet/` portability, mirrors
 * `scene.ts`'s `THEME_PRESETS` convention). `feed.ts` recolors per theme via
 * the returned mesh's material.
 */
const GLYPH_MATERIAL_COLOR = 0x2a2830;
const GLYPH_ROUGHNESS = 0.4;
const GLYPH_METALNESS = 0;

/**
 * A rounded-rectangle `THREE.Shape` — a "stadium"/capsule when `radius`
 * equals half of both `width` and `height` — centered at `(cx, cy)` and
 * rotated `angle` radians. The one primitive every glyph below is built
 * from. Every anchor AND control point is produced by the same `at()`
 * rotate+translate map, so the whole outline turns as one rigid body:
 * rotation+translation is affine, so it carries a quadratic Bezier's
 * control point along with its endpoints without distorting the curve.
 */
function roundedBarShape(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
  angle = 0,
): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  /** Maps a point in the bar's own unrotated local space (origin at its
   *  center) to final shape space: rotate by `angle`, then translate to
   *  `(cx, cy)`. Used below for every anchor AND control point, so the
   *  whole rounded-rect outline turns as one rigid body — rotation then
   *  translation is affine, so it carries a quadratic Bezier's control
   *  point along with its endpoints without distorting the curve. */
  function at(x: number, y: number): [number, number] {
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  }

  const shape = new THREE.Shape();
  // Block bodies (not concise/expression arrows) so these stay unambiguously
  // void — `Shape#moveTo`/`lineTo`/`quadraticCurveTo` all return `this` for
  // chaining, which a `: void`-annotated expression-bodied arrow would
  // otherwise need to discard.
  const moveTo = (x: number, y: number): void => {
    shape.moveTo(...at(x, y));
  };
  const lineTo = (x: number, y: number): void => {
    shape.lineTo(...at(x, y));
  };
  const curveTo = (ctrlX: number, ctrlY: number, x: number, y: number): void => {
    shape.quadraticCurveTo(...at(ctrlX, ctrlY), ...at(x, y));
  };

  // Standard rounded-rect outline (moveTo one straight-edge start, then
  // lineTo/curveTo around each of the 4 corners in turn), just expressed
  // through the `at()`-wrapped helpers above instead of raw x/y.
  moveTo(-w + r, -h);
  lineTo(w - r, -h);
  curveTo(w, -h, w, -h + r);
  lineTo(w, h - r);
  curveTo(w, h, w - r, h);
  lineTo(-w + r, h);
  curveTo(-w, h, -w, h - r);
  lineTo(-w, -h + r);
  curveTo(-w, -h, -w + r, -h);

  return shape;
}

/** A rounded bar spanning exactly between two points, `thickness` wide, with
 *  fully-rounded (semicircular) caps at each endpoint — the main authoring
 *  primitive below: every stroke-built glyph (`+ = > {`) is a short list of
 *  endpoint pairs. */
function barBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
): THREE.Shape {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  return roundedBarShape((x1 + x2) / 2, (y1 + y2) / 2, length, thickness, thickness / 2, angle);
}

/** A round "dot" blob of diameter `d` — `roundedBarShape` with radius equal
 *  to half of both width and height collapses its straight edges to zero
 *  length, leaving 4 quadratic-Bezier quarter-arcs (a circle-ish blob). */
function dotShape(cx: number, cy: number, d: number): THREE.Shape {
  return roundedBarShape(cx, cy, d, d, d / 2, 0);
}

/** One or more `THREE.Shape` paths silhouetting `kind` — see the module doc
 *  comment; each is a hand-built rounded-bar/blob composition, no fonts. */
function shapesForKind(kind: GlyphKind): THREE.Shape[] {
  switch (kind) {
    case '+':
      return [
        barBetween(-0.4, 0, 0.4, 0, BAR_THICKNESS),
        barBetween(0, -0.4, 0, 0.4, BAR_THICKNESS),
      ];

    case '=':
      return [
        barBetween(-0.4, 0.18, 0.4, 0.18, BAR_THICKNESS),
        barBetween(-0.4, -0.18, 0.4, -0.18, BAR_THICKNESS),
      ];

    case '>':
      return [
        barBetween(-0.28, 0.4, 0.32, 0, BAR_THICKNESS),
        barBetween(0.32, 0, -0.28, -0.4, BAR_THICKNESS),
      ];

    case '*':
      return [
        barBetween(-0.35, 0, 0.35, 0, BAR_THICKNESS),
        barBetween(-0.175, -0.303, 0.175, 0.303, BAR_THICKNESS),
        barBetween(-0.175, 0.303, 0.175, -0.303, BAR_THICKNESS),
      ];

    case ';':
      // A small dot over an elongated, angled "tail" blob standing in for
      // the comma — SPEC §6's "two dots/comma blobs".
      return [dotShape(0.02, 0.3, 0.22), barBetween(0.08, -0.02, -0.14, -0.4, 0.22)];

    case '{':
      // A 4-segment zigzag (top hook -> inward point -> bottom hook)
      // approximating a curly brace out of the same rounded-bar primitive
      // as every other glyph, per the "rounded primitives" brief.
      return [
        barBetween(0.16, 0.45, -0.05, 0.2, BAR_THICKNESS),
        barBetween(-0.05, 0.2, -0.22, 0, BAR_THICKNESS),
        barBetween(-0.22, 0, -0.05, -0.2, BAR_THICKNESS),
        barBetween(-0.05, -0.2, 0.16, -0.45, BAR_THICKNESS),
      ];
  }
}

/**
 * Builds one tossable glyph mesh (R-T5-10): `kind`'s hand-built `Shape`(s),
 * bevel-extruded and centered so the mesh's origin is its visual center
 * (`feed.ts` positions + scales it from there). One unique geometry +
 * material per call — `feed.ts` disposes both per eaten/popped glyph; this
 * module never adds the mesh to a scene/layer or scales it (`feed.ts` does
 * both, by `unitPx`).
 */
export function makeGlyph(kind: GlyphKind): THREE.Mesh {
  const shapes = shapesForKind(kind);
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: GLYPH_DEPTH,
    bevelEnabled: true,
    bevelThickness: GLYPH_BEVEL,
    bevelSize: GLYPH_BEVEL,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: CURVE_SEGMENTS,
  });
  geometry.center();

  const material = new THREE.MeshStandardMaterial({
    color: GLYPH_MATERIAL_COLOR,
    roughness: GLYPH_ROUGHNESS,
    metalness: GLYPH_METALNESS,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `byte-glyph-${kind}`;
  return mesh;
}
