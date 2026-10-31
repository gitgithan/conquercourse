// CC-118: opens each of the 12 Labs with NO click and checks that every output is already filled. Desktop 1280 px only.
// Fails on a page error, a placeholder ("Run ... to see"), a visible-but-empty output, or a blank 2D canvas. Times the first populated paint.
// Usage: node scripts/labs-default-smoke.mjs   (env: PORT, OUT)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5189';
const out = process.env.OUT ?? 'test-results/cc-118-labs-default';
const modes = ['search', 'optimization', 'ik', 'vision', 'camera', 'integration', 'timing', 'signal', 'gentest', 'detector', 'hashing', 'rl'].map((m) => `lab-${m}`);
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const rows = [], problems = [];
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  for (const mode of modes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // warm the dev server's module graph once so the timing is the Lab, not the first compile
    const t0 = Date.now();
    await page.goto(`http://localhost:${port}/?mode=${mode}&labs=1&welcome=0`);
    try { await page.waitForFunction((m) => document.documentElement.dataset.labPopulated === m, mode, { timeout: 90000 }); }
    catch { problems.push(`${mode}: never reached the populated state`); }
    const wall = Date.now() - t0;
    const at = await page.evaluate(() => Number(document.documentElement.dataset.labPopulatedAt ?? 0));
    await page.waitForTimeout(500);
    const bad = await page.evaluate((m) => {
      const root = document.getElementById(m);
      const res = [];
      if (!root) return ['no root element'];
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]'); };
      if (!root.querySelector('#lab-default-note')) res.push('no "already run" label');
      for (const e of root.querySelectorAll('[id$="-none"]')) if (vis(e)) res.push(`placeholder visible: ${e.id}`);
      for (const e of root.querySelectorAll('[id$="-ours"],[id$="-ours-p"],dl.facts')) if (vis(e) && !e.textContent.trim()) res.push(`empty: ${e.id || e.className}`);
      for (const e of root.querySelectorAll('[id$="-ours"],[id$="-ours-p"]')) if (!vis(e)) res.push(`our-setting output hidden: ${e.id}`);
      if (/(run|train|play|press|test)\b[^.\n]{0,40}\bto see\b/i.test(root.innerText)) res.push('"... to see" placeholder text');
      for (const c of root.querySelectorAll('canvas')) {
        if (!vis(c)) continue;
        let ctx = null; try { ctx = c.getContext('2d'); } catch { /* webgl */ }
        if (!ctx) continue;
        const d = ctx.getImageData(0, 0, c.width, c.height).data; let any = false;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) { any = true; break; }
        if (!any) res.push(`blank canvas: ${c.id || '(unnamed)'}`);
      }
      return res;
    }, mode);
    if (errors.length) bad.push(...errors.map((e) => `page error: ${e}`));
    for (const b of bad) problems.push(`${mode}: ${b}`);
    mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/${mode}.png` });
    rows.push({ mode, firstPopulatedPaintMs: at, wallMs: wall, problems: bad.length });
    console.log(mode.padEnd(16), `populated at ${at} ms (page clock), ${wall} ms wall`, bad.length ? bad.join(' | ') : 'ok');
    await page.close();
  }
  await browser.close();
  writeFileSync(`${out}/timings.json`, JSON.stringify(rows, null, 2) + '\n');
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'all 12 Labs open populated with no click');
  process.exit(problems.length ? 1 : 0);
} finally { server.kill(); }
