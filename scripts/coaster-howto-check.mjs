// CC-244: the coaster instruction panels on both screens, the editor's preloaded dots, and a double-click that adds a dot. 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5199', out = process.argv[2] ?? 'test-results/coaster-howto'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('dialog', (d) => d.accept());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await page.goto(`http://localhost:${port}/?mode=coaster&welcome=0`);
  await page.waitForSelector('.howto', { timeout: 40000 }).catch(async () => { console.log('NO howto', JSON.stringify(errs), (await page.content()).slice(0, 300)); }); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/builder.png` });
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#presetpick', { timeout: 90000 }); await page.waitForTimeout(3000);
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.selectOption('#presetpick', 'coaster')]);
  await page.waitForSelector('#presetpick', { timeout: 90000 }); await page.waitForTimeout(6000);
  console.log('howto visible', await page.isVisible('#coasterhowto'));
  await page.screenshot({ path: `${out}/editor.png` });
  const box = await page.locator('#profile').boundingBox();
  await page.mouse.dblclick(box.x + box.width * 0.13, box.y + box.height * 0.5); await page.waitForTimeout(15000);
  await page.screenshot({ path: `${out}/editor-added.png` });
  console.log('errors', JSON.stringify(errs));
  await browser.close();
} finally { server.kill(); }
