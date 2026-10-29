// CC-138 finding: what does a phone (390 x 844, touch) show today? Screenshots only, nothing is changed.
import { chromium, devices } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/phone-today'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5884);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/lache.course.json', `http://localhost:${port}`]).toString().trim();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const dev = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };
for (const [name, url] of [['link', `${link}&welcome=0&tour=0`], ['bare', `http://localhost:${port}/?welcome=0&tour=0`]]) {
  const page = await (await b.newContext(dev)).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(25000);
  await page.screenshot({ path: `${out}/${name}-1.png` });
  // a tap on the screen: does anything move?
  await page.touchscreen.tap(195, 600);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/${name}-2.png` });
  const info = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight,
    coarse: matchMedia('(pointer: coarse)').matches, hover: matchMedia('(hover: hover)').matches, touchPoints: navigator.maxTouchPoints,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
    buttons: [...document.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim().slice(0, 30)).slice(0, 25),
    ghost: document.querySelector('#ghost-chip')?.textContent, banner: document.querySelector('#challenge-banner')?.innerText,
  }));
  console.log(name, JSON.stringify(info), errs.join(' | ').slice(0, 200));
  await page.context().close();
}
await b.close(); vite.kill();
