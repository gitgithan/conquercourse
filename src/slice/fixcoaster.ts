import { searchIdealRun } from '../sim/ideal';
import { roleCourse } from './roles';
import { isTrack } from './track-world';
import type { P } from './holds-world';
import { size } from './world';

// "Fix it" for a coaster world in the editor (CC-244): the smallest change to the sections and bars that lets the ride clear.
// Candidates are cheap moves (a bar up or down, a gap closed, the first section raised); each is tried on the same simulator the Course uses, so the first that clears is proved.
type Lane = { angle: number; offset: number; level: number };
export interface FixedCoaster { ok: boolean; pieces: P[]; steps: string[] }

const clearsNow = (ps: P[], lane: Lane): boolean => searchIdealRun(roleCourse(ps as never[], lane).course).cleared;
const copy = (ps: P[]): P[] => ps.map((q) => ({ ...q }));
const right = (q: P) => q.x + (size(q.mesh).w * q.scale) / 2;

export function fixCoaster(ps: P[], lane: Lane, budget = 60): FixedCoaster {
  if (clearsNow(ps, lane)) return { ok: true, pieces: ps, steps: [] };
  const cands: { pieces: P[]; text: string; cost: number }[] = [];
  const sections = ps.filter(isTrack).sort((a, b) => a.x - b.x);
  for (const h of ps.filter((q) => q.src === 'hold:bar')) {
    for (let d = 0.2; d <= 1.2; d += 0.2) for (const sign of [1, -1]) {
      const y = +(h.y + sign * d).toFixed(2);
      if (y < 1.6 || y > 4) continue;
      const n = copy(ps); n.find((q) => q.id === h.id)!.y = y;
      cands.push({ pieces: n, cost: d, text: `Moved a bar ${sign > 0 ? 'up' : 'down'} by ${d.toFixed(1)} m so the rider can catch it.` });
    }
  }
  for (let i = 0; i + 1 < sections.length; i++) {
    const edge = right(sections[i]), gap = sections[i + 1].x - (size(sections[i + 1].mesh).w * sections[i + 1].scale) / 2 - edge;
    for (let d = 0.5; gap - d >= 1.5; d += 0.5) {
      const n = copy(ps);
      for (const q of n) if (q.src !== 'hold:bar' ? q.x > edge : q.x > edge + gap / 2) q.x -= d; else if (q.src === 'hold:bar' && q.x > edge) q.x -= d / 2;
      cands.push({ pieces: n, cost: d * 0.6, text: `Closed the flight after section ${i + 1} by ${d.toFixed(1)} m: a shorter flight needs less speed.` });
    }
  }
  if (sections.length) for (let d = 0.5; d <= 4; d += 0.5) {
    const n = copy(ps); n.find((q) => q.id === sections[0].id)!.y += d;
    cands.push({ pieces: n, cost: d * 0.8, text: `Raised the first section by ${d.toFixed(1)} m: the rider has more height to spend.` });
  }
  cands.sort((a, b) => a.cost - b.cost);
  for (const c of cands.slice(0, budget)) if (clearsNow(c.pieces, lane)) return { ok: true, pieces: c.pieces, steps: [c.text] };
  return { ok: false, pieces: ps, steps: ['No small move of the sections or bars makes this ride clear. Try a higher start or a shorter flight.'] };
}
