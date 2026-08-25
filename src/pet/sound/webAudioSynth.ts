/**
 * WebAudio implementation of the `SoundEngine` seam.
 *
 * Every cue is a throwaway graph of one-shot oscillators + a per-voice gain
 * envelope, summed through a single shared master `GainNode` into the context
 * destination. Nodes are `start()`/`stop()`-ed and then left for the garbage
 * collector — no pooling, no manual disconnect.
 *
 * Three properties this module guarantees to its callers:
 *
 *  1. **No AudioContext at import time.** Browsers hand back a *suspended*
 *     context until a user gesture resumes it, and constructing one eagerly
 *     trips autoplay policies / console warnings. The context is created lazily
 *     inside `unlock()`, which the app calls from the first real gesture.
 *  2. **Nothing is audible until BOTH the gate is open AND sound is enabled.**
 *     `play()` is a pure no-op — it creates zero audio nodes — unless the engine
 *     has been unlocked and `enabled()` is true.
 *  3. **It never throws.** A missing, blocked, or throwing `AudioContext`
 *     degrades to permanent silence rather than surfacing an error; `play()` and
 *     friends stay safe to call unconditionally.
 *
 * The mute preference persists to `localStorage` behind the same guarded
 * try/catch idiom as `src/lib/theme.ts`, so a user's choice survives a reload.
 * Callers only ever see the `SoundEngine` interface, so a later ticket can swap
 * this synth for a sample-based engine (e.g. Howler) with no call-site changes.
 */

import type { Cue, SoundEngine } from './SoundEngine';

/** `localStorage` key holding the persisted mute preference (`'1'` on / `'0'` off). */
const STORAGE_KEY = 'byte:sound';

/** Default master level — everything is mixed deliberately low and subtle. */
const DEFAULT_MASTER = 0.6;

/** Exponential ramps cannot reach 0; this is the audible-floor stand-in. */
const SILENCE = 0.0001;

/** Extra tail (seconds) kept after a voice's envelope closes before `stop()`. */
const STOP_PADDING = 0.03;

type AudioContextConstructor = new () => AudioContext;

/** One oscillator voice: a waveform, a frequency path, and a gain envelope. */
interface VoiceSpec {
  /** Oscillator waveform. */
  type: OscillatorType;
  /**
   * Frequency waypoints (Hz), the first set immediately and the rest reached by
   * successive exponential glides spread evenly across `duration`. One entry is
   * a steady tone; two glide; three bend up-then-down.
   */
  freqs: number[];
  /** Peak envelope gain, pre-master (kept in the ~0.05–0.15 subtle range). */
  peak: number;
  /** Attack time (seconds) from silence to `peak`. */
  attack: number;
  /** Envelope length (seconds) from start to silence. */
  duration: number;
  /** Start offset (seconds) after "now" — used to sequence multi-blip cues. */
  delay?: number;
}

/**
 * Cue → voice recipes. Lengths and peaks follow the T7 brief's targets:
 * subtle, mixed low, distinct enough to read as different events.
 */
const CUE_VOICES: Record<Cue, VoiceSpec[]> = {
  // Brief mechanical click.
  typeTick: [{ type: 'square', freqs: [1650], peak: 0.05, attack: 0.006, duration: 0.05 }],
  // Two alternating "chomp" pitches with a slight downward bend.
  eatA: [{ type: 'triangle', freqs: [330, 300], peak: 0.12, attack: 0.008, duration: 0.11 }],
  eatB: [{ type: 'triangle', freqs: [260, 235], peak: 0.12, attack: 0.008, duration: 0.11 }],
  // Quick upward blip.
  spawnPop: [{ type: 'sine', freqs: [250, 650], peak: 0.1, attack: 0.006, duration: 0.1 }],
  // Airy upward glide.
  themeWhoosh: [{ type: 'sine', freqs: [220, 660], peak: 0.07, attack: 0.05, duration: 0.3 }],
  // Springy pitch bend up-then-down.
  wakeBoing: [{ type: 'sine', freqs: [180, 420, 240], peak: 0.12, attack: 0.012, duration: 0.24 }],
  // Two quick ascending blips.
  chirp: [
    { type: 'sine', freqs: [800, 1000], peak: 0.07, attack: 0.005, duration: 0.06 },
    { type: 'sine', freqs: [1000, 1200], peak: 0.07, attack: 0.005, duration: 0.06, delay: 0.07 },
  ],
};

