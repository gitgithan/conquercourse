import type { CourseData } from '../course/course';
import { searchIdealRun } from '../sim/ideal';
import { groundAt } from '../sim/terrain';
import { DEFAULT_WALL } from '../sim/wall';
import { isPolePiece, polesOf, withPoles } from './pole-world';
import { barsOf, toBarRuns } from './bars-world';
import { lanePlanks } from './plank-world';
import { holdsOf, isHold, type P } from './holds-world';
import { describe, HALF_LANE, laneToCourse } from './slice';
import { patternOf } from './stack';
import { applyTracks, isTrack, parseTrackSrc, sectionPoints } from './track-world';
import { realSize, laneProfile, type Role } from './world';
import type { LaneSetting } from './advice';

// Smart roles (CC-43). A piece can play a role in the course: plain ground (the default), the Warped Wall, a rope anchor or a trampoline bed.
// This module is pure: it knows what each move needs, builds the course a world makes (with the roles), says which moves a world has and lacks,
// and proposes the smallest scale, turn or lift that gives a piece the size its role needs. Every proposal is proved by the simulator.
export type { Role } from './world';
export const ROLE_NAME: Record<Role, string> = { ground: 'Plain ground', wall: 'Warped Wall', rope: 'Rope anchor', trampoline: 'Trampoline bed', bar: 'Swing bar' };

// ---- what each move needs, in plain words (the Moves panel) ----
export type MoveId = 'gap' | 'step' | 'wall' | 'rope' | 'trampoline' | 'lache' | 'drop' | 'stack' | 'trebuchet' | 'coaster';
export interface MoveInfo { id: MoveId; name: string; need: string }
export const WALL_SPEED = (height: number, p = DEFAULT_WALL): number => Math.sqrt(2 * p.gravity * (1 + p.loss) * Math.max(0, height - p.hipHeight - p.reach)); // m/s the runner needs at the foot of the curve
export const MOVES: MoveInfo[] = [
  { id: 'gap', name: 'Gap jump', need: 'Two pieces of ground with a gap between them. Run, then press Space at the edge.' },
  { id: 'step', name: 'Step up', need: 'A block to jump on, or a taller one to vault (press V a little before it).' },
  { id: 'wall', name: 'Warped Wall', need: 'A tall curved face at the end of a long flat run-up. Run fast and grab the top.' },
  { id: 'rope', name: 'Rope swing', need: 'A rope anchor high above a gap between two pieces of ground. Catch the rope in the air and swing across.' },
  { id: 'trampoline', name: 'Trampoline', need: 'A low flat bed in front of higher ground. Press Space at the bottom of the bounce for extra push.' },
  { id: 'lache', name: 'Lache pair', need: 'Two bars over a gap. Hold E, pump with the arrows, let go.' },
  { id: 'drop', name: 'Drop with a roll', need: 'A long fall. Hold X as you land to roll out of it: it counts only in the last moment, a tap earlier does nothing.' },
  { id: 'stack', name: 'Cup stack', need: 'A Stack piece from the Stacks row: pyramids of cups to climb and cross.' },
  { id: 'trebuchet', name: 'Trebuchet', need: 'Start the lane in a trebuchet: set its counterweight and let go at the right moment.' },
  { id: 'coaster', name: 'Roller coaster', need: 'Built on its own page (?mode=coaster): shape the track, then ride it.' },
];

// ---- where a piece sits in the lane ----
export function footprint(p: P, lane: LaneSetting) {
  const r = realSize(p), a = p.yaw - lane.angle, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const ca = Math.cos(lane.angle), sa = Math.sin(lane.angle);
  return {
    u: p.x * ca + p.z * sa, // along the run, from the rod
    v: -p.x * sa + p.z * ca - lane.offset, // sideways from the middle of the lane
    alongHalf: (r.w * c + r.d * s) / 2, acrossHalf: (r.w * s + r.d * c) / 2,
    h: r.h, top: p.y + r.h - lane.level, // height of the top above the lane's level
  };
}
const inLane = (p: P, lane: LaneSetting) => Math.abs(footprint(p, lane).v) <= HALF_LANE + 0.5;
const r2 = (v: number) => Math.round(v * 100) / 100;

