import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { faceForward, FACING_MIN, fitToSkeleton, GOOD_K, MAX_K, measureFacing, MIN_K } from '../src/characters/fit';
import { readSkin } from '../src/characters/glb-skin';
import { castUrl, isCast, loadCast } from '../src/characters/cast';
import { fetchCharacterUrl } from '../src/characters/runner';
import { glbProblems } from '../src/characters/limits';
import { DEFAULT_HANG } from '../src/sim/holds';

const DIR = 'public/assets/characters/cast';
const cast = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')).items as { id: string; name: string; file: string; bytes: number }[];
const skin = (file: string) => readSkin(new Uint8Array(readFileSync(`${DIR}/${file}`)))!;
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** How far the skin's fingertip sits along the arm from the shoulder bone (the farthest 0.5 percent trimmed), the bones' arm length, and the wrist's distance. */
function skinReach(s: ReturnType<typeof skin>, side: 'Left' | 'Right') {
  const ix = (n: string) => s.names.indexOf(side + n);
  const sh = s.rest[ix('Arm')];
  const tip = [s.rest[ix('HandThumbEnd')], s.rest[ix('HandMiddleEnd')]].sort((a, b) => Math.hypot(...sub(b, sh)) - Math.hypot(...sub(a, sh)))[0];
  const L = Math.hypot(...sub(tip, sh)), u = sub(tip, sh).map((c) => c / L);
  const arm = new Set(['Arm', 'ForeArm', 'Hand', 'HandThumbEnd', 'HandMiddleEnd', 'Grip'].map(ix));
  const ts: number[] = [];
  for (let v = 0; v < s.positions.length / 3; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (arm.has(s.joints[v * 4 + k])) w += s.weights[v * 4 + k];
    if (w > 0.5) ts.push((s.positions[v * 3] - sh[0]) * u[0] + (s.positions[v * 3 + 1] - sh[1]) * u[1] + (s.positions[v * 3 + 2] - sh[2]) * u[2]);
  }
  ts.sort((a, b) => a - b);
  return { skin: ts[Math.floor(0.995 * ts.length)], bone: L, wrist: Math.hypot(...sub(s.rest[ix('Hand')], sh)) };
}

describe('the starter cast files', () => {
  it('there are eight, each inside the size caps and under the 300 KB shipping line', () => {
    expect(cast).toHaveLength(8);
    for (const c of cast) {
      const b = new Uint8Array(readFileSync(`${DIR}/${c.file}`));
      expect(glbProblems(b), c.name).toEqual([]);
      expect(b.length, c.name).toBeLessThan(300_000);
      expect(c.file).toBe(`${c.id}.glb`);
    }
    expect(readdirSync(DIR).filter((f) => f.endsWith('.glb'))).toHaveLength(8);
  });
});

describe('the fit puts the fingertip on the fingertip bone', () => {
  it.each(cast.map((c) => [c.name, c.file]))('%s', (_n, file) => {
    for (const side of ['Left', 'Right'] as const) {
      const before = skinReach(skin(file), side);
      const s = skin(file);
      const r = fitToSkeleton(s);
      const after = skinReach(s, side);
      const arm = r.arms[side]!;
      // within 4 cm or 5 percent of the arm wherever the clamp allowed it; where it did not, closer than before and the report says so
      if (!arm.clamped) expect(Math.abs(after.skin - after.bone), `${side} fingertip`).toBeLessThan(Math.max(0.04, 0.05 * after.bone));
      else { expect(after.skin).toBeGreaterThan(before.skin); expect(r.quality).toBe('extreme'); }
      if (!arm.clamped) expect(after.skin, 'the skin hand reaches past the wrist bone, where a bar is held').toBeGreaterThan(after.wrist - 0.04 * after.bone);
      expect(arm.used).toBeGreaterThanOrEqual(MIN_K);
      expect(arm.used).toBeLessThanOrEqual(MAX_K);
    }
  });

  it('shows the problem was real: most of the cast started with arms 20 to 50 percent short', () => {
    const rows = cast.map((c) => { const r = fitToSkeleton(skin(c.file)); return { name: c.name, quality: r.quality, before: r.handGap.before, after: r.handGap.after }; });
    for (const r of rows) expect(r.after, r.name).toBeLessThanOrEqual(r.before + 1e-9);
    expect(rows.filter((r) => r.before > 0.2).length).toBeGreaterThanOrEqual(6);
    expect(rows.filter((r) => r.quality === 'good' || r.quality === 'stretched').length).toBeGreaterThanOrEqual(5);
  });

  it('is stable: fitting a fitted skin again changes almost nothing', () => {
    const s = skin(cast[0].file);
    fitToSkeleton(s);
    const once = Float32Array.from(s.positions);
    const r2 = fitToSkeleton(s);
    let worst = 0;
    for (let i = 0; i < once.length; i++) worst = Math.max(worst, Math.abs(once[i] - s.positions[i]));
    expect(worst).toBeLessThan(0.02);
    expect(r2.arms.Left!.used).toBeGreaterThan(0.97);
    expect(r2.arms.Left!.used).toBeLessThan(1.03);
  });

  it('holds the total height and clamps an extreme skin instead of exploding it', () => {
    const s = skin(cast.find((c) => c.name === 'Potato Blob')!.file);
    const top = (p: Float32Array) => { let m = -1e9; for (let i = 1; i < p.length; i += 3) m = Math.max(m, p[i]); return m; };
    const t0 = top(s.positions), r = fitToSkeleton(s);
    expect(Math.abs(top(s.positions) - t0)).toBeLessThan(0.02);
    expect(r.quality).toBe('extreme');
    expect(r.arms.Left!.wanted).toBeGreaterThan(MAX_K);
    expect(r.arms.Left!.used).toBe(MAX_K);
    expect(GOOD_K[0]).toBeLessThan(1);
  });
});

