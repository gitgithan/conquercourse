// CC-246 browser check: after "Play this lane" in the World Editor, the World Editor tab cuts the run short and brings the editor back with its pieces.
//   PORT=5936 node scripts/editor-return-check.mjs   (screenshot in test-results/editor-return/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = Number(process.env.PORT ?? 5936), out = 'test-results/editor-return';
mkdirSync(out, { recursive: true });
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 12000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); localStorage.setItem('cc.music', '0'); } catch {} });
let code = 0;
const ok = (n, p, note = '') => { console.log(p ? 'PASS' : 'FAIL', n, note); if (!p) code = 1; };
await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`, { waitUntil: 'load' });
await page.waitForSelector('.ed #play', { timeout: 60000 });
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cc.world.v1') ?? 'null')?.pieces?.length ?? -1);
await page.click('#play');
await page.waitForFunction(() => !document.querySelector('.ed'), null, { timeout: 150000 });
ok('Play this lane hides the editor and runs the course', true);
await page.waitForTimeout(3000);
await page.click('#sitenav [data-feature="editor"]', { timeout: 120000 });
await page.waitForSelector('.ed #play', { timeout: 60000 });
ok('the World Editor tab brings the editor back', true);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('cc.world.v1') ?? 'null')?.pieces?.length ?? -1);
ok('the pieces are still there', after === before && after > 0, `${before} -> ${after}`);
await page.screenshot({ path: `${out}/back-in-editor.png` });
await b.close(); vite.kill();
process.exit(code);