function toX(uMap: { u0: number; u1: number; x0: number }[], u: number): number {
  let best = uMap[0], d = Infinity;
  for (const r of uMap) { const dd = u < r.u0 ? r.u0 - u : u > r.u1 ? u - r.u1 : 0; if (dd < d) { d = dd; best = r; } }
  return best.x0 + (u - best.u0);
}

// After the climb the runner stands on top at a stop and needs room to run on: the deck on top of the wall is made at least `minLen` long
// (everything beyond it moves along). This is a modelling choice, written in docs/world-slice.md.
export const WALL_TOP_RUN = 8; // m
function extendTop(course: CourseData, xFace: number, minLen: number): void {
  const plats = course.terrain.platforms, top = plats.find((q) => Math.abs(q.x0 - xFace) < 0.16);
  if (!top) return;
  const delta = r2(minLen - (top.x1 - top.x0));
  if (delta <= 0) return;
  const from = top.x1;
  top.x1 = r2(top.x1 + delta);
  for (const q of plats) if (q !== top && q.x0 >= from - 0.01) { q.x0 = r2(q.x0 + delta); q.x1 = r2(q.x1 + delta); if (q.profile) q.profile = q.profile.map(([x, y]) => [r2(x + delta), y] as [number, number]); }
  course.finishX = r2(course.finishX + delta);
  if (course.holds) course.holds = course.holds.map((h) => (h.x >= from ? { ...h, x: r2(h.x + delta) } : h));
  if (course.rope && course.rope.anchorX >= from) course.rope = { ...course.rope, anchorX: r2(course.rope.anchorX + delta) };
  if (course.uMap) course.uMap = course.uMap.map((m) => (m.x0 >= from - 0.01 ? { ...m, x0: r2(m.x0 + delta) } : m));
}

// ---- the course a world makes, with its roles ----
export interface RoleBuild { course: CourseData; notes: string[]; length: number } // notes: why a role could not be used; length: metres of ground in the lane
export function roleCourse(pieces: P[], lane: LaneSetting, name = 'My world'): RoleBuild {
  const ground = pieces.filter((p) => !isHold(p) && !isPolePiece(p) && p.role !== 'rope' && p.role !== 'bar'); // bars and rope anchors are not ground
  const pr = laneProfile(ground, lane);
  const walls = pieces.filter((p) => p.role === 'wall' && inLane(p, lane)), beds = pieces.filter((p) => p.role === 'trampoline' && inLane(p, lane)), ropes = pieces.filter((p) => p.role === 'rope' && inLane(p, lane));
  const rows = barsOf(pieces, lane);
  const splits: number[] = [];
  for (const p of walls) splits.push(footprint(p, lane).u - footprint(p, lane).alongHalf);
  for (const p of beds) { const f = footprint(p, lane); splits.push(f.u - f.alongHalf, f.u + f.alongHalf); }
  for (const p of pieces) if (isTrack(p) && inLane(p, lane)) { const f = footprint(p, lane); splits.push(f.u - f.alongHalf, f.u + f.alongHalf); }
  const course = laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin }, name, holdsOf(pieces, lane), { keepGaps: ropes.length > 0 || rows.length > 0, splits }, lanePlanks(pieces, lane));
  const notes: string[] = [], uMap = course.uMap ?? [], plats = course.terrain.platforms;
  if (!uMap.length) return { course, notes, length: pr.length };
  const wall = walls[0];
  if (wall) {
    const f = footprint(wall, lane), x1 = toX(uMap, f.u - f.alongHalf), face = plats.find((q) => Math.abs(q.x0 - x1) < 0.16), xFace = face ? face.x0 : x1, before = groundAt(course.terrain, xFace - 0.3);
    if (!Number.isFinite(before)) notes.push('The wall has no ground in front of it to run up from.');
    else if (f.top - before < 1) notes.push('The wall is too low to be a wall: a jump or a vault does it.');
    else { const height = f.top - before; course.wall = { x0: r2(xFace - height), height: r2(height) }; extendTop(course, xFace, WALL_TOP_RUN); }
  }
  for (const bed of beds) {
    const f = footprint(bed, lane), x0 = toX(uMap, f.u - f.alongHalf), x1 = toX(uMap, f.u + f.alongHalf);
    const plat = plats.find((q) => Math.abs(q.x0 - x0) < 0.16 && Math.abs(q.x1 - x1) < 0.16);
    if (plat && !plat.profile) plat.bouncy = true;
    else notes.push('The trampoline bed must be flat ground of its own: lift it level with the ground around it, or leave a clear edge on both ends.');
  }
  const rails = pieces.filter((p) => isTrack(p) && inLane(p, lane)).flatMap((p) => { const pts = parseTrackSrc(p.src!); if (!pts) return []; const f = footprint(p, lane), x = toX(uMap, f.u); return [sectionPoints(p, pts, f.u, lane.level).map(([u, y]) => [u + (x - f.u), y] as [number, number])]; });
  if (rails.length) notes.push(...applyTracks(course, rails));
  if (rows.length) course.bars = toBarRuns(rows, (u) => toX(uMap, u));
  const rope = ropes[0];
  if (rope) {
    const f = footprint(rope, lane);
    course.rope = { anchorX: r2(toX(uMap, f.u)), anchorY: r2(f.top), length: 9 };
    if (f.top < 4) notes.push('The rope anchor is low: the runner needs it about 6.6 m up.');
  }
  const poles = polesOf(pieces, lane);
  if (poles.length) return { course: withPoles(course, poles.map((q) => ({ x: toX(uMap, q.u), top: q.top }))), notes, length: pr.length };
  return { course, notes, length: pr.length };
}

