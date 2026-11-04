import { CLIMBABLE, laneToCourse, setRoofStart } from '../../slice/slice';
import { LANE_DROP } from '../../sim/drop';
import { playPlan, searchIdealRun } from '../../sim/ideal';
import type { CourseData } from '../../course/course';
import { laneFacts, looksCrossable, whyNot, JUMP_GAP_M, MIN_GAP_M, type LaneFacts, type Why } from '../../slice/why';
import { customLane, worldOf } from '../../slice/slicer-core';
import { laneProfile } from '../../slice/world';
import { customOf, stateAt, tourOf, TICKS_PER_SECOND, type Line, type PlaceInput, type SlicerDefault } from '../../slice/slicer-default';
import type { Ground } from '../../world/terrain';
import type { OverpassAnswer } from '../../world/osm';

// pipeline "Map to lane": a pin on a real map becomes a lane the simulator proves can be cleared. Every number comes from the game's own
// Slicer code (src/slice/slicer-default.ts, slicer-core.ts, why.ts) on RECORDED OpenStreetMap buildings of the ready places. Pure; no DOM, no network.
export { JUMP_GAP_M, MIN_GAP_M, CLIMBABLE, LANE_DROP };
export const MIN_LANE_M = 8; // a lane shorter than this is too short to run along (src/slice/why.ts)
export const PLACE_URL = (slug: string): string => `/assets/places/${slug}.json`;
export const DEFAULTS_URL = '/assets/places/slicer-defaults.json';
export const INDEX_URL = '/assets/places/index.json';
/** One line of public/assets/places/index.json (only the parts the Lab reads). Every place the Lab offers comes from this list. */
export interface IndexEntry { slug: string; name: string; country?: string; kind?: string; listed?: boolean; path?: boolean; visible?: boolean; hill_m?: number; buildings?: number; bytes?: number }
export type Level = 'ready' | 'nolane' | 'nophotos' | 'small';
/** The same completeness words as the world editor's ready-places gallery (src/modes/map-place.ts), in the order they are shown. */
export const LEVELS: readonly { id: Level; label: string; tip: string }[] = [
  { id: 'ready', label: 'ready (lane proven)', tip: 'Listed in the editor and has a lane the simulator cleared.' },
  { id: 'nolane', label: 'no lane found yet', tip: 'A park whose search has not found a lane yet.' },
  { id: 'nophotos', label: 'no photos or no lane', tip: 'Not listed in the editor yet (it still has a proved lane stored, but no photos).' },
  { id: 'small', label: 'small on the map', tip: 'The mapped shape is under 1500 square metres, so it is a small patch at the editor zoom.' },
];
/** The same test the editor uses for its green "ready" badge. */
export const isReady = (p: IndexEntry): boolean => p.listed !== false && (p.kind !== 'parkour' || p.path === true);
/** The badges of one place: one of ready / no lane found yet / no photos or no lane, and "small on the map" on top when it applies. */
export const levelsOf = (p: IndexEntry): Level[] => [isReady(p) ? 'ready' : p.kind === 'parkour' ? 'nolane' : 'nophotos', ...(p.kind === 'parkour' && p.visible === false ? ['small' as const] : [])];
export const countLevels = (index: readonly IndexEntry[]): Record<Level, number> => {
  const c: Record<Level, number> = { ready: 0, nolane: 0, nophotos: 0, small: 0 };
  for (const p of index) for (const l of levelsOf(p)) c[l]++;
  return c;
};
export const OSM_CREDIT = '© OpenStreetMap contributors (ODbL)';

export interface PlaceData { slug: string; name: string; lat: number; lon: number; radius: number; blurb: string; answer: OverpassAnswer; ground: Ground | null }
export function placeOf(raw: { slug: string; name: string; lat: number; lon: number; radius: number; blurb: string; answer: OverpassAnswer; ground?: { step: number; n: number; h: number[] } | null }): PlaceData {
  return { slug: raw.slug, name: raw.name, lat: raw.lat, lon: raw.lon, radius: raw.radius, blurb: raw.blurb, answer: raw.answer, ground: raw.ground ? { radius: raw.radius, ...raw.ground } : null };
}
export const inputOf = (p: PlaceData, hills = true): PlaceInput => ({ answer: p.answer, lat: p.lat, lon: p.lon, ground: hills ? p.ground : null });

const centre = (ring: [number, number][]): [number, number] => [ring.reduce((t, p) => t + p[0], 0) / ring.length, ring.reduce((t, p) => t + p[1], 0) / ring.length];

