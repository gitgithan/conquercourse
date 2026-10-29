// Screenshots for CC-148: the character gauges, new place and old (?gauges=old), on the Course, Drone, Cannon and a phone-width view.
// Usage: node scripts/gauge-shots.mjs   (writes test-results/gauges/*.png)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const course = (n) => `/assets/demo/${n}.course.json`;
const shots = [
  ['course-new', '/?', 1280, 720], ['course-old', '/?gauges=old&', 1280, 720],
  ['drone-new', `/?course=${course('drone')}&`, 1280, 720], ['drone-old', `/?gauges=old&course=${course('drone')}&`, 1280, 720],
  ['cannon-new', `/?course=${course('cannon')}&`, 1280, 720],
  ['phone-new', '/?touch=1&', 390, 760], ['phone-drone', `/?touch=1&course=${course('drone')}&`, 390, 760],
];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/gauges', { recursive: true });
  const errors = [];
  for (const [name, path, width, height] of shots) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
    await page.goto(`http://localhost:${port}${path}welcome=0&ghost=1`);
    await page.waitForSelector('#gtext', { state: 'attached', timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500);
    await page.keyboard.press('KeyG');
    const read = await page.evaluate(() => ({ speed: document.querySelector('#gtext')?.textContent, battery: document.querySelector('#gtextbattery')?.textContent, box: document.querySelector('#gauge-stack')?.getBoundingClientRect().toJSON() }));
    console.log(name, JSON.stringify(read));
    await page.screenshot({ path: `test-results/gauges/${name}.png` });
    await page.close();
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
