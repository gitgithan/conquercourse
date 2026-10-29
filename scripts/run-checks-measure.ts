// Measures every stored plan (public/ and data/) against the run checks: ticks, average speed, key changes per second (CC-174). Run: npx tsx scripts/run-checks-measure.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CourseData } from '../src/course/course';
import { recordPlan } from '../src/sim/replay';

export function courseFiles(root: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(root)) {
    const p = join(root, f), s = statSync(p);
    if (s.isDirectory()) out.push(...courseFiles(p));
    else if (f.endsWith('.json')) out.push(p);
  }
  return out;
}
export function loadWithPlan(p: string): CourseData | null {
  try {
    const c = JSON.parse(readFileSync(p, 'utf8')) as CourseData;
    return c && typeof c === 'object' && (c as { plan?: unknown }).plan && typeof c.finishX === 'number' && typeof c.startX === 'number' ? c : null;
  } catch { return null; }
}
if (process.argv[1]?.endsWith('run-checks-measure.ts')) {
  const rows = [...courseFiles("public/assets"), ...courseFiles("data")].flatMap((p): Record<string, unknown>[] => {
    const c = loadWithPlan(p);
    if (!c) return [];
    const { recorder, world } = recordPlan(c, c.plan!, 120 * 180);
    if (world.outcome !== 'cleared' || !recorder.valid) return [{ p, skipped: world.outcome + (recorder.valid ? '' : ' (not plain keys)') }];
    const log = recorder.snapshot(), ticks = recorder.ticks;
    let peak = 0; const at: number[] = []; let t = 0;
    for (let i = 1; i < log.length; i++) { t += log[i - 1][1]; at.push(t); }
    for (let i = 0, j = 0; i < at.length; i++) { while (at[i] - at[j] >= 120) j++; peak = Math.max(peak, i - j + 1); }
    return [{ p, ticks, speed: +((c.finishX - c.startX) / (ticks / 120)).toFixed(2), changesPerS: +((log.length - 1) / (ticks / 120)).toFixed(2), peak1s: peak }];
  });
  for (const r of rows) console.log(JSON.stringify(r));
}
