// Picks the third launcher's beat so the ideal run AND a standing start at every checkpoint still clear (CC-240). Prints one line per try.
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';

const base = course as unknown as CourseData;
const idx = Number(process.argv[2] ?? 2);
for (const every of [6, 8, 10, 12]) {
  for (let phase = 0; phase < every; phase += 1.5) {
    const shots = base.shots!.map((s, i) => (i === idx ? { ...s, every, phase } : s));
    const c = { ...base, shots };
    const full = searchIdealRun(c);
    const cps = (c.checkpoints ?? []).map((cp) => searchIdealRun({ ...c, startX: cp.x }).cleared);
    console.log(`every ${every} phase ${phase}: full ${full.cleared} windows ${full.windows.length} checkpoints ${cps.map(Number).join('')}`);
    if (full.cleared && cps.every(Boolean) && full.windows.length >= 6) { console.log('GOOD', every, phase); }
  }
}
console.log('DONE');
