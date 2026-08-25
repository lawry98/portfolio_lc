import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cue } from './SoundEngine';
import { createWebAudioSynth } from './webAudioSynth';

/**
 * jsdom ships no Web Audio API, so every test here runs against a hand-rolled
 * mock `AudioContext` assigned to `globalThis` (and its `webkitAudioContext`
 * alias). The mock records the calls that matter for the engine's *contract* —
 * was a context constructed, was it resumed, was an oscillator started, what is
 * the master gain — without pretending to render audio. The unit under test is
 * the gate + persistence + node-graph wiring, not the sound itself.
 */

const STORAGE_KEY = 'byte:sound';
const DEFAULT_MASTER = 0.6;

/** Exhaustive by construction: a missing `Cue` fails to compile here. */
const CUE_REGISTRY: Record<Cue, true> = {
  typeTick: true,
  eatA: true,
  eatB: true,
  spawnPop: true,
  themeWhoosh: true,
  wakeBoing: true,
  chirp: true,
};
const ALL_CUES = Object.keys(CUE_REGISTRY) as Cue[];

/** Shared call recorders — reset via `vi.clearAllMocks()` in `beforeEach`. */
const audioSpies = {
  ctor: vi.fn(),
  resume: vi.fn((): Promise<void> => Promise.resolve()),
  createOscillator: vi.fn(),
  createGain: vi.fn(),
  oscStart: vi.fn(),
  oscStop: vi.fn(),
};

/** Every `GainNode` the engine builds, in creation order; `[0]` is the master bus. */
const createdGains: MockGainNode[] = [];

class MockAudioParam {
  value: number;

  constructor(initial = 0) {
    this.value = initial;
  }

  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number): this {
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number): this {
    this.value = value;
    return this;
  }

  cancelScheduledValues(): this {
    return this;
  }
}

class MockOscillatorNode {
  type: OscillatorType = 'sine';
  readonly frequency = new MockAudioParam(440);

  connect(destination: unknown): unknown {
    return destination;
  }

  disconnect(): void {}

  start(when?: number): void {
    audioSpies.oscStart(when);
  }

  stop(when?: number): void {
    audioSpies.oscStop(when);
  }
}

class MockGainNode {
  readonly gain = new MockAudioParam(1);

  connect(destination: unknown): unknown {
    return destination;
  }

  disconnect(): void {}
}

class MockAudioContext {
  currentTime = 0;
  readonly destination = {};

  constructor() {
    audioSpies.ctor();
  }

  resume(): Promise<void> {
    return audioSpies.resume();
  }

  createOscillator(): MockOscillatorNode {
    audioSpies.createOscillator();
    return new MockOscillatorNode();
  }

  createGain(): MockGainNode {
    audioSpies.createGain();
    const node = new MockGainNode();
    createdGains.push(node);
    return node;
  }
}

// `AudioContext` is typed as always-present by the DOM lib, so `delete` needs a
// scope type where it is optional — hence the `as unknown as` cast.
type AudioScope = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

function installMockAudioContext(): void {
  const scope = globalThis as unknown as AudioScope;
  scope.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  scope.webkitAudioContext = MockAudioContext as unknown as typeof AudioContext;
}

function uninstallMockAudioContext(): void {
  const scope = globalThis as unknown as AudioScope;
  delete scope.AudioContext;
  delete scope.webkitAudioContext;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  createdGains.length = 0;
  installMockAudioContext();
});

afterEach(() => {
  uninstallMockAudioContext();
  vi.restoreAllMocks();
});

describe('createWebAudioSynth: the unlock gate', () => {
  it('plays nothing before unlock() — no audio nodes are created', () => {
    const synth = createWebAudioSynth();
    expect(synth.enabled()).toBe(true); // enabled is not what is gating here

    synth.play('typeTick');

    expect(audioSpies.ctor).not.toHaveBeenCalled();
    expect(audioSpies.createOscillator).not.toHaveBeenCalled();
    expect(audioSpies.oscStart).not.toHaveBeenCalled();
  });

  it('unlock() creates exactly one AudioContext, resumes it, and is idempotent', () => {
    const synth = createWebAudioSynth();

    synth.unlock();
    synth.unlock();
    synth.unlock();

    expect(audioSpies.ctor).toHaveBeenCalledTimes(1);
    expect(audioSpies.resume).toHaveBeenCalledTimes(1);
  });

  it('after unlock while enabled, play(cue) starts an oscillator', () => {
    const synth = createWebAudioSynth();
    synth.unlock();

    synth.play('typeTick');

    expect(audioSpies.createOscillator).toHaveBeenCalled();
    expect(audioSpies.oscStart).toHaveBeenCalled();
  });
});

