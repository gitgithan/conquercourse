// Usage: node data/eval/cc-133-bulb-to-bench/bulb-to-bench.mjs [--out dir]
// Question (CC-133): can a runner on the BULB lane (pole climb, then bars at y 4.3) DROP onto a bench and carry on along the bench lane to the join at x 26?
// The real course is used as it is (both lanes' floors and bars exist together), played with the real world step (playPlan / verifyLog from src/sim).
// For every N (bars swung) and a sweep of the release moment on bar N, it records where the runner lands, how hard, and then searches the bench jumps to the join.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

register();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { playPlan, CLEARED } = await import(resolve(root, 'src/sim/ideal.ts'));
const { recordPlan, verifyLog, encodeLog, courseHash, REPLAY_VERSION } = await import(resolve(root, 'src/sim/replay.ts'));
const { routeOfTrack, routeCourse } = await import(resolve(root, 'src/sim/branches.ts'));
const { trackFromPlan } = await import(resolve(root, 'src/sim/replay.ts'));

const args = process.argv.slice(2);
const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : resolve(root, 'data/eval/cc-133-bulb-to-bench/out'));
mkdirSync(outDir, { recursive: true });
const coursePath = resolve(root, 'public/assets/demo/fork-bench-bulb.course.json');
const course = JSON.parse(readFileSync(coursePath, 'utf8'));
const branch = course.branches[0];
const benches = course.terrain.platforms.filter((p) => p.top === 0.45);
const bulbPlan = branch.routes.find((r) => r.id === 'bulb').plan; // the proved bulb-lane line: pole climb and hang times for every bar
const benchOf = (x) => benches.findIndex((b) => x >= b.x0 - 0.05 && x <= b.x1 + 0.05) + 1; // 1-based, 0 = none
const GRAV_DROP = 4.3 - 0.45;

// the plan: climb the pole, swing bars 1..N (hang times from the bulb line, the N-th is swept), release over the bench, then hands off in the air
const planFor = (n, tN, jumpXs = [], earlier = bulbPlan.hangTicks) => ({
  jumpXs, releaseAfter: 60, bouncePress: 8, climbXs: bulbPlan.climbXs, hands: true,
  hangTicks: [...earlier.slice(0, n - 1), tN, ...Array(8).fill(0)].slice(0, 8),
  airHands: Array.from({ length: 8 }, (_, i) => i < n - 1), // true until the N-th release, then false: no regrab of the next bar
});

const firstEvent = (events, type, after = 0) => events.find((e) => e.type === type && e.tick >= after);
function describe(plan) {
  const r = playPlan(course, plan);
  const ev = r.events;
  const rel = ev.find((e) => e.type === 'hang-release' && true);
  const releases = ev.filter((e) => e.type === 'hang-release');
  const rel_n = releases[releases.length - 1];
  const land = ev.find((e) => (e.type === 'land' || e.type === 'hard-landing' || e.type === 'splash') && rel_n && e.tick > rel_n.tick);
  return { r, ev, releases, rel_n, land };
}

const rows = [];
const GRID = [];
for (let n = 1; n <= 8; n++) GRID.push(n);
for (const n of GRID) {
  for (let t = 0; t <= 320; t++) {
    const plan = planFor(n, t);
    const { r, releases, land } = describe(plan);
    if (releases.length < n || !land) continue; // the swing never reached bar N or never came down
    const rx = r.world.runner.x;
    const lx = land.detail?.x;
    rows.push({ n, t, landType: land.type, outcome: r.world.outcome, endX: +rx.toFixed(2), impact: land.detail?.impact ?? null, peakDecel: land.detail?.peakDecel ?? null, tick: land.tick });
  }
}
// only the rows where the first touchdown is on a bench: re-run to read the x at the landing tick
const landRows = [];
for (const row of rows) {
  if (row.landType === 'splash') continue;
  const plan = planFor(row.n, row.t);
  let lx = null, ly = null;
  playPlan(course, plan, undefined, (w) => { if (lx === null && w.runner.tick === row.tick) { lx = w.runner.x; ly = w.runner.y; } });
  const k = lx === null ? 0 : benchOf(lx);
  if (k > 0) landRows.push({ ...row, landX: +lx.toFixed(2), landY: +ly.toFixed(2), bench: k, dropM: +(GRAV_DROP).toFixed(2) });
}

