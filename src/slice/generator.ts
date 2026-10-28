import { HAZARDS } from '../course/hazard';
import type { CourseData } from '../course/course';
import { playPlan, searchIdealRun, type Plan } from '../sim/ideal';

// Course generator v1: a seed becomes a course of a few moves, each one proved clearable by the ideal-run search.
// Pure: no DOM, no clock, no random source but the seed.
export type MoveKind = 'gap' | 'step' | 'lache' | 'wall' | 'rope';
export const MOVE_KINDS: MoveKind[] = ['gap', 'step', 'lache', 'wall']; // the default pool
const ALL_KINDS: MoveKind[] = [...MOVE_KINDS, 'rope']; // the rope clears too but its proof takes about 9 s, so it is only used when asked for

export interface GenOptions { moves?: string[]; length?: number; difficulty?: number }
export interface MoveInfo { kind: MoveKind; level: number; size: number; x0: number; x1: number } // level 0..1 is how hard for its kind; size is metres (gap), rise (step), gap (lache)
export interface Generated { course: CourseData; moves: MoveInfo[]; cleared: boolean }

const ONCE: MoveKind[] = ['wall', 'lache', 'rope'];
const RUNUP = 36; // m of flat deck before each move: enough to be at full speed
const LAND = 6; // m of deck after each move
const KEEP = 0.88; // share of speed kept at a jump take-off when the course has bars or steps
const SIZE: Record<MoveKind, [number, number]> = { gap: [2.5, 5.2], step: [0.4, 1.3], lache: [5.5, 6.8], wall: [3.4, 4.3], rope: [6, 9.5] };
const NAME: Record<MoveKind, string> = { gap: 'Gap jump', step: 'Step up', lache: 'Lache pair', wall: 'Warped wall', rope: 'Rope swing' };