describe('createWebAudioSynth: enabled flag + persistence', () => {
  it('defaults to enabled (sound ON after the gate — decision D-05)', () => {
    const synth = createWebAudioSynth();
    expect(synth.enabled()).toBe(true);
  });

  it('setEnabled(false) silences play(); setEnabled(true) restores it', () => {
    const synth = createWebAudioSynth();
    synth.unlock();

    synth.setEnabled(false);
    expect(synth.enabled()).toBe(false);
    vi.clearAllMocks(); // drop the master-bus setup from unlock()
    synth.play('eatA');
    expect(audioSpies.oscStart).not.toHaveBeenCalled();

    synth.setEnabled(true);
    synth.play('eatA');
    expect(audioSpies.oscStart).toHaveBeenCalled();
  });

  it('persists a mute, and a fresh engine reads the stored preference back', () => {
    const first = createWebAudioSynth();
    first.setEnabled(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0');

    const second = createWebAudioSynth();
    expect(second.enabled()).toBe(false);

    second.setEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    expect(createWebAudioSynth().enabled()).toBe(true);
  });

  it('stays enabled-by-default when localStorage.getItem is blocked', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });

    const synth = createWebAudioSynth();
    expect(synth.enabled()).toBe(true);

    getItemSpy.mockRestore();
  });

  it('does not throw when localStorage.setItem is blocked (persistence is best-effort)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: storage disabled');
    });

    const synth = createWebAudioSynth();
    expect(() => synth.setEnabled(false)).not.toThrow();
    expect(synth.enabled()).toBe(false); // in-memory flag still flips

    setItemSpy.mockRestore();
  });
});

describe('createWebAudioSynth: master gain', () => {
  it('initialises the master bus to the default master level on unlock', () => {
    const synth = createWebAudioSynth();
    synth.unlock();

    expect(createdGains[0].gain.value).toBeCloseTo(DEFAULT_MASTER, 5);
  });

  it('setMaster clamps its argument into [0, 1] and applies it to the master gain', () => {
    const synth = createWebAudioSynth();
    synth.unlock();
    const master = createdGains[0];

    synth.setMaster(5);
    expect(master.gain.value).toBe(1);

    synth.setMaster(-3);
    expect(master.gain.value).toBe(0);

    synth.setMaster(0.42);
    expect(master.gain.value).toBeCloseTo(0.42, 5);
  });

  it('applies a setMaster made before unlock once the context is created', () => {
    const synth = createWebAudioSynth();
    synth.setMaster(0.25); // no AudioContext exists yet
    synth.unlock();

    expect(createdGains[0].gain.value).toBeCloseTo(0.25, 5);
  });
});

describe('createWebAudioSynth: cue coverage + defensive degradation', () => {
  it('plays every cue in the union without throwing, and each starts a node', () => {
    const synth = createWebAudioSynth();
    synth.unlock();

    for (const cue of ALL_CUES) {
      audioSpies.oscStart.mockClear();
      expect(() => synth.play(cue)).not.toThrow();
      expect(audioSpies.oscStart).toHaveBeenCalled();
    }
  });

  it('degrades to a silent no-op engine when AudioContext is unavailable', () => {
    uninstallMockAudioContext(); // neither AudioContext nor webkitAudioContext exists
    const synth = createWebAudioSynth();

    expect(() => synth.unlock()).not.toThrow();
    expect(() => {
      for (const cue of ALL_CUES) {
        synth.play(cue);
      }
    }).not.toThrow();

    expect(audioSpies.ctor).not.toHaveBeenCalled();
    expect(audioSpies.oscStart).not.toHaveBeenCalled();
    expect(synth.enabled()).toBe(true); // the enabled flag still works without audio
  });

  it('falls back to webkitAudioContext when the unprefixed constructor is absent', () => {
    const scope = globalThis as unknown as AudioScope;
    delete scope.AudioContext; // only the webkit-prefixed alias remains
    const synth = createWebAudioSynth();

    synth.unlock();
    synth.play('spawnPop');

    expect(audioSpies.ctor).toHaveBeenCalledTimes(1);
    expect(audioSpies.oscStart).toHaveBeenCalled();
  });
});
