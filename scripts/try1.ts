import { barMesh, type P } from '../src/slice/holds-world';
import { roleCourse, clears, roleCandidates, suggestRoles, movesInWorld } from '../src/slice/roles';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';
const mk = (name: string, w: number, h: number, d: number, x: number, y = 0, role?: P['role']): P => ({ ...newPiece(name, box(w, h, d), { x, z: 0 }), y, ...(role ? { role } : {}) });
const lane = { angle: 0, offset: 0, level: 0 };
const t = (label: string, f: () => unknown) => { const t0 = Date.now(); const r = f(); console.log(label, JSON.stringify(r), `${((Date.now() - t0) / 1000).toFixed(1)}s`); };
// wall: deck 0..30 (0.5 high) then wall piece 4 m high at x=31..33
const deck = mk('Deck', 30, 0.5, 1.8, 15);
const wall = (role?: P['role']) => mk('Wall', 2, 4.0, 1.8, 31, 0, role);
t('wall course', () => { const b = roleCourse([deck, wall('wall')], lane); return { wall: b.course.wall, plats: b.course.terrain.platforms, notes: b.notes }; });
t('wall clears (role)', () => clears([deck, wall('wall')], lane));
t('wall clears (no role)', () => clears([deck, wall()], lane));
t('wall cands', () => roleCandidates(mk('Tall', 2, 2.0, 1.8, 31), lane).map((s) => [s.role, s.change]));
