import { type P } from '../src/slice/holds-world';
import { roleCourse } from '../src/slice/roles';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';
import { searchIdealRun, playPlan } from '../src/sim/ideal';
const mk = (name: string, w: number, h: number, d: number, x: number, y = 0, role?: P['role']): P => ({ ...newPiece(name, box(w, h, d), { x, z: 0 }), y, ...(role ? { role } : {}) });
const lane = { angle: 0, offset: 0, level: 3 };
const A = mk('A', 12, 3, 1.8, -6), B = mk('B', 12, 3, 1.8, 21.4), bed = mk('Bed', 8, 0.3, 1.8, 10, 0, 'trampoline');
const b = roleCourse([A, bed, B], lane);
const r = searchIdealRun(b.course);
for (const xs of [[4.72, 18.84, 45.7], [4.72, 18.84, 32.5, 45.7], [4.72, 18.84, 46.5], [4.72, 18.84, 44.5]]) {
  const res: any = playPlan(b.course, { ...r.plan, jumpXs: xs });
  const w = res.world ?? res;
  console.log(JSON.stringify(xs), 'outcome', w.outcome, 'x', w.runner?.x?.toFixed(1), 'cleared', res.cleared, Object.keys(res).join());
}
