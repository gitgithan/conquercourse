// Plank bridge (CC-115): a thick plank, then a thin one held by a post. Both bend; the thin one would break without the post.
// Run: npx tsx scripts/make-plank-two.ts   (writes public/assets/demo/plank-two.course.json with the whole-course proof)
import { writeFileSync } from 'node:fs';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import type { CourseData } from '../src/course/course';

const course = {
  version: 1, name: 'Plank bridge: thick, then thin', startX: 0, finishX: 62, jumpSpeed: 4.5,
  terrain: { waterY: -3, platforms: [{ x0: -10, x1: 14, top: 0 }, { x0: 23, x1: 34, top: 0 }, { x0: 43, x1: 80, top: 0 }] },
  planks: [
    { x0: 14, x1: 23, y: 0, thickness: 0.035, width: 0.6, material: 'wood' },
    { x0: 34, x1: 43, y: 0, thickness: 0.02, width: 0.6, material: 'wood', support: true },
  ],
  zones: [{ id: 'plank', name: 'Thick plank', x0: 12, x1: 25 }, { id: 'plank', name: 'Thin plank with a post', x0: 32, x1: 45 }],
  checkpoints: [{ id: 'plank', x: 8 }, { id: 'plank', x: 28 }],
} as unknown as CourseData;
const s = searchIdealRun(course);
console.log('cleared', s.cleared, JSON.stringify(s.plan));
if (!s.cleared) process.exit(1);
const noPost = JSON.parse(JSON.stringify(course)); delete noPost.planks[1].support;
console.log('without the post:', playPlan(noPost, s.plan).world.outcome);
writeFileSync('public/assets/demo/plank-two.course.json', JSON.stringify({ ...course, plan: s.plan }, null, 2) + '\n');
