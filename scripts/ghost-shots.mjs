// CC-167: the ghost over a sky, grass and dark background (?bg=), the new look and ?ghost=old, and the bytes a look adds to a challenge link.
// Usage: PORT=5893 node scripts/ghost-shots.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/ghost'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5893);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const backs = { sky: '', grass: '&bg=4f8f33', dark: '&bg=05070a' };
for (const look of (process.env.LOOKS ?? 'new,old').split(',')) for (const [name, bg] of Object.entries(backs)) {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('console', (m) => { if (/Ghost look/.test(m.text())) console.log('console:', m.text().slice(0, 200)); }); page.on('pageerror', (e) => { if (!/popErrorScope/.test(String(e))) errs.push(String(e)); });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); localStorage.setItem('cc.ghost.mode', 'ideal'); } catch { /* shots */ } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0&ghost=${look === 'old' ? 'old' : '1'}${bg}`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 }); await page.waitForTimeout(3000);
  const chip = page.locator('#ghost-chip'); if (!/ideal|On/i.test(await chip.innerText())) await page.keyboard.press('KeyN');
  await page.waitForTimeout(1500);
  if (look === 'new') await page.waitForFunction(() => document.body.dataset.ghostLook, null, { timeout: 120000 }); // the figure loads after the page
  await page.keyboard.press('KeyH'); // hide the keys card so it does not cover the picture
  await page.keyboard.press('KeyR'); await page.waitForTimeout(300); // start again: the ghost and the runner leave together
  await page.keyboard.down('ArrowRight');
  for (const t of [1200, 1000, 1000]) { await page.waitForTimeout(t); await page.screenshot({ path: `${out}/${look}-${name}-${t === 1200 ? 'a' : t === 1000 && !globalThis.__b ? (globalThis.__b = 1, 'b') : 'c'}.png` }); }
  globalThis.__b = 0;
  console.log(look, name, errs.length ? 'ERR ' + errs[0].slice(0, 120) : 'ok'); await page.close();
}
await b.close(); vite.kill();
