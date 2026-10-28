import type { CourseData } from '../course/course';
import { playPlan, risers, searchIdealRun, type Plan, type RunResult, type Window } from './ideal';
import { DT } from './units';

// Shortcut discovery. The ideal-run search finds the best line through the course the designer drew. This asks the other question:
// is there a line the designer did not plan? The ideal line is looked at first (does it skip anything?), then every obstacle (and every pair
// of neighbouring bars) is switched off in turn and the search is run again. A line counts only when it clears the REAL course, with every
// bar and obstacle in place, and is faster than the line that uses everything.
export interface Shortcut {
  id: string; // stable name: 'skip-bar-2', 'skip-bars-1-2', 'skip-wall', 'skip-rope'
  skipped: string[]; // what the line does not use, in plain words ('Bar 2')
  how: string; // what the player does, in plain words
  secondsSaved: number; // against the line that uses everything
  seconds: number; // the whole run
  pumpSeconds: number | null; // the longest pump on a bar in this line
  windowMs: number | null; // the narrowest window of good presses (smaller = harder)
  designed: boolean; // the designer marked it as meant (course.designedShortcuts)
  plan: Plan; // plays on the real course
}
export interface MoveChoice { move: 'vault' | 'roll'; withSeconds: number; withoutSeconds: number | null } // the best line against the best line without this move (null: cannot be cleared without it)
export interface ShortcutReport {
  intendedSeconds: number | null; // the line that uses everything; null: the course does not clear
  intended: Plan | null;
  shortcuts: Shortcut[];
  moveChoices: MoveChoice[];
  searches: number;
  complete: boolean; // false when the budget ran out before every variant was tried
}
export interface ShortcutOptions { budgetMs?: number; maxSearches?: number; onlyIds?: string[]; moveChoices?: boolean }

const r2 = (v: number) => Math.round(v * 100) / 100;

interface Used { seconds: number; caught: number[]; wall: boolean; rope: boolean; pumps: number[] }
// what a played line used: the bars it held, the wall, the rope, and how long each hold lasted
function usedBy(res: RunResult): Used | null {
  if (res.world.outcome !== 'cleared') return null;
  const caught: number[] = [], pumps: number[] = [];
  let at = -1;
  for (const e of res.events) {
    if (e.type === 'hang-catch') { caught.push(Number(e.detail?.hold ?? 0)); at = e.tick; }
    if (e.type === 'hang-release' && at >= 0) { pumps.push((e.tick - at) * DT); at = -1; }
  }
  return { seconds: res.world.runner.tick * DT, caught: [...new Set(caught)], wall: res.events.some((e) => e.type === 'wall-grab'), rope: res.events.some((e) => e.type === 'rope-catch'), pumps };
}

interface Variant { id: string; skipped: string[]; course: CourseData; keep: number[] | null; skipIdx: number[] }

// every way to take away one move: each bar, each pair of neighbouring bars, the wall, the rope
export function variantsOf(course: CourseData): Variant[] {
  const out: Variant[] = [];
  const holds = course.holds ?? [];
  const base = { ...course, plan: undefined } as CourseData;
  const without = (drop: number[]): Variant => {
    const keep = holds.map((_, i) => i).filter((i) => !drop.includes(i));
    return { id: drop.length === 1 ? `skip-bar-${drop[0] + 1}` : `skip-bars-${drop.map((i) => i + 1).join('-')}`, skipped: drop.map((i) => `Bar ${i + 1}`), course: { ...base, holds: keep.map((i) => holds[i]) }, keep, skipIdx: drop };
  };
  holds.forEach((_, i) => out.push(without([i])));
  for (let i = 0; i + 1 < holds.length; i++) out.push(without([i, i + 1]));
  if (course.wall) out.push({ id: 'skip-wall', skipped: ['the wall'], course: { ...base, off: [...(course.off ?? []), 'wall'] }, keep: null, skipIdx: [] });
  if (course.rope) out.push({ id: 'skip-rope', skipped: ['the rope'], course: { ...base, off: [...(course.off ?? []), 'rope'] }, keep: null, skipIdx: [] });
  return out;
}

// the variant's plan, written for the real course: bars it never held are marked noGrab, the others keep their pump times
function mapPlan(plan: Plan, real: CourseData, v: Variant): Plan {
  if (!v.keep) return plan;
  const n = (real.holds ?? []).length;
  const hangTicks = Array.from({ length: n }, (_, i) => { const k = v.keep!.indexOf(i); return k >= 0 ? plan.hangTicks?.[k] ?? 90 : 0; });
  return { ...plan, hangTicks, noGrab: v.skipIdx, hands: n > 0 };
}

function say(skipped: string[], u: Used): string {
  const longest = u.pumps.length ? Math.max(...u.pumps) : 0;
  const names = skipped.map((s) => s.toLowerCase()).join(' and ');
  if (skipped.some((s) => s.startsWith('Bar'))) return longest > 0.2 ? `pump ${r2(longest)} s on the bar you hold, let go, and fly past ${names}` : `jump past ${names}`;
  return `get past ${names} without using it`;
}