function rng(seed: number): () => number {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

// One move laid on a flat deck that ends at x = 0 (the take-off edge). `mid` is ground between the deck and the landing deck, which starts at `landing` (top 0).
interface Piece { mid: { x0: number; x1: number; top: number }[]; holds: { x: number; y: number }[]; landing: number; rise?: number } // rise: the landing deck is this much higher than the run-up deck
function piece(kind: MoveKind, size: number, style: [number, number]): Piece {
  if (kind === 'gap') return { mid: [], holds: [], landing: size };
  if (kind === 'wall') return { mid: [], holds: [], landing: 0, rise: size }; // the deck stays up (the wall only triggers from ground level, so there is no way back down)
  if (kind === 'rope') return { mid: [], holds: [], landing: size };
  if (kind === 'step') return { mid: [{ x0: 0, x1: STEP_TOP, top: size }], holds: [], landing: STEP_TOP };
  const spacing = r2(2.2 + style[0] * 1.3);
  const y = r2(2.8 + style[1] * 0.2);
  return { mid: [], holds: [{ x: 3, y }, { x: r2(3 + spacing), y }], landing: size };
}
const STEP_TOP = 4; // m of raised ground on a step before it drops back to the deck

export function assemble(kinds: MoveKind[], sizes: number[], styles: [number, number][], keep: boolean): { course: CourseData; moves: MoveInfo[] } {
  const platforms: CourseData['terrain']['platforms'] = [];
  const holds: { x: number; y: number }[] = [];
  const zones: NonNullable<CourseData['zones']> = [];
  const checkpoints: NonNullable<CourseData['checkpoints']> = [];
  const moves: MoveInfo[] = [];
  let wall: CourseData['wall'];
  let rope: CourseData['rope'];
  let base = 0; // height of the current deck
  let deck = -10; // where the current flat deck starts
  let edge = RUNUP;
  kinds.forEach((kind, i) => {
    const p = piece(kind, sizes[i], styles[i]);
    const id = `${kind}-${i + 1}`;
    platforms.push({ x0: deck, x1: edge, top: base });
    p.mid.forEach((q) => platforms.push({ x0: r2(edge + q.x0), x1: r2(edge + q.x1), top: r2(base + q.top) }));
    if (kind === 'rope') rope = { anchorX: r2(edge + sizes[i] / 2), anchorY: r2(base + 6.6), length: 9 };
    if (kind === 'wall') wall = { x0: r2(edge - sizes[i]), height: sizes[i] };
    p.holds.forEach((h) => holds.push({ x: r2(edge + h.x), y: r2(base + h.y) }));
    deck = r2(edge + p.landing);
    base = r2(base + (p.rise ?? 0));
    zones.push({ id, name: NAME[kind], x0: r2(edge - 3), x1: r2(deck + 2) });
    checkpoints.push({ id, x: r2(edge - 10) });
    moves.push({ kind, level: 0, size: sizes[i], x0: r2(edge), x1: deck });
    edge = r2(deck + LAND + RUNUP);
  });
  platforms.push({ x0: deck, x1: r2(deck + LAND + 4), top: base });
  const finishX = r2(deck + LAND);
  return {
    course: { version: 1, name: '', startX: 0, finishX, jumpSpeed: 4.5, ...(keep ? { jumpKeep: KEEP } : {}), terrain: { waterY: -1.5, platforms }, ...(wall ? { wall } : {}), ...(rope ? { rope } : {}), ...(holds.length ? { holds } : {}), zones, checkpoints },
    moves,
  };
}

const sizeAt = (kind: MoveKind, level: number) => kind === 'rope' ? [6, 8, 9.5][Math.min(2, Math.floor(level * 3))] : r2(SIZE[kind][0] + level * (SIZE[kind][1] - SIZE[kind][0]));

export function generateDetailed(seed: number, opts: GenOptions = {}): Generated {
  const rand = rng(seed);
  const pool = (opts.moves ?? MOVE_KINDS).filter((m): m is MoveKind => (ALL_KINDS as string[]).includes(m));
  const n = Math.max(1, Math.min(8, Math.round(opts.length ?? 4)));
  const top = Math.max(0.2, Math.min(1, opts.difficulty ?? 0.7));
  const kinds: MoveKind[] = [];
  for (let i = 0; i < n; i++) {
    // no same move twice in a row; one wall and one lache at most (a course has one wall, and a lache is the slow proof)
    const options: MoveKind[] = pool.length > 1 ? pool.filter((k) => k !== kinds[i - 1] && !(ONCE.includes(k) && kinds.includes(k))) : pool;
    if (!options.length) options.push(...pool);
    kinds.push(options[Math.floor(rand() * options.length)]);
  }
  const styles = kinds.map((): [number, number] => [rand(), rand()]);
  const keep = kinds.some((k) => k === 'lache' || k === 'step'); // bars and vault steps are worth learning only when a jump costs speed
  // the ramp: the first move is easy (level 0.1), the last reaches `top`; a small jitter keeps seeds apart but never lets a move fall below the one before
  let levels = kinds.map((_, i) => (n === 1 ? 0.1 : 0.1 + (top - 0.1) * (i / (n - 1))));
  levels = levels.map((l, i) => (i === 0 ? l : Math.min(1, l + (rand() - 0.5) * 0.1)));
  for (let i = 1; i < n; i++) levels[i] = Math.max(levels[i], levels[i - 1]);
  // each move is proved alone by the ideal-run search on a course of just that move (cached: the proof is the slow part);
  // the proved presses are then laid along the whole course and played once, which is cheap
  const proof = (i: number, size: number): Proved | null => {
    const key = `${kinds[i]}|${size}|${styles[i]}|${keep}`;
    let r = PROOFS.get(key);
    if (r === undefined) {
      const alone = assemble([kinds[i]], [size], [styles[i]], keep).course;
      const found = searchIdealRun(alone);
      r = found.cleared ? { plan: found.plan, hangs: playPlan(alone, found.plan).events.filter((e) => e.type === 'hang-catch').length } : null;
      PROOFS.set(key, r);
    }
    return r;
  };
  const compose = (idx: number[], lv: number[]): Generated | null => {
    const ks = idx.map((i) => kinds[i]);
    const sizes = ks.map((k, j) => sizeAt(k, lv[j]));
    const parts = idx.map((i, j) => proof(i, sizes[j]));
    if (parts.some((p) => !p)) return null;
    const a = assemble(ks, sizes, idx.map((i) => styles[i]), keep);
    a.moves.forEach((m, j) => (m.level = lv[j]));
    a.course.name = `Generated course ${seed}`;
    const floor = HAZARDS[seed % HAZARDS.length]; // the floor follows the seed (water on every fifth), without touching the random draws
    if (floor !== 'water') a.course.hazard = floor;
    const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8, vaultXs: [], hangTicks: [] };
    parts.forEach((pr, j) => {
      const p = pr!.plan;
      const dx = a.moves[j].x0 - RUNUP;
      plan.jumpXs.push(...p.jumpXs.map((x) => r2(x + dx)));
      plan.vaultXs!.push(...(p.vaultXs ?? []).map((x) => r2(x + dx)));
      plan.hangTicks!.push(...Array.from({ length: pr!.hangs }, (_, h) => p.hangTicks?.[h] ?? 90));
      if (p.hands) plan.hands = true;
    });
    if (!plan.vaultXs!.length) delete plan.vaultXs;
    if (!plan.hangTicks!.length) delete plan.hangTicks;
    const run = playPlan(a.course, plan, 120 * 60);
    const cleared = run.world.outcome === 'cleared';
    if (cleared) a.course.plan = plan; // the proved line travels with the course (drums and the bot use it without searching again)
    return { course: a.course, moves: a.moves, cleared };
  };
  // shrink every move a little until the whole course clears, then drop moves from the end; a single move that will not clear alone is dropped
  let idx = kinds.map((_, i) => i);
  let lv = levels.slice();
  let g = compose(idx, lv);
  for (let round = 0; (!g || !g.cleared) && round < 5; round++) {
    lv = lv.map((l) => Math.max(0, l - 0.15));
    g = compose(idx, lv);
  }
  while ((!g || !g.cleared) && idx.length > 1) { idx = idx.slice(0, -1); lv = lv.slice(0, -1); g = compose(idx, lv); }
  return g ?? { course: assemble([], [], [], false).course, moves: [], cleared: false };
}

const PROOFS = new Map<string, Proved | null>();
interface Proved { plan: Plan; hangs: number } // hangs: how many times the proved line catches a bar (the next move's hang times follow these)

export function generateCourse(seed: number, opts?: GenOptions): CourseData {
  return generateDetailed(seed, opts).course;
}
