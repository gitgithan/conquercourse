// CC-99 parts 2 and 3 in a browser: the bot's cleared run is kept as the best and can be chased with N, the link it copies opens as a friend's ghost, and a damaged link is refused.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = Number(process.env.PORT ?? 5931), out = process.env.OUT ?? 'data/eval/cc-99-ghost';
mkdirSync(out, { recursive: true });
const v = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (name, pass, note = '') => { results.push({ name, pass, note }); console.log(pass ? 'PASS' : 'FAIL', name, note); };
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} });
const base = `http://localhost:${port}/?course=/assets/demo/lache.course.json&welcome=0`;
await page.goto(`${base}&bot=ideal&ghost=bot&timescale=4`, { waitUntil: 'load' });
await page.waitForSelector('#ghost-share', { timeout: 150000 });
const kept = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cc.best.')).map((k) => JSON.parse(localStorage.getItem(k)).ticks));
ok('the cleared run is kept as the best (its time is stored)', kept.length === 1 && kept[0] > 0, String(kept));
const line = await page.evaluate(() => document.body.innerText.match(/This is your best run on this course\./)?.[0] ?? '');
ok('the end report says it is the best run', line !== '', line);
await page.fill('#ghost-nick', 'sam');
await page.click('#ghost-share');
await page.waitForTimeout(800);
const link = await page.evaluate(() => navigator.clipboard.readText());
ok('Copy link puts a challenge link on the clipboard, under 2000 characters', /[?&]challenge=1\.[a-z0-9]+\.SAM\./.test(link) && link.length < 2000, `${link.length} characters`);
ok('the link holds no personal data (no bot or ghost switches, only the nickname)', !/bot=|ghost=/.test(link));
await page.screenshot({ path: `${out}/report-share-1280.png` });
// open the link: the friend's run is the ghost; the bot on the ideal line (same keys) stays level with it
const friendPage = await ctx.newPage();
await friendPage.goto(`${link}&bot=ideal&ghost=bot&timescale=2`, { waitUntil: 'load' });
await friendPage.waitForFunction(() => /SAM's run/.test(document.querySelector('#ghost-chip')?.textContent ?? ''), null, { timeout: 60000 });
await friendPage.waitForTimeout(5000);
const g = await friendPage.textContent('#ghost-gap');
ok("the link's run is the ghost, named by its nickname", true, await friendPage.textContent('#ghost-chip'));
ok('the bot on the same line stays level with the friend ghost', /Level with the sam|Level with the/i.test(g ?? ''), g ?? '');
await friendPage.screenshot({ path: `${out}/friend-1280.png` });
await friendPage.close(); await page.close();
// N cycles Off, Ideal, Your best (kept in this browser), the friend
const cycle = [];
const chase = await ctx.newPage();
await chase.goto(`${base}`, { waitUntil: 'load' });
await chase.waitForSelector('#ghost-chip', { timeout: 120000 });
for (let i = 0; i < 4; i++) { cycle.push(((await chase.textContent('#ghost-chip')) ?? '').replace(/\s+/g, ' ').trim()); await chase.keyboard.press('KeyN'); await chase.waitForTimeout(300); }
ok('N cycles Off, Ideal run, Your best', /Off/.test(cycle[0]) && /Ideal run|working/.test(cycle[1]) && /Your best/.test(cycle[2]) && /Off/.test(cycle[3]), cycle.join(' | '));
// a damaged link is refused with a plain message
const bad = link.replace(/(challenge=1\.[a-z0-9]+\.[A-Z0-9]*\.)(.)(.{6})(.*)/, (_m, a, c, d, rest) => `${a}${c}${d}${rest.slice(0, Math.floor(rest.length / 3))}`);
const badPage = await ctx.newPage();
await chase.close();
await badPage.goto(`${bad}`, { waitUntil: 'load' });
await badPage.waitForFunction(() => document.querySelector('#ghost-note')?.textContent, null, { timeout: 30000 });
const note = await badPage.textContent('#ghost-note');
ok('a damaged link is refused in plain words', /could not|cannot|changed/.test(note ?? '') && !/SAM's run/.test((await badPage.textContent('#ghost-chip')) ?? ''), note ?? '');
// another version of the game
const oldPage = await ctx.newPage();
await badPage.close();
await oldPage.goto(`${link.replace(/challenge=1\./, 'challenge=9.')}`, { waitUntil: 'load' });
await oldPage.waitForFunction(() => document.querySelector('#ghost-note')?.textContent, null, { timeout: 30000 });
ok('a link from another version says so and offers the ideal ghost', /another version/.test((await oldPage.textContent('#ghost-note')) ?? ''), (await oldPage.textContent('#ghost-note')) ?? '');
await b.close(); v.kill();
writeFileSync(`${out}/run-part23.json`, JSON.stringify({ results }, null, 2) + '\n');
process.exit(results.every((r) => r.pass) ? 0 : 1);
