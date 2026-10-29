// CC-173: the end report's side-view picture: which lines it draws (desktop 1280 only). A friend's run plays to the end so the report appears.
// Usage: node scripts/report-lines.mjs [outdir] [tag]   (run it on the VM; COURSES=a.json,b.json to change the courses)
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/report-lines'; mkdirSync(out, { recursive: true });
const tag = process.argv[3] ?? 'after';
const port = Number(process.env.PORT ?? 5886);
const courses = (process.env.COURSES ?? 'public/assets/demo/training.course.json,public/assets/demo/lache.course.json').split(',');
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let bad = 0;
for (const course of courses) {
  const name = course.split('/').pop().replace('.course.json', '');
  const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', course, `http://localhost:${port}`]).toString().trim();
  for (const layout of tag === 'before' ? ['new'] : ['new', 'old']) {
    const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* shots only */ } });
    await page.goto(`${link}&autoplay=1&welcome=0&tour=0&next=0${layout === 'old' ? '&report=old' : ''}`, { waitUntil: 'load' });
    const got = await page.waitForSelector('#report-again', { timeout: 300000 }).then(() => true).catch(() => false);
    if (!got) { console.log('FAIL no report', name, layout); bad++; await page.close(); continue; }
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const svg = document.querySelector('section[aria-label="Run report"] svg[role="img"]');
      return { lines: [...svg.querySelectorAll(':scope > polyline, :scope > line')].map((e) => ({ tag: e.tagName, stroke: e.getAttribute('stroke'), dash: e.getAttribute('stroke-dasharray'), points: e.tagName === 'polyline' ? e.getAttribute('points').trim().split(/\s+/).length : 2 })), legend: [...document.querySelectorAll('section[aria-label="Run report"] span')].map((s) => s.textContent).filter((t) => /path|line|You|Ghost/.test(t)).slice(0, 4) };
    });
    console.log(name, layout, JSON.stringify(info));
    const el = page.locator('section[aria-label="Run report"] svg[role="img"]').first();
    await el.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/${tag}-${name}-${layout}.png` });
    await el.screenshot({ path: `${out}/${tag}-${name}-${layout}-picture.png` });
    await page.close();
  }
}
await b.close(); vite.kill(); process.exit(bad ? 1 : 0);
