import { type P } from '../src/slice/holds-world';
import { clears } from '../src/slice/roles';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';
const mk = (name: string, w: number, h: number, d: number, x: number, y = 0, role?: P['role']): P => ({ ...newPiece(name, box(w, h, d), { x, z: 0 }), y, ...(role ? { role } : {}) });
const lane = { angle: 0, offset: 0, level: 3 };
// A ends at 0. bed from g1 for len; B from bed end + g2; B top 3 (rise = 3 - bedTop)
for (const [g1, len, g2, bedH] of [[6, 8, 1.4, 0.3], [6, 8, 2.0, 0.3], [5, 6, 2.0, 0.6], [7, 8, 1.4, 1.0], [6, 8, 1.4, 1.5]] as number[][]) {
  const A = mk('A', 12, 3, 1.8, -6), bed = (role?: P['role']) => mk('Bed', len, bedH, 1.8, g1 + len / 2, 0, role), B = mk('B', 12, 3, 1.8, g1 + len + g2 + 6);
  const t0 = Date.now();
  const yes = clears([A, bed('trampoline'), B], lane), no = clears([A, bed(), B], lane);
  console.log(JSON.stringify({ g1, len, g2, bedH, rise: 3 - bedH, withRole: yes, withoutRole: no }), `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
