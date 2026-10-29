// CC-192: a first run with no falls must show no gold anywhere. Plays a clean (ideal) run to the end report, then scans every visible element for gold colours.
// Usage: node scripts/gold-first-run.mjs [outdir]   (desktop 1280 only; run on the VM; COURSES=a.json,b.json to change the courses)
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/gold-first-run'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5887);
const courses = (process.env.COURSES ?? 'public/assets/demo/training.course.json,public/assets/demo/park-run.course.json,public/assets/demo/lache.course.json').split(',');
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let bad = 0;
for (const course of courses) {
  const name = course.split('/').pop().replace('.course.json', '');
  const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', course, `http://localhost:${port}`]).toString().trim();
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* shots only */ } });
  await page.goto(`${link}&autoplay=1&welcome=0&tour=0&next=0`, { waitUntil: 'load' });
  const got = await page.waitForSelector('#report-again', { timeout: 300000 }).then(() => true).catch(() => false);
  if (!got) { console.log('FAIL no report', name); bad++; await page.close(); continue; }
  await page.waitForTimeout(2500); // let a shortcut line arrive
  const gold = await page.evaluate(() => {
    const hits = [];
    const isGold = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); if (!m) return false; if (m[4] !== undefined && Number(m[4]) < 0.2) return false; const [r, g, b2] = [m[1], m[2], m[3]].map((v) => Number(v) / 255); const mx = Math.max(r, g, b2), mn = Math.min(r, g, b2); if (mx - mn < 0.1) return false; let h; const d = mx - mn; if (mx === r) h = ((g - b2) / d) % 6; else if (mx === g) h = (b2 - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; const l = (mx + mn) / 2, s = d / (1 - Math.abs(2 * l - 1)); return h >= 32 && h <= 55 && s > 0.5; };
    for (const e of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      for (const p of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'fill', 'stroke']) {
        if (p === 'borderTopColor' && parseFloat(cs.borderTopWidth) === 0) continue; if (p === 'borderLeftColor' && parseFloat(cs.borderLeftWidth) === 0) continue;
        if (p === 'stroke' && cs.stroke === 'none') continue; if (p === 'fill' && cs.fill === 'none') continue;
        if (isGold(cs[p])) hits.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''} ${p}=${cs[p]} in ${e.closest('#strip') ? 'strip' : e.closest('section[aria-label="Run report"]') ? (e.closest('svg') ? 'report-picture' : 'report') : 'other'}`);
      }
    }
    return { hits, hard: document.querySelectorAll('#strip .ob.hard').length, shortcut: document.querySelector('#shortcutnote')?.textContent ?? null, saving: document.querySelector('section[aria-label="Run report"]')?.innerText.includes('saves') ?? false };
  });
  const uniq = [...new Set(gold.hits)];
  console.log(name, JSON.stringify({ hard: gold.hard, shortcut: gold.shortcut, goldHits: uniq.length }));
  for (const h of uniq) console.log('  GOLD', h);
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ ...gold, hits: uniq }, null, 2) + '\n');
  await page.screenshot({ path: `${out}/${name}.png` });
  if (uniq.length || gold.hard) bad++;
  await page.close();
}
await b.close(); vite.kill(); console.log(bad ? 'FAIL' : 'PASS'); process.exit(bad ? 1 : 0);
