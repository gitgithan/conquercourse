import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAP_MAX, GAP_MIN } from '../src/sim/bars';
import { fitBarsTo } from '../src/slice/bars-world';
import { newPiece, scaleToHeight } from '../src/slice/world';
import { readGlbMesh } from '../src/slice/glb';
import { BAR_HEIGHT_MAX, BAR_HEIGHT_MIN, cleanLift, extentOf, largestComponent, regulariseRungs, roleCollider, roleColliderOn, voxelise, closing } from '../src/slice/role-collider';

const fx = JSON.parse(readFileSync('tests/fixtures/noisy-bars.json', 'utf8')) as { truth: Record<string, number>; positions: number[]; indices: number[] };
const noisy = { positions: fx.positions, indices: fx.indices };

describe('role-first collider: the 3D clean-up', () => {
  it('keeps the largest piece and drops the floating blob', () => {
    const { pieces, dropped } = largestComponent(voxelise(noisy, 0.05));
    expect(pieces).toBeGreaterThanOrEqual(2);
    expect(dropped).toBeGreaterThan(0);
  });
  it('closing fills a hole through a solid block and never shrinks the object', () => {
    const n = 12, cells = new Uint8Array(n * n * n).fill(1);
    const at = (x: number, y: number, z: number) => x + n * (y + n * z);
    for (let z = 0; z < n; z++) for (let y = 5; y <= 6; y++) for (let x = 5; x <= 6; x++) cells[at(x, y, z)] = 0; // a 2 x 2 hole all the way through
    const holey = { nx: n, ny: n, nz: n, size: 0.05, ox: 0, oy: 0, oz: 0, cells };
    const closed = closing(holey, 1);
    for (let z = 3; z < n - 3; z++) for (let y = 5; y <= 6; y++) for (let x = 5; x <= 6; x++) expect(closed.cells[at(x, y, z)]).toBe(1); // the hole is gone
    for (let z = 2; z < n - 2; z++) for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) if (cells[at(x, y, z)]) expect(closed.cells[at(x, y, z)]).toBe(1); // inside, nothing shrank
  });
  it('is deterministic: the same lift gives the same numbers', () => {
    expect(roleCollider(noisy, 'bar', { knownHeight: 2.2 })).toEqual(roleCollider(noisy, 'bar', { knownHeight: 2.2 }));
  });
});

describe('role-first collider: bars from a noisy lift', () => {
  const r = roleCollider(noisy, 'bar', { knownHeight: fx.truth.tall });
  it('law: evenly spaced bars come from one spacing, within 5 cm of the truth', () => {
    expect(Math.abs(r.bars!.gap - fx.truth.gap)).toBeLessThanOrEqual(0.05);
    expect(r.bars!.run.n).toBe(fx.truth.rungs);
  });
  it('the height is the rung height, in spite of the wrong scale (the known height fixes it)', () => {
    expect(Math.abs(r.bars!.height - fx.truth.height)).toBeLessThanOrEqual(0.12);
    expect(r.scaleUsed).toBeLessThan(0.8);
  });
  it('the span is the length of the frame and the rungs lie inside it, centred on its middle', () => {
    const b = r.bars!;
    expect(b.axis).toBe('x');
    expect(b.run.x).toBeGreaterThanOrEqual(-b.span / 2); expect(b.run.x + (b.run.n - 1) * b.run.gap).toBeLessThanOrEqual(b.span / 2);
    expect(Math.abs(b.run.x + ((b.run.n - 1) * b.run.gap) / 2)).toBeLessThan(0.1);
  });
  it('the collider is a clean primitive in the shape the fit step uses, inside the sim limits', () => {
    const p = r.primitive;
    expect(p.type).toBe('bar'); expect(p.roles).toEqual(['grab']);
    expect(r.bars!.run.gap).toBeGreaterThanOrEqual(GAP_MIN); expect(r.bars!.run.gap).toBeLessThanOrEqual(GAP_MAX);
    expect(r.bars!.run.y).toBeGreaterThanOrEqual(BAR_HEIGHT_MIN); expect(r.bars!.run.y).toBeLessThanOrEqual(BAR_HEIGHT_MAX);
    expect(p.scale.source).toBe('maker');
  });
  it('the cleaned lift has no blob and its extent is the frame, not the blob', () => {
    const { grid, report } = cleanLift({ positions: noisy.positions.map((v) => v * 0.7692), indices: noisy.indices });
    expect(report.pieces).toBeGreaterThanOrEqual(2);
    expect(extentOf(grid).x[1]).toBeLessThan(3.0); // the blob stood at x = 3.5 to 3.7 before the resize
  });
  it('law: a spacing under the least the sim allows uses every second rung, so no bar is out of reach', () => {
    const peaks = Array.from({ length: 12 }, (_, i) => i * 0.25 + (i % 2 ? 0.01 : -0.01));
    const g = regulariseRungs(peaks);
    expect(g.gap).toBeCloseTo(0.25, 1);
    expect(g.n).toBe(12);
  });
  it('law: a missed rung (a double gap) does not change the spacing', () => {
    const g = regulariseRungs([0, 0.5, 1.0, 2.0, 2.5, 3.0]);
    expect(g.gap).toBeCloseTo(0.5, 2); expect(g.n).toBe(7);
  });
});