/** Clamp into `[0, 1]`; a `NaN` (e.g. from bad input) degrades to muted. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolve the platform's `AudioContext` constructor, preferring the standard
 * name and falling back to the legacy `webkitAudioContext` (older Safari/iOS).
 * Returns `undefined` when neither exists so the engine can degrade to silence.
 */
function getAudioContextCtor(): AudioContextConstructor | undefined {
  // `as unknown as` because the DOM lib types `AudioContext` as always-present,
  // whereas at runtime it can be absent (older Safari, jsdom, locked-down webviews).
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/**
 * `localStorage` access can throw (privacy mode, blocked site data, quota-0
 * webviews). Reads fall back to `null`; writes are silently best-effort — same
 * guard as `src/lib/theme.ts`.
 */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Persistence is a nice-to-have, not a requirement.
  }
}

function readEnabled(): boolean {
  const stored = safeGet(STORAGE_KEY);
  if (stored === '0') {
    return false;
  }
  if (stored === '1') {
    return true;
  }
  // Default ON: sound is enabled once the first-gesture gate opens (decision D-05).
  return true;
}

function persistEnabled(value: boolean): void {
  safeSet(STORAGE_KEY, value ? '1' : '0');
}

/**
 * Render one throwaway voice: an oscillator through a fast gain envelope into
 * the shared master bus. Started at `now (+delay)` and stopped shortly after
 * its envelope closes so the browser can reclaim it.
 */
function renderVoice(context: AudioContext, out: GainNode, spec: VoiceSpec): void {
  const start = context.currentTime + (spec.delay ?? 0);
  const end = start + spec.duration;

  const osc = context.createOscillator();
  osc.type = spec.type;

  const [firstFreq, ...restFreqs] = spec.freqs;
  osc.frequency.setValueAtTime(firstFreq, start);
  restFreqs.forEach((freq, index) => {
    const at = start + (spec.duration * (index + 1)) / restFreqs.length;
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq, 1), at);
  });

  const envelope = context.createGain();
  const attackEnd = start + Math.min(spec.attack, spec.duration);
  envelope.gain.setValueAtTime(SILENCE, start);
  envelope.gain.linearRampToValueAtTime(spec.peak, attackEnd);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end);

  osc.connect(envelope).connect(out);
  osc.start(start);
  osc.stop(end + STOP_PADDING);
}

export function createWebAudioSynth(): SoundEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let unlocked = false;
  let contextFailed = false;
  let enabledFlag = readEnabled();
  let masterValue = DEFAULT_MASTER;

  /**
   * Build the context + master bus exactly once. Any failure (missing or
   * throwing constructor) latches `contextFailed` so we never retry or throw;
   * the engine simply stays silent from then on.
   */
  function ensureContext(): void {
    if (ctx || contextFailed) {
      return;
    }
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      contextFailed = true;
      return;
    }
    try {
      const created = new Ctor();
      const bus = created.createGain();
      bus.gain.value = clamp01(masterValue);
      bus.connect(created.destination);
      ctx = created;
      master = bus;
    } catch {
      ctx = null;
      master = null;
      contextFailed = true;
    }
  }

  return {
    unlock(): void {
      if (unlocked) {
        return; // idempotent: one context, one resume
      }
      unlocked = true;
      ensureContext();
      if (!ctx) {
        return;
      }
      try {
        // resume() reports refusal (autoplay policy / closed context) by
        // REJECTING its promise, not throwing — attach a .catch() so that
        // rejection cannot surface as an unhandled promise rejection. The outer
        // try/catch additionally guards the rare synchronous throw.
        void ctx.resume().catch(() => {
          // A refused resume() must not surface to the caller.
        });
      } catch {
        // ctx.resume() itself threw synchronously (non-spec engines) — ignore.
      }
    },

    setEnabled(next: boolean): void {
      enabledFlag = next;
      persistEnabled(next);
    },

    enabled(): boolean {
      return enabledFlag;
    },

    play(cue: Cue): void {
      // The gate: audible only once unlocked, enabled, and actually backed by a context.
      if (!unlocked || !enabledFlag || !ctx || !master) {
        return;
      }
      try {
        for (const spec of CUE_VOICES[cue]) {
          renderVoice(ctx, master, spec);
        }
      } catch {
        // WebAudio can throw on exotic devices; a failed cue must never surface.
      }
    },

    setMaster(value: number): void {
      masterValue = clamp01(value);
      if (master) {
        master.gain.value = masterValue;
      }
    },
  };
}
