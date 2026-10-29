// CC-99 browser check: the ghost beside the bot (level with it on the ideal line) and beside a player who runs without jumping (the gap grows), on three courses, no overlap with HUD cards.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = Number(process.env.PORT ?? 5921), out = process.env.OUT ?? 'data/eval/cc-99-ghost';
mkdirSync(out, { recursive: true });
const v = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (name, pass, note = '') => { results.push({ name, pass, note }); console.log(pass ? 'PASS' : 'FAIL', name, note); };
const rect = (r) => ({ l: r.x, t: r.y, r: r.x + r.width, b: r.y + r.height });
const overlap = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
for (const [w, h] of [[1280, 720], [1024, 640]]) {
  for (const c of ['lache', 'climb', 'coaster']) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript(() => { try { localStorage.setItem('cc.ghost.mode', 'ideal'); localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} });
    await page.goto(`http://localhost:${port}/?course=/assets/demo/${c}.course.json&welcome=0&bot=ideal&ghost=bot&timescale=2`, { waitUntil: 'load' });
    await page.waitForSelector('#ghost-chip', { timeout: 60000 });
    await page.waitForFunction(() => /Ideal run/.test(document.querySelector('#ghost-chip')?.textContent ?? ''), null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    const gap = await page.textContent('#ghost-gap');
    ok(`${c} ${w}: the bot on the ideal line is level with the ghost`, /Level with the ghost/.test(gap ?? ''), gap ?? '');
    const boxes = await page.evaluate(() => ['#ghost-hud', '#keys', '#strip', '#debugbtn', '#courses-btn'].map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const r = e.getBoundingClientRect(); return [s, r.width ? { x: r.x, y: r.y, width: r.width, height: r.height } : null]; }));
    const hud = boxes.find(([s]) => s === '#ghost-hud')[1];
    const clash = boxes.filter(([s, r]) => s !== '#ghost-hud' && r && hud && overlap(rect(hud), rect(r))).map(([s]) => s);
    ok(`${c} ${w}: the ghost chip overlaps no other card`, !!hud && clash.length === 0, clash.join(','));
    if (w === 1280) await page.screenshot({ path: `${out}/${c}-bot-${w}.png` });
    await page.close();
  }
}
// a player who only runs: the ghost jumps the first gap and pulls ahead, the gap grows in plain words
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('cc.ghost.mode', 'ideal'); localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} });
await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&welcome=0`, { waitUntil: 'load' });
await page.waitForFunction(() => /Ideal run/.test(document.querySelector('#ghost-chip')?.textContent ?? ''), null, { timeout: 60000 });
await page.keyboard.down('ArrowRight');
await page.waitForFunction(() => /Ghost is [\d.]+ s ahead/.test(document.querySelector('#ghost-gap')?.textContent ?? ''), null, { timeout: 40000 }).catch(() => {});
const t1 = await page.textContent('#ghost-gap');
await page.screenshot({ path: `${out}/chase-1280.png` });
ok('a player who only runs sees the ghost ahead', /Ghost is [\d.]+ s ahead/.test(t1 ?? ''), t1 ?? '');
await page.keyboard.up('ArrowRight');
await page.keyboard.press('KeyN'); await page.waitForTimeout(300);
ok('N switches the ghost off', /Ghost: Off/.test((await page.textContent('#ghost-chip')) ?? '') && (await page.isHidden('#ghost-gap')));
await b.close(); v.kill();
writeFileSync(`${out}/run.json`, JSON.stringify({ results }, null, 2) + '\n');
process.exit(results.every((r) => r.pass) ? 0 : 1);
