// CC-180 / CC-181: the ghost and the player on exactly the same line (a link's own keys played by hand), a friend's try that fell, and the fall panel with its link button.
// Usage: PORT=5894 node scripts/ghost-overlap-shots.mjs <links.json> [outdir]   (links.json: {done, fell}, the part of each link after the address)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const links = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] ?? 'data/eval/ghost-overlap'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5894);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
async function open(url, name, shots) {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => { if (!/popErrorScope/.test(String(e))) errs.push(String(e)); });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); localStorage.setItem('cc.worldWelcome.seen', '1'); } catch { /* shots */ } });
  await page.goto(`http://localhost:${port}${url}&welcome=0&tour=0`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 }); await page.waitForFunction(() => document.body.dataset.ghostLook, null, { timeout: 150000 }).catch(() => console.log('ghost figure not loaded')); // the figure loads after the page
  await page.keyboard.press('KeyH');
  for (const [i, t] of shots.entries()) { await page.waitForTimeout(t); await page.screenshot({ path: `${out}/${name}-${i + 1}.png` }); }
  console.log(name, errs.length ? 'ERR ' + errs[0].slice(0, 150) : 'ok', (await page.textContent('#ghost-chip').catch(() => '')) ?? '', (await page.textContent('#challenge-banner').catch(() => '')) ?? '');
  return page;
}
const p1 = await open(links.done + '&autoplay=1', 'overlap', [1500, 1500, 1500]); await p1.close();
const p2 = await open(links.fell + '&autoplay=1', 'friend-fell', [1000, 2500, 2500]); await p2.close();
// the fall panel: run right off the first edge
const p3 = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p3.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); localStorage.setItem('cc.worldWelcome.seen', '1'); } catch { /* shots */ } });
await p3.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0`);
await p3.waitForSelector('#keys', { state: 'attached', timeout: 120000 }); await p3.waitForTimeout(4000);
await p3.keyboard.press('KeyR'); await p3.keyboard.down('ArrowRight');
await p3.waitForSelector('#share-copy-fall', { timeout: 60000 }).catch(() => {});
await p3.screenshot({ path: `${out}/fall-panel.png` });
console.log('fall button', await p3.locator('#share-copy-fall').count());
await b.close(); vite.kill();
