// CC-118: opens Lab 1, clicks the bar through all 12 Labs and back by Previous, checks no page errors, saves shots.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.env.OUT ?? 'test-results/cc-118-labs-nav';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync(out, { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=lab-search&labs=1&welcome=0`);
  const modes = ['search', 'optimization', 'ik', 'vision', 'camera', 'integration', 'timing', 'signal', 'gentest', 'detector', 'hashing', 'rl'].map((m) => `lab-${m}`);
  const fail = [];
  for (let i = 0; i < modes.length; i++) {
    if (i > 0) await Promise.all([page.waitForURL(`**mode=${modes[i]}&**`), page.click(`#labs-nav a[data-lab=${modes[i]}]`)]);
    await page.waitForSelector(`#${modes[i]}`, { timeout: 60000 });
    await page.waitForSelector('#labs-nav', { timeout: 10000 });
    await page.waitForTimeout(800);
    const cur = await page.locator('#labs-nav [aria-current=page]').getAttribute('data-lab');
    const n = await page.locator('#labs-nav .tiers a').count();
    if (cur !== modes[i] || n !== 12) fail.push(`${modes[i]}: current=${cur} count=${n}`);
    if (i === 0 || i === 6 || i === 11) await page.screenshot({ path: `${out}/${modes[i]}.png` });
  }
  // Previous from Lab 12 lands on Lab 11; ] goes forward again
  await Promise.all([page.waitForURL('**mode=lab-hashing&**'), page.click('#labs-prev')]);
  await page.waitForSelector('#lab-hashing');
  await Promise.all([page.waitForURL('**mode=lab-rl&**'), page.keyboard.press(']')]);
  await page.waitForSelector('#lab-rl');
  // labs off: no bar
  await page.goto(`http://localhost:${port}/?mode=lab-search&labs=0&welcome=0`);
  await page.waitForTimeout(3000);
  if (await page.locator('#labs-nav').count()) fail.push('bar shown with labs=0');
  await page.goto(`http://localhost:${port}/?mode=lab-search&labs=1&welcome=0`); // restore the switch
  console.log('errors:', errors, 'fail:', fail);
  await browser.close();
  process.exit(errors.length || fail.length ? 1 : 0);
} finally { server.kill(); }
