// CC-133: 1280 px screenshots of the Ready places list (parkour group) and two parks on the map. Usage: node scripts/cc133-parkour-shots.mjs <outdir> <port>
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? 'docs/evidence/cc-133-parkour-places', port = process.argv[3] ?? '5733';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 4000));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(`http://localhost:${port}/?mode=map&hooks=1&flight=0&welcome=0`);
  await p.waitForSelector('#ready .card', { timeout: 90000 });
  if (!(await p.$eval('#ready', (e) => e.open))) await p.click('#ready summary');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { const h = [...document.querySelectorAll('#ready .gh')].find((x) => /Parkour/.test(x.textContent ?? '')); h?.scrollIntoView({ block: 'start' }); });
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: '.mp .gal{max-height:none !important}' }); // evidence only: show the whole list in one picture
  await p.setViewportSize({ width: 1280, height: 1900 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const h = [...document.querySelectorAll('#ready .gh')].find((x) => /Parkour/.test(x.textContent ?? '')); h?.scrollIntoView({ block: 'start' }); });
  await p.screenshot({ path: `${out}/editor-place-list.png` });
  await p.setViewportSize({ width: 1280, height: 800 }); await p.addStyleTag({ content: '.mp .gal{max-height:340px !important}' });
  for (const [name, file] of [['Lakeside Garden SkatePark', 'map-lakeside-singapore.png'], ['Gerlev Parkour Park', 'map-gerlev-denmark.png']]) {
    await p.evaluate((n) => { [...document.querySelectorAll('#ready .card')].find((c) => c.textContent?.includes(n))?.click(); }, name);
    await p.waitForTimeout(9000);
    await p.screenshot({ path: `${out}/${file}` });
  }
  await b.close();
} finally { server.kill(); }
