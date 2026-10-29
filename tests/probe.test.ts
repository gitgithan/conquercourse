import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { recordPlan } from '../src/sim/replay';
import { makeChallengeUrl } from '../src/share/challenge';
it('p', async () => {
  const course = JSON.parse(readFileSync('public/assets/demo/bench-and-stairs.course.json', 'utf8'));
  const done = recordPlan(course, course.plan!, 7200).recorder.snapshot();
  const S = '?course=/assets/demo/bench-and-stairs.course.json';
  const a = await makeChallengeUrl('http://x', S, course, done), b = await makeChallengeUrl('http://x', S, course, [[1, 3000]], '', 'a', 'fell');
  writeFileSync('/root/links.json', JSON.stringify({ done: a!.slice(8), fell: b!.slice(8) }));
});