// the jumps along the bench lane after landing: greedy, one jump at a time, best by "clears fastest, else gets farthest"
function jumpSearch(n, t) {
  const jumpXs = [];
  const score = (xs) => { const r = playPlan(course, planFor(n, t, xs)); return { s: r.world.outcome === 'cleared' ? CLEARED - r.world.runner.tick : r.maxX, r }; };
  let best = score(jumpXs);
  for (let round = 0; round < 6 && best.r.world.outcome !== 'cleared'; round++) {
    let bs = -Infinity, bx = null;
    for (let x = 12.5; x <= 26; x += 0.1) {
      const xx = +x.toFixed(2);
      if (jumpXs.length && xx <= jumpXs[jumpXs.length - 1]) continue;
      const q = score([...jumpXs, xx]);
      if (q.s > bs) { bs = q.s; bx = xx; }
    }
    if (bx === null || bs <= best.s) break;
    jumpXs.push(bx); best = score(jumpXs);
  }
  return { jumpXs, outcome: best.r.world.outcome, ticks: best.r.world.runner.tick, maxX: +best.r.maxX.toFixed(2) };
}

const results = [];
const seen = new Set();
for (const row of landRows) {
  const key = `${row.n}:${row.bench}`;
  // search the first, a middle and the last release moment that lands on this bench for this N, to keep the run short
  results.push(row);
}
const byNK = new Map();
for (const row of landRows) { const k = `${row.n}:${row.bench}`; if (!byNK.has(k)) byNK.set(k, []); byNK.get(k).push(row); }
const combos = [];
for (const [k, list] of byNK) {
  const [n, bench] = k.split(':').map(Number);
  // try every release time that lands there (they are few); keep the best result
  let best = null;
  const pick = [...new Set([0, Math.floor(list.length / 2), list.length - 1])].map((i) => list[i]); // first, middle and last release moment that land here
  for (const row of pick) {
    console.error(`jump search n=${n} bench=${bench} t=${row.t}`);
    const j = jumpSearch(n, row.t);
    const cand = { n, bench, t: row.t, landX: row.landX, landType: row.landType, impact: row.impact, peakDecel: row.peakDecel, landOutcome: row.outcome, ...j };
    if (!best || (cand.outcome === 'cleared' && (best.outcome !== 'cleared' || cand.ticks < best.ticks)) || (best.outcome !== 'cleared' && cand.outcome !== 'cleared' && cand.maxX > best.maxX)) best = cand;
  }
  combos.push({ ...best, releaseMomentsThatLandHere: list.length, tRange: [list[0].t, list[list.length - 1].t] });
}
combos.sort((a, b) => a.n - b.n || a.bench - b.bench);

// the best cleared one: record its keys, replay them on the real course with verifyLog, read the lane
let champion = null;
for (const c of combos) if (c.outcome === 'cleared' && (!champion || c.ticks < champion.ticks)) champion = c;
let championOut = null;
if (champion) {
  const plan = planFor(champion.n, champion.t, champion.jumpXs);
  const { recorder } = recordPlan(course, plan);
  const logArr = recorder.snapshot();
  const v = verifyLog(course, logArr);
  const lane = routeOfTrack(branch, v.track.xs, v.track.ys);
  let lowest = Infinity;
  for (let i = 0; i < v.track.xs.length; i++) if (v.track.xs[i] >= branch.forkX && v.track.xs[i] <= branch.joinX) lowest = Math.min(lowest, v.track.ys[i]);
  const hash = courseHash(course);
  const challenge = `${REPLAY_VERSION}.${hash}.mixed.${await encodeLog(logArr)}`;
  writeFileSync(resolve(outDir, 'mixed-route.keys.json'), JSON.stringify({ course: 'fork-bench-bulb.course.json', courseHash: hash, version: REPLAY_VERSION, n: champion.n, bench: champion.bench, plan, log: logArr, challenge }, null, 2));
  championOut = { ...champion, replayCleared: v.cleared, replayTicks: v.ticks, laneRead: lane?.id ?? null, lowestFeetY: +lowest.toFixed(2), keyRuns: logArr.length, challengeFile: 'out/mixed-route.keys.json' };
}

const run = {
  experiment: 'cc-133-bulb-to-bench', date: '2026-11-04', course: 'public/assets/demo/fork-bench-bulb.course.json',
  inputs: { bulbPlanHangTicks: bulbPlan.hangTicks, climbXs: bulbPlan.climbXs, benches, barXs: course.holds.map((h) => h.x), barY: course.holds[0].y, dropHeightM: GRAV_DROP },
  sweep: { n: '1..8', releaseTick: '0..320 on bar N, earlier bars at the proved bulb-lane hang times', rowsWithALanding: rows.length, rowsOnABench: landRows.length },
  combos, mixedRoute: championOut,
};
writeFileSync(resolve(outDir, 'run.json'), JSON.stringify(run, null, 2) + '\n');
writeFileSync(resolve(outDir, 'sweep-rows.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify({ combos, mixedRoute: championOut, sweep: run.sweep }, null, 2));