/** Everything the student can turn. Lengths are real metres east and south of the pin the place was recorded at. */
export interface Knobs { pin: [number, number]; radiusM: number; realOnly: boolean; hills: boolean; shrink: number; cutM: number; line: Line }
/** How far the farthest building's middle is from the pin, rounded up to 10 m: the circle that holds every recorded building (the recorded circle is where the search began, its buildings reach past it). */
export function reachOf(p: PlaceData): number {
  const tops = stateAt(inputOf(p), 1).tops;
  return Math.ceil(Math.max(20, ...tops.map((t) => Math.hypot(...centre(t.ring)))) / 10) * 10;
}
export function openKnobs(p: PlaceData, d: SlicerDefault): Knobs {
  return { pin: [0, 0], radiusM: reachOf(p), realOnly: false, hills: true, shrink: d.shrink, cutM: d.cutM, line: [...d.line] as Line };
}

export type BuildingState = 'kept' | 'outside' | 'guessed' | 'below'; // why a building is in the lane or not
export interface Analysis {
  place: string; knobs: Knobs;
  tops: { ring: [number, number][]; top: number; real: boolean; state: BuildingState }[];
  counts: { found: number; kept: number; outside: number; guessed: number; below: number; real: number };
  range: number; // the highest roof, real metres: the top of the cut slider
  cells: (number | null)[]; origin: number; lengthM: number; // the lane's profile as the editor reads it
  facts: LaneFacts; why: Why;
  quick: boolean; // the quick look (looksCrossable)
  proved: boolean; // the simulator's verdict (customLane)
}

/** Which buildings are in the lane for these knobs, and the real Slicer's verdict on the line. */
export function analyse(p: PlaceData, k: Knobs, opts: { prove?: boolean } = {}): Analysis {
  setRoofStart(true); // the Slicer on the page has roof start on (CC-200); the stored answers were proved under it
  const inp = inputOf(p, k.hills), all = stateAt(inp, k.shrink);
  const picked = new Set<number>(), state: BuildingState[] = [];
  all.tops.forEach((t, i) => {
    const c = centre(t.ring);
    const s: BuildingState = Math.hypot(c[0] - k.pin[0], c[1] - k.pin[1]) > k.radiusM ? 'outside' : k.realOnly && !t.b.real ? 'guessed' : t.top < k.cutM ? 'below' : 'kept';
    state.push(s);
    if (s === 'kept' || s === 'below') picked.add(i); // a low roof is still a piece; the cut decides what the lane sees
  });
  const st = stateAt(inp, k.shrink, picked), own = customOf(tourOf(k.line), k.shrink), level = k.cutM * k.shrink;
  const prof = laneProfile(worldOf(st.pieces), { angle: own.angle, offset: own.offset, level });
  const facts = laneFacts(prof);
  const proved = opts.prove === false ? false : !!customLane({ mesh: st.mesh, pieces: st.pieces }, { angle: own.angle, offset: own.offset, level }).proved;
  const n = (s: BuildingState) => state.filter((x) => x === s).length;
  return {
    place: p.slug, knobs: k,
    tops: all.tops.map((t, i) => ({ ring: t.ring, top: t.top, real: t.b.real, state: state[i] })),
    counts: { found: all.tops.length, kept: n('kept'), outside: n('outside'), guessed: n('guessed'), below: n('below'), real: all.tops.filter((t) => t.b.real).length },
    range: all.range, cells: [...prof.cells], origin: prof.origin ?? 0, lengthM: prof.length, facts, why: whyNot(facts), quick: looksCrossable(facts), proved,
  };
}

// ---- the what-if limits ------------------------------------------------------------------------------------------
/** The quick look with the limits the student sets (not the game's). At the game's limits it equals looksCrossable. */
export interface Limits { gap: number; climb: number; fall: number }
export const GAME_LIMITS: Limits = { gap: JUMP_GAP_M + 0.5, climb: CLIMBABLE, fall: LANE_DROP };
export interface RuleRow { id: 'length' | 'gap' | 'step' | 'fall'; name: string; value: number; limit: number; ok: boolean }
export function ruleRows(f: LaneFacts, l: Limits = GAME_LIMITS): RuleRow[] {
  const r = (v: number) => Math.round(v * 10) / 10;
  return [
    { id: 'length', name: 'Lane length (m, at least)', value: r(f.lengthM), limit: MIN_LANE_M, ok: f.lengthM >= MIN_LANE_M },
    { id: 'gap', name: 'Widest gap (m, at most)', value: r(f.widestGapM), limit: r(l.gap), ok: f.widestGapM <= l.gap && f.needsSpeed <= 8.5 },
    { id: 'step', name: 'Tallest step up (m, at most)', value: r(f.tallestStepM), limit: r(l.climb), ok: f.tallestStepM <= l.climb },
    { id: 'fall', name: 'Longest fall (m, at most)', value: r(f.deepestDropM), limit: r(l.fall), ok: f.deepestDropM <= l.fall },
  ];
}
export const looksOk = (f: LaneFacts, l: Limits = GAME_LIMITS): boolean => ruleRows(f, l).every((x) => x.ok);

