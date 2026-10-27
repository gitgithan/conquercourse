// Plays the lache demo with real key presses (not the bot): V at the box, Space at the edge, hold E on the bar, push the arrow the way the swing goes, let go.
// Status: vault, jump, grab, pump and the second grab all work through the real keys; the let-go timing of this script is crude (it ends in a splash), so it is a manual aid, not a pass/fail test.
// Run: npx tsx scripts/keys-check.ts  (the game runs at half of real speed so a poll every 20 ms is exact enough)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { searchIdealRun } from '../src/sim/ideal';
import type { CourseData } from '../src/course/course';

const port = process.env.PORT ?? '5410';
const SCALE = Number(process.env.SCALE ?? 0.15);
const course = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
const plan = searchIdealRun(course).plan;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&timescale=${SCALE}`);
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 60000 });
  const read = () => page.evaluate(() => ({ x: Number(document.documentElement.dataset.x), mode: document.documentElement.dataset.mode ?? '', omega: Number(document.documentElement.dataset.omega), outcome: document.documentElement.dataset.outcome ?? '', grounded: document.documentElement.dataset.grounded === '1' }));
  await page.keyboard.down('ArrowRight');
  let vaulted = false, jumped = false, grabbed = false, hangStart = 0, hangCount = 0, ended = '';
  let pumping = '';
  const t0 = Date.now();
  let lastLog = 0;
  while (Date.now() - t0 < 600000) {
    const s = await read();
    if (Date.now() - lastLog > 5000) { lastLog = Date.now(); console.log(Math.round((Date.now() - t0) / 1000), s, { vaulted, jumped, grabbed, hangCount }); }
    if (s.outcome !== 'running') { ended = s.outcome; break; }
    if (!vaulted && s.x >= (plan.vaultXs?.[0] ?? 1e9)) { await page.keyboard.press('KeyV'); vaulted = true; }
    if (!jumped && vaulted && s.mode === 'run' && s.grounded && s.x >= (plan.jumpXs[0] ?? 1e9)) { await page.keyboard.press('Space'); jumped = true; }
    if (s.mode === 'run' && jumped && !grabbed) await page.keyboard.down('KeyE'); // in the air: hold a hand on the key
    if (s.mode === 'hang') {
      if (!grabbed) { grabbed = true; hangStart = Date.now(); }
      const want = s.omega >= 0 ? 'ArrowRight' : 'ArrowLeft';
      if (want !== pumping) { if (pumping) await page.keyboard.up(pumping); await page.keyboard.down(want); pumping = want; }
      // hang time in game ticks is plan.hangTicks[k]; the game runs at 0.2 speed, so wall time = ticks / 120 / 0.2
      const wallMs = ((plan.hangTicks?.[hangCount] ?? 90) / 120 / SCALE) * 1000;
      const cue = await page.evaluate(() => document.body.textContent?.includes('LET GO NOW') ?? false); // the game's own look-ahead says when letting go works
      if ((Date.now() - hangStart > wallMs * 0.5 && cue) || Date.now() - hangStart > wallMs * 1.6) { await page.keyboard.up('KeyE'); hangCount++; grabbed = false; await page.keyboard.up(pumping); pumping = ''; await page.keyboard.down('ArrowRight'); if (hangCount < (plan.hangTicks?.length ?? 0)) { await page.waitForTimeout(150); await page.keyboard.down('KeyE'); grabbed = true; hangStart = Date.now() + 1e9; } }
    }
    if (grabbed && s.mode === 'run' && hangStart > Date.now() + 1e8) hangStart = Date.now();
    await page.waitForTimeout(20);
  }
  await page.screenshot({ path: 'test-results/lache/keys-end.png' });
  const final = await read();
  console.log({ vaulted, jumped, hangCount, outcome: ended || final.outcome, x: final.x }, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
