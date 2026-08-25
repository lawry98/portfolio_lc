/**
 * Sound engine seam — the engine-agnostic contract every call site speaks to.
 *
 * Byte's cues are addressed by NAME (`Cue`), never by waveform: nothing outside
 * this folder knows whether the sound is a WebAudio synth, a Howler sample bank,
 * or silence. That indirection is the whole point — the current implementation
 * is `createWebAudioSynth()` (see `webAudioSynth.ts`); a later ticket can swap in
 * a sample-based engine behind the same `SoundEngine` interface without touching
 * a single caller.
 *
 * This module holds ONLY the vocabulary (the `Cue` union), the interface, and the
 * null-object default. No WebAudio, no `localStorage`, no runtime logic beyond the
 * no-ops — so it is safe to import from anywhere, including pure/testable modules.
 */

/** Every sound Byte can make, named by intent rather than by synthesis recipe. */
export type Cue = 'typeTick' | 'eatA' | 'eatB' | 'spawnPop' | 'themeWhoosh' | 'wakeBoing' | 'chirp';

export interface SoundEngine {
  unlock(): void;
  setEnabled(b: boolean): void;
  enabled(): boolean;
  play(cue: Cue): void;
  setMaster(v: number): void;
}

/**
 * Null-object engine: the default every consumer holds until a real engine is
 * injected. Every method is a no-op and `enabled()` is always `false`, so code
 * paths that emit cues stay identical whether or not sound was ever wired up —
 * no `if (sound)` guards at the call sites.
 *
 * Parameters are intentionally omitted: the methods ignore their arguments, and
 * a shorter signature is still structurally assignable to `SoundEngine` (and
 * dodges `noUnusedParameters`).
 */
export const silentSoundEngine: SoundEngine = {
  unlock(): void {},
  setEnabled(): void {},
  enabled(): boolean {
    return false;
  },
  play(): void {},
  setMaster(): void {},
};
