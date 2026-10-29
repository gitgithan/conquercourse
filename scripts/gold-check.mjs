// CC-183: gold means the obstacle you fell at most. No fall: no gold. Two falls at the first gap: gold on it, with the label and the legend. ?gold=old: the old look.
// Usage: node scripts/gold-check.mjs [outdir]   (desktop 1280 only; run on the VM)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'data/eval/gold-hardest'; mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? '5893';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
let bad = 0; const check = (n, ok) => { console.log(ok ? 'ok  ' : 'FAIL', n); if (!ok) bad++; };
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: flags });
  const fall = async (page) => {
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 100, null, { timeout: 120000 });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.documentElement.dataset.outcome === 'splash', null, { timeout: 200000 });
    await page.keyboard.up('ArrowRight'); await page.waitForTimeout(500);
  };
  const gold = (page) => page.evaluate(() => ({ hard: document.querySelectorAll('#strip .ob.hard').length, legend: getComputedStyle(document.querySelector('#gold-legend')).display, text: document.querySelector('#gold-legend').textContent, block: document.querySelector('#hardest-block')?.innerText ?? null, anim: [...document.querySelectorAll('#strip .ob svg')].some((e) => getComputedStyle(e).animationName !== 'none') }));
  for (const mode of ['new', 'old']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://localhost:${port}/?welcome=0&tour=0${mode === 'old' ? '&gold=old' : ''}`);
    await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
    await page.waitForTimeout(1500);
    let g = await gold(page);
    await page.screenshot({ path: `${out}/${mode}-1-no-falls.png` });
    if (mode === 'new') check('no fall: no gold, no legend, no animation', g.hard === 0 && g.legend === 'none' && !g.anim);
    else check('?gold=old: icons glow', g.anim);
    await fall(page);
    g = await gold(page);
    await page.screenshot({ path: `${out}/${mode}-2-one-fall.png` });
    if (mode === 'new') check('one fall: gold on one obstacle, label and legend', g.hard === 1 && g.legend === 'block' && /Hardest for you: .* \(1 fall\)/.test(g.text) && /Gold marks/.test(g.text) && /Hardest for you/.test(g.block ?? ''));
    else check('?gold=old: no hardest label', g.hard === 0 && g.block === null);
    if (mode === 'new') {
      await page.keyboard.press('KeyR'); await page.waitForTimeout(800);
      await fall(page); g = await gold(page);
      await page.screenshot({ path: `${out}/new-3-two-falls.png` });
      check('two falls: the label counts 2', /\(2 falls\)/.test(g.text));
    }
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
console.log(bad ? 'FAIL' : 'PASS'); process.exit(bad ? 1 : 0);
