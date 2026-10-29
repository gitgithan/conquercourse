// CC-193: a side-view still at the tick the hands close on the first Training bar (the bot flies the ideal run on a very slow clock; the picture is taken the moment the hang begins).
// Usage: LABEL=after node scripts/grab-tick-shot.mjs   (desktop 1280 only; run on the VM; output test-results/grab-tick/<LABEL>.png)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = 'test-results/grab-tick'; mkdirSync(out, { recursive: true });
const label = process.env.LABEL ?? 'now', port = Number(process.env.PORT ?? 5893);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('crash', () => console.log('page crash')); page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200))); page.on('close', () => console.log('page closed')); b.on('disconnected', () => console.log('browser gone'));
await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&bot=ideal&startx=${process.env.STARTX ?? 117}&timescale=${process.env.TIMESCALE ?? 0.01}&welcome=0&tour=0&onboarding=0&drums=0`);
await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
await page.keyboard.press('h');
await page.mouse.move(640, 360); await page.mouse.wheel(0, Number(process.env.ZOOM ?? -900));
const t0 = Date.now(); let shot = false;
while (Date.now() - t0 < 600000) {
  const hung = await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => d.children.length === 0 && /^Push [→←] with the swing/.test(d.textContent ?? ''))).catch(() => false);
  if (hung) { await page.screenshot({ path: `${out}/${label}.png` }); shot = true; break; }
  await page.waitForTimeout(30);
}
console.log(label, shot ? 'shot' : 'no hang seen');
await b.close(); vite.kill(); process.exit(shot ? 0 : 1);
