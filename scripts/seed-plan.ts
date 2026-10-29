// Usage: npx tsx scripts/seed-plan.ts <course.json> <log.json> [<log.json> ...] [--write]
// Reads verified key logs (an InputLog as JSON: [[mask, ticks], ...]), makes a plan from each, polishes it, and compares with the plan stored in the course (CC-176).
// With --write the faster plan is stored in the course file (then run `npm run course-meta`); a seed that beats the stored plan is reported as a finding, never as an error.
// To keep a log for later plans.ts runs, put it in data/seeds/<course name>/<anything>.json.
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import type { InputLog } from '../src/sim/replay';
import { verifyLog } from '../src/sim/replay';
import { chooseWithSeeds } from '../src/sim/seed-plan';

const args = process.argv.slice(2);
const write = args.includes('--write');
const [courseFile, ...logFiles] = args.filter((a) => a !== '--write');
if (!courseFile || !logFiles.length) { console.error('usage: seed-plan.ts <course.json> <log.json>... [--write]'); process.exit(2); }
const course = JSON.parse(readFileSync(courseFile, 'utf8')) as CourseData;
const logs = logFiles.map((f) => JSON.parse(readFileSync(f, 'utf8')) as InputLog);
logs.forEach((l, i) => { const v = verifyLog(course, l); console.log(`${logFiles[i]}: ${v.cleared ? 'cleared' : 'NOT cleared'} in ${v.ticks} ticks as played`); });
const pick = chooseWithSeeds(course, course.plan ?? null, logs);
if (!pick) { console.log('nothing cleared: no plan'); process.exit(1); }
console.log(`stored plan ${pick.searchTicks} ticks, seeds ${pick.seedTicks.join('/')}: keeping the ${pick.from} (${pick.ticks} ticks)`);
if (pick.from === 'seed' && write) { course.plan = pick.plan; writeFileSync(courseFile, JSON.stringify(course, null, 2) + '\n'); console.log('written; run npm run course-meta'); }
