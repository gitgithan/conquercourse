import { holdsOf, isHold, type P } from './holds-world';
import { laneToCourse, sliceProfile } from './slice';
import { worldSamples } from './world';
import { searchIdealRun } from '../sim/ideal';

// "Fix it" for a lane with bars: try small moves of the bars (up or down, along the run, both together) and keep the smallest one the
// ideal-run search proves clearable. Each candidate is a whole proof, so the search is cut off by a time budget.
type Lane = { angle: number; offset: number; level: number };
export interface FixedBars { ok: boolean; pieces: P[]; steps: string[] }

const proof = (ps: P[], lane: Lane): boolean => {
  const ground = ps.filter((p) => !isHold(p));
  const pr = sliceProfile(worldSamples(ground), { x: 0, z: 0 }, lane);
  return pr.length >= 8 && searchIdealRun(laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin }, 'fix', holdsOf(ps, lane))).cleared;
};

export function fixBars(pieces: P[], lane: Lane, budgetMs = 6000): FixedBars {
  const t0 = performance.now();
  const bars = pieces.filter(isHold).sort((a, b) => a.x - b.x);
  if (!bars.length) return { ok: proof(pieces, lane), pieces, steps: [] };
  if (proof(pieces, lane)) return { ok: true, pieces, steps: [] };
  type Cand = { cost: number; text: string; apply: (ps: P[]) => P[] };
  const cands: Cand[] = [];
  const along = Math.cos(lane.angle), across = Math.sin(lane.angle);
  const move = (ids: number[], du: number, dy: number) => (ps: P[]) => ps.map((p) => (ids.includes(p.id) ? { ...p, x: p.x + du * along, z: p.z + du * across, y: Math.min(4.3, Math.max(0.35, p.y + dy)) } : p));
  const nice = (v: number) => `${Math.abs(v).toFixed(v % 1 === 0 ? 0 : 1)} m`;
  for (const dy of [0.2, -0.2, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2, -2]) {
    bars.forEach((b, i) => cands.push({ cost: Math.abs(dy), text: `Moved bar ${i + 1} ${dy > 0 ? 'up' : 'down'} ${nice(dy)}.`, apply: move([b.id], 0, dy) }));
    if (bars.length > 1) cands.push({ cost: Math.abs(dy) * 0.9, text: `Moved the bars ${dy > 0 ? 'up' : 'down'} ${nice(dy)} together.`, apply: move(bars.map((b) => b.id), 0, dy) });
  }
  for (const du of [0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2]) {
    bars.forEach((b, i) => cands.push({ cost: Math.abs(du) * 0.6, text: `Moved bar ${i + 1} ${du > 0 ? 'forward' : 'back'} ${nice(du)}.`, apply: move([b.id], du, 0) }));
    cands.push({ cost: Math.abs(du) * 0.5, text: `Moved the bars ${du > 0 ? 'forward' : 'back'} ${nice(du)} together.`, apply: move(bars.map((b) => b.id), du, 0) });
  }
  cands.sort((a, b) => a.cost - b.cost);
  for (const c of cands) {
    if (performance.now() - t0 > budgetMs) break;
    const next = c.apply(pieces);
    if (!next.some((p) => isHold(p) && p.y + 0.04 >= 2.0 && p.y + 0.04 <= 3.4)) continue; // no bar a jump can reach: no need for a whole proof
    if (proof(next, lane)) return { ok: true, pieces: next, steps: [c.text] };
  }
  return { ok: false, pieces, steps: ['No small move of the bars makes it clearable: try different gaps between the decks.'] };
}
