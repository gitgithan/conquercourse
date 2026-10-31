// CC-242 picture: a link from checkpoint 2, opened with ?autoplay=1, so the player's keys and the friend's ghost start together and overlap.
// Run: PORT=5199 npx tsx scripts/partial-shot.ts  (needs the dev server on that port and Playwright)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { recordPlan } from '../src/sim/replay';
import { makeChallengeUrl } from '../src/share/challenge';

const c = course as unknown as CourseData, cp = c.checkpoints![1].x, port = process.env.PORT ?? '5199';
const from = { ...c, startX: cp } as CourseData;
const log = recordPlan(from, searchIdealRun(from).plan).recorder.snapshot();
const url = (await makeChallengeUrl(`http://localhost:${port}`, '', c, log, 'ann', 'a', 'done', 2))!;
mkdirSync('test-results/partial', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.goto(url + '&autoplay=1&welcome=0&tour=0&nav=0');
await p.waitForSelector('html[data-ready=true]', { state: 'attached', timeout: 90000 });
for (let i = 0; i < 6; i++) { await p.waitForTimeout(1200); await p.screenshot({ path: `test-results/partial/t${i}.png` }); }
console.log(await p.evaluate(() => document.getElementById('challenge-banner')?.textContent ?? 'no banner'));
await b.close();
