// End to end, on the built site with local Pages functions and a local database:
// upload a photo, draw two boxes, type a height, make the course, share it, approve it, find it in the gallery, play it.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '8788';
const server = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', port, '--d1=DB=153f511c-2d03-4442-b7cb-9f988a84becd'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', '--local', '--command', q], { encoding: 'utf8' });
try {
  await new Promise((r) => setTimeout(r, 9000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('test-results/community', { recursive: true });
  // a photo made on the spot: sky, ground, a block and a low wall
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d');
    g.fillStyle = '#9ec5ea'; g.fillRect(0, 0, 900, 600); g.fillStyle = '#6a8f4f'; g.fillRect(0, 400, 900, 200);
    g.fillStyle = '#9b9488'; g.fillRect(120, 300, 300, 120); g.fillRect(520, 340, 280, 80);
    return c.toDataURL('image/png').split(',')[1];
  });
  const { writeFileSync } = await import('node:fs');
  writeFileSync('test-results/community/photo.png', Buffer.from(png, 'base64'));
  await page.goto(`http://localhost:${port}/?mode=park`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.setInputFiles('#upload', 'test-results/community/photo.png');
  await page.waitForSelector('.stage img');
  const stage = await page.$('.stage');
  const bb = await stage.boundingBox();
  const drag = async (x0, y0, x1, y1) => { await page.mouse.move(bb.x + x0 * bb.width, bb.y + y0 * bb.height); await page.mouse.down(); await page.mouse.move(bb.x + x1 * bb.width, bb.y + y1 * bb.height, { steps: 6 }); await page.mouse.up(); };
  await drag(0.13, 0.5, 0.47, 0.7);
  await page.selectOption('#what', 'platform'); await page.fill('#heightm', '0.6');
  await drag(0.58, 0.57, 0.89, 0.7);
  await page.selectOption('#what', 'wall');
  const checks = { boxesDrawn: (await page.$$('.box')).length === 2 };
  await page.click('#make');
  await page.waitForSelector('#proof');
  checks.proved = (await page.textContent('#proof')).includes('found a way');
  checks.sizeFromMaker = (await page.textContent('.park table')).includes('from the height you typed');
  await page.fill('#cname', 'Test blocks'); await page.fill('#cnick', 'tester');
  await page.click('#sharego');
  checks.needsTick = (await page.textContent('#sharenote')).includes('tick');
  await page.check('#cok'); await page.click('#sharego');
  await page.waitForSelector('#shared', { timeout: 20000 });
  checks.pending = /pending/.test(sql("SELECT status FROM community WHERE name = 'Test blocks'"));
  await page.goto(`http://localhost:${port}/?mode=gallery`);
  await page.waitForFunction(() => document.documentElement.dataset.galleryReady === 'true', null, { timeout: 30000 });
  checks.hiddenUntilApproved = (await page.$$('.card[data-key^=c]')).length === 0;
  sql("UPDATE community SET status = 'approved' WHERE name = 'Test blocks'");
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.galleryReady === 'true', null, { timeout: 30000 });
  console.log('status:', await page.textContent('.gal .muted:nth-of-type(2)').catch(() => ''), await page.evaluate(async () => (await fetch('/api/community')).text()));
  console.log(checks);
  const card = await page.$('.card[data-key^=c]');
  checks.shownAfterApproval = !!card && (await card.textContent()).includes('Test blocks') && (await card.textContent()).includes('tester');
  checks.photoLoads = card ? await card.$eval('img', (i) => new Promise((r) => { if (i.complete) r(i.naturalWidth > 0); else i.onload = () => r(true), i.onerror = () => r(false); })) : false;
  checks.starters = (await page.$$('.card[data-key^=park]')).length >= 3;
  await page.screenshot({ path: 'test-results/community/gallery.png' });
  await card.$('button.go').then((b) => b.click());
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' && Number(document.documentElement.dataset.tick) >= 0, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  checks.playsInCourse = (await page.$('.gal')) === null && /m of/.test(await page.textContent('body'));
  await page.screenshot({ path: 'test-results/community/play.png' });
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); try { sql("DELETE FROM community WHERE name = 'Test blocks'"); } catch { /* ok */ } }
