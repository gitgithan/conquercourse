// The editor's "Routes you did not plan": add the lache pair, run the search in the worker, list what it finds.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  mkdirSync('test-results/editor', { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=editor&editorui=old`);
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.click('#addpiece'); await page.$eval('#addlache', (e) => e.click());
  await page.waitForFunction(() => document.documentElement.dataset.bars === '2', null, { timeout: 10000 });
  if (await page.evaluate(() => document.getElementById('helper')?.classList.contains('closed'))) await page.click('#helperbtn');
  await page.waitForSelector('#findroutes', { timeout: 20000 });
  checks.buttonThere = true;
  await page.click('#findroutes');
  checks.routesSearchAnswers = await page.waitForFunction(() => document.documentElement.dataset.routes !== undefined, null, { timeout: 600000 }).then(() => true, () => false);
  checks.routeCount = await page.evaluate(() => document.documentElement.dataset.routes);
  checks.listText = (await page.textContent('#routes')).slice(0, 300);
  await page.screenshot({ path: 'test-results/editor/routes.png' });
  if (Number(checks.routeCount) > 0) {
    await page.click('#routes button:has-text("Keep it")');
    await page.waitForTimeout(400);
    checks.keptShowsInList = /kept/.test(await page.textContent('#routes'));
    await page.locator('#profile').screenshot({ path: 'test-results/editor/routes-kept-side.png' });
  }
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
