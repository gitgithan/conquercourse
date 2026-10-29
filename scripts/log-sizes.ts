// Prints how many bytes the key log of each stored best line takes (CC-218): run-length pairs, deflated, as the base64url text a link carries.
import { readdirSync, readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { encodeLog, recordPlan } from '../src/sim/replay';

const dir = 'public/assets/demo';
for (const f of readdirSync(dir).filter((x) => x.endsWith('.course.json')).sort()) {
  const course = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as CourseData;
  if (!course.plan) continue;
  const { recorder } = recordPlan(course, course.plan, 120 * 120);
  if (!recorder.valid) continue;
  const log = recorder.snapshot(), text = await encodeLog(log);
  console.log(`${f}\tpairs=${log.length}\tticks=${log.reduce((s, [, n]) => s + n, 0)}\tchars=${text.length}`);
}
