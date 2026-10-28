import { barMesh, type P } from '../src/slice/holds-world';
import { roleCourse, clears, roleCandidates, suggestRoles, movesInWorld } from '../src/slice/roles';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';
const mk = (name: string, w: number, h: number, d: number, x: number, y = 0, role?: P['role']): P => ({ ...newPiece(name, box(w, h, d), { x, z: 0 }), y, ...(role ? { role } : {}) });
const t = (label: string, f: () => unknown) => { const t0 = Date.now(); const r = f(); console.log(label, JSON.stringify(r), `${((Date.now() - t0) / 1000).toFixed(1)}s`); };
const lane = { angle: 0, offset: 0, level: 3 };
// trampoline: deck A (top 3) x -12..0, bed x 1..4 (0.3 high), deck B (top 3) x 5.5..17
const A = mk('A', 12, 3, 1.8, -6), B = mk("B", 12, 3, 1.8, 21.4);
const bed = (role?: P['role']) => mk("Bed", 8, 0.3, 1.8, 10, 0, role);
t('tramp course', () => { const b = roleCourse([A, bed('trampoline'), B], lane); return { plats: b.course.terrain.platforms, notes: b.notes }; });
t('tramp clears (role)', () => clears([A, bed('trampoline'), B], lane));
t('tramp clears (no role)', () => clears([A, bed(), B], lane));
// rope: deck 0.5 high x 0..10, gap 7, deck x 17..27; pole 6.6 tall at x=13.5
