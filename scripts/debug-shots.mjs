// Usage: node scripts/debug-shots.mjs <phase>  (before|after): B on, several courses, two window sizes, screenshots into data/eval/cc-98-debug-panel/
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const phase = process.argv[2] ?? 'after', port = 5893;
const dir = 'data/eval/cc-98-debug-panel'; mkdirSync(dir, { recursive: true });
const v = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 7000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const courses = { stock: '', lache: '/assets/demo/lache.course.json', climb: '/assets/demo/climb.course.json', cannon: '/assets/demo/cannon.course.json', band: '/assets/demo/band.course.json', coaster: '/assets/demo/coaster.course.json', drone: '/assets/demo/drone.course.json' };
for (const [name, path] of Object.entries(courses)) for (const [w, h] of [[1280, 720], [1024, 640]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://localhost:${port}/?${path ? `course=${path}&` : ''}welcome=0&debug=1`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  if (name === 'lache' || name === 'climb') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowRight'); }
  await page.screenshot({ path: `${dir}/${phase}-${name}-${w}.png` });
  await page.close();
}
await b.close(); v.kill(); console.log('shots done');
