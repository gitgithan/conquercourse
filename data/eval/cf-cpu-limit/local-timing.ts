// Laptop baseline: the same replay as the test function, timed in node (CC-169).
import { readFileSync } from 'node:fs';
import { decodeLog, verifyLog } from '../../../src/sim/replay';
import type { CourseData } from '../../../src/course/course';
const logs = JSON.parse(readFileSync(new URL('./inputs/logs.json', import.meta.url), 'utf8')) as { key: string; keys: string }[];
for (const [key, idle] of [['demo/training', 0], ['demo/generated-1', 0], ['demo/training', 1200], ['demo/training', 14400]] as const) {
  const l = logs.find((x) => x.key === key)!;
  const course = JSON.parse(readFileSync(`public/assets/${key}.course.json`, 'utf8')) as CourseData;
  const log = await decodeLog(l.keys); if (idle) log.unshift([0, idle]);
  verifyLog(course, log, 14400); // warm up
  const ms: number[] = [];
  for (let i = 0; i < 9; i++) { const t = performance.now(); const v = verifyLog(course, log, 14400); ms.push(performance.now() - t); if (i === 0) console.log(key, 'idle', idle, 'ticks', v.ticks, 'cleared', v.cleared); }
  ms.sort((a, b) => a - b);
  console.log('  median ms', ms[4].toFixed(2), 'min', ms[0].toFixed(2), 'us/tick', (ms[4] * 1000 / 3233).toFixed(2));
}
