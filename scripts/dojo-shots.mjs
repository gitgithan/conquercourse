// Screenshots of the wall and rope Dojo pages after one run each (for the playtest-round evidence).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  mkdirSync('test-results/dojo', { recursive: true });
  const set = (id, v) => page.$eval(`#${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  for (const [ex, knobs] of [['gap', { speed: 7, jump: 4.5 }], ['wall', { speed: 6, height: 4.3 }], ['wall', { speed: 6, height: 6 }], ['rope', { speed: 7, length: 5, angle: 60 }], ['trampoline', { drop: 2.5 }], ['landing', { drop: 2.5, bend: 0.1 }]]) {
    await page.goto(`http://localhost:${port}/?mode=dojo&ex=${ex}`);
    await page.waitForSelector('html[data-ready=true]');
    await page.click('#next');
    for (const [k, v] of Object.entries(knobs)) await set('knob-' + k, v);
    await page.click('#run');
    await page.screenshot({ path: `test-results/dojo/${ex}-${Object.values(knobs).join('-')}.png` });
  }
  await browser.close();
} finally { server.kill(); }
