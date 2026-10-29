// CC-168: the bright rim on the ledge the hands would catch (Training course, at the foot of the 2 m wall), with and without ?grabhint=0.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/grab-hint'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5891);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const [name, extra] of [['on', ''], ['off', '&grabhint=0']]) {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0&startx=111.2&timescale=0.02${extra}`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.keyboard.down('KeyE'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/rim-${name}.png` }); await page.close();
}
await b.close(); vite.kill(); console.log('done');
