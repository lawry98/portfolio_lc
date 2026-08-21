# ASSET_SPEC — Byte's 3D model (`.glb`)

- **Status:** Draft contract (T0). Refined if needed at the GLB swap-in ticket.
- **Purpose:** the checklist for whoever produces Byte's model (you in Blender, a modeler, or an AI 3D tool). If the file meets this contract, it drops into the running demo with minimal rework. Until it arrives, a procedural placeholder bot stands in.
- **Related:** [`SPEC.md`](SPEC.md) §4.2–§4.3, §5.

> TL;DR: one `.glb`, a **little robot**, Y-up / faces +Z / origin at feet / ~1.8u tall, ≤ ~40k tris, textures ≤ 1024², ≤ ~500KB compressed, with **named materials** (`Body`, `Glow`), **named nodes** (`Eye` or `Head`, `Mouth`), and **named baked clips** (`Idle Hop Dash Eat Sleep Wake Peek`).

---

## 1. File & format
- **glTF 2.0 binary `.glb`**, a single self-contained file (embedded textures + animations).
- **Compression:** DRACO or meshopt welcome (I wire the decoder). Uncompressed is fine too if within budget.
- **No** embedded cameras or lights. One scene. Apply/freeze transforms before export.

## 2. Scale, orientation, origin
- **Up axis:** Y-up.
- **Forward:** faces **+Z** (tell me if it faces −Z and I'll flip once).
- **Height:** ~**1.8 world units** tall (the rig re-scales to the live headline font-size, so exact size isn't critical — but keep it "roughly humanoid-unit" so proportions read).
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
- Exact material **names matter** — call them `Body` and `Glow` (case-insensitive match, but exact is safest).

## 5. Nodes (must be findable by name)
- **`Eye`** or **`Head`** — a node I rotate a few degrees to fake **cursor tracking**. If the face is a screen, a `Face`/`Screen` node works too. Give it a sensible local pivot.
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

## 9. Tips
- **AI 3D tools** (Meshy / Tripo / Rodin) usually output a **static** mesh, *not* rigged with named clips → that lands you in the §6 *fallback* path. Great for the shape; you'd still rig in Blender to get baked clips.
- Keep it **chunky and readable at small size** — this appears at headline scale, sometimes half-behind a letter.
- Emissive `Glow` is what makes the dark-mode phosphor look land — worth including even if tiny.
