// CC-108 facing, the voting version: several cues vote, a confidence decides, an unsure skin is left as it is (docs/character-facing-bug.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_MIN, faceForward, fitToSkeleton, measureFacing, type FacingReport, type Vec3 } from '../src/characters/fit';
import { readSkin } from '../src/characters/glb-skin';

// ---- a synthetic skin: the Rookie's bones (T-pose, forward +z) and a cloud of points shaped by the cues we want to switch on
const NAMES = ['Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase', 'LeftArm', 'LeftHand', 'RightArm', 'RightHand'];
const REST: Vec3[] = [[0, 1, 0], [0.1, 0.95, 0], [-0.1, 0.95, 0], [0.1, 0.09, -0.02], [0.1, 0.04, 0.12], [-0.1, 0.09, -0.02], [-0.1, 0.04, 0.12], [0.15, 1.34, 0], [0.81, 1.37, 0], [-0.15, 1.34, 0], [-0.81, 1.37, 0]];
const H = 1.8;
interface Look { toe?: number; heel?: number; top?: number[]; belly?: number; back?: number; thumb?: number; feet?: boolean; tinyShoes?: boolean }
/** toe/heel: how far the shoe reaches in front of / behind the shin (m); top: shoe height [front, back] (m); belly/back: torso reach (m); thumb: how far the hands stick out in front (m) */
function skin(o: Look = {}): Float32Array {
  const pts: number[] = [];
  const add = (x: number, y: number, z: number) => pts.push(x, y, z);
  const ring = (cx: number, y: number, r: number, k = 12) => { for (let i = 0; i < k; i++) { const a = (i / k) * 2 * Math.PI; add(cx + r * Math.cos(a), y, r * Math.sin(a)); } };
  for (const side of [1, -1]) {
    for (let y = 0.3; y <= 0.55; y += 0.05) ring(side * 0.1, y, 0.05); // the shin column, centred on z = 0
    if (o.feet !== false) {
      const toe = o.toe ?? 0.12, heel = o.heel ?? 0.12, [hf, hb] = o.top ?? [0.1, 0.1], n = o.tinyShoes ? 1 : 6;
      for (let i = 0; i <= n; i++) for (const dx of [-0.05, 0.05]) {
        const z = -heel + ((toe + heel) * i) / n;
        add(side * 0.1 + dx, 0.01, z);
        add(side * 0.1 + dx, (z > 0 ? hf : hb) * 0.9, z); add(side * 0.1 + dx, (z > 0 ? hf : hb), z);
      }
    }
  }
  for (let y = 0.95; y <= 1.35; y += 0.05) { // the torso: the belly at z = +belly, the back at z = -back
    for (const x of [-0.1, 0, 0.1]) { add(x, y, o.belly ?? 0.1); add(x, y, -(o.back ?? 0.1)); add(x, y, 0); }
  }
  for (const side of [1, -1]) for (let i = 0; i < 8; i++) { // the hands: out beyond the wrist, the thumb side to the front
    const x = side * (0.78 + 0.02 * i); add(x, 1.37, o.thumb ?? 0.05); add(x, 1.37, -(o.thumb ?? 0.05)); add(x, 1.34, 0); add(x, 1.4, 0);
  }
  if (o.feet === false) add(0.1, 0, 0); // a stump on the floor: the lowest point of a skin with no feet
  for (let i = 0; i < 6; i++) add(0, H - 0.01 * i, 0); // the head top, so the height is H
  return Float32Array.from(pts);
}
const nameOf = (r: FacingReport, cue: string) => r.votes.find((v) => v.name === cue)!;
const measure = (o: Look = {}, names = NAMES, rest = REST) => measureFacing(skin(o), names, rest);

