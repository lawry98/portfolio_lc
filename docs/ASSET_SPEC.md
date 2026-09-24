# ASSET_SPEC — Byte's 3D model (`.glb`)

- **Status:** Delivered 2026-08-27 (owner's Blender build; audited 2026-09-22) — this file is now the re-export contract.
- **Purpose:** the checklist for whoever produces Byte's model (you in Blender, a modeler, or an AI 3D tool). If the file meets this contract, it drops into the running demo with minimal rework. Until it arrives, a procedural placeholder bot stands in.
- **Related:** [`SPEC.md`](SPEC.md) §4.2–§4.3, §5.

> TL;DR: one `.glb`, a **little robot**, Y-up / faces +Z / origin at feet / ~1.8u tall, ≤ ~40k tris, textures ≤ 1024², ≤ ~500KB compressed, with **named materials** (`Body`, `Glow`), **named nodes** (`Eye` or `Head`, `Mouth`), and **named baked clips** (`Idle Hop Dash Eat Sleep Wake Peek`).

---

## 1. File & format
- **glTF 2.0 binary `.glb`**, a single self-contained file (embedded textures + animations).
- **Compression:** `EXT_meshopt_compression` is what's wired (`MeshoptDecoder`, bundled with three) — DRACO is not. Uncompressed is fine too if within budget.
- **No** embedded cameras or lights. One scene. Apply/freeze transforms before export.

## 2. Scale, orientation, origin
- **Up axis:** Y-up.
- **Forward:** faces **+Z** (tell me if it faces −Z and I'll flip once).
- **Height:** ~**1.8 world units** tall — the rig normalizes this 1.8u height and renders Byte at **1.25 × the headline font-size** (T-GLB), so exact size isn't critical — but keep it "roughly humanoid-unit" so proportions read.
- **Origin/pivot:** at the **feet**, centered on X/Z, resting on the ground plane (y=0). (Centered origin is acceptable — just tell me which.)
- **One root node** containing everything.

## 3. Budget (drives 60fps on a mid-range phone)
- **Triangles:** ≤ ~**40,000**.
- **Textures:** ≤ **1024×1024**, at most **2 maps** — baseColor (+ optional metallic-rough *or* emissive).
- **File size:** aim ≤ ~**500KB** compressed (soft target; we verify on-device).
- Prefer a few materials over many; prefer baked/simple over complex node graphs.

## 4. Materials (must be findable by name)
- **`Body`** — the main surface I recolor per light/dark theme. Standard PBR **metallic-roughness**. Give the bulk of the robot this material (or a small set I can tint together).
- **`Glow`** *(optional but recommended)* — an emissive accent (eye, visor, chest light) I drive for the dark-mode phosphor glow in the chosen accent color (mint/amber/white/cyan). Mark it emissive.
- **`Visor`** *(optional)* — left as authored; I never recolor or theme it (T-GLB).
- Exact material **names matter** — call them `Body`, `Glow` and `Visor` (case-insensitive match, but exact is safest).

## 5. Nodes (must be findable by name)
- **`Eye`** or **`Head`** — a node I rotate a few degrees to fake **cursor tracking**. If the face is a screen, a `Face`/`Screen` node works too. Give it a sensible local pivot.
- **`EyeL`/`EyeR`** *(optional)* — if present, I drive them for blink (squash on the eye's local Y) and an eye slide toward the cursor, on top of the `Head` turn (T-GLB). Children of `Head` is the natural place for them.
- **`Mouth`** — an empty/locator at the intake point where fed glyphs converge and disappear. Position it where "eating" should visually happen.
- *(If you go the static/segmented route — see §6 — also name the moving parts: `Antenna`, `EyeL`, `EyeR`, `LegL`, `LegR`, etc.)*

## 6. Animation — pick a path
**Preferred (locked): baked clips.** Rig + animate in Blender and export named **animation clips**:

| Clip | Loop? | Notes |
|---|---|---|
| `Idle` | loop | subtle breathing/hover; the resting state |
| `Hop` | once | a small jump (used for micro-behaviors + peek) |
| `Dash` | loop or once | fast travel pose (I move it through space; keep root **in place**) |
| `Eat` | once | a chomp/consume beat (~2 quick bites) |
| `Sleep` | loop | dozing (slow, low) |
| `Wake` | once | startled jump/shake |
| `Peek` | once | leans/peers up over a ledge |

- Keep clips **short and loopable** where marked; **root motion in place** (I drive world position via GSAP — don't translate the character across the scene inside the clip).
- A **subset is fine**: at minimum `Idle` + `Eat`. Missing clips fall back to procedural GSAP motion.

**The re-export contract (T-GLB).** The delivered `byte.glb` was decoded with three's own loader on 2026-09-22 and these are the authored beats every re-export must match:

| Clip | Length | Loop | Beats |
|---|---|---|---|
| `Idle` | 3.00 s | loop | ±1.3° torso sway, ±2.6° head tilt, no vertical bob |
| `Hop` | 1.17 s | once | crouch to 0.13 s, takeoff 0.20 s, apex 0.50 s (+0.165 u, 9% of height), land 0.80 s |
| `Dash` | 0.67 s | loop | 12° forward lean, bouncing run cycle |
| `Eat` | 1.33 s | once | bites at **0.33 s** and **0.60 s** (head nods +8°), satisfied bounce at 0.90 s |
| `Sleep` | 4.00 s | loop | slumped (torso −0.025 u, head nod 10°), breathing |
| `Wake` | 1.25 s | once | starts from the Sleep pose, jolt at 0.20–0.33 s, head shake to 0.90 s, settled by 1.18 s |
| `Peek` | 1.67 s | once | starts and ends crouched (−0.34 u), rises through 0.1–0.7 s, peers 0.7–1.1 s, drops 1.3–1.6 s |

`src/pet/glbAsset.test.ts` is a real-file smoke test that decodes the committed `public/models/byte.glb` and enforces this contract mechanically: every material/node/clip name, these clip lengths, the `Eat` bite timings, the 1.8u height, tris ≤ 40k and the byte size. A bad re-export fails that suite rather than the page.

**Fallback: static / segmented.** No skeleton. If §5's parts are separate named nodes, I animate them procedurally with GSAP (bob, tilt, hop-squash, antenna wiggle). Simpler to produce; reads a touch stiffer. A single fused static mesh also works but is the stiffest.

## 7. Export checklist (Blender → glTF)
- [ ] Apply all transforms (scale = 1), Y-up on export.
- [ ] Materials named `Body` / `Glow`; `Glow` has emission.
- [ ] Nodes named `Eye`/`Head` and `Mouth` (+ segmented parts if static).
- [ ] Animation actions named per §6; pushed to NLA / exported as separate clips; **"Group by NLA Track"** or equivalent so names survive.
- [ ] Root motion kept in place for `Dash`.
- [ ] Within budget (§3). Test in <https://gltf-viewer.donmccurdy.com/> before sending.
- [ ] Export **format: glTF Binary (.glb)**, with animations + selected objects.

## 8. Delivery
- Drop the file at `public/models/byte.glb` in the demo (or send it and I'll place it), and I set `modelUrl` accordingly. The loader maps your names to the runtime interface and disposes the placeholder.
- If a name doesn't match or a clip is missing, the demo still runs (placeholder/procedural fallback for that piece) — nothing hard-crashes.
- **Model changes are re-exports, never patches (T-GLB).** Any future change to Byte's model comes from re-exporting the owner's Blender source (`/Volumes/SD500/Documents/blender/`) — the committed `public/models/byte.glb` is never hand-edited or re-optimized in place. Copy the fresh export over `public/models/byte.glb` and update `src/pet/glbAsset.test.ts`'s `DELIVERED_BYTES` constant to the new file's byte size so the smoke test's size check stays true.

## 9. Tips
- **AI 3D tools** (Meshy / Tripo / Rodin) usually output a **static** mesh, *not* rigged with named clips → that lands you in the §6 *fallback* path. Great for the shape; you'd still rig in Blender to get baked clips.
- Keep it **chunky and readable at small size** — this appears at headline scale, sometimes half-behind a letter.
- Emissive `Glow` is what makes the dark-mode phosphor look land — worth including even if tiny.
