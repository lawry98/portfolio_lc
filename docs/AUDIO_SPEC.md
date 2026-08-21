# AUDIO_SPEC — Byte's sound files (Howler swap-in)

- **Status:** Draft contract (T0). Only needed when we swap synth → Howler; the demo ships and works on WebAudio synth until then.
- **Purpose:** the checklist for the recorded sounds that replace the synth blips. Deliver files matching this and the `SoundEngine`'s Howler implementation drops in with no call-site changes.
- **Related:** [`SPEC.md`](SPEC.md) §9.

## 1. Engine
- A thin **`SoundEngine`** interface owns the gate/unlock, master volume, EQ mute, and a per-event `play(name)` API. Two impls: **WebAudioSynth** (now) and **HowlerFiles** (this doc). Swapping engines changes no call sites.
- **Howler impl:** prefer **one audio sprite** (a single file with named time segments) — fewer requests, cleaner unlock. Individual files are also fine.

## 2. Sound list (names are the `play()` keys)
| Key | Character | ~Length |
|---|---|---|
| `typeTick` | soft mechanical key tick (plays every 2–3 chars while typing) | 40–80ms |
| `eatA` / `eatB` | two alternating "chomp/blip" bites | 80–140ms |
| `spawnPop` | light pop when a glyph is tossed in | 80–120ms |
| `themeWhoosh` | short airy whoosh on theme toggle | 200–350ms |
| `wakeBoing` | springy startle on wake | 150–300ms |
| `chirp` | Byte's occasional friendly beep (idle/peek) | 100–200ms |

A subset is fine; any missing key falls back to the synth version.

## 3. File specs
- **Format:** provide **`.webm`/`.ogg` + `.mp3`** (or `.m4a`) for cross-browser; Howler picks the best. If a sprite, one file per format.
- **Levels:** normalized, **mixed low/subtle** (these layer under interaction — err quiet). Consistent loudness across cues.
- **Mono** is fine (smaller); 44.1kHz; trim silence tight.
- **Budget:** total ≤ ~**150KB** (soft) — favor a sprite; keep cues short. This is a new asset download (like the GLB), so stay lean.

## 4. Licensing
- **CC0 / owned / commissioned only.** Never Léo's (or anyone's) copyrighted audio. Note the source + license per cue so we can attribute if required. Good CC0 sources: freesound.org (CC0 filter), or synthesize/render your own.

## 5. Delivery
- Drop files at `public/audio/` (e.g. `public/audio/byte.sprite.webm` + `.mp3`, or individual `public/audio/eatA.webm` …).
- Tell me the sprite segment map (name → `[startMs, durationMs]`) if using a sprite; I wire it into the Howler `SoundEngine`.

## 6. Tips
- If unsure, ship the demo on synth (already great) and add files later — nothing blocks on this.
- Tiny UI cues often sound better *quieter and shorter* than you'd expect; over-designed foley reads as noisy.