export const clears = (pieces: P[], lane: LaneSetting, wrap?: (c: CourseData) => CourseData): boolean => {
  const { course, length } = roleCourse(pieces, lane, 'roles proof');
  return length >= 8 && searchIdealRun(wrap ? wrap(course) : course).cleared; // under 8 m of ground is not a lane; wrap puts a machine at its start
};

// ---- which moves a world has ----
export type Have = 'yes' | 'no' | 'elsewhere';
export interface MoveStatus extends MoveInfo { have: Have; detail: string }
export function movesInWorld(pieces: P[], lane: LaneSetting, extra: { trebuchet?: boolean } = {}): MoveStatus[] {
  const ps = pieces.filter((p) => !isHold(p) && p.role !== 'rope' && p.role !== 'bar');
  const prof = laneProfile(ps, lane), report = describe(prof);
  const { course, notes } = roleCourse(pieces, lane);
  const bars = course.holds?.length ?? 0, bed = course.terrain.platforms.some((q) => q.bouncy);
  const fact = (id: MoveId): { have: Have; detail: string } => {
    switch (id) {
      case 'gap': return report.gaps ? { have: 'yes', detail: `${report.gaps} gap${report.gaps > 1 ? 's' : ''}` } : { have: 'no', detail: 'no gap in the lane' };
      case 'step': return report.steps || (report.maxRise >= 0.25 && report.maxRise <= 1.3) ? { have: 'yes', detail: `${report.steps || 1} step${report.steps > 1 ? 's' : ''}, highest ${report.maxRise.toFixed(1)} m` } : { have: 'no', detail: 'no step in the lane' };
      case 'wall': return course.wall ? { have: 'yes', detail: `wall ${course.wall.height} m high` } : { have: 'no', detail: notes.find((n) => /wall/.test(n)) ?? 'no wall piece' };
      case 'rope': return course.rope ? { have: 'yes', detail: `rope anchor ${course.rope.anchorY} m up` } : { have: 'no', detail: notes.find((n) => /rope/.test(n)) ?? 'no rope anchor' };
      case 'trampoline': return bed ? { have: 'yes', detail: 'a bed in the lane' } : { have: 'no', detail: notes.find((n) => /trampoline/.test(n)) ?? 'no trampoline bed' };
      case 'lache': return bars >= 2 ? { have: 'yes', detail: `${bars} bars` } : { have: 'no', detail: bars ? 'one bar: add a second' : 'no bars' };
      case 'drop': return report.maxDrop >= 1.8 ? { have: 'yes', detail: `a fall of ${report.maxDrop.toFixed(1)} m` } : { have: 'no', detail: 'no fall over 1.8 m' };
      case 'stack': return pieces.some((p) => patternOf(p.src)) ? { have: 'yes', detail: 'a stack in the world' } : { have: 'no', detail: 'no stack' };
      case 'trebuchet': return extra.trebuchet ? { have: 'yes', detail: 'the lane starts in a trebuchet' } : { have: 'no', detail: 'the lane starts on a deck' };
      default: return { have: 'elsewhere', detail: 'its own page' };
    }
  };
  return MOVES.map((m) => ({ ...m, ...fact(m.id) }));
}

