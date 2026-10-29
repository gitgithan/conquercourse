import { layoutToPieces, type Layout } from './photo-course';
import { NO_TURN } from './photo-proof';
import { roleCourse } from './roles';
import { searchIdealRun, playPlan, meter, workSeconds } from '../sim/ideal';
import { itemLength, type AgentReport, type Probe } from './course-agent';

// The Course Agent's tool: put a layout through the same proof the editor uses and say, in item terms, what happened.
// It runs the ideal-run search once (can it be cleared? how fast is the best line?), and when it cannot be cleared it finds where the
// best attempt stopped and tries the smallest easing of each obstacle on its own, so the model repairs with facts, not a blind retry.
const r2 = (v: number) => Math.round(v * 100) / 100;
const total = (l: Layout) => l.items.reduce((s, it) => s + itemLength(it), 0);

function run(layout: Layout) {
  const { course, length } = roleCourse(layoutToPieces(layout), NO_TURN, 'agent');
  if (length < 8) return { course, length, cleared: false, seconds: null as number | null, maxX: 0, jumps: 0 }; // under 8 m of ground is not a lane
  const found = searchIdealRun(course);
  const p = playPlan(course, found.plan);
  return { course, length, cleared: found.cleared, seconds: found.cleared ? r2(p.world.runner.tick / 120) : null, maxX: p.maxX, jumps: p.jumps };
}

// Metres from the start of the layout where the farthest point reached sits (the course's own x runs through uMap).
function layoutPosition(layout: Layout, course: ReturnType<typeof run>['course'], maxX: number): number {
  const t = total(layout);
  let best = 0, d = Infinity;
  for (const m of course.uMap ?? []) {
    const x = Math.min(m.x0 + (m.u1 - m.u0), Math.max(m.x0, maxX));
    if (Math.abs(maxX - x) < d) { d = Math.abs(maxX - x); best = m.u0 + (x - m.x0) + t / 2; }
  }
  return best;
}

// The first obstacle at or after the position: the thing the runner was facing when it stopped.
export function itemAt(layout: Layout, pos: number): number {
  let u = 0;
  for (let i = 0; i < layout.items.length; i++) {
    u += itemLength(layout.items[i]);
    if (layout.items[i].kind !== 'ground' && u > pos - 0.05) return i;
  }
  return -1;
}

function eased(layout: Layout, i: number, k: number): { layout: Layout; text: string } | null {
  const it = layout.items[i];
  const items = layout.items.map((x) => ({ ...x }));
  if (it.kind === 'block') { const h = r2(Math.max(0.1, it.height * k)); items[i] = { ...it, height: h }; return { layout: { items }, text: `item ${i + 1} (block) ${it.height} m high lowered to ${h} m` }; }
  if (it.kind === 'gap') { const w = r2(Math.max(1.2, it.width * k)); items[i] = { ...it, width: w }; return { layout: { items }, text: `item ${i + 1} (gap) ${it.width} m wide narrowed to ${w} m` }; }
  if (it.kind === 'bar' && k < 1) { const h = r2(Math.max(2, it.height * 0.9)); if (h === it.height) return null; items[i] = { ...it, height: h }; return { layout: { items }, text: `item ${i + 1} (bar) ${it.height} m up lowered to ${h} m` }; }
  return null;
}

export function testLayout(layout: Layout, opts: { probeSeconds?: number } = {}): AgentReport {
  const base = run(layout);
  const reached = r2(layoutPosition(layout, base.course, base.maxX));
  const stopped = base.cleared ? null : itemAt(layout, reached);
  const probes: Probe[] = [];
  if (!base.cleared && base.length >= 8) {
    const t0 = meter.ticks, budget = workSeconds(opts.probeSeconds ?? 20); // simulated work, so the answer does not depend on the machine's speed
    const order = layout.items.map((_, i) => i).filter((i) => layout.items[i].kind !== 'ground').sort((a, b) => Math.abs(a - (stopped ?? 0)) - Math.abs(b - (stopped ?? 0)));
    for (const i of order) {
      let failing = 1, found: { text: string; seconds: number | null; k: number } | null = null;
      for (const k of [0.75, 0.5, 0.3, 0.15]) { // the first easing that clears, then two halvings back toward the original to keep as much of the obstacle as possible
        if (meter.ticks - t0 > budget) break;
        const e = eased(layout, i, k);
        if (!e) break;
        const r = run(e.layout);
        if (r.cleared) { found = { text: e.text, seconds: r.seconds, k }; break; }
        failing = k;
      }
      for (let b = 0; found && b < 2 && meter.ticks - t0 <= budget; b++) {
        const k = (failing + found.k) / 2, e = eased(layout, i, k);
        if (!e) break;
        const r = run(e.layout);
        if (r.cleared) found = { text: e.text, seconds: r.seconds, k }; else failing = k;
      }
      if (found) probes.push({ item: i, text: found.text, clears: true, seconds: found.seconds });
    }
  }
  return { cleared: base.cleared, seconds: base.seconds, jumps: base.jumps, stoppedAtItem: stopped, reachedMetres: reached, laneMetres: r2(base.length), probes };
}
