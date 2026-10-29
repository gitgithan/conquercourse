// Usage: npx tsx scripts/training-line.ts   (after scripts/make-training-course.ts)
// The Training course's whole-course search lands on a slower line than the one that is there once the drop after the lache pair needs a roll
// (CC-161: 3486 ticks searched against 3194 by hand), so the two lines through the lache pair are searched here on the plan of the other obstacles
// and the faster one is stored: a full pump on bar 1 and a flight past bar 2 (the shortcut), with bar to bar kept as the slower route.
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { playPlan, type Plan } from '../src/sim/ideal';
import { findShortcuts } from '../src/sim/shortcuts';

const f = 'public/assets/demo/training.course.json';
const c = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
// CC-175: the lache, rope and trampoline block moved along by DX = 99 (scripts/training-layout.ts); the step vault and the climb come before it.
import { DX, GAP_EDGE, TRAMP_CUT } from './training-layout';
// CC-182: the layout (and DX) now come from scripts/training-layout.ts.
const T = TRAMP_CUT;
const JX0 = 62 + DX - 2.2; // the first bar's take-off, 2.2 m before the deck ends (searched below)
const VX = JSON.parse(process.env.VX ?? '[41.5,63.8]') as number[], CX = Number(process.env.CX ?? 100.5);
const base: Plan = { jumpXs: [GAP_EDGE - 1.5, JX0, 84.5 + DX, 126.48 + DX - T], releaseAfter: 58, bouncePress: 8, hands: true, hangTicks: [215], vaultXs: VX, climbXs: [CX] };
const catches = (r: ReturnType<typeof playPlan>) => r.events.filter((e) => e.type === 'hang-catch').length;
let both: { plan: Plan; ticks: number } | null = null, skip: { plan: Plan; ticks: number } | null = null;
for (const jx of Array.from({ length: 8 }, (_, i) => 62 + DX - 3 + i * 0.4)) for (let h1 = 0; h1 <= 300; h1 += 30) for (let h2 = 0; h2 <= 480; h2 += 30) {
  const plan: Plan = { ...base, jumpXs: [GAP_EDGE - 1.5, jx, 84.5 + DX, 126.48 + DX - T], hangTicks: [h1, h2] };
  const r = playPlan(c, plan, 120 * 70);
  if (r.world.outcome === 'cleared' && catches(r) >= 2 && (!both || r.world.runner.tick < both.ticks)) both = { plan, ticks: r.world.runner.tick };
}
for (const jx of Array.from({ length: 15 }, (_, i) => 62 + DX - 3.2 + i * 0.2)) for (let h = 0; h <= 540; h += 3) {
  const plan: Plan = { ...base, jumpXs: [GAP_EDGE - 1.5, jx, 84.5 + DX, 126.48 + DX - T], hangTicks: [h], airHands: [false] };
  const r = playPlan(c, plan, 120 * 70);
  if (r.world.outcome === 'cleared' && catches(r) === 1 && (!skip || r.world.runner.tick < skip.ticks)) skip = { plan, ticks: r.world.runner.tick };
}
if (!both || !skip) throw new Error(`a line is missing: bar to bar ${both?.ticks}, skip ${skip?.ticks}`);
const fastest = skip.ticks <= both.ticks ? skip : both;
c.plan = fastest.plan;
c.routes = [
  { name: 'bar to bar', ticks: both.ticks, bars: 2, chosen: fastest === both },
  { name: 'skip the second bar', ticks: skip.ticks, bars: 1, chosen: fastest === skip },
];
delete c.shortcuts;
const sc = findShortcuts(c, { moveChoices: false }).shortcuts;
if (sc.length) c.shortcuts = sc;
writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
console.log(JSON.stringify({ both: both.ticks, skip: skip.ticks, plan: c.plan, shortcuts: sc.map((s) => [s.id, s.secondsSaved]) }));
