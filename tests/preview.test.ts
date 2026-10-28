import { workSeconds } from '../src/sim/ideal';
import { beforeAll, describe, expect, it } from 'vitest';
import { adviseLane } from '../src/slice/advice';
import { fixBars } from '../src/slice/fixbars';
import { barMesh, isHold, type P } from '../src/slice/holds-world';
import { diffProposal, enabledCount, fromAdvice, fromEdits, labelsOf, resultOf } from '../src/slice/preview';
import type { Mesh } from '../src/slice/slice';
import { proves } from '../src/slice/photo-proof';
import { newPiece } from '../src/slice/world';

function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
const bar = (x: number, y: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y });
const deck = (x: number, w: number): P => ({ ...newPiece('Deck', box(w, 0.5, 1.8), { x, z: 0 }), src: 'x' });
const lane = { angle: 0, offset: 0, level: 0 };
const snapshot = (ps: P[]) => JSON.stringify(ps.map((p) => [p.id, p.x, p.y, p.z, p.yaw, p.scale]));

describe('preview before apply', () => {
  let pieces: P[], fixed: ReturnType<typeof fixBars>, barsProposal: ReturnType<typeof diffProposal>;
  beforeAll(() => {
    pieces = [deck(0, 8), deck(17, 8), bar(6.5, 4.4), bar(10, 4.4)]; // bars too high to reach
    fixed = fixBars(pieces, lane, workSeconds(50));
    barsProposal = diffProposal('fixit', 'Fix it', pieces, lane, fixed.pieces, lane, fixed.steps, fixed.ok);
  }, 240000);

  it('building a proposal leaves the pieces untouched', () => {
    const before = snapshot(pieces);
    const again = diffProposal('fixit', 'Fix it', pieces, lane, fixed.pieces, lane);
    resultOf(pieces, lane, again);
    expect(snapshot(pieces)).toBe(before);
  });

  it('bars: the preview names the bar, says where it goes, and Apply equals the fixed layout', () => {
    expect(fixed.ok).toBe(true);
    expect(barsProposal.items.length).toBeGreaterThanOrEqual(1);
    const it = barsProposal.items[0];
    expect(it.kind).toBe('piece');
    if (it.kind === 'piece') {
      expect(it.name).toMatch(/^Bar [12]$/);
      expect(it.words).toMatch(/Move “Bar [12]” .*(up|down|along|back)/);
      expect(it.to.y).not.toBe(it.from.y);
    }
    const r = resultOf(pieces, lane, barsProposal);
    expect(snapshot(r.pieces)).toBe(snapshot(fixed.pieces));
    expect(r.pieces.filter(isHold).length).toBe(2);
  });

  it('switching a change off changes the result back', () => {
    const p = { ...barsProposal, items: barsProposal.items.map((i) => ({ ...i })) };
    const all = resultOf(pieces, lane, p);
    p.items[0].on = false;
    const less = resultOf(pieces, lane, p);
    expect(snapshot(less.pieces)).not.toBe(snapshot(all.pieces));
    expect(enabledCount(p)).toBe(barsProposal.items.length - 1);
    for (const i of p.items) i.on = false;
    expect(snapshot(resultOf(pieces, lane, p).pieces)).toBe(snapshot(pieces));
  });

  it('partner edits become a proposal with plain words, and the turn and scale are counted', () => {
    const ps: P[] = [deck(0, 8), deck(12, 8)];
    const pr = fromEdits(ps, lane, [{ piece: ps[1].id, dx: -1.2, dy: 0.5, scale: 0.8, yaw: Math.PI / 12 }, { piece: 99, dx: 5 }]);
    expect(pr.items.length).toBe(1); // the piece that does not exist is dropped
    const it = pr.items[0];
    expect(it.kind === 'piece' && it.words).toMatch(/back toward the start/);
    expect(it.kind === 'piece' && it.words).toMatch(/up/);
    expect(it.kind === 'piece' && it.words).toMatch(/smaller: 20% less/);
    expect(it.kind === 'piece' && it.words).toMatch(/Turn “Deck 2” 15°/);
    expect(snapshot(ps)).toBe(snapshot([deck(0, 8), deck(12, 8)].map((p, i) => ({ ...p, id: ps[i].id }))));
  });

  it('advice: the preview shows the move, and its result is the layout the simulator proved', () => {
    const ps: P[] = [{ ...newPiece('Low box', box(4, 0.5, 1.5), { x: 3, z: 0 }), src: 'x' }, { ...newPiece('Tall wall', box(4, 1.6, 1.5), { x: 8, z: 0 }), src: 'x' }]; // a wall no jump climbs
    expect(proves(ps, lane)).toBe(false);
    const adv = adviseLane(ps, lane);
    expect(adv.length).toBeGreaterThan(0);
    const pr = fromAdvice(ps, lane, adv[0]);
    expect(pr.items.length).toBeGreaterThan(0);
    expect(pr.known).toBe(true);
    const before = snapshot(ps);
    const r = resultOf(ps, lane, pr);
    expect(snapshot(ps)).toBe(before);
    expect(proves(r.pieces, r.lane)).toBe(true);
  }, 60000);

  it('labels twins in order along the run', () => {
    const l = labelsOf([bar(10, 2.8), bar(6, 2.8), deck(0, 8)]);
    const ids = [...l.values()];
    expect(ids.filter((n) => n.startsWith('Bar')).sort()).toEqual(['Bar 1', 'Bar 2']);
    expect(ids).toContain('Deck');
  });
});
