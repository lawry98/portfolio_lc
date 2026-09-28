# Byte flips the theme — design

- **Status:** agreed with the owner, 2026-09-28 (grilling session). Supersedes SPEC §6's "theme reaction" bullet for toggle clicks, including its unbuilt "headbutt the toggle" stretch goal.
- **Branch:** `feat/byte-theme-gesture`, cut from `feat/byte-caret-lean` at `9e4b9f6`. The portfolio integration (`lc/byte-light-dark-toggle-5d93c4`) comes later and is out of scope here.
- **Prototype:** a throwaway demo compared four gestures on the real `byte.glb`. The owner picked **B, charge & release**.

## What happens

Clicking the nav theme toggle makes **Byte cause the switch**. It crouches, squashes and charges, then stretches and its chest light flares. The new theme spreads out as a circle whose origin is the chest light on screen.

## Decisions

| # | Decision |
|---|---|
| 1 | **Byte's role:** Byte causes the flip. The theme changes on the gesture's flare, not on the click. |
| 2 | **Gesture:** charge & release. Crouch-squash (y 0.8, xz 1.11, 0.56s), then release-stretch (y 1.18, xz 0.92), then an elastic settle. The chest glow flares to 3.6× on release. The flip lands at **0.63s** after the gesture starts. |
| 3 | **Light → dark:** the glow is off in light mode, so it **ignites** during the charge (level 0 → 0.6), then flares. **Dark → light:** the glow dims during the charge (× 0.1), flares, then fades out with the theme lerp. |
| 4 | **Reveal origin:** the new `ChestLight` empty (parented to `Torso`, re-exported by the owner 2026-09-25; world rest ≈ (0.007, 0.709, 0.163) model units). The code falls back to `Torso`, then to Byte's root, if the node is missing. |
| 5 | **Where it happens:** if at least **50%** of Byte's screen box is inside the viewport and its scissor stage, Byte gestures **at home**. Otherwise it **peeks in from the bottom-right edge of the viewport**: it rises (0.6s), gestures, then sinks back out. The rise is a custom `pose.position.y` tween. The `Peek` clip only lifts Byte about 17% of its height, so it isn't used for this. |
| 6 | **Busy Byte:** idle, curious, invited and peeking go into a new FSM state, `switching`. Sleeping goes through `waking` first (the Wake clip, then `switching`). While **dashing, eating or retyping**, the gesture is **layered on top** (on `pose.scale` and the glow) and the running state is not interrupted. The reveal starts from the chest if at least 50% of Byte is visible, otherwise from the toggle. While **hidden, entering or traveling**, the reveal starts **from the toggle button** with no gesture. *(This refines the original "interrupt anything" answer. The feed, retype and migration drivers each have one writer for Byte's position or the headline, and interrupting them would strand their work. The owner re-decided on 2026-09-28.)* |
| 7 | **Spam clicks:** ignored until the gesture and the reveal have both finished. The button carries `aria-busy="true"` meanwhile, for about 1.45s at home and 2.6s for a corner visit. |
| 8 | **Reduced motion:** no body motion, no peek and no circle. If Byte is visible (at home or busy), its glow pulses once (0.15s up, 0.15s down) and the theme **crossfades** on the pulse peak (a 400ms opacity fade via View Transitions). Otherwise it's a plain crossfade. |
| 9 | **The T8 stretch:** toggle-driven switches skip it. The light/material lerp stays and runs for the reveal's length (0.62s). `setTheme()`, the non-toggle path, keeps the stretch and the plain whoosh, unchanged. |
| 10 | **API seam:** the pet exposes `performThemeSwitch(next, apply): Promise<void>`. On the flip beat the pet calls `apply(origin)`, where `origin` is a screen point or `null`, meaning "use your own". The **page** runs the reveal and persists the theme. The pet never touches storage or `data-theme`, so the seam carries over unchanged to the portfolio's `.dark` / `theme` scheme. The promise resolves when both the gesture and the reveal are done, and never rejects. |
| 11 | **Sound:** the whoosh moves to the flip beat and depends on direction. The existing `themeWhoosh` (220 → 660 Hz) plays going to light, and a new `themeWhooshDown` (660 → 220 Hz) plays going to dark. |
| 12 | **Blender:** done by the owner. `ChestLight` is in `byte_working.blend` and the re-exported `byte.glb` is 729,036 B, which is +108 B. All 7 clips are unchanged. |

## Known behaviour worth knowing

- A **sleeping Byte that's offscreen** wakes at home before visiting the corner, which adds the 1.25s wake window. You hear the wakeBoing first, then Byte pops in.
- If Byte is **waking because it was clicked** (a pending feed) and the toggle is clicked too, the theme wins and that feed is dropped.
- A feed clicked during `switching` is ignored by the FSM, the same way FEED is ignored in every non-accepting state.
- The FSM caps `switching` at 4s as a safety net (`switchMs`). The gesture normally sends `SWITCHED` well before that.

## Out of scope

- Mounting Byte in the Next.js portfolio (`docs/INTEGRATION.md` covers that separately).
- An OS `prefers-color-scheme` change listener. None exists today, and `setTheme()` remains the entry point for one.