// CC-108 facing: the bones always face +z (the foot bones point ankle to toe); the made skins came out with an arbitrary front.
const BACK = ['Skater', 'Banana', 'Potato Blob'], UNCLEAR = ['Jelly'];
const fileOf = (name: string) => cast.find((c) => c.name === name)!.file;
/** A skin as a maker could have produced it facing back: turned 180 degrees about the hips' vertical axis, left and right bone weights swapped. */
function turnedAround(file: string) {
  const s = skin(file), i = (n: string) => s.names.indexOf(n);
  const hx = (s.rest[i('LeftLeg')][0] + s.rest[i('RightLeg')][0]) / 2, hz = (s.rest[i('LeftLeg')][2] + s.rest[i('RightLeg')][2]) / 2;
  const other = s.names.map((n) => { const o = n.startsWith('Left') ? 'Right' + n.slice(4) : n.startsWith('Right') ? 'Left' + n.slice(5) : n; return s.names.indexOf(o); });
  for (let v = 0; v < s.positions.length / 3; v++) { s.positions[v * 3] = 2 * hx - s.positions[v * 3]; s.positions[v * 3 + 2] = 2 * hz - s.positions[v * 3 + 2]; }
  const j = Float64Array.from(s.joints as ArrayLike<number>);
  for (let k = 0; k < j.length; k++) j[k] = other[j[k]];
  s.joints = j;
  return s;
}