// ---- what a piece could be ----
export interface RoleSuggestion {
  piece: number;
  role: Role | 'turn';
  move: MoveId;
  words: string;
  change: { scale?: number; yaw?: number; dy?: number; role?: Role }; // the numbers to apply (scale: a factor; yaw: radians to add; dy: metres to lift)
  proved: boolean | null; // null: not tried yet
}

const plain = (v: number) => `${+v.toFixed(1)} m`;

// Candidate roles for one piece from its measured size, with the smallest change that gives it the size the role needs. Not proved yet.
export function roleCandidates(p: P, lane: LaneSetting): RoleSuggestion[] {
  if (isHold(p) || patternOf(p.src)) return [];
  const f = footprint(p, lane), out: RoleSuggestion[] = [];
  const along = f.alongHalf * 2, across = f.acrossHalf * 2, h = f.h;
  const add = (role: RoleSuggestion['role'], move: MoveId, words: string, change: RoleSuggestion['change']) => out.push({ piece: p.id, role, move, words, change, proved: null });
  const k = (target: number, now: number) => r2(target / now);
  // the Warped Wall: a tall face that fills the lane
  if (h >= 1.2 && h <= 14 && p.y < 0.05) {
    const target = h >= 3.4 && h <= 4.3 ? h : 4.0, scale = k(target, h);
    if (scale >= 0.2 && scale <= 5 && across * scale >= 1.6) {
      add('wall', 'wall', `${scale === 1 ? `“${p.name}” is ${plain(h)} tall: use it as the Warped Wall.` : `Make “${p.name}” ${scale > 1 ? 'bigger' : 'smaller'} (×${scale}) so it is ${plain(target)} tall, and use it as the Warped Wall.`} The runner runs up the curve in front of it (needs about ${WALL_SPEED(target).toFixed(1)} m/s) and grabs the top.`, { ...(scale !== 1 ? { scale } : {}), role: 'wall' });
    }
  }
  // the trampoline bed: low, flat, long enough to land on
  if (h <= 0.9 && p.y < 0.05 && across >= 1.2) {
    const length = along >= 2 && along <= 6 ? along : 3, scale = r2(length / along);
    if (scale >= 0.3 && scale <= 4) add('trampoline', 'trampoline', `${scale === 1 ? `Use “${p.name}” as a trampoline bed` : `Make “${p.name}” ${scale > 1 ? 'longer' : 'shorter'} (×${scale}) so it is ${plain(length)} long, and use it as a trampoline bed`}: land on it and press Space at the bottom of the bounce.`, { ...(scale !== 1 ? { scale } : {}), role: 'trampoline' });
  }
  // the rope anchor: a pole or a beam that can be put 6.6 m up
  if (Math.min(along, across) <= 1.2 || p.y > 0.3) {
    const top = p.y + h;
    if (p.y > 0.3 || h >= 3) {
      const dy = r2(6.6 + lane.level - top);
      if (Math.abs(dy) < 0.02) add('rope', 'rope', `Use “${p.name}” as a rope anchor: a rope hangs from its top, ${plain(f.top)} up.`, { role: 'rope' });
      else if (p.y > 0.3 && top + dy > 0) add('rope', 'rope', `${dy > 0 ? 'Lift' : 'Lower'} “${p.name}” ${plain(Math.abs(dy))} so its top is 6.6 m up, and use it as a rope anchor: the runner catches the rope in the air over the gap and swings across.`, { dy, role: 'rope' });
      else if (p.y <= 0.3) { const scale = k(6.6 + lane.level, h); if (scale >= 0.4 && scale <= 4) add('rope', 'rope', `Make “${p.name}” ${scale > 1 ? 'taller' : 'shorter'} (×${scale}) so its top is 6.6 m up, and use it as a rope anchor.`, { scale, role: 'rope' }); }
    }
  }
  // a gap by turning: a piece long along the run, turned 90 degrees, shortens along the run and leaves room
  if (p.y < 0.05 && along >= 3 && across < along) out.push({ piece: p.id, role: 'turn', move: 'gap', words: `Turn “${p.name}” 90° so it is ${plain(across)} along the run instead of ${plain(along)}: that can open a gap to jump.`, change: { yaw: Math.PI / 2 }, proved: null });
  return out;
}

