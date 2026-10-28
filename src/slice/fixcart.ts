import { playPlan, searchIdealRun, type Plan } from '../sim/ideal';
import { coasterCourse } from './coaster';

// "Fix it" for a coaster: the smallest change to the track that makes the cart roll home with no brake.
// It raises the first hill (more height to spend), lowers a hill that is too high, or makes a hilltop broader (the cart leaves the rails on a sharp one).
// Every candidate is tried on the same cart physics the Course uses; the first that clears wins, so the fix is proved, not guessed.
export interface FixedCart { ok: boolean; pts: [number, number][]; steps: string[] }

const NO_BRAKE: Plan = { jumpXs: [], releaseAfter: 0, bouncePress: 0, cartBrake: [] };

export const cartRides = (pts: [number, number][], push = 1.5): boolean => playPlan(coasterCourse('t', pts, push), NO_BRAKE).world.outcome === 'cleared';

export function fixCart(pts: [number, number][], push = 1.5): FixedCart {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  if (cartRides(p, push)) return { ok: true, pts: p, steps: [] };
  const cands: { pts: [number, number][]; text: string; cost: number }[] = [];
  const copy = () => p.map((q) => [...q] as [number, number]);
  for (let d = 0.25; d <= 6; d += 0.25) {
    const a = copy(); a[0][1] += d;
    cands.push({ pts: a, cost: d, text: `Raised the start of the track by ${d.toFixed(2)} m: the cart has more height to spend.` });
  }
  const peaks = p.map((q, i) => i).filter((i) => i > 0 && i < p.length - 1 && p[i][1] > p[i - 1][1] && p[i][1] >= p[i + 1][1]);
  for (const i of peaks) {
    for (let d = 0.25; d <= 3; d += 0.25) {
      const a = copy(); a[i][1] = Math.max(0, a[i][1] - d);
      cands.push({ pts: a, cost: d * 1.2, text: `Lowered the hill at ${p[i][0].toFixed(0)} m by ${d.toFixed(2)} m: the cart no longer needs to climb as high.` });
    }
    for (let s = 1; s <= 12; s++) {
      const a = copy();
      for (let k = 0; k < a.length; k++) { if (k < i) a[k][0] -= s; else if (k > i) a[k][0] += s; }
      // keep the neighbours' own neighbours in order: moving whole sides together keeps the order
      cands.push({ pts: a, cost: s * 0.5, text: `Made the hilltop at ${p[i][0].toFixed(0)} m broader (its two sides ${2 * s} m further apart): a gentler top lets the cart stay on the rails.` });
    }
  }
  cands.sort((a, b) => a.cost - b.cost);
  for (const c of cands) if (cartRides(c.pts, push)) return { ok: true, pts: c.pts, steps: [c.text] };
  // nothing rolls home without a brake: is there at least a line with the brake?
  const braked = searchIdealRun(coasterCourse('t', p, push)).cleared;
  return { ok: braked, pts: p, steps: braked ? ['This track can be ridden if you brake before the sharp hilltop (hold ↓).'] : [] };
}