export function findShortcuts(course: CourseData, opts: ShortcutOptions = {}): ShortcutReport {
  const t0 = Date.now();
  const holds = course.holds ?? [];
  // the ideal search with routes (CC-67) already compares bar to bar against a full pump that flies over the second bar, and keeps the faster; reuse its answer
  const idealFound = course.plan && (course.routes || holds.length < 2) ? null : searchIdealRun({ ...course, plan: undefined, routes: undefined } as CourseData, { routes: holds.length >= 2 });
  const idealPlan = course.plan ?? idealFound!.plan;
  const routes = course.routes ?? idealFound?.routes;
  const idealUsed = usedBy(playPlan(course, idealPlan));
  const report: ShortcutReport = { intendedSeconds: idealUsed?.seconds ?? null, intended: idealPlan, shortcuts: [], moveChoices: [], searches: idealFound ? 1 : 0, complete: true };
  if (!idealUsed) return report;
  const over = () => (opts.budgetMs !== undefined && Date.now() - t0 > opts.budgetMs) || (opts.maxSearches !== undefined && report.searches >= opts.maxSearches);
  const designed = new Set(course.designedShortcuts ?? []);

  // the line that uses every bar: the designer's route, and the baseline for the saving when the ideal line already skips a bar
  let baseline = idealUsed.seconds;
  const viaBars = routes?.find((r) => holds.length >= 2 && r.bars >= holds.length); // the route that holds every bar, when the ideal line flies over one
  if (viaBars) baseline = viaBars.ticks * DT;
  report.intendedSeconds = r2(baseline);

  const found = new Map<string, Shortcut>();
  const consider = (plan: Plan, windows: Window[] | undefined, hint: Variant | null) => {
    const u = usedBy(playPlan(course, plan));
    if (!u || u.seconds >= baseline - 0.05) return;
    const skippedBars = holds.map((_, i) => i).filter((i) => !u.caught.includes(i));
    const skipped = [...skippedBars.map((i) => `Bar ${i + 1}`), ...(course.wall && !u.wall ? ['the wall'] : []), ...(course.rope && !u.rope ? ['the rope'] : [])];
    if (!skipped.length) return;
    const id = skippedBars.length && !(course.wall && !u.wall) && !(course.rope && !u.rope) ? (skippedBars.length === 1 ? `skip-bar-${skippedBars[0] + 1}` : `skip-bars-${skippedBars.map((i) => i + 1).join('-')}`) : hint?.id ?? 'skip-' + skipped.join('-').toLowerCase().replace(/\s+/g, '-');
    const widths = (windows ?? []).map((w) => w.widthMs).filter((m) => m > 0);
    const s: Shortcut = { id, skipped, how: say(skipped, u), secondsSaved: r2(baseline - u.seconds), seconds: r2(u.seconds), pumpSeconds: u.pumps.length ? r2(Math.max(...u.pumps)) : null, windowMs: widths.length ? Math.round(Math.min(...widths)) : null, designed: designed.has(id), plan };
    const old = found.get(id);
    if (!old || s.seconds < old.seconds) found.set(id, s);
  };
  consider(idealPlan, idealFound?.windows, null); // the ideal run may already skip something

  for (const v of variantsOf(course)) {
    if (opts.onlyIds && !opts.onlyIds.includes(v.id)) continue;
    if (over()) { report.complete = false; break; }
    report.searches++;
    const f = searchIdealRun(v.course);
    if (f.cleared) consider(mapPlan(f.plan, course, v), f.windows, v);
  }

  // move choices: the best line against the best line without the vault or without the roll
  if (opts.moveChoices !== false && !opts.onlyIds) {
    for (const move of ['vault', 'roll'] as const) {
      if (move === 'vault' && !(risers(course).length > 0)) continue;
      if (over()) { report.complete = false; break; }
      report.searches++;
      const variant = { ...course, plan: undefined, off: [...(course.off ?? []), move] } as CourseData;
      const f = searchIdealRun(variant);
      const u = f.cleared ? usedBy(playPlan(variant, f.plan)) : null;
      if (!u || Math.abs(u.seconds - idealUsed.seconds) > 0.05) report.moveChoices.push({ move, withSeconds: r2(idealUsed.seconds), withoutSeconds: u ? r2(u.seconds) : null });
    }
  }
  report.shortcuts = [...found.values()].sort((a, b) => b.secondsSaved - a.secondsSaved);
  return report;
}

// one plain line for the hint and the end panel: a fact, never a grade
export function shortcutLine(s: Shortcut): string {
  return `Shortcut: ${s.how}. It saves ${s.secondsSaved.toFixed(1)} s${s.windowMs !== null ? `, and its window of good presses is ${s.windowMs} ms wide` : ''}.`;
}
