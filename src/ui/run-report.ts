// The end-of-run report (CC-97): what happened, drawn on the course, next to the best line the simulator found. Facts only: no scores, no grades.
// The path and the moves come from a RunLog filled every tick; the best line is the stored plan played again (the same ideal run as Shift+I).
import type { CourseData } from '../course/course';
import { CLIMB_COST } from '../sim/climb';
import { JUMP_COST, VAULT_COST } from '../sim/energy';
import { inputFor, type Plan } from '../sim/ideal';
import type { Ways } from './paths';
import { roomText } from './paths';
import { GROUND_ROLL_COST } from '../sim/roll';
import { newWorld, stepWorld, type WorldState } from '../sim/world';
import { ZONE_ICONS } from './zone-icons';
import { column, TOPIC_ORDER } from '../course/obstacles';
import { goldOld } from './hardest';

export type MoveKind = 'jump' | 'vault' | 'climb' | 'roll' | 'grab' | 'bounce' | 'fire';
export interface LoggedMove { kind: MoveKind; x: number; y: number }
export interface RunLog { path: { x: number; y: number }[]; moves: LoggedMove[] }
export const newLog = (): RunLog => ({ path: [], moves: [] });
export const clearLog = (l: RunLog) => { l.path.length = 0; l.moves.length = 0; };

const MOVE_OF: Record<string, MoveKind | undefined> = { jump: 'jump', vault: 'vault', climb: 'climb', roll: 'roll', 'hang-catch': 'grab', 'rope-catch': 'grab', bounce: 'bounce', recoil: 'fire', 'launch-fire': 'fire' };
const ICON_OF: Record<MoveKind, string> = { jump: 'gap', vault: 'vault', climb: 'climb', roll: 'drop', grab: 'lache', bounce: 'trampoline', fire: 'recoil' };
const NAME_OF: Record<MoveKind, [string, string]> = { jump: ['Jump', 'Jumps'], vault: ['Vault', 'Vaults'], climb: ['Climb', 'Climbs'], roll: ['Roll', 'Rolls'], grab: ['Bar or rope grab', 'Bar or rope grabs'], bounce: ['Trampoline bounce', 'Trampoline bounces'], fire: ['Launch', 'Launches'] };
// What a move costs in the energy store, in words (src/sim/energy.ts); moves with no stated cost say nothing about it
const COST_OF: Partial<Record<MoveKind, string>> = {
  jump: 'one jump of effort each',
  vault: `less than half a jump of effort (${(VAULT_COST / JUMP_COST).toFixed(1)} of one)`,
  climb: `the effort of ${Math.round(CLIMB_COST / JUMP_COST)} jumps`,
  roll: `a third of a jump of effort on the ground (${(GROUND_ROLL_COST / JUMP_COST).toFixed(1)} of one)`,
};

/** Adds this tick to the log: the path every few ticks, and every move the simulator reports. */
export function logTick(l: RunLog, w: WorldState): void {
  if (w.runner.tick % 4 === 0) l.path.push({ x: w.runner.x, y: w.runner.y });
  for (const e of w.events) {
    const k = e.type === 'land' && e.detail?.rolled ? 'roll' : MOVE_OF[e.type]; // a landing the runner rolled out of counts as a roll
    if (k) l.moves.push({ kind: k, x: w.runner.x, y: w.runner.y });
  }
}

export interface BestLine { log: RunLog; seconds: number; spent: number }
/** The stored plan played once more, with its path and moves (a coaster's plan is its brake windows). Null when the course has no plan or the plan does not clear. */
export function bestLine(course: CourseData, planOverride?: Plan): BestLine | null {
  const plan = planOverride ?? course.plan; // a course with a fork passes the line of the way taken (CC-225)
  if (!plan) return null;
  let w = newWorld(course);
  const st = { next: 0, caught: null, bedAt: null, hangAt: null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null } as unknown as Parameters<typeof inputFor>[2];
  const log = newLog();
  for (let i = 0; i < 120 * 120 && w.outcome === 'running'; i++) { w = stepWorld(w, inputFor(plan, w, st, course), course); logTick(log, w); }
  return w.outcome === 'cleared' ? { log, seconds: w.runner.tick / 120, spent: 1 - w.energy } : null;
}

