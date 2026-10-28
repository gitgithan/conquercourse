// Usage: npx tsx scripts/coaster-demos.ts   (writes public/assets/demo/coaster*.course.json with the whole-course proof)
// Run again whenever src/sim changes: a stored plan that no longer clears fails tests/demo-coaster.test.ts.
import { writeFileSync } from 'node:fs';
import { COASTER_DEMOS, coasterCourse } from '../src/slice/coaster';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

for (const [id, d] of Object.entries(COASTER_DEMOS)) {
  const c = coasterCourse(d.name, d.pts, d.push);
  const s = searchIdealRun(c);
  const out = s.cleared ? { ...c, plan: s.plan } : c; // courses that cannot be cleared carry no plan
  const r = playPlan(c, s.plan);
  console.log(id, 'cleared by the search:', s.cleared, 'plan run:', r.world.outcome, JSON.stringify(s.plan.cartBrake));
  writeFileSync(`public/assets/demo/${id}.course.json`, JSON.stringify(out, null, 2) + '\n');
}
