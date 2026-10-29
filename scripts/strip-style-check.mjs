// CC-171: the obstacle strip keeps its gold icon style (a gold border and a pale gold fill) at 1280; fails if the style is lost.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/strip'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5891);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let bad = 0;
for (const [w, h] of [[1280, 720]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0`);
  await page.waitForSelector('#strip .ob svg', { state: 'attached', timeout: 120000 }); await page.waitForTimeout(2500);
  const s = await page.evaluate(() => { const e = document.querySelector('#strip .ob svg'); const c = getComputedStyle(e); return { bg: c.backgroundColor, border: c.borderTopColor, n: document.querySelectorAll('#strip .ob').length }; });
  const ok = s.n > 0 && s.bg !== 'rgba(0, 0, 0, 0)' && s.border !== 'rgb(0, 0, 0)';
  console.log(w, JSON.stringify(s), ok ? 'ok' : 'LOST'); if (!ok) bad++;
  await page.screenshot({ path: `${out}/strip-${w}.png` }); await page.close();
}
console.log(bad ? 'FAIL' : 'PASS'); await b.close(); vite.kill(); process.exit(bad ? 1 : 0);
