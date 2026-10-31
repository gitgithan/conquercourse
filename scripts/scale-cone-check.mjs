// CC-96: the person for scale has a tall see-through yellow cone, so a tall piece in front cannot hide them.
// A saved world with tall walls is opened; the first visit stands the person at the start; pictures from the default camera and from a high one.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5193', out = process.env.OUT ?? 'data/eval/cc-96-scale-cone';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {}, errors = [];
const world = { pieces: [
  { src: 'obj:stairs-park-07.glb', x: 14, z: 0, y: 0, yaw: 0, scale: 2 },
  { src: 'obj:stairs-park-07.glb', x: 3.5, z: -4, y: 0, yaw: 0, scale: 6 },
  { src: 'obj:stairs-park-07.glb', x: 3.5, z: 7, y: 0, yaw: 0, scale: 6 },
], angle: 0, offset: 0, level: 0 };
const clip = { x: 0, y: 55, width: 930, height: 370 };
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  await page.addInitScript((w) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('cc.world.v1', JSON.stringify(w)); } localStorage.setItem('cc.partner.open', '0'); }, world);
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForFunction(() => document.querySelector('#personfind')?.textContent === 'Find the person', null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.mouse.click(875, 92); await page.waitForTimeout(600); // closes the buttons help that opens on a first visit
  await page.screenshot({ path: `${out}/cone-default.png`, clip });
  await page.click('#personfind'); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/cone-found.png`, clip });
  const box = await page.locator('.planwrap canvas:visible').first().boundingBox();
  await page.mouse.move(box.x + 300, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 300, box.y + 290, { steps: 8 }); await page.mouse.up();
  await page.mouse.wheel(0, 250); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/cone-high.png`, clip });
  checks['the chip still says Find the person'] = (await page.textContent('#personfind')) === 'Find the person';
  await page.click('#personhide'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/cone-hidden.png`, clip });
  checks['Hide takes the person away'] = (await page.textContent('#personfind')) === 'Show a person';
  await browser.close();
} finally { server.kill(); }
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify(checks, null, 2), '\nerrors', errors);
console.log(failed.length || errors.length ? `FAIL: ${failed.join('; ')}` : 'PASS');
process.exit(failed.length || errors.length ? 1 : 0);
