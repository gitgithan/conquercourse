// Before/after pictures of the hero lane backdrop (CC-234): node scripts/backdrop-shots.mjs [slug]  -> data/eval/cc-spectacle/backdrop/<slug>-<view>-<off|on>.png
// The same frames are taken with and without ?furniture=1: the clock is stepped (no wall time), the ideal-run bot drives, and a shot is taken at fixed game ticks.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ['montmartre-paris'];
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const report = { runs: [] };
mkdirSync((process.env.OUT ?? 'data/eval/cc-spectacle/backdrop'), { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const slug of slugs) for (const on of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 200)); });
    await page.addInitScript(stepped);
    await page.goto(`http://localhost:${port}/?course=/assets/demo/hero-${slug}.course.json&photos=0${process.env.EXTRA ?? ''}${on ? `&backdrop=${slug}` : ''}`);
    await page.waitForSelector('html[data-ready=true]', { timeout: 400000 });
    const step = (n) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) { window.__stepClock(1000 / 60); await new Promise((r) => requestAnimationFrame(r)); } }, n);
    await step(30);
    if (on) await page.waitForFunction(() => document.documentElement.dataset.backdrop !== undefined, null, { timeout: 30000 }).catch(() => {});
    const placed = await page.evaluate(() => document.documentElement.dataset.backdrop ?? null);
    const credit = await page.evaluate(() => document.getElementById('furniture-credit')?.textContent ?? null);
    for (const view of ['side', 'angle']) {
      if (view === 'angle') await page.keyboard.press('KeyC');
      await step(20);
      await page.screenshot({ path: `${process.env.OUT ?? 'data/eval/cc-spectacle/backdrop'}/${slug}-${view}-${on ? 'on' : 'off'}.png` });
    }
    report.runs.push({ slug, furniture: on, placed, credit, errors });
    console.log(slug, on ? 'on' : 'off', 'placed', placed, 'errors', errors.length);
    await page.close();
  }
  await browser.close();
  writeFileSync(`${process.env.OUT ?? 'data/eval/cc-spectacle/backdrop'}/shots.json`, JSON.stringify(report, null, 2) + '\n');
} finally { server.kill(); }
