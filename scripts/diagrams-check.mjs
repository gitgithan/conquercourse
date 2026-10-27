// Opens ?mode=diagrams, parses every SVG with DOMParser, fails on text under 12px, saves a screenshot to test-results/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
let failed = false;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=diagrams`);
  await page.waitForSelector('html[data-ready=true]');
  mkdirSync('test-results/diagrams', { recursive: true });
  const res = await page.evaluate(() => {
    const out = [];
    for (const fig of document.querySelectorAll('figure[data-diagram]')) {
      const svg = fig.querySelector('svg');
      const doc = new DOMParser().parseFromString(svg.outerHTML, 'image/svg+xml');
      const parseError = !!doc.querySelector('parsererror');
      const small = [...svg.querySelectorAll('text')].filter((t) => parseFloat(getComputedStyle(t).fontSize) < 12).length;
      out.push({ id: fig.dataset.diagram, parseError, small });
    }
    return out;
  });
  for (const r of res) if (r.parseError || r.small) { failed = true; console.error('FAIL', r); }
  if (res.length !== 10) { failed = true; console.error('expected 10 diagrams, got', res.length); }
  if (errors.length) { failed = true; console.error(errors); }
  await page.screenshot({ path: 'test-results/diagrams/all.png', fullPage: true });
  for (const el of await page.$$('figure[data-diagram]')) await el.screenshot({ path: `test-results/diagrams/${await el.getAttribute('data-diagram')}.png` });
  await browser.close();
  console.log(failed ? 'diagrams check FAILED' : `diagrams check ok (${res.length} diagrams)`);
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
