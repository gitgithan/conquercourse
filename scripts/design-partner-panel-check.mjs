// CC-243: the Design partner slides in from the right edge: open, close, Esc, remembered, full height, nothing covered. 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5197', out = process.argv[2] ?? 'test-results/design-partner'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#partnertab', { timeout: 90000 }); await page.waitForTimeout(3000);
  const box = (s) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(e).visibility }; }, s);
  checks['closed on first visit'] = !(await page.isVisible('#helper'));
  await page.screenshot({ path: `${out}/closed.png` });
  await page.click('#partnertab'); await page.waitForTimeout(500);
  checks['tab opens it'] = await page.isVisible('#helper');
  const h = await box('#helper'), nav = await box('#sitenav'), bar = await box('.ed .top, #edtop') ;
  console.log('helper', JSON.stringify(h), 'nav', JSON.stringify(nav));
  checks['flush to the right edge'] = Math.abs(h.x + h.w - 1280) < 1;
  checks['340 wide, as the right column'] = Math.abs(h.w - 340) < 2;
  checks['full height to the bottom'] = Math.abs(h.y + h.h - 720) < 1 && h.h > 560;
  checks['sits below the top bars'] = nav ? h.y >= nav.y + nav.h - 1 : true;
  const inner = await page.evaluate(() => { const hp = document.getElementById('helper'), r = hp.getBoundingClientRect(); const bad = []; for (const e of hp.querySelectorAll('button,textarea,label,#reply,strong')) { const b = e.getBoundingClientRect(); if (!b.width) continue; if (b.left < r.left - 1 || b.right > r.right + 1 || b.bottom > r.bottom + 1) bad.push(e.id || e.tagName); } const ask = document.getElementById('ask').getBoundingClientRect(), send = document.getElementById('send').getBoundingClientRect(), reply = document.getElementById('reply').getBoundingClientRect(); return { bad, askH: ask.height, sendBottom: send.bottom, replyH: reply.height, label: document.querySelector('#helper label').textContent.trim() }; });
  console.log('inner', JSON.stringify(inner));
  checks['nothing cut off'] = inner.bad.length === 0;
  checks['ask box is multi-line (>=70 px)'] = inner.askH >= 70;
  checks['Ask pinned at the bottom'] = inner.sendBottom <= 720 && inner.sendBottom > 680;
  checks['answer area is roomy (>=200 px)'] = inner.replyH >= 200;
  checks['checkbox row is labelled'] = inner.label === 'Move only the chosen pieces';
  const sv = await box('#profile'), tabs = await box('#partnertab');
  checks['tab rides the panel edge'] = tabs && Math.abs(tabs.x + tabs.w - h.x) < 3;
  await page.screenshot({ path: `${out}/open.png` });
  // the side view (profile) and canvas buttons stay usable: the side-view designer is left of the panel or the panel is clear of its drawn area
  checks['side view not covered'] = sv ? sv.x + sv.w <= h.x + 1 || sv.y + sv.h <= h.y : true;
  console.log('profile', JSON.stringify(sv));
  await page.reload(); await page.waitForSelector('#partnertab', { timeout: 90000 }); await page.waitForTimeout(2500);
  checks['open choice is remembered'] = await page.isVisible('#helper');
  await page.focus('#ask'); await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  checks['Esc closes it'] = !(await page.isVisible('#helper'));
  await page.reload(); await page.waitForSelector('#partnertab', { timeout: 90000 }); await page.waitForTimeout(2500);
  checks['closed choice is remembered'] = !(await page.isVisible('#helper'));
  await page.click('#helperbtn'); await page.waitForTimeout(400);
  checks['top-bar button opens it'] = await page.isVisible('#helper');
  await page.click('#closehelper'); await page.waitForTimeout(400);
  checks['✕ closes it'] = !(await page.isVisible('#helper'));
  await page.click('#partnertab'); await page.waitForTimeout(300); await page.fill('#ask', 'make the gap easier'); checks['can type in the ask box'] = (await page.inputValue('#ask')) === 'make the gap easier';
  checks['no page errors'] = errs.length === 0; if (errs.length) console.log(JSON.stringify(errs));
  await browser.close();
} finally { server.kill(); }
let bad = 0; for (const [k, v] of Object.entries(checks)) { console.log(v ? 'PASS' : 'FAIL', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