describe('the skin faces the way the bones face (CC-108 facing)', () => {
  it('the bones of all eight face +z: ankle to toe is the same forward, so only the skin can face wrong', () => {
    for (const c of cast) {
      const s = skin(c.file), i = (n: string) => s.names.indexOf(n);
      for (const side of ['Left', 'Right']) {
        const a = s.rest[i(side + 'Foot')], b = s.rest[i(side + 'ToeBase')];
        const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
        expect((b[2] - a[2]) / d, `${c.name} ${side}`).toBeGreaterThan(0.999);
      }
    }
  });

  it('measures the made skins: Skater, Banana and Potato Blob face back, the other five do not', () => {
    for (const c of cast) {
      const s = skin(c.file), m = measureFacing(s.positions, s.names, s.rest);
      if (BACK.includes(c.name)) { expect(m.verdict, c.name).toBe('back'); expect(m.score, c.name).toBeLessThanOrEqual(-FACING_MIN); }
      else if (UNCLEAR.includes(c.name)) expect(m.verdict, c.name).toBe('unclear'); // a jellyfish has no front shoe: left alone
      else { expect(m.verdict, c.name).toBe('forward'); expect(m.score, c.name).toBeGreaterThanOrEqual(FACING_MIN); }
    }
  });

  it('after the fit none faces back, exactly the three are turned, and the report says so', () => {
    for (const c of cast) {
      const s = skin(c.file), r = fitToSkeleton(s), m = measureFacing(s.positions, s.names, s.rest);
      expect(r.facing.turned, c.name).toBe(BACK.includes(c.name));
      expect(m.score, c.name).toBeGreaterThan(-FACING_MIN);
      expect(m.verdict, c.name).not.toBe('back'); // the fit's height remap changes the shoe slab, so a thin score can slip into unclear here
      expect(r.notes.some((n) => n.startsWith('turned around')), c.name).toBe(BACK.includes(c.name));
    }
  });

  it('turning alone makes a back-facing skin read forward, with the same score the other way round', () => {
    for (const name of BACK) {
      const s = skin(fileOf(name)), before = measureFacing(s.positions, s.names, s.rest).score;
      faceForward(s);
      const after = measureFacing(s.positions, s.names, s.rest);
      expect(after.verdict, name).toBe('forward');
      expect(after.score, name).toBeCloseTo(-before, 1);
    }
  });

  it('a skin built facing back is turned to exactly the skin that faced forward, left stays left', () => {
    for (const name of ['Fox', 'Cactus', 'Toy Robot']) {
      const good = skin(fileOf(name)), back = turnedAround(fileOf(name));
      expect(measureFacing(back.positions, back.names, back.rest).verdict, name).toBe('back');
      const f = faceForward(back);
      expect(f.turned, name).toBe(true);
      let worst = 0;
      for (let i = 0; i < good.positions.length; i++) worst = Math.max(worst, Math.abs(good.positions[i] - back.positions[i]));
      expect(worst, name).toBeLessThan(1e-4);
      for (let k = 0; k < good.joints.length; k++) expect(back.joints[k]).toBe(good.joints[k]);
    }
  });

  it('a skin that faces forward is not touched', () => {
    for (const name of ['Fox', 'Cactus', 'Toy Robot', 'Robo Cat']) {
      const s = skin(fileOf(name)), p0 = Float32Array.from(s.positions), j0 = Float64Array.from(s.joints as ArrayLike<number>);
      const f = faceForward(s);
      expect(f.turned, name).toBe(false);
      expect(Array.from(s.positions), name).toEqual(Array.from(p0));
      expect(Array.from(s.joints as ArrayLike<number>), name).toEqual(Array.from(j0));
    }
  });

  it('the turned skins keep their left arm on the left bones (x > 0) and their feet on the ground', () => {
    for (const name of BACK) {
      const s = skin(fileOf(name)), i = (n: string) => s.names.indexOf(n);
      fitToSkeleton(s);
      const L = new Set(['LeftArm', 'LeftForeArm', 'LeftHand'].map(i));
      let sx = 0, w = 0, yMin = 1e9;
      for (let v = 0; v < s.positions.length / 3; v++) {
        yMin = Math.min(yMin, s.positions[v * 3 + 1]);
        for (let k = 0; k < 4; k++) if (L.has(s.joints[v * 4 + k])) { sx += s.weights[v * 4 + k] * s.positions[v * 3]; w += s.weights[v * 4 + k]; }
      }
      expect(sx / w, name).toBeGreaterThan(0.2);
      expect(Math.abs(yMin), name).toBeLessThan(0.02);
    }
  });
});

describe('the physics does not look at the skin', () => {
  it('src/sim and src/course import nothing from the renderer or the characters', () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.ts') ? [`${d}/${e.name}`] : []));
    for (const f of [...walk('src/sim'), ...walk('src/course')]) {
      const imports = [...readFileSync(f, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      expect(imports.filter((i) => /render|characters|gltf/i.test(i) || (f.startsWith('src/sim') && /three/i.test(i))), f).toEqual([]);
    }
  });
  it('a bar is grabbed by one fixed reach and hand height, the same for every character', () => {
    expect(DEFAULT_HANG.reach).toBe(0.15);
    expect(DEFAULT_HANG.handHeight).toBe(2.1);
  });
});

describe('the picker and the loader take the cast', () => {
  it('turns the list into cards and loads a cast character without the server', async () => {
    const list = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
    const cards = await loadCast((async () => new Response(JSON.stringify(list))) as unknown as typeof fetch);
    expect(cards).toHaveLength(8);
    expect(cards.every((c) => /^[0-9a-f]{16}$/.test(c.id) && c.thumb.endsWith('.webp'))).toBe(true);
    expect(isCast(cards[0].id, cards)).toBe(true);
    const offline = (async () => { throw new Error('no server'); }) as unknown as typeof fetch;
    expect(await fetchCharacterUrl(cards[0].id, offline, cards)).toEqual({ url: castUrl(cards[0].id) });
  });
  it('no list means no cards, and no crash', async () => {
    expect(await loadCast((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toEqual([]);
  });
});
