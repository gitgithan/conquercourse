// Records the real editor screen (CC-209): the hero course, "Edit this course", the editor opening on its pieces, at 1280 x 720.
// Playwright records in real time; the marks file says when each step happened so waits can be cut (scripts/film-ui-cut.sh).
// Usage: PORT=5291 node scripts/film-editor.mjs [out.mp4]       (run on a VM; one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const port = process.env.PORT ?? '5291', out = process.argv[2] ?? 'films/ui-editor.mp4';
const work = `${out}.frames`; rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const marks = []; const log = (m) => console.log(new Date().toISOString().slice(11, 19), m);
let t0 = 0;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage(); t0 = Date.now();
  page.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 160)));
  const mark = (n) => { marks.push([n, (Date.now() - t0) / 1000]); log(n); };
  await page.goto(`http://localhost:${port}/?course=/assets/demo/hero-montmartre-paris.course.json&photos=0`);
  await page.waitForSelector('#editcourse', { timeout: 120000 });
  mark('course shown'); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}.1-course.png` });
  await page.click('#editcourse'); mark('edit clicked');
  await page.waitForSelector('#view3d', { timeout: 120000 }); mark('editor open');
  await page.waitForTimeout(2500);
  await page.mouse.click(945, 92).catch(() => log('no help to hide')); mark('help hidden');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Fit', exact: true }).click().catch(() => log('no Fit')); mark('fit');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}.2-editor.png` });
  await page.getByRole('button', { name: 'Top plan' }).click({ trial: false }).catch(() => log('no Top plan')); mark('top plan');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}.3-plan.png` });
  mark('end');
  await page.close(); await ctx.close(); await browser.close();
} catch (e) { log('threw ' + String(e).slice(0, 300)); }
server.kill();
writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 2) + '\n');
console.log('video in', work, 'marks', JSON.stringify(marks));
