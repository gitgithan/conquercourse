import { describe, expect, it } from 'vitest';
import { barMesh, holdsOf, isHold, type P } from '../src/slice/holds-world';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { newPiece, worldSamples } from '../src/slice/world';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

// CC-243: the green hang bar (crossbar 2.2 m) and the black one (2.05 m) from the editor's object list: the runner jumps, holds E and swings on, like the Lache.
const bar = (x: number, hang: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y: hang - 0.04 }); // the editor puts the crossbar piece at hang_m - 0.04
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
import { box, deck, lane } from './helpers/pieces';

describe('the default editor course', () => {
  it('has a real hang bar and the Lache, and the ideal run swings on both', () => {
    const pre = PRESETS[0];
    expect(pre.id).toBe('swing');
    const ps = [...piecesFromSource(pre.pieces.filter((q) => !q.src.startsWith('obj:'))) as P[], ...pre.pieces.filter((q) => q.src.startsWith('obj:')).map((q) => {
      const b = readFileSync(`public/assets/objects/${q.src.slice(4)}`);
      return { ...newPiece(q.src, readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale, noGround: true };
    })];
    const { course } = roleCourse(ps as never[], lane);
    expect(course.holds?.length).toBe(3);
    expect(course.holds![0].y).toBeCloseTo(2.2, 1);
    const r = searchIdealRun(course);
    expect(r.cleared).toBe(true);
    let grabs = 0, prev = '';
    playPlan(course, r.plan, undefined, (w) => { const m = w.mode === 'swing' || w.mode === 'hang' ? 'on' : ''; if (m && !prev) grabs++; prev = m; });
    expect(grabs).toBeGreaterThanOrEqual(2);
  }, 240000);
});

describe('a hang-bar object without a separate bar piece', () => {
  it('is still a hold at its crossbar height', () => {
    const o = { ...newPiece('x', box(1, 1, 1), { x: 8.5, z: 0 }), src: 'obj:pullup-black.glb', y: 0 } as P;
    expect(holdsOf([o], lane)[0].y).toBeCloseTo(2.05, 2);
    expect(holdsOf([o, bar(8.5, 2.05)], lane).length).toBe(1); // a bar piece beside it is not counted twice
  });
});