describe('each cue alone', () => {
  it('shoe reach: a long toe in front votes forward, a long toe behind votes back', () => {
    expect(nameOf(measure({ toe: 0.25, heel: 0.05 }), 'shoe reach').lean).toBeGreaterThan(0.5);
    expect(nameOf(measure({ toe: 0.05, heel: 0.25 }), 'shoe reach').lean).toBeLessThan(-0.5);
  });
  it('shoe middle: the shoe body sitting in front of the shin votes forward, behind it votes back', () => {
    expect(nameOf(measure({ toe: 0.3, heel: 0.06 }), 'shoe middle').lean).toBeGreaterThan(0.3);
    expect(nameOf(measure({ toe: 0.06, heel: 0.3 }), 'shoe middle').lean).toBeLessThan(-0.3);
  });
  it('shoe top: a low toe cap with a high heel collar votes forward, the other way votes back', () => {
    expect(nameOf(measure({ top: [0.05, 0.2] }), 'shoe top').lean).toBeGreaterThan(0.5);
    expect(nameOf(measure({ top: [0.2, 0.05] }), 'shoe top').lean).toBeLessThan(-0.5);
  });
  it('torso: the belly out in front votes forward, the back out behind votes back', () => {
    expect(nameOf(measure({ belly: 0.2, back: 0.06 }), 'torso').lean).toBeGreaterThan(0.3);
    expect(nameOf(measure({ belly: 0.06, back: 0.2 }), 'torso').lean).toBeLessThan(-0.3);
  });
  it('hands: the thumb side out in front votes forward', () => {
    const r = measure({ thumb: 0.08 });
    expect(nameOf(r, 'hands').available).toBe(true);
  });
  it('a symmetric skin gets no vote from anyone and is unclear', () => {
    const r = measure();
    expect(r.votes.every((v) => v.lean === 0)).toBe(true);
    expect(r.verdict).toBe('unclear');
    expect(r.confidence).toBeLessThan(CONFIDENCE_MIN);
  });
});

describe('the votes are combined with a confidence', () => {
  it('agreeing cues are confident, in both directions', () => {
    const f = measure({ toe: 0.25, heel: 0.05, top: [0.05, 0.2], belly: 0.2, back: 0.06 }), b = measure({ toe: 0.05, heel: 0.25, top: [0.2, 0.05], belly: 0.06, back: 0.2 });
    expect(f.verdict).toBe('forward'); expect(f.confidence).toBeGreaterThan(0.5);
    expect(b.verdict).toBe('back'); expect(b.confidence).toBeGreaterThan(0.5);
    expect(f.score).toBeCloseTo(-b.score, 1);
  });
  it('conflicting cues cancel to unclear: a high toe cap says back, a big belly says forward, and neither is strong enough alone to win', () => {
    const r = measure({ top: [0.22, 0.04], belly: 0.25, back: 0.05 });
    expect(nameOf(r, 'shoe top').lean).toBeLessThan(-0.5);
    expect(nameOf(r, 'torso').lean).toBeGreaterThan(0.5);
    expect(r.verdict).toBe('unclear');
    expect(r.confidence).toBeLessThan(CONFIDENCE_MIN);
  });
  it('a disagreeing cue lowers the confidence of an otherwise clear skin', () => {
    const clear = measure({ toe: 0.3, heel: 0.05, top: [0.05, 0.2] }), mixed = measure({ toe: 0.3, heel: 0.05, top: [0.2, 0.05] });
    expect(clear.verdict).toBe('forward');
    expect(mixed.confidence).toBeLessThan(clear.confidence);
  });
  it('one cue alone, strongly, is enough; a faint one is not', () => {
    expect(measure({ toe: 0.04, heel: 0.3 }).verdict).toBe('back');
    expect(measure({ toe: 0.13, heel: 0.12 }).verdict).toBe('unclear');
  });
  it('reports a vote per cue with its own score, lean and weight', () => {
    const r = measure({ toe: 0.25, heel: 0.05 });
    expect(r.votes.map((v) => v.name)).toEqual(['shoe reach', 'shoe middle', 'shoe top', 'torso', 'hands']);
    for (const v of r.votes) { expect(v.weight).toBeGreaterThan(0); expect(Math.abs(v.lean)).toBeLessThanOrEqual(1); }
  });
});

