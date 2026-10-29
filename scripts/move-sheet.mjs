// One move (vault or climb) stage by stage on any course, for before/after contact sheets (CC-144).
// The bot runs the ideal line with the game clock slowed (the software renderer takes seconds per frame); a picture is taken as the move reaches each stage.
// Env: COURSE (url path), MOVE (vault|climb), STARTX, EXTRA (more query, e.g. "&clips=0"), LABEL, STAGES, VIEW (side|front), PORT, W, H, ZOOM.
// Output: test-results/move-sheet/<LABEL>/fNN-pP.png; with ffmpeg on the path, also <LABEL>.jpg (a contact sheet).
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const env = process.env;
const port = env.PORT ?? '5173', move = env.MOVE ?? 'vault', label = env.LABEL ?? 'now';
const W = Number(env.W ?? 960), H = Number(env.H ?? 540);
const stages = (env.STAGES ?? '0.02,0.15,0.3,0.45,0.58,0.68,0.78,0.88,0.97').split(',').map(Number);
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist', '--no-sandbox'];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const dir = `test-results/move-sheet/${label}`;
  mkdirSync(dir, { recursive: true });
  await page.goto(`http://localhost:${port}/?course=${env.COURSE}&bot=ideal&startx=${env.STARTX}&timescale=${env.TIMESCALE ?? 0.01}&welcome=0&onboarding=0&music=0${env.EXTRA ?? ''}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.keyboard.press('h'); // the controls card away
  await page.keyboard.press('g'); // the drum strip away
  for (let i = 0; i < Number(env.CAMS ?? 0); i++) await page.keyboard.press('c');
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.wheel(0, Number(env.ZOOM ?? -500)); // zoom in on the runner
  let next = 0, last = '';
  const t0 = Date.now();
  while (next < stages.length && Date.now() - t0 < 1500000) {
    const v = await page.evaluate((m) => document.documentElement.dataset[m], move);
    if (v !== '' && v !== undefined) {
      last = v;
      if (Number(v) >= stages[next]) { await page.screenshot({ path: `${dir}/f${String(next).padStart(2, '0')}-p${stages[next]}.png` }); console.log('shot', next, 'at', v); next++; continue; }
    } else if (last !== '' && Number(last) > 0.9) break; // the move is over
    await page.waitForTimeout(40);
  }
  console.log({ shots: next, of: stages.length }, 'errors:', errors);
  await browser.close();
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', `${dir}/f*.png`, '-vf', `scale=480:-1,tile=${Math.min(stages.length, 5)}x${Math.ceil(stages.length / 5)}`, '-frames:v', '1', `test-results/move-sheet/${label}.jpg`]);
  } catch { console.log('no contact sheet (ffmpeg missing)'); }
} finally { server.kill(); }
