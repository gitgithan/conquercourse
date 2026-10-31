// CC-243: the voice badges. For each screen: one picture with ?says=0 (before) and one with the badges (after), and a check that the badge is there (or absent with ?says=0).
// 1280 x 720, desktop only. One browser, one screen after another. Usage: node scripts/says-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5231', out = process.argv[2] ?? 'test-results/says'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {}, base = `http://localhost:${port}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await wait(5000);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const errs = [];
  const badge = (page, voice) => page.evaluate((v) => { const b = document.querySelector(`.says[data-voice="${v}"]`); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), text: b.innerText.replace(/\s+/g, ' ') }; }, voice);
  // each screen: name, query, voice, steps(page) that bring the speaker on screen, optional element to picture
  const screens = [
    ['welcome-crew', '?welcome=1', 'simulator', async (p, on) => { if (on) { await p.click('#welcome-crew'); await p.waitForSelector('#crew'); } }, null],
    ['editor-verdict', '?mode=editor&welcome=0', 'simulator', async (p) => { await p.waitForFunction(() => (document.getElementById('verdict')?.textContent ?? '').length > 5, null, { timeout: 120000 }); await p.click('#partnertab'); await wait(700); }, null],
    ['editor-partner', '?mode=editor&welcome=0', 'partner', async (p) => { await p.click('#partnertab'); await wait(700); }, null],
    ['editor-agent', '?mode=editor&welcome=0&agent=1', 'agent', async (p) => { await p.setInputFiles('#agentfile', 'public/assets/park/park01.jpg'); await p.waitForFunction(() => document.querySelector('#agenttrace li'), null, { timeout: 60000 }); await wait(4000); }, null],
    ['report', '?course=/assets/demo/coaster-two-hills.course.json&bot=ideal&welcome=0', 'simulator', async (p) => { await p.waitForSelector('#report-again', { timeout: 240000 }); await wait(600); }, null],
    ['coaster', '?mode=coaster', 'simulator', async (p) => { await p.waitForSelector('#coverdict'); await p.waitForFunction(() => (document.getElementById('coverdict')?.textContent ?? '').length > 5, null, { timeout: 90000 }); }, null],
    ['community-crew', '?mode=communities', 'simulator', async (p, on) => { if (on) { await p.waitForSelector('#ex-crew'); await p.locator('#ex-crew').scrollIntoViewIfNeeded(); await wait(400); } }, null],
    ['make-segment', '?mode=communities', 'cutter', async (p) => { await p.click('#make-own'); await p.waitForSelector('[data-sample]'); await p.click('[data-sample="park01"]'); await p.waitForSelector('#cnext', { timeout: 30000 }); const st = p.locator('.com .stage, .com img').first(); const bb = await st.boundingBox(); if (bb) await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await wait(500); await p.click('#cnext'); await wait(800); }, null],
    ['characters', '?welcome=0', 'maker', async (p) => { await p.waitForSelector('#characters-btn', { timeout: 120000 }); await p.click('#characters-btn'); await p.waitForSelector('#chars'); await wait(800); }, null],
  ];
  for (const [name, q, voice, steps] of screens) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue;
    for (const on of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(`${name}: ${e.message.slice(0, 120)}`));
      const url = `${base}${q}${on ? '' : (q.includes('?') ? '&' : '?') + 'says=0'}`;
      try {
        await page.goto(url, { waitUntil: 'load' });
        await steps(page, on);
        const b = await badge(page, voice);
        // the welcome and community crew checks look at the strip instead of one voice
        if (name === 'welcome-crew' || name === 'community-crew') {
          const n = await page.evaluate(() => document.querySelectorAll('#crew li').length);
          checks[`${name} ${on ? 'on' : 'off'}: ${on ? '11 crew cards' : 'no crew strip'}`] = on ? n === 11 : n === 0 && !(await page.$('#welcome-crew'));
        } else {
          checks[`${name} ${on ? 'on' : 'off'}: badge ${on ? 'shown' : 'absent'}`] = on ? !!b && b.h >= 40 : b === null;
          if (on && b) console.log(name, JSON.stringify(b));
        }
        await page.screenshot({ path: `${out}/${name}-${on ? 'after' : 'before'}.png` });
      } catch (e) { checks[`${name} ${on ? 'on' : 'off'}: ran`] = false; console.log('ERR', name, on, String(e).split('\n')[0]); try { await page.screenshot({ path: `${out}/${name}-${on ? 'after' : 'before'}-err.png` }); } catch { /* gone */ } }
      await ctx.close();
    }
  }
  checks['no page errors'] = errs.length === 0; if (errs.length) console.log(errs.slice(0, 6));
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(checks, null, 1));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
