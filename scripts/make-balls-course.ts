// Writes public/assets/demo/cannonballs.course.json: the First Course with the timed ball launchers and a climbable wall (CC-240), so it has a card on the Courses page.
// Run: npx tsx scripts/make-balls-course.ts, then npx tsx scripts/plans.ts public/assets/demo/cannonballs.course.json and npm run course-meta.
import { writeFileSync } from 'node:fs';
import course from '../src/course/default-course.json';
import { BALL_LAUNCHERS, cannonLaunchers, withCannonWall } from '../src/sim/shots';

const c = { ...withCannonWall(course), name: 'Cannonballs', shots: cannonLaunchers(BALL_LAUNCHERS) } as Record<string, unknown>;
delete c.plan;
writeFileSync('public/assets/demo/cannonballs.course.json', JSON.stringify(c, null, 2) + '\n');
console.log('wrote public/assets/demo/cannonballs.course.json');
