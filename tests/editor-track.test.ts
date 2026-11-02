import { describe, expect, it } from 'vitest';
import { addTrackPoint, moveTrackPoint, trackDots } from '../src/modes/editor/track';
import { createEditorState, type P } from '../src/modes/editor/state';
import { trackPiece, trackSrc } from '../src/slice/track-world';

// The side-view coaster points (CC-133): the numbers were taken from the code as it stood inside editor.ts, before it moved to editor/track.ts.
const pts: [number, number][] = [[0, 2], [4, 0.5], [8, 3]];
const section = (): P => ({ ...trackPiece(pts, { x: 10, z: 2 }), src: trackSrc(pts) });
const state = () => { const ed = createEditorState(); ed.pieces = [section()]; ed.angle = 0.3; ed.level = 0.4; return ed; };

describe('side view coaster points', () => {
  it('lists the dots of every section', () => {
    expect(trackDots(state()).map((d) => [d.i, +d.u.toFixed(3), +d.y.toFixed(3)])).toMatchInlineSnapshot(`
      [
        [
          0,
          6.144,
          1.1,
        ],
        [
          1,
          10.144,
          -0.4,
        ],
        [
          2,
          14.144,
          2.1,
        ],
      ]
    `);
  });
  it('moves one point and keeps the others', () => {
    const ed = state(); const p = ed.pieces[0];
    const block = moveTrackPoint(ed, p, 1, 11.5, 1.2);
    expect([block, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), p.src]).toMatchInlineSnapshot(`
      [
        "",
        10,
        1.5,
        2,
        "track:0,2;5.36,2.1;8,3",
      ]
    `);
  });
  it('adds a point between two others, and refuses one too close', () => {
    const ed = state(); const p = ed.pieces[0];
    const u0 = trackDots(ed)[0].u;
    expect(addTrackPoint(ed, p, u0 + 2, 1)).toMatchInlineSnapshot(`""`);
    expect(parseCount(p.src)).toMatchInlineSnapshot(`4`);
    expect(addTrackPoint(ed, p, u0 + 2.1, 1)).toMatchInlineSnapshot(`"spacing"`);
  });
});
const parseCount = (src?: string) => (src ?? '').split(';').length;
