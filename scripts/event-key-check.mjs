// CC-108: a started run must be sent to /api/course-event under the key the server keeps and the cards read ('demo/training', not 'demo-training').
// Usage: PORT=5303 node scripts/event-key-check.mjs   (answers the API itself; prints OK or FAIL)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5303';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const keys = [];
  await page.route('**/api/course-event', (route) => { keys.push(JSON.parse(route.request().postData() ?? '{}').courseKey); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/**', (route) => route.request().url().includes('course-event') ? route.fallback() : route.fulfill({ json: {} }));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&nav=0`);
  await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  console.log(keys.includes('demo/training') ? 'OK start event key demo/training' : `FAIL keys sent: ${JSON.stringify(keys)}`);
  if (!keys.includes('demo/training')) process.exitCode = 1;
  await browser.close();
} finally { server.kill(); }