// One plain line per course, and the saying of the obstacle (docs/sayings.md); chosen by what the course holds, else by its last obstacle
export const LEARNED: Record<string, string> = column('learned');
export const SAYING: Record<string, string> = column('saying');
const baseId = (id: string) => id.replace(/-\d+$/, '');
/** The key into LEARNED and SAYING for a course: its machine first, else its last obstacle that has one. */
export function topicOf(course: CourseData): string | null {
  const c = course;
  for (const [id, key] of TOPIC_ORDER) { const v = (c as unknown as Record<string, unknown>)[key]; if (Array.isArray(v) ? v.length : v) return id; }
  const ids = (course.zones ?? []).map((z) => baseId(z.id)).filter((id) => LEARNED[id]);
  return ids.length ? ids[ids.length - 1] : null;
}

export interface Report {
  cleared: boolean;
  headline: string;
  seconds: number;
  spent: number; // share of the energy store
  best: BestLine | null; // only for a run from the start
  counts: { kind: MoveKind; n: number }[];
  saving: string | null;
  matched: boolean; // the run was as fast as the best line (within a quarter of a second): there is nothing to change
  learned: string | null;
  saying: string | null;
  metres: number;
  finishX: number;
  ways?: Ways; // a course with a fork, with ?paths=1 (CC-225): the way taken and the best line of each way
}
const f1 = (v: number) => v.toFixed(1);
const jumps = (share: number) => f1(share / JUMP_COST);
const HEADLINE: Record<string, string> = { splash: 'You fell in the water.', hurt: 'A hard landing ended the run.', stalled: 'You ran out of speed.' };

export function buildReport(course: CourseData, log: RunLog, w: WorldState, fromStart: boolean, best: BestLine | null): Report {
  const cleared = w.outcome === 'cleared';
  const seconds = w.runner.tick / 120, spent = 1 - w.energy;
  const counts: Report['counts'] = [];
  for (const m of log.moves) { const c = counts.find((q) => q.kind === m.kind); if (c) c.n++; else counts.push({ kind: m.kind, n: 1 }); }
  const use = cleared && fromStart ? best : null;
  let headline = cleared ? `You made it in ${f1(seconds)} s.` : HEADLINE[w.outcome] ?? 'The run ended.';
  if (cleared && !fromStart) headline = `You made it, starting partway (${f1(seconds)} s).`;
  const matched = !!use && seconds <= use.seconds + 0.25;
  const top = cleared && fromStart && !matched ? [...(course.shortcuts ?? [])].sort((a, b) => b.secondsSaved - a.secondsSaved)[0] : undefined;
  const saving = top && top.secondsSaved >= 0.2 ? `The biggest change the simulator found: ${top.how}. It saves ${f1(top.secondsSaved)} s.` : null;
  const topic = topicOf(course);
  return { cleared, headline, seconds, spent, best: use, counts, saving, matched, learned: cleared && topic ? LEARNED[topic] ?? null : null, saying: cleared && topic ? SAYING[topic] ?? null : null, metres: Math.max(0, Math.round(w.runner.x)), finishX: course.finishX };
}

export interface Actions { watch?: () => void; again?: () => void; next?: { name: string; go: () => void }; close?: () => void }
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e as SVGElement;
};
const tx = (tag: string, text: string, css: string, parent: HTMLElement): HTMLElement => { const e = document.createElement(tag); e.textContent = text; e.style.cssText = css; parent.appendChild(e); return e; };

/** A path with fewer than MIN_POINTS points is given more along its own segments, so the line follows the motion it came from and never reads as one straight stroke. */
export const MIN_POINTS = 10;
export function resamplePath(p: { x: number; y: number }[]): { x: number; y: number }[] {
  if (p.length < 2 || p.length >= MIN_POINTS) return p;
  const out: { x: number; y: number }[] = [];
  const per = Math.ceil((MIN_POINTS - 1) / (p.length - 1));
  for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < per; k++) { const t = k / per; out.push({ x: p[i].x + (p[i + 1].x - p[i].x) * t, y: p[i].y + (p[i + 1].y - p[i].y) * t }); }
  out.push(p[p.length - 1]);
  return out;
}