// Apply one suggestion to copies of the pieces (the originals are never touched).
export function applySuggestion(pieces: P[], s: RoleSuggestion): P[] {
  return pieces.map((p) => {
    if (p.id !== s.piece) return p;
    const q: P = { ...p, scale: p.scale * (s.change.scale ?? 1), yaw: p.yaw + (s.change.yaw ?? 0), y: Math.max(0, p.y + (s.change.dy ?? 0)) };
    if (s.change.role) q.role = s.change.role;
    return q;
  });
}

// Candidates for the whole world, each proved by the simulator (the lane clears with the change). `budgetMs` stops the proving early; the rest stay `proved: null`.
export interface RoleProgress { index: number; total: number; candidate: RoleSuggestion; verified: RoleSuggestion[] }
export function suggestRoles(pieces: P[], lane: LaneSetting, opts: { budgetMs?: number; only?: number; moves?: MoveId[]; onProgress?: (p: RoleProgress) => void } = {}): RoleSuggestion[] {
  const t0 = Date.now(), budget = opts.budgetMs ?? 20000, out: RoleSuggestion[] = [];
  const have = new Set(movesInWorld(pieces, lane).filter((m) => m.have === 'yes').map((m) => m.id));
  const cands = pieces.filter((p) => opts.only === undefined || p.id === opts.only).flatMap((p) => roleCandidates(p, lane)).filter((s) => !opts.moves || opts.moves.includes(s.move));
  // moves the world lacks first, then smaller changes
  const size = (s: RoleSuggestion) => Math.abs(Math.log(s.change.scale ?? 1)) + Math.abs(s.change.yaw ?? 0) / 3 + Math.abs(s.change.dy ?? 0) / 4;
  cands.sort((a, b) => Number(have.has(a.move)) - Number(have.has(b.move)) || size(a) - size(b));
  for (const [index, s] of cands.entries()) {
    opts.onProgress?.({ index: index + 1, total: cands.length, candidate: s, verified: out.filter((v) => v.proved === true) });
    if (Date.now() - t0 > budget) { out.push(s); continue; }
    const next = applySuggestion(pieces, s);
    if (s.role === 'turn') {
      const before = describe(laneProfile(pieces.filter((q) => !isHold(q)), lane)), after = describe(laneProfile(next.filter((q) => !isHold(q)), lane));
      if (after.gaps <= before.gaps) continue; // turning does not open a gap: not worth showing
    }
    s.proved = clears(next, lane);
    if (s.proved) out.push(s);
    opts.onProgress?.({ index: index + 1, total: cands.length, candidate: s, verified: out.filter((v) => v.proved === true) });
  }
  return out;
}

