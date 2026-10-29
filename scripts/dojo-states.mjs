// Screenshots of every Dojo state (CC-146): node scripts/dojo-states.mjs <outdir> [old|new]
// Desktop (1280x860) and phone (390x844); the lesson list, a lesson in progress, the earned formula step and the finished step.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/dojo-design';
const flavour = process.argv[3] ?? 'new';
const port = process.env.PORT ?? '5199';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  mkdirSync(out, { recursive: true });
  const sizes = { desktop: { width: 1280, height: 860 }, phone: { width: 390, height: 844 } };
  const states = flavour === 'old' ? [['gap', 0, 'why'], ['gap', 1, 'try'], ['wall', 2, 'shape'], ['rope', 3, 'rule'], ['landing', 4, 'formula'], ['gap', 5, 'course']]
    : [['gap', 0, 'why'], ['gap', 1, 'try'], ['wall', 2, 'shape'], ['landing', 1, 'try'], ['landing', 3, 'formula'], ['gap', 3, 'formula']]; // CC-148: four steps
  for (const [name, viewport] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport });
    for (const [ex, step, label] of states) {
      await page.goto(`http://localhost:${port}/?mode=dojo&ex=${ex}&dojo=${flavour}`);
      await page.waitForSelector('html[data-ready=true]');
      for (let i = 0; i < step; i++) await page.click('#next');
      if (step === 1 || label === 'formula') await page.$eval('#knob-speed', (el) => { el.value = '8.5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(400);
      const h = await page.evaluate(() => Math.min(2600, Math.max(innerHeight, (document.querySelector('.dojo.v2') ?? document.documentElement).scrollHeight)));
      await page.setViewportSize({ width: viewport.width, height: h });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${flavour}-${name}-${ex}-${label}.png`, fullPage: false });
    }
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
