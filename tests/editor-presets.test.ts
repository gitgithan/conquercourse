import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGlbMesh } from '../src/slice/glb';
import { clears, fixLayout } from '../src/slice/fixit';
import { PRESETS } from '../src/slice/presets';
import { newPiece, laneProfile, type Piece } from '../src/slice/world';
import { describe as describeLane } from '../src/slice/slice';
import { roleCourse } from '../src/slice/roles';
import { searchIdealRun } from '../src/sim/ideal';
import { piecesFromSource } from '../src/slice/roundtrip';

const lane = { angle: 0, offset: 0, level: 0 };
const build = (id: string): Piece[] => PRESETS.find((p) => p.id === id)!.pieces.filter((q) => q.src.startsWith('obj:')).map((q) => {
  const b = readFileSync(`public/assets/objects/${q.src.slice(4)}`);
  const m = readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  return { ...newPiece(q.src, m, { x: q.x, z: q.z }), y: q.y, yaw: q.yaw, scale: q.scale };
});
const jumps = (ps: Piece[], l = lane) => { const d = describeLane(laneProfile(ps, l)); return d.gaps + d.steps; };

describe('the editor course list', { timeout: 120000 }, () => { // the Fix search takes about 20 s alone and over 50 s when the whole suite runs at once
  it('the passing course clears and has jumps in it', () => {
    const ps = build('passing');
    expect(clears(ps, lane)).toBe(true);
    expect(jumps(ps)).toBeGreaterThanOrEqual(3);
  });
  it('the broken course does not clear, and Fix it makes it clear without flattening it', () => {
    const ps = build('failing');
    expect(clears(ps, lane)).toBe(false);
    const r = fixLayout(ps, lane);
    console.log('FIX', r.ok, r.steps.join(' | '), 'jumps', jumps(ps), '->', jumps(r.pieces, r.lane));
    expect(r.ok).toBe(true);
    expect(clears(r.pieces, r.lane)).toBe(true);
    expect(jumps(r.pieces, r.lane)).toBeGreaterThanOrEqual(2);
  });
  it('with only some pieces movable, only those change', () => {
    const ps = build('failing');
    const ids = [ps[1].id];
    const r = fixLayout(ps, lane, undefined, undefined, { movable: ids });
    for (const p of r.pieces) if (!ids.includes(p.id)) { const o = ps.find((q) => q.id === p.id)!; expect([p.x, p.y, p.scale]).toEqual([o.x, o.y, o.scale]); }
    expect(r.lane).toEqual(lane);
  });
  it('the coaster course rebuilds from its saved sources and the simulator clears it', () => {
    const ps = piecesFromSource(PRESETS.find((p) => p.id === 'coaster')!.pieces);
    expect(ps.length).toBe(2);
    expect(searchIdealRun(roleCourse(ps as never[], lane).course).cleared).toBe(true);
  });
});

describe('Fix it for a coaster world', () => {
  it('leaves a ride that already clears alone', async () => {
    const { fixCoaster } = await import('../src/slice/fixcoaster');
    const good = piecesFromSource(PRESETS.find((p) => p.id === 'coaster')!.pieces) as never[];
    expect(fixCoaster(good, lane).steps).toEqual([]);
    // not tested: a coaster world that fails (every break tried here still cleared, so there is no failing case to repair yet; CC-244 keeps this open)
  });
});

describe('the fork course in the editor list', { timeout: 120000 }, () => {
  for (const id of ['fork']) {
    it(`${id} opens from its saved sources and the simulator clears it`, () => {
      const pre = PRESETS.find((p) => p.id === id)!;
      const objs = pre.pieces.filter((q) => q.src.startsWith('obj:')).map((q) => {
        const b = readFileSync(`public/assets/objects/${q.src.slice(4)}`);
        const m = readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
        return { ...newPiece(q.src, m, { x: q.x, z: q.z }), y: q.y, yaw: q.yaw, scale: q.scale, noGround: q.decor };
      });
      const rest = piecesFromSource(pre.pieces.filter((q) => !q.src.startsWith('obj:'))) as never[];
      const r = searchIdealRun(roleCourse([...objs, ...rest] as never[], lane).course);
      console.log('FORK', id, r.cleared);
      expect(r.cleared).toBe(true);
    });
  }
});
