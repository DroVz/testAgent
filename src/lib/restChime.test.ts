import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playRestChime, resetRestChimeForTests, unlockRestChime } from './restChime';

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'suspended';
  currentTime = 1;
  sampleRate = 44100;
  destination = {};
  oscillators: { frequency: { setValueAtTime: ReturnType<typeof vi.fn> }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; type: string }[] = [];
  gains: { gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn> }[] = [];
  bufferSources: { start: ReturnType<typeof vi.fn> }[] = [];
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createBuffer = vi.fn(() => ({}));
  createBufferSource = vi.fn(() => {
    const s = { buffer: null, connect: vi.fn(), start: vi.fn() };
    this.bufferSources.push(s);
    return s;
  });
  createOscillator = vi.fn(() => {
    const o = { type: '', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    this.oscillators.push(o);
    return o;
  });
  createGain = vi.fn(() => {
    const g = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    this.gains.push(g);
    return g;
  });
}

describe('bip de fin de repos (Web Audio)', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    resetRestChimeForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetRestChimeForTests();
  });

  it('sans geste préalable (contexte non débloqué) : aucun son', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    playRestChime();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('débloqué au geste : contexte créé une seule fois, réveillé, tampon muet joué', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    unlockRestChime();
    unlockRestChime();
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.bufferSources[0].start).toHaveBeenCalled();
  });

  it('bip court (~200 ms), volume modéré, sans fichier audio', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    unlockRestChime();
    playRestChime();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.oscillators).toHaveLength(1);
    const osc = ctx.oscillators[0];
    expect(osc.start).toHaveBeenCalledWith(1);
    const [stopAt] = osc.stop.mock.calls[0] as unknown as [number];
    expect(stopAt - 1).toBeGreaterThan(0.15);
    expect(stopAt - 1).toBeLessThan(0.3);
    const peaks = (ctx.gains[0].gain.exponentialRampToValueAtTime.mock.calls as unknown as [number, number][]).map(([v]) => v);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(0.3);
  });

  it('Safari ancien (webkitAudioContext) : pris en charge', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    unlockRestChime();
    playRestChime();
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(1);
  });

  it('sans Web Audio, ou si la création échoue : rien, aucune erreur', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(() => {
      unlockRestChime();
      playRestChime();
    }).not.toThrow();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('NotAllowedError');
        }
      },
    );
    expect(() => {
      unlockRestChime();
      playRestChime();
    }).not.toThrow();
  });

  it('Safari : le son se mêle à la musique (audioSession « ambient »)', () => {
    const audioSession = { type: 'auto' };
    vi.stubGlobal('navigator', { ...navigator, audioSession });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    unlockRestChime();
    expect(audioSession.type).toBe('ambient');
  });
});
