// CC-243: the editor's lane check shows progress, can be cancelled at once, and never piles up workers. 1280 x 720.
// Edit a ready-made course until the search is long enough to watch, read the progress line, press Cancel, edit again.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5197', out = process.argv[2] ?? 'test-results/lane-cancel'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
let bad = 0; const ok = (name, v) => { console.log(v ? 'PASS' : 'FAIL', name); if (!v) bad++; };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('dialog', (d) => d.accept());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  let live = 0, made = 0;
  page.on('worker', (w) => { if (!/ideal-worker/.test(w.url())) return; live++; made++; w.on('close', () => { live--; }); });
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#presetpick', { timeout: 90000 }); await page.waitForTimeout(4000);
  const flag = (k) => page.evaluate((key) => document.documentElement.dataset[key] ?? null, k);
  const edit = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = String(val); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
  const settle = async (n, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms && live > n) await page.waitForTimeout(100); return live <= n; }; // Playwright reports a closed worker a moment late
  const waitState = async (want, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await flag('laneState')) === want) return true; await page.waitForTimeout(150); } return false; };
  ok(`start: the default course is answered from its stored proof (${await flag('laneProof')}), no worker`, (await flag('laneProof')) === 'stored' && made === 0);

  // find an edit whose search is long enough to watch
  let searching = false;
  for (const [id, v] of [['level', 0.35], ['level', 0.7], ['angle', 35], ['angle', 70], ['level', 1.1]]) {
    await edit(id, v);
    searching = await waitState('searching', 8000);
    if (!searching) continue;
    await page.waitForTimeout(1500);
    if ((await flag('laneState')) === 'searching') break;
    searching = false;
  }
  ok('an edited lane starts a search that stays on long enough to watch', searching);
  if (searching) {
    const t1 = await flag('laneProgress'); await page.waitForTimeout(2500); const t2 = await flag('laneProgress');
    console.log('progress:', t1, '|', t2);
    ok('the progress line is plain words', /^Searching for a way through: /.test(t1 ?? ''));
    ok('the progress line moves (seconds or steps change)', !!t2 && t1 !== t2 && (await flag('laneState')) === 'searching');
    ok('Cancel and Play anyway are on screen while searching', await page.locator('#lane-cancel').isVisible() && await page.locator('#lane-anyway').isVisible());
    ok('the bar is there', await page.locator('#lane-progress-bar').isVisible());
    ok(`one search worker alive (${live})`, live === 1);
    await page.screenshot({ path: `${out}/searching.png` });
    await page.click('#lane-cancel'); await page.waitForTimeout(400);
    ok('after Cancel the state is cancelled', (await flag('laneState')) === 'cancelled');
    ok(`the worker is gone (${live} alive)`, await settle(0));
    const v = (await page.textContent('#verdict')) ?? '';
    ok(`the verdict says not checked ("${v.slice(0, 50)}")`, /not checked/i.test(v) && (await flag('laneClear')) === null);
    ok('Check again is offered', await page.locator('#lane-recheck').isVisible());
    await page.waitForTimeout(2500);
    ok('nothing restarts by itself after Cancel', (await flag('laneState')) === 'cancelled' && live === 0);
    await page.screenshot({ path: `${out}/stopped.png` });
    const before = made;
    await edit('level', 0.5); await page.waitForTimeout(300);
    ok('an edit clears the old verdict at once', (await flag('laneState')) === 'idle');
    ok('and does not start a search before the pause', made === before);
    ok('then a fresh search starts after the pause', await waitState('searching', 6000) || (await flag('laneState')) === 'done');
    await edit('level', 0.9); await page.waitForTimeout(1500);
    ok(`new edits never pile up workers (${live} alive)`, await settle(1));
  }
  console.log('errors', JSON.stringify(errs)); ok('no page errors', errs.length === 0);
  await browser.close();
} finally { server.kill(); }
process.exit(bad ? 1 : 0);
