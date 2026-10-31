import { describe, expect, it } from 'vitest';
import { barMesh, holdsOf, isHold, type P } from '../src/slice/holds-world';
import { laneToCourse, sliceProfile, type Mesh } from '../src/slice/slice';
import { newPiece, worldSamples } from '../src/slice/world';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

// CC-243: the green hang bar (crossbar 2.2 m) and the black one (2.05 m) from the editor's object list: the runner jumps, holds E and swings on, like the Lache.
function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
const lane = { angle: 0, offset: 0, level: 0 };
const bar = (x: number, hang: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y: hang - 0.04 }); // the editor puts the crossbar piece at hang_m - 0.04
const deck = (x: number, w: number): P => ({ ...newPiece('Deck', box(w, 0.5, 1.8), { x, z: 0 }), src: 'x' });
const courseOf = (hang: number | null) => {
  const ps: P[] = [deck(0, 8), deck(17, 8), ...(hang === null ? [] : [bar(8.5, hang)])]; // a 9 m gap with the bar in the middle
  return laneToCourse(sliceProfile(worldSamples(ps.filter((p) => !isHold(p))), { x: 0, z: 0 }, lane), 'test', holdsOf(ps, lane));
};

describe.each([['green', 2.2], ['black', 2.05]])('the %s hang bar (%d m)', (_n, hang) => {
  it('is a hold at its real height', () => expect(courseOf(hang).holds?.[0].y).toBeCloseTo(hang, 1));
  it('lets the runner clear the gap, holding E', () => {
    const r = searchIdealRun(courseOf(hang));
    expect(r.cleared).toBe(true);
  });
  it('grabs on E and swings (hang or swing mode happens)', () => {
    const c = courseOf(hang), r = searchIdealRun(c);
    expect(r.cleared).toBe(true);
    const modes = new Set<string>();
    playPlan(c, r.plan, undefined, (w) => modes.add(w.mode));
    expect(modes.has('swing') || modes.has('hang')).toBe(true);
  });
});

// the same, through the editor's ready-made courses (frame object + crossbar piece + two decks), played from the course the editor builds
import { readFileSync } from 'node:fs';
import { readGlbMesh } from '../src/slice/glb';
import { PRESETS } from '../src/slice/presets';
import { roleCourse } from '../src/slice/roles';
import { piecesFromSource } from '../src/slice/roundtrip';

describe.each([['green-bar', 2.2], ['black-bar', 2.05]])('ready-made course %s', (id, hang) => {
  it('is cleared by swinging on the rod, and the rod is a hold at the real height', () => {
    const pre = PRESETS.find((p) => p.id === id)!;
    const ps = [...piecesFromSource(pre.pieces.filter((q) => !q.src.startsWith('obj:'))) as P[], ...pre.pieces.filter((q) => q.src.startsWith('obj:')).map((q) => {
      const b = readFileSync(`public/assets/objects/${q.src.slice(4)}`);
      return { ...newPiece(q.src, readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale, noGround: true } as P;
    })];
    const { course } = roleCourse(ps as never[], lane);
    expect(course.holds?.length).toBe(1);
    expect(course.holds![0].y).toBeCloseTo(hang, 1);
    const r = searchIdealRun(course), modes = new Set<string>();
    expect(r.cleared).toBe(true);
    playPlan(course, r.plan, undefined, (w) => modes.add(w.mode));
    expect(modes.has('swing') || modes.has('hang')).toBe(true);
  });
});