export interface HardBand { x0: number; x1: number; name: string; falls: number }
export const HARD_BAND = '#ffe38a', HARD_LINE = '#d9a521';
export const YOU_COLOUR = '#0f6b5c', GHOST_COLOUR = '#e08a00';
/** The move icons in the path picture (CC-192): grey like the strip, because gold means only "the obstacle you fell at most" (CC-183); ?gold=old keeps the old gold circles. */
/** CC-215: the trampoline bed in the path picture was amber on every report, so it looked like the gold obstacle; it is teal now (amber only with ?gold=old). */
export const bouncyFill = (old = goldOld()) => (old ? '#e7a93a' : '#6fb7a8');
export const moveIconColours = (old = goldOld()) => (old ? { fill: '#fff8dc', ring: '#d9a521', ink: '#6b4a00' } : { fill: '#ffffff', ring: '#9aa59e', ink: '#58635d' });

/** The course in side view with the player's path (green), the selected ghost's path (amber, both solid) and a small icon where each move happened.
 *  `ghost` null: only the player's line. `old` (?report=old): the first picture, with the best line gold and dashed and the dashed finish line. */
export function pathPicture(course: CourseData, log: RunLog, best: BestLine | null, ghost: { x: number; y: number }[] | null = null, old = false, hard: HardBand | null = null): SVGElement {
  const W = 600, H = 150, pad = 8;
  const mine = resamplePath(log.path), theirs = old ? best?.log.path ?? null : ghost ? resamplePath(ghost) : null;
  const pts = [...mine, ...(theirs ?? [])];
  const xs = [course.startX, course.finishX, ...pts.map((p) => p.x)], x0 = Math.min(...xs), x1 = Math.max(...xs) + 1;
  const tops = course.terrain.platforms.map((p) => p.top);
  const y0 = Math.min(course.terrain.waterY, ...tops, ...pts.map((p) => p.y)) - 0.5, y1 = Math.max(...tops, ...pts.map((p) => p.y)) + 3;
  const X = (x: number) => pad + ((x - x0) / (x1 - x0)) * (W - 2 * pad), Y = (y: number) => H - pad - ((y - y0) / (y1 - y0)) * (H - 2 * pad);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The course from the side with the path you ran and where you jumped, vaulted, climbed and rolled', width: '100%' });
  svg.style.cssText = 'display:block;background:#f4f8f5;border-radius:10px;max-height:170px';
  sv('rect', { x: 0, y: Y(course.terrain.waterY), width: W, height: H, fill: '#cfe6f2' }, svg);
  for (const p of course.terrain.platforms) sv('rect', { x: X(p.x0), y: Y(p.top), width: Math.max(1, X(p.x1) - X(p.x0)), height: Math.max(2, Y(y0) - Y(p.top)), fill: p.bouncy && old ? bouncyFill(true) : '#b9c2bb' }, svg);
  if (hard) { // CC-183: the obstacle you fell at most this session, between two vertical lines on a light gold band (nothing is tinted when there is no fall)
    const bx0 = X(hard.x0), bx1 = X(hard.x1);
    sv('rect', { x: bx0, y: 0, width: Math.max(2, bx1 - bx0), height: H, fill: HARD_BAND, 'fill-opacity': 0.55 }, svg);
    for (const bx of [bx0, bx1]) sv('line', { x1: bx, x2: bx, y1: 0, y2: H, stroke: HARD_LINE, 'stroke-width': 1.5 }, svg);
  }
  for (const h of course.holds ?? []) sv('circle', { cx: X(h.x), cy: Y(h.y), r: 3, fill: '#58635d' }, svg);
  if (course.rope) sv('circle', { cx: X(course.rope.anchorX), cy: Y(course.rope.anchorY), r: 3, fill: '#58635d' }, svg);
  if (old) sv('line', { x1: X(course.finishX), x2: X(course.finishX), y1: pad, y2: H - pad, stroke: '#0f6b5c', 'stroke-dasharray': '3 3' }, svg);
  const line = (p: { x: number; y: number }[], stroke: string, dash: string, width = 2.5) => p.length > 1 && sv('polyline', { points: p.map((q) => `${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' '), fill: 'none', stroke, 'stroke-width': width, 'stroke-dasharray': dash, 'stroke-linejoin': 'round' }, svg);
  if (theirs) line(theirs, old ? '#d9a521' : GHOST_COLOUR, old ? '6 4' : '', old ? 2.5 : 5.5); // wider, under the player's line: where the two runs are the same, amber shows at both edges
  line(mine, YOU_COLOUR, '');
  let lastX = -99;
  const MOVE_ICON = moveIconColours();
  for (const m of log.moves) {
    const cx = X(m.x), cy = Math.max(pad + 9, Y(m.y) - 16);
    if (cx - lastX < 20) continue; // keep the icons apart
    lastX = cx;
    const g = sv('g', {}, svg), title = sv('title', {}, g); title.textContent = NAME_OF[m.kind][0];
    sv('circle', { cx, cy, r: 10, fill: MOVE_ICON.fill, stroke: MOVE_ICON.ring, 'stroke-width': 1.5 }, g);
    const icon = sv('svg', { x: cx - 8, y: cy - 8, width: 16, height: 16, viewBox: '0 0 32 32', fill: 'none', stroke: MOVE_ICON.ink, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    icon.innerHTML = ZONE_ICONS[ICON_OF[m.kind]] ?? '';
  }
  return svg;
}

/** The report as a panel body. `compact` leaves out the big headline (the fall panel has its own). Buttons are built here; what they do comes from `a`. */
export function renderReport(course: CourseData, log: RunLog, r: Report, a: Actions, compact = false, ghost: { x: number; y: number }[] | null = null, old = false, hard: HardBand | null = null): HTMLElement {
  const box = document.createElement('section');
  box.setAttribute('aria-label', 'Run report');
  box.style.cssText = 'display:grid;gap:12px';
  if (!compact) tx('h2', r.headline, 'margin:0;font:800 26px/1.2 system-ui,sans-serif;color:#0f6b5c', box);
  else tx('div', r.cleared ? r.headline : `You got ${r.metres} m of ${r.finishX} m.`, 'font-weight:700', box);
  box.appendChild(pathPicture(course, log, r.best, ghost, old, hard));
  const key = tx('div', '', 'display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#58635d', box);
  key.innerHTML = old ? '<span><b style="color:#0f6b5c">━</b> your path</span>' + (r.best ? '<span><b style="color:#d9a521">╍</b> the best line</span>' : '') + '<span>Icons: where you jumped, vaulted, climbed, grabbed or rolled</span>'
    : `<span><b style="color:${YOU_COLOUR}">━</b> You</span>` + (ghost ? `<span><b style="color:${GHOST_COLOUR}">━</b> Ghost</span>` : '') + '<span>Icons: where you jumped, vaulted, climbed, grabbed or rolled</span>'
      + (hard ? `<span><b style="color:${HARD_LINE};background:${HARD_BAND};padding:0 5px">┃┃</b> Gold band: the obstacle you fell at most this session (${hard.name}, ${hard.falls} ${hard.falls === 1 ? 'fall' : 'falls'})</span>` : '');
  if (r.cleared) {
    const t = document.createElement('table'); t.style.cssText = 'border-collapse:collapse;font-size:15px;width:100%';
    const row = (a1: string, a2: string, a3: string, head = false) => { const tr = t.insertRow(); [a1, a2, a3].forEach((s, i) => { const c = tr.insertCell(); c.textContent = s; c.style.cssText = `padding:5px 8px;border-bottom:1px solid #e5e9e5;${i ? 'text-align:right;' : ''}${head ? 'color:#58635d;font-weight:600' : ''}`; }); };
    const effort = r.spent > 0.005 || (r.best?.spent ?? 0) > 0.005; // a cart ride spends no body energy: no effort row
    if (r.best) { row('', 'You', 'Best line', true); row('Time', `${f1(r.seconds)} s`, `${f1(r.best.seconds)} s`); if (effort) row('Effort', `${jumps(r.spent)} jumps' worth`, `${jumps(r.best.spent)} jumps' worth`); }
    else { row('', 'You', '', true); row('Time', `${f1(r.seconds)} s`, ''); if (effort) row('Effort', `${jumps(r.spent)} jumps' worth`, ''); }
    box.appendChild(t);
  }
  if (r.cleared && r.ways) {
    const w = r.ways;
    tx('div', w.taken ? `You took the ${w.rows.find((q) => q.mine)?.name.toLowerCase() ?? 'way'}.` : 'You started after the fork, so no way is counted.', 'font-weight:700', box).id = 'ways-taken';
    const t = document.createElement('table'); t.id = 'ways-table'; t.style.cssText = 'border-collapse:collapse;font-size:15px;width:100%';
    const row = (cells: string[], head = false, mine = false) => { const tr = t.insertRow(); if (mine) tr.style.background = '#e6f4ee'; cells.forEach((s, i) => { const c = tr.insertCell(); c.textContent = s; c.style.cssText = `padding:5px 8px;border-bottom:1px solid #e5e9e5;${i ? 'text-align:right;' : ''}${head ? 'color:#58635d;font-weight:600' : ''}`; }); };
    row([`Best line on each way`, 'Time', 'Effort', 'Room for error'], true);
    for (const q of w.rows) row([q.mine ? `${q.name} (you)` : q.name, `${f1(q.seconds)} s`, q.effort === null ? '' : `${f1(q.effort)} jumps' worth`, roomText(q.roomMs)], false, q.mine);
    box.appendChild(t);
  }
  if (r.counts.length) {
    const ul = document.createElement('ul'); ul.style.cssText = 'margin:0;padding:0;list-style:none;display:grid;gap:4px;font-size:14px';
    for (const c of r.counts) {
      const li = document.createElement('li'); li.style.cssText = 'display:flex;gap:8px;align-items:center';
      const ic = document.createElementNS(NS, 'svg'); ic.setAttribute('viewBox', '0 0 32 32'); ic.setAttribute('width', '20'); ic.setAttribute('height', '20'); ic.setAttribute('fill', 'none'); ic.setAttribute('stroke', goldOld() ? '#6b4a00' : '#58635d'); ic.setAttribute('stroke-width', '2.4'); ic.setAttribute('stroke-linecap', 'round'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = ZONE_ICONS[ICON_OF[c.kind]] ?? '';
      const cost = COST_OF[c.kind];
      const text = document.createElement('span'); text.textContent = `${c.n} ${NAME_OF[c.kind][c.n === 1 ? 0 : 1].toLowerCase()}${cost ? `: ${cost}` : ''}`;
      li.append(ic, text); ul.appendChild(li);
    }
    box.appendChild(ul);
  }
  if (r.matched) tx('p', 'You took the best line the simulator found.', 'margin:0;font-size:15px;background:#e6f4ee;border-left:4px solid #0f6b5c;padding:8px 10px;border-radius:6px', box);
  if (r.saving) tx('p', r.saving, `margin:0;font-size:15px;${goldOld() ? 'background:#fff8dc;border-left:4px solid #d9a521' : 'background:#eef1ec;border-left:4px solid #58635d'};padding:8px 10px;border-radius:6px`, box);
  if (r.learned) tx('p', `What you learned: ${r.learned}`, 'margin:0;font-weight:600', box);
  if (r.saying && r.saying !== r.learned?.replace('What you learned: ', '')) tx('p', `“${r.saying}”`, 'margin:0;font-style:italic;color:#58635d', box);
  const slot = document.createElement('div'); slot.id = 'report-ghost-slot'; box.appendChild(slot); // the ghost (Chase the ghost) adds its button here
  const row = document.createElement('div'); row.id = 'report-actions'; row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;position:sticky;bottom:-16px;background:#fffffff5;padding:8px 0';
  const btn = (label: string, go: () => void, primary = false, id?: string) => {
    const b = document.createElement('button'); b.textContent = label; if (id) b.id = id;
    b.style.cssText = `font:inherit;border:1px solid ${primary ? '#0f6b5c' : '#b9c2bb'};background:${primary ? '#0f6b5c' : '#fff'};color:${primary ? '#fff' : '#17201d'};border-radius:8px;padding:7px 14px;cursor:pointer;white-space:nowrap`;
    b.onclick = go; row.appendChild(b); return b;
  };
  if (a.again) btn('Try again (R)', a.again, true, 'report-again');
  if (a.watch) btn('Watch the best line', a.watch, false, 'report-watch');
  if (a.next) btn(`Next: ${a.next.name}`, a.next.go, false, 'report-next');
  if (a.close && old) btn('Close', a.close, false, 'report-close');
  box.appendChild(row); // always there: the ghost adds its buttons to it
  return box;
}
