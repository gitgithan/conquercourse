// Steps a course hands-free (?bot=ideal) in a tiny viewport and logs where the runner is and what it is doing, so a film take can start at the right moment.
// Usage: node scripts/film-b-probe.mjs <port> <seconds> <outfile.json> <query>...   (one object per query: id=query)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [port, secs, out, ...items] = process.argv.slice(2);
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  for (const it of items) {
    const [id, q] = [it.slice(0, it.indexOf('=')), it.slice(it.indexOf('=') + 1)];
    const page = await (await browser.newContext({ viewport: { width: 160, height: 90 } })).newPage();
    await page.addInitScript(stepped);
    await page.goto(`http://localhost:${port}/?${q}`);
    await page.waitForSelector('html[data-ready=true]', { timeout: 240000 });
    const rows = [];
    for (let k = 0; k < Number(secs) * 30; k++) {
      await page.evaluate(() => { window.__stepClock(1000 / 30); return new Promise((r) => requestAnimationFrame(r)); });
      if (k % 3 === 0) rows.push(await page.evaluate(() => { const d = document.documentElement.dataset; return [Number(d.tick), Number(d.x), d.mode, d.grounded, d.outcome, d.vault, d.climb]; }));
    }
    result[id] = rows;
    console.log(id, rows.length, 'rows; end', JSON.stringify(rows[rows.length - 1]));
    await page.context().close();
  }
  await browser.close();
} finally { writeFileSync(out, JSON.stringify(result)); server.kill(); }