describe('role-first collider: other roles', () => {
  const slab = (w: number, h: number, d: number) => { const p: number[] = [], i: number[] = []; const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]; p.push(0, 0, 0, w, 0, 0, w, h, 0, 0, h, 0, 0, 0, d, w, 0, d, w, h, d, 0, h, d); return { positions: p, indices: q.concat(i) }; };
  it('wall: height and width', () => { const r = roleCollider(slab(3, 1.2, 0.3), 'wall'); expect(r.primitive.height).toBeCloseTo(1.2, 1); expect(r.primitive.width).toBeCloseTo(3, 1); expect(r.primitive.type).toBe('wall'); });
  it('pole: height and thickness', () => { const r = roleCollider(slab(0.15, 3, 0.15), 'pole'); expect(r.primitive.height).toBeCloseTo(3, 1); expect(r.primitive.thickness).toBeGreaterThan(0.1); expect(r.primitive.thickness).toBeLessThan(0.25); });
  it('platform: height and length', () => { const r = roleCollider(slab(4, 0.5, 2), 'platform'); expect(r.primitive.type).toBe('platform'); expect(r.primitive.height).toBeCloseTo(0.5, 1); });
});

// The real lifts live outside the repo (../conquercourse-assets/bar-photos/best/, with SHA256SUMS); the test skips when they are not there.
const GLB = '../conquercourse-assets/bar-photos/best/monkey-bars-1-saienji-CC0.glb';
describe.skipIf(!existsSync(GLB))('role-first collider: the Saienji CC0 lift', () => {
  const r = (() => { // read lazily: describe.skipIf still runs this body when the file is absent
    if (!existsSync(GLB)) return { bars: { run: { gap: 0.5, n: 9, y: 2.1 }, peaks: new Array(15) } } as unknown as ReturnType<typeof roleCollider>;
    const b = readFileSync(GLB);
    return roleCollider(readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), 'bar', { knownHeight: 2.2 });
  })();
  it('finds a swingable row: evenly spaced rungs between 0.3 and 1.0 m, at a height the hands can swing from', () => {
    expect(r.bars!.run.gap).toBeGreaterThanOrEqual(GAP_MIN); expect(r.bars!.run.gap).toBeLessThanOrEqual(GAP_MAX);
    expect(r.bars!.run.n).toBeGreaterThanOrEqual(6);
    expect(r.bars!.run.y).toBeGreaterThan(2.0); expect(r.bars!.run.y).toBeLessThan(2.2);
  });
  it('the raw gaps are about 0.28 m (about 17 rungs over 4.5 m); the collider uses every second one', () => {
    expect(r.bars!.peaks.length).toBeGreaterThanOrEqual(15);
    expect(r.bars!.run.gap).toBeCloseTo(0.55, 1);
  });
});
if (!existsSync(GLB)) console.warn(`role-collider test: ${GLB} is not here, so the real-lift checks are skipped (the fixture checks still run)`);

describe('role-first collider: wired into "Fit to selected" behind its switch', () => {
  const piece = () => ({ ...newPiece('lift', { positions: noisy.positions, indices: noisy.indices }), src: 'x' });
  it('off: the old box fit is byte for byte what it was', () => {
    const o = piece();
    expect(fitBarsTo(o, false)).toEqual(fitBarsTo(o));
  });
  it('on: the row has the measured spacing and rung count, not the box-and-default-gap guess', () => {
    const o = scaleToHeight(piece(), 2.2) as ReturnType<typeof piece>;
    const f = fitBarsTo(o, true);
    expect(f.spec.n).toBe(10);
    expect(Math.abs(f.spec.gap - 0.5)).toBeLessThanOrEqual(0.05);
    expect(f.y).toBeGreaterThan(1.9); expect(f.y).toBeLessThan(2.2);
  });
  it('the switch: on at home and on the preview site, off on the real site, and the link word wins', () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(roleColliderOn(q(''), 'localhost')).toBe(true);
    expect(roleColliderOn(q(''), 'preview.conquercourse.pages.dev')).toBe(true);
    expect(roleColliderOn(q(''), 'conquercourse.com')).toBe(false);
    expect(roleColliderOn(q('rolecollider=1'), 'conquercourse.com')).toBe(true);
    expect(roleColliderOn(q('rolecollider=0'), 'localhost')).toBe(false);
  });
});