// ---- the simulator tries the lane --------------------------------------------------------------------------------
export interface Tried { course: CourseData; cleared: boolean; clearS: number | null; xs: number[]; ys: number[]; finishX: number }
/** The ideal-run search on the lane's course, played again to record where the runner was every 4th tick. */
export function tryLane(a: Analysis): Tried | null {
  if (a.lengthM < 1 || a.cells.length < 8) return null;
  setRoofStart(true);
  const course = laneToCourse({ cells: a.cells, length: a.lengthM, origin: a.origin });
  const res = searchIdealRun(course);
  const xs: number[] = [], ys: number[] = [];
  let n = 0, ticks = 0;
  const run = playPlan(course, res.plan, undefined, (w) => { if (n++ % 4 === 0) { xs.push(w.runner.x); ys.push(w.runner.y); } ticks = w.runner.tick; });
  return { course, cleared: res.cleared, clearS: res.cleared ? Math.round((ticks / TICKS_PER_SECOND) * 10) / 10 : null, xs, ys, finishX: course.finishX ?? run.maxX };
}

// ---- the design challenges -----------------------------------------------------------------------------------------
export type ChallengeKind = 'clear' | 'reason';
export interface Challenge {
  id: string; title: string; slug: string; kind: ChallengeKind; task: string; start: Partial<Knobs>;
  reveal: string; // what we did, in plain words (a lesson in docs/lessons.md or docs/world-slice.md stands behind each)
}
export const CHALLENGES: readonly Challenge[] = [
  { id: 'cut-high', title: 'The cut is too high', slug: 'alfama-lisbon', kind: 'clear', start: { cutM: 26 },
    task: 'Alfama has a lane, but the cut is set at 26 m and no roof is left. Move the cut until the simulator says the lane clears.',
    reveal: 'We cut at 18 m, a height that keeps many roofs. Anything from about 10 to 18 m works here. This is why the Slicer opens on a height we proved ahead of time (docs/lessons.md, CC-90).' },
  { id: 'say-why', title: 'Say why it fails', slug: 'montmartre-paris', kind: 'reason', start: { cutM: 42 },
    task: 'This cut gives a lane the simulator cannot clear. Look at the side view, then say what stops the runner.',
    reveal: 'The side view has a step about 7 m tall; a climb reaches 2.8 m. The game says the same in plain words on the Slicer, and offers a cut that works. We stored 50 m for this place.' },
  { id: 'small-circle', title: 'The circle is too small', slug: 'eixample-barcelona', kind: 'clear', start: { radiusM: 30 },
    task: 'Only one building is inside this circle, so the lane has nothing to stand on. Widen the radius until a lane clears.',
    reveal: 'A lane needs buildings under the whole line. We read a circle that holds every building recorded around the pin. A wider circle costs more to search, so the Slicer proves the lane ahead of time (docs/lessons.md, CC-90).' },
  { id: 'guessed', title: 'Only the buildings we are sure of', slug: 'alfama-lisbon', kind: 'clear', start: { realOnly: true },
    task: 'Many buildings here have no height tag. With only the tagged ones counted, there is no lane. Find a setting that clears.',
    reveal: 'We count every building and guess 9 m when the tag is missing. A guess is imperfect, but a place with only the sure ones has no lane. The lane is a game lane, not a survey.' },
];
export interface Verdict { pass: boolean; text: string }
export function judge(c: Challenge, a: Analysis, answer?: Why['blocked']): Verdict {
  if (c.kind === 'clear') return a.proved ? { pass: true, text: `The simulator found a run: the lane is ${Math.round(a.lengthM * 10) / 10} m and clears.` } : { pass: false, text: a.lengthM < MIN_LANE_M ? `No lane yet: it is ${Math.round(a.lengthM * 10) / 10} m, a lane needs at least ${MIN_LANE_M} m.` : 'There is a lane, but the simulator cannot clear it. Change a setting.' };
  if (a.proved) return { pass: false, text: 'This lane clears, so nothing stops the runner. Put the setting back, or pick another.' };
  if (!answer) return { pass: false, text: 'Pick what stops the runner first.' };
  return answer === a.why.blocked ? { pass: true, text: `Yes: ${a.why.lines[0] ?? 'that is what stops it'}` } : { pass: false, text: 'Not that one. Look at the side view again, and at the rules table.' };
}
export function startKnobs(c: Challenge, p: PlaceData, d: SlicerDefault): Knobs { return { ...openKnobs(p, d), ...c.start }; }
