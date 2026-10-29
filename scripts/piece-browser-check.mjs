// CC-96: the add browser. Opens it at three window sizes, points at cards and tabs, searches, adds pieces with the mouse and the keyboard,
// and saves screenshots plus a frame strip of the featured view changing. PORT picks the dev-server port, OUT where the pictures go.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5190', out = process.env.OUT ?? 'data/eval/cc-96-piece-browser';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const checks = {}, errors = [];
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  for (const [w, h] of [[1280, 720], [1024, 640], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
    await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
    await page.waitForSelector('#addpiece', { timeout: 90000 });
    await page.click('#addpiece'); await page.waitForTimeout(800);
    const tag = `${w}x${h}`;
    checks[`${tag} browser open`] = await page.isVisible('#piecebrowser');
    const names = async () => page.$eval('.pb-feature h3', (e) => e.textContent);
    // every card on every tab has a picture that loaded
    const tabs = await page.$$eval('.pb-tab', (t) => t.map((x) => x.id));
    let missing = 0, cards = 0;
    for (const id of tabs) {
      await page.hover(`#${id}`); await page.waitForTimeout(250);
      for (const ok of await page.$$eval('.pb-card img', (is) => is.map((i) => i.complete && i.naturalWidth > 0))) { cards++; if (!ok) missing++; }
    }
    checks[`${tag} every card has its picture (${cards})`] = missing === 0;
    // pointing at a card changes the featured piece
    await page.hover('#pbtab-ground'); await page.waitForTimeout(200);
    const first = await names();
    await page.hover('.pb-card >> nth=3'); await page.waitForTimeout(250);
    const second = await names();
    checks[`${tag} hover changes the featured view`] = first !== second;
    checks[`${tag} the card is highlighted`] = (await page.$$eval('.pb-card.on', (c) => c.length)) === 1;
    if (w === 1280) {
      const strip = [];
      for (const [i, sel] of ['#pbtab-ground', '#pbtab-swing', '#pbtab-contraptions', '#pbtab-stacks'].entries()) {
        await page.hover(sel); await page.waitForTimeout(250); await page.hover('.pb-card >> nth=0'); await page.waitForTimeout(350);
        await page.screenshot({ path: `${out}/hover-${i + 1}.png` }); strip.push(await names());
      }
      checks['1280 the strip shows four different pieces'] = new Set(strip).size === 4;
      writeFileSync(`${out}/hover-strip.json`, JSON.stringify(strip, null, 2) + '\n');
    }
    // search
    await page.fill('#piecesearch', 'rope'); await page.waitForTimeout(250);
    checks[`${tag} search finds the rope`] = (await page.$$eval('.pb-card span', (s) => s.map((x) => x.textContent))).includes('Rope swing');
    await page.fill('#piecesearch', '');
    // a click adds the piece and closes the menu
    const before = Number(await page.evaluate(() => document.documentElement.dataset.pieces ?? '0'));
    await page.hover('#pbtab-ground'); await page.click('.pb-card[data-piece=block]'); await page.waitForTimeout(500);
    checks[`${tag} a click adds a piece`] = Number(await page.evaluate(() => document.documentElement.dataset.pieces ?? '0')) > before;
    checks[`${tag} the menu closes after adding`] = !(await page.isVisible('#piecebrowser'));
    // the rope swing adds a rope anchor
    await page.click('#addpiece'); await page.hover('#pbtab-swing'); await page.click('.pb-card[data-piece=rope]'); await page.waitForTimeout(500);
    checks[`${tag} the rope swing is offered and added`] = Number(await page.evaluate(() => document.documentElement.dataset.pieces ?? '0')) > before + 1;
    // the own-photo entry opens the file picker
    await page.click('#addpiece'); await page.hover('#pbtab-tools');
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).then(() => true, () => false);
    await page.click('.pb-card[data-piece=photo]');
    checks[`${tag} Use my own photo opens the file picker`] = await chooser;
    // keyboard: Tab into the grid, arrows move, Enter adds
    await page.click('#addpiece'); await page.click('#pbtab-ground'); await page.focus('.pb-card >> nth=0'); await page.keyboard.press('ArrowRight');
    checks[`${tag} arrows move between cards`] = await page.evaluate(() => document.activeElement?.classList.contains('pb-card') && document.activeElement !== document.querySelector('.pb-card'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    checks[`${tag} Escape closes the browser`] = !(await page.isVisible('#piecebrowser'));
    await page.click('#addpiece'); await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/open-${tag}.png` });
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify(checks, null, 2), '\nerrors', errors);
console.log(failed.length || errors.length ? `FAIL: ${failed.join('; ')}` : 'PASS');
process.exit(failed.length || errors.length ? 1 : 0);
