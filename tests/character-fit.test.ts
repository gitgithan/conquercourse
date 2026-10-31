import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fitToSkeleton, GOOD_K, MAX_K, MIN_K } from '../src/characters/fit';
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