describe('hard characters are left alone, with a plain note', () => {
  it('no feet at all: the shoe cues cannot look, and a skin with nothing else to say stays as made', () => {
    const r = measure({ feet: false, belly: 0.1, back: 0.1 });
    for (const c of ['shoe reach', 'shoe middle', 'shoe top']) expect(nameOf(r, c).available, c).toBe(false);
    expect(r.verdict).toBe('unclear');
  });
  it('no foot bones: the bones\' forward falls back to +z and nothing crashes', () => {
    const names = NAMES.filter((n) => !/Foot|ToeBase/.test(n)), rest = NAMES.map((n, i) => (/Foot|ToeBase/.test(n) ? null : REST[i])).filter((r): r is Vec3 => !!r);
    const r = measure({}, names, rest);
    expect(r.axis).toEqual([0, 1]);
    expect(r.verdict).toBe('unclear');
  });
  it('tiny shoes (too few points to measure) abstain instead of guessing', () => {
    const r = measure({ tinyShoes: true, toe: 0.2, heel: 0.05 });
    expect(r.votes.filter((v) => v.available && /shoe/.test(v.name)).every((v) => v.lean === 0 || Math.abs(v.score) < 2)).toBe(true);
    expect(Number.isFinite(r.score)).toBe(true);
  });
  it('an empty skin does not crash', () => {
    const r = measureFacing(new Float32Array(0), NAMES, REST);
    expect(r.verdict).toBe('unclear'); expect(r.votes.every((v) => !v.available)).toBe(true);
  });
  it('an unclear skin is not turned, and the fit report says "facing unclear"', () => {
    const s = readSkin(new Uint8Array(readFileSync('public/assets/characters/cast/03bceda6975ee7c7.glb')))!; // Jelly
    const p0 = Float32Array.from(s.positions);
    const r = fitToSkeleton(s);
    expect(r.facing.verdict).toBe('unclear'); expect(r.facing.turned).toBe(false);
    expect(r.notes.some((n) => n.startsWith('facing unclear'))).toBe(true);
    expect(s.positions[0]).not.toBeNaN(); expect(p0.length).toBe(s.positions.length);
  });
});

describe('the per-character override table (FACING_OVERRIDE)', () => {
  const load = (id: string) => readSkin(new Uint8Array(readFileSync(`public/assets/characters/cast/${id}.glb`)))!;
  it('turns an unclear skin when the table says back, and leaves a skin the cues would turn when it says forward', () => {
    const jelly = load('03bceda6975ee7c7');
    const f = faceForward(jelly, { id: 'aaaaaaaaaaaaaaaa', overrides: { aaaaaaaaaaaaaaaa: 'back' } });
    expect(f.turned).toBe(true); expect(f.overridden).toBe(true);
    const banana = load('7c95df17d131f152'), p0 = Float32Array.from(banana.positions);
    const g = faceForward(banana, { id: 'bbbbbbbbbbbbbbbb', overrides: { bbbbbbbbbbbbbbbb: 'forward' } });
    expect(g.turned).toBe(false); expect(g.overridden).toBe(true);
    expect(Array.from(banana.positions)).toEqual(Array.from(p0));
  });
  it('does nothing for an id that is not in the table', () => {
    const f = faceForward(load('03bceda6975ee7c7'), { id: 'cccccccccccccccc', overrides: {} });
    expect(f.turned).toBe(false); expect(f.overridden).toBeUndefined();
  });
});

describe('the eight starter characters (must not regress)', () => {
  const cast = (JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')) as { items: { name: string; file: string }[] }).items;
  it('the same three are turned, five are not, and all seven judged ones are confident', () => {
    const turned: string[] = [], unclear: string[] = [];
    for (const c of cast) {
      const s = readSkin(new Uint8Array(readFileSync(`public/assets/characters/cast/${c.file}`)))!;
      const m = measureFacing(s.positions, s.names, s.rest);
      if (m.verdict === 'back') turned.push(c.name);
      if (m.verdict === 'unclear') unclear.push(c.name); else expect(m.confidence, c.name).toBeGreaterThanOrEqual(CONFIDENCE_MIN);
      expect(m.votes.length, c.name).toBe(5);
    }
    expect(turned.sort()).toEqual(['Banana', 'Potato Blob', 'Skater']);
    expect(unclear).toEqual(['Jelly']);
  });
});
