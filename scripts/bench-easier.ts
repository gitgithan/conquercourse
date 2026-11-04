// npx tsx scripts/bench-easier.ts [summary.json]
// Same eight ordered course edits, two worker slots, three repeats. No paid model calls.
import { buildSync } from 'esbuild';
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { searchIdealRun, playPlan, meter, type SearchResult } from '../src/sim/ideal';
import { nodePool } from '../src/sim/ideal-pool-node';
import type { CourseData } from '../src/course/course';
import { prefixTrials } from './easier-prefix';

const hash = (o: unknown) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const answer = (r: SearchResult) => hash({ cleared: r.cleared, plan: r.plan, windows: r.windows });
const median = (ns: number[]) => [...ns].sort((a, b) => a - b)[1];
const file = join(tmpdir(), `cc-candidate-${process.pid}.mjs`);
buildSync({ stdin: { contents: `import {parentPort} from 'node:worker_threads'; import {searchIdealRun} from ${JSON.stringify(fileURLToPath(new URL('../src/sim/ideal.ts', import.meta.url)))}; parentPort.on('message', c=>parentPort.postMessage(searchIdealRun(c)));`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: file });
function candidates(size = 2) {
  const ws = Array.from({ length: size }, () => new Worker(file));
  return { async run(cs: CourseData[]) {
    const out = new Array<SearchResult>(cs.length); let next = 0;
    await Promise.all(ws.map(async (w) => {
      while (next < cs.length) {
        const i = next++;
        out[i] = await new Promise((resolve, reject) => { w.once('message', resolve); w.once('error', reject); w.postMessage(cs[i]); });
      }
    })); return out;
  }, close: () => ws.forEach((w) => void w.terminate()) };
}
const result: Record<string, unknown> = { date: '2026-11-04', cpu: cpus()[0]?.model, logicalCpus: cpus().length, node: process.version, workers: 2, repeats: 3, candidates: 8, includesStartup: true, inputs: {}, courses: {}, prefix: {} };
for (const name of ['lane-2', 'lache', 'bars']) {
  const base = JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, 'utf8')) as CourseData;
  delete base.plan; delete base.windows;
  const cs = Array.from({ length: 8 }, (_, i) => ({ ...base, terrain: { ...base.terrain, platforms: base.terrain.platforms.map((p, k) => k === base.terrain.platforms.length - 1 ? { ...p, x0: p.x0 - (i + 1) * .05 } : p) } }));
  (result.inputs as Record<string, unknown>)[name] = { courseHash: hash(base), editedPlatform: base.terrain.platforms.length - 1, x0Offsets: cs.map((_, i) => -(i + 1) * .05) };
  const timings: Record<string, number[]> = { serial: [], singleWorker: [], candidateWorkers: [], timingTrialPool: [] };
  const answers: Record<string, string[]> = {};
  // Rotate method order between repeats to reduce order/warm-up bias.
  const methods = Object.keys(timings);
  for (let repeat = 0; repeat < 3; repeat++) for (let m = 0; m < methods.length; m++) {
    const method = methods[(repeat + m) % methods.length], t0 = performance.now(); let rs: SearchResult[];
    if (method === 'serial') rs = cs.map((c) => searchIdealRun(c));
    else if (method === 'candidateWorkers' || method === 'singleWorker') { const pool = candidates(method === 'singleWorker' ? 1 : 2); try { rs = await pool.run(cs); } finally { pool.close(); } }
    else { const pool = nodePool(2); try { rs = []; for (const c of cs) rs.push(await pool.search(c)); } finally { pool.close(); } }
    timings[method].push(Math.round(performance.now() - t0));
    const hs = rs.map(answer); if (answers[method] && JSON.stringify(answers[method]) !== JSON.stringify(hs)) throw new Error('Unstable answers'); answers[method] = hs;
    console.log(name, repeat + 1, method, timings[method].at(-1), 'ms');
  }
  const sameAnswers = Object.values(answers).every((a) => JSON.stringify(a) === JSON.stringify(answers.serial));
  if (!sameAnswers) throw new Error('Pool mismatch');
  (result.courses as Record<string, unknown>)[name] = { timings, medianMs: Object.fromEntries(Object.entries(timings).map(([k, ns]) => [k, median(ns)])), sameAnswers, answerHashes: answers.serial };
  const proof = searchIdealRun(base), j = proof.plan.jumpXs.length - 1;
  if (j < 0) continue;
  const plans = Array.from({ length: 41 }, (_, i) => ({ ...proof.plan, jumpXs: proof.plan.jumpXs.map((x, k) => k === j ? x + (i - 20) * .02 : x) }));
  const fullMs: number[] = [], prefixMs: number[] = []; let fullTicks = 0, reusedTicks = 0, sharedTicks = 0;
  for (let r = 0; r < 3; r++) {
    let t = performance.now(), oldTicks = meter.ticks;
    const full = plans.map((p) => playPlan(base, p)); fullMs.push(performance.now() - t); fullTicks = meter.ticks - oldTicks;
    t = performance.now(); const reuse = prefixTrials(base, plans); prefixMs.push(performance.now() - t);
    if (hash(full) !== hash(reuse.runs)) throw new Error('Prefix full-state mismatch');
    reusedTicks = reuse.ticks; sharedTicks = reuse.sharedTicks;
  }
  (result.prefix as Record<string, unknown>)[name] = { variants: plans.length, fullMs: fullMs.map(Math.round), prefixMs: prefixMs.map(Math.round), fullMedianMs: Math.round(median(fullMs)), prefixMedianMs: Math.round(median(prefixMs)), fullTicks, reusedTicks, sharedTicks, exactFullRunMatch: true };
}
writeFileSync(process.argv[2] ?? 'easier-scores.json', JSON.stringify(result, null, 2) + '\n');
