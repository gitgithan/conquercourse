import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGlbMesh } from '../src/slice/glb';
import { clears, fixLayout } from '../src/slice/fixit';
import { PRESETS } from '../src/slice/presets';
import { newPiece, laneProfile, type Piece } from '../src/slice/world';
import { describe as describeLane } from '../src/slice/slice';

const lane = { angle: 0, offset: 0, level: 0 };
const build = (id: string): Piece[] => PRESETS.find((p) => p.id === id)!.pieces.map((q) => {
  const b = readFileSync(`public/assets/objects/${q.src.slice(4)}`);
  const m = readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  return { ...newPiece(q.src, m, { x: q.x, z: q.z }), y: q.y, yaw: q.yaw, scale: q.scale };
});
const jumps = (ps: Piece[], l = lane) => { const d = describeLane(laneProfile(ps, l)); return d.gaps + d.steps; };

describe('the editor course list', () => {
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
});
