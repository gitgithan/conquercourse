// CC-191: the fall panel and the finished report in the real page at 1280 px, fresh profile, tour=0 and welcome=0.
// Fails when the first-fall card or the controls card sits on the open panel, a hint shows while a panel is open, or "Edit this course" shows twice.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'data/eval/cc-191-report';
mkdirSync(out, { recursive: true });
const tag = process.env.TAG ?? 'after';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const state = (page) => page.evaluate(() => {
  const vis = (e) => { if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const rect = (e) => e.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const panel = [...document.querySelectorAll('body > div')].find((d) => getComputedStyle(d).position === 'fixed' && getComputedStyle(d).zIndex === '40' && vis(d));
  const over = [];
  if (panel) for (const id of ['ccfirstfall', 'keys']) { const e = document.getElementById(id); if (vis(e) && hit(rect(e), rect(panel))) over.push(id); }
  const edits = [...document.querySelectorAll('button')].filter((b) => vis(b) && b.textContent.trim() === 'Edit this course').length;
  const hint = [...document.querySelectorAll('body > div')].filter((d) => vis(d) && /hold E|Press Space/.test(d.textContent) && !d.contains(panel) && d !== panel && !panel?.contains(d) && getComputedStyle(d).fontSize === '20px').map((d) => d.textContent.slice(0, 30));
  return { panel: !!panel, over, edits, hint };
});
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: flags });
  const fresh = async (q) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); await page.goto(`http://localhost:${port}/?${q}`); await page.waitForSelector('html[data-ready=true]', { timeout: 120000 }); return page; };
  // fall: run right with no jump until the panel opens
  let page = await fresh('tour=0&welcome=0');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some((d) => getComputedStyle(d).zIndex === '40' && getComputedStyle(d).display !== 'none'), null, { timeout: 120000 });
  await page.keyboard.up('ArrowRight'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${tag}-fall-panel.png` });
  let s = await state(page);
  check('fall panel: the first-fall card and the controls card are off the panel', s.panel && s.over.length === 0, JSON.stringify(s.over));
  check('fall panel: one Edit this course button', s.edits === 1, String(s.edits));
  check('fall panel: no hint shows while the panel is open', s.hint.length === 0, JSON.stringify(s.hint));
  // finished: the ideal bot
  page = await fresh('tour=0&welcome=0&bot=ideal');
  await page.waitForFunction(() => [...document.querySelectorAll('body > div')].some((d) => getComputedStyle(d).zIndex === '40' && getComputedStyle(d).display !== 'none'), null, { timeout: 240000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${tag}-finished-report.png` });
  s = await state(page);
  check('finished report: nothing sits on the panel', s.panel && s.over.length === 0, JSON.stringify(s.over));
  check('finished report: one Edit this course button', s.edits <= 1, String(s.edits));
  await browser.close();
} catch (e) { console.log('FAIL error', e.message); results.push(false); }
server.kill();
process.exit(results.every(Boolean) && results.length ? 0 : 1);
