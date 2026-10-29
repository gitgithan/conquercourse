import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type AudioLike, isMuted, playedSounds, setAudioFactory, setMuted, sfx, soundsFor } from '../src/ui/audio';

// A fake AudioContext that counts what it was asked to play.
function fake() {
  const made = { oscillators: 0, noises: 0 };
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const ctx: AudioLike = {
    currentTime: 0, destination: {}, sampleRate: 8000,
    createOscillator: () => { made.oscillators++; return { type: 'sine', frequency: param, connect() {}, start() {}, stop() {} }; },
    createGain: () => ({ gain: param, connect() {} }),
    createBufferSource: () => { made.noises++; return { buffer: null, connect() {}, start() {} }; },
    createBuffer: (_c, n) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { ctx, made };
}

describe('event sounds', () => {
  let made: ReturnType<typeof fake>['made'];
  beforeEach(() => { const f = fake(); made = f.made; setAudioFactory(() => f.ctx); });
  afterEach(() => setAudioFactory(null));

  const ev = (type: string, detail?: Record<string, unknown>) => [{ type, detail }];

  it('each game event plays its own sound exactly once', () => {
    const cases: [string, string, Record<string, unknown>?][] = [
      ['jump', 'jump'], ['land', 'land', { impact: 4 }], ['vault', 'vault'], ['hang-catch', 'grab'], ['hang-release', 'letgo'], ['splash', 'splash'], ['cleared', 'finish'],
    ];
    for (const [type, sound, detail] of cases) {
      const before = playedSounds().length;
      soundsFor(ev(type, detail));
      expect(playedSounds().slice(before), type).toEqual([sound]);
    }
  });
  it('a soft touch-down is silent, and events with no sound stay quiet', () => {
    soundsFor(ev('land', { impact: 0.3 }));
    soundsFor(ev('wall-slide'));
    soundsFor(ev('stumble'));
    expect(playedSounds()).toEqual([]);
  });
  it('the same step is not played twice when asked once', () => {
    soundsFor([...ev('jump'), ...ev('vault')]);
    expect(playedSounds()).toEqual(['jump', 'vault']);
  });
  it('a sound makes tones (and noise for the splash and the landing)', () => {
    sfx('jump'); expect(made.oscillators).toBe(1); expect(made.noises).toBe(0);
    sfx('splash'); expect(made.noises).toBe(1);
  });
  it('the cannon fires a blast, not a clang', () => {
    soundsFor(ev('recoil'));
    expect(playedSounds()).toEqual(['blast']);
    expect(made.oscillators).toBe(1); expect(made.noises).toBe(1);
  });
  it('mute stops every sound', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    soundsFor(ev('jump'));
    expect(playedSounds()).toEqual([]);
    setMuted(false);
    soundsFor(ev('jump'));
    expect(playedSounds()).toEqual(['jump']);
  });
});
