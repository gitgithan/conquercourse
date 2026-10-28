// Shift+I on every demo course (one ideal run through every obstacle must clear it), that any key takes the run back,
// and each floor (water, lava, mud, spikes, dark drop): the fall words, the fall sound and a screenshot of the floor.
// Usage: node scripts/ideal-all-check.mjs   (PORT, SECONDS per course, ONLY=lache to try one course)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const secs = Number(process.env.SECONDS ?? 90);
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const courses = ['/assets/demo/lache.course.json', '/assets/demo/climb.course.json', '/assets/demo/plank.course.json', '/assets/demo/lache-wide.course.json', '/assets/demo/recoil.course.json', '/assets/demo/cannon.course.json', '/assets/demo/lane-1.course.json', '/assets/demo/lane-2.course.json', '/assets/demo/generated-1.course.json', '/assets/experiments/osm/eixample-barcelona.course.json', '/assets/experiments/osm/montmartre-paris.course.json', '/assets/experiments/osm/circular-quay-sydney.course.json', '/assets/experiments/osm/san-francisco-lombard.course.json']
  .filter((c) => !process.env.ONLY || c.includes(process.env.ONLY));
const floors = { water: [/fell in the water/, 'splash'], lava: [/touched the lava/, 'sizzle'], mud: [/sank in the mud/, 'squelch'], spikes: [/landed on the spikes/, 'clang'], void: [/fell into the dark/, 'plunge'] };
const out = { shiftI: {}, anyKeyStops: null, floors: {} };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  mkdirSync('test-results/ideal-all', { recursive: true });
  const outcome = () => page.evaluate(() => document.documentElement.dataset.outcome);
  const startPage = async (q) => { await page.goto(`http://localhost:${port}/?${q}`); await page.waitForSelector('#wholeideal', { timeout: 60000 }); await page.waitForTimeout(500); await page.keyboard.press('Space').catch(() => {}); };

  for (const c of courses) {
    const name = c.split('/').pop().replace('.course.json', '');
    await startPage(`course=${c}&timescale=3`);
    await page.keyboard.press('Shift+KeyI');
    let o = 'running', sawText = false;
    for (let i = 0; i < secs && o !== 'cleared' && o !== 'splash'; i++) { await page.waitForTimeout(1000); o = await outcome(); sawText ||= /through every obstacle/.test(await page.textContent('body')); }
    out.shiftI[name] = { outcome: o, noHandBack: sawText };
    await page.screenshot({ path: `test-results/ideal-all/${name}.png` });
    console.log(name, out.shiftI[name]);
  }

  // any key takes the run back: the runner stops running by itself
  await startPage('course=/assets/demo/lache.course.json');
  await page.keyboard.press('Shift+KeyI');
  await page.waitForTimeout(2500);
  const x1 = Number(await page.evaluate(() => document.documentElement.dataset.x));
  await page.keyboard.press('ArrowLeft'); await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(700);
  const yourTurn = /Your turn/.test(await page.textContent('body'));
  await page.waitForTimeout(2500);
  const x2 = Number(await page.evaluate(() => document.documentElement.dataset.x));
  await page.waitForTimeout(2500);
  const x3 = Number(await page.evaluate(() => document.documentElement.dataset.x));
  out.anyKeyStops = { x1, x2, x3, yourTurn, stoodStill: Math.abs(x3 - x2) < 0.05, notCleared: (await outcome()) === 'running' };
  console.log('anyKeyStops', out.anyKeyStops);

  // the floors: walk off the deck into the first gap of the lache demo
  for (const [h, [words, sound]] of Object.entries(floors)) {
    await startPage(`course=/assets/demo/lache.course.json&hazard=${h}&startx=31&timescale=3`);
    await page.keyboard.down('ArrowRight');
    let o = 'running';
    for (let i = 0; i < 40 && o !== 'splash'; i++) { await page.waitForTimeout(500); o = await outcome(); }
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(600);
    const body = await page.textContent('body');
    const sounds = await page.evaluate(() => document.documentElement.dataset.sounds ?? '');
    out.floors[h] = { fell: o === 'splash', words: words.test(body), sound: sounds.split(',').includes(sound) };
    await page.screenshot({ path: `test-results/ideal-all/floor-${h}.png` });
    console.log(h, out.floors[h]);
  }
  console.log(JSON.stringify(out), 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
