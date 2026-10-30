// CC-108: the board with a podium, shown from a made-up answer (no server needed). One screenshot at 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5301', out = process.argv[2] ?? 'test-results/podium';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  const top = [['Ninja_Amy', 3120], ['SpeedyPanda', 3300], ['Bo', 3345], ['Cloud-Runner', 3500], ['K9', 3610]].map(([nick, ticks]) => ({ nick, ticks }));
  await page.route('**/api/leaderboard**', (r) => r.fulfill({ json: { top, players: 12, mine: { rank: 4, ticks: 3500 }, resetAt: Date.now() + 5 * 3600e3, previous: { nick: 'Ninja_Amy', ticks: 3150 } } }));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&welcome=0`);
  await page.waitForSelector('#board-corner .board-row', { timeout: 90000 });
  await page.waitForTimeout(1500);
  console.log(JSON.stringify(await page.evaluate(() => { const b = document.querySelector('#board-corner').getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })), JSON.stringify(errors));
  await page.screenshot({ path: `${out}/podium.png` });
  await browser.close();
} finally { server.kill(); }
