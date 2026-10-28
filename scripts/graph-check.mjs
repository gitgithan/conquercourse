// Graph Studio (CC-86): Tab pauses the Course and opens the ground as a graph; drag a deck up, the verdict updates; "Play from here" reloads on the edited ground.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const query = process.env.QUERY ?? '?'; // the default course loads fastest under the software renderer
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 9000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });

  await page.goto(`http://localhost:${port}/${query}${query === '?' ? '' : '&'}edit=1`);
  try { await page.waitForSelector('#graphchip', { state: 'attached', timeout: 90000 }); } catch (e) { console.log('NO CHIP', await page.evaluate(() => ({ chip: !!document.getElementById('graphchip'), hasText: document.body.innerHTML.includes('Edit the ground'), kids: document.body.children.length })), page.url(), (await page.textContent('body')).slice(0, 200).replace(/\s+/g, ' '), await page.evaluate(() => JSON.stringify(document.documentElement.dataset))); throw e; }
  await page.waitForTimeout(1500);
  mkdirSync('test-results/graph', { recursive: true });
  checks.chipShown = await page.evaluate(() => getComputedStyle(document.getElementById('graphchip')).display !== 'none');
  const xBefore = await page.evaluate(() => Number(document.documentElement.dataset.x));
  await page.keyboard.press('Tab');
  await page.waitForSelector('#graphstudio', { timeout: 10000 });
  checks.opened = true;
  const read = () => page.evaluate(() => JSON.parse(document.documentElement.dataset.graph ?? 'null'));
  // paused: time stands still while the studio is open
  await page.waitForTimeout(1200);
  const xPaused = await page.evaluate(() => Number(document.documentElement.dataset.x));
  checks.pausedWhileOpen = Math.abs(xPaused - xBefore) < 0.5;
  await page.keyboard.press('Space'); // the game must not hear keys while the studio is open
  await page.waitForTimeout(300);
  // wait for the baseline verdict
  let g = await read();
  for (let i = 0; i < 120 && g.baseline === 'working'; i++) { await page.waitForTimeout(1000); g = await read(); }
  checks.baseline = g.baseline; checks.baselineSeconds = g.baselineSeconds;
  await page.screenshot({ path: 'test-results/graph/open.png' });
  // double-click a deck: a gap is cut into it (three more handles), "Undo my edits" takes it back
  const top0 = g.handles.find((q) => q.id === 'top:0');
  await page.mouse.dblclick(top0.sx + 90, top0.sy + 40);
  await page.waitForTimeout(300);
  const split = await read();
  checks.splitAddsHandles = split.handles.length > g.handles.length && split.changes > 0;
  await page.click('#gsreset');
  await page.waitForTimeout(300);
  const undone = await read();
  checks.undoRestores = undone.changes === 0 && undone.handles.length === g.handles.length;
  // drag the first deck's top handle that is not the runner's deck: raise it
  const h = g.handles.find((q) => q.id === 'top:1') ?? g.handles.find((q) => q.id.startsWith('top:'));
  checks.handleFound = !!h;
  await page.mouse.move(h.sx, h.sy); await page.mouse.down();
  await page.mouse.move(h.sx, h.sy - 25, { steps: 5 }); await page.mouse.move(h.sx, h.sy - 45, { steps: 5 });
  await page.waitForTimeout(100);
  const mid = await read();
  checks.changesWhileDragging = mid.changes;
  checks.verdictWorkingAfterDrag = mid.verdict === 'working';
  await page.mouse.up();
  await page.screenshot({ path: 'test-results/graph/dragged.png' });
  let after = await read();
  for (let i = 0; i < 120 && after.verdict === 'working'; i++) { await page.waitForTimeout(1000); after = await read(); }
  checks.verdictAfter = after.verdict; checks.secondsAfter = after.seconds;
  checks.words = await page.textContent('#gschanges');
  await page.screenshot({ path: 'test-results/graph/verdict.png' });
  // play from here: the page reloads on the edited ground
  const topBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('cc.course')).terrain.platforms[1]?.top);
  await Promise.all([page.waitForNavigation({ timeout: 60000 }), page.click('#gsplay')]);
  await page.waitForSelector('#graphchip', { state: 'attached', timeout: 90000 });
  await page.waitForTimeout(1500);
  const topAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('cc.course')).terrain.platforms[1]?.top);
  checks.platformRaised = topAfter > topBefore;
  checks.studioClosedAfterReload = (await page.$('#graphstudio')) === null;
  checks.runningAfter = Number.isFinite(await page.evaluate(() => Number(document.documentElement.dataset.x)));
  await page.screenshot({ path: 'test-results/graph/after.png' });
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
