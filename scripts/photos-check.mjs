// CC-85: the real photos beside the real worlds. Play on each OSM course shows the strip; a click opens the large view with the credit;
// the arrow keys move between photos, Esc closes it; the strip does not cover the corner window; the images are lazy loaded; map mode shows them for a famous place.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.env.OUT ?? 'test-results/photos'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const courses = [['montmartre-paris', 3], ['eixample-barcelona', 2], ['circular-quay-sydney', 3], ['san-francisco-lombard', 3]];
const checks = {}, notes = [];
const overlap = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const [vw, vh] of [[1280, 720], [1024, 640]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    for (const [slug, n] of courses) {
      const tag = `${slug}@${vw}x${vh}`;
      await page.goto(`http://localhost:${port}/?course=/assets/experiments/osm/${slug}.course.json&front=1`);
      await page.waitForSelector('#placephotos', { timeout: 150000 });
      checks[`${tag}: strip with ${n} photos`] = (await page.$$('#placephotos .pp-thumb')).length === n;
      checks[`${tag}: images lazy loaded`] = await page.$$eval('#placephotos img', (xs) => xs.every((x) => x.loading === 'lazy'));
      checks[`${tag}: credit under every photo`] = await page.$$eval('#placephotos .pp-credit', (xs) => xs.length > 0 && xs.every((x) => /, (CC0|CC BY|Public)/.test(x.textContent ?? '')));
      // the strip does not cover the corner window or the HUD cards
      const strip = await page.locator('#placephotos').boundingBox();
      const pip = await page.locator('#frontview').boundingBox().catch(() => null);
      checks[`${tag}: strip is on screen`] = !!strip && strip.x >= 0 && strip.y >= 0 && strip.x + strip.width <= vw && strip.y + strip.height <= vh;
      checks[`${tag}: strip clear of the corner window`] = !pip || !overlap(strip, pip);
      const others = await page.$$eval('body > div, body > button, body > select', (xs) => xs.filter((x) => getComputedStyle(x).position === 'fixed' && x.id !== 'placephotos' && x.offsetWidth > 20 && x.offsetHeight > 10 && !x.hidden && getComputedStyle(x).display !== 'none' && getComputedStyle(x).pointerEvents !== 'none').map((x) => { const r = x.getBoundingClientRect(); return { id: x.id || x.className || x.tagName, x: r.x, y: r.y, width: r.width, height: r.height }; }));
      const hit = others.filter((o) => overlap(strip, o)).map((o) => o.id);
      checks[`${tag}: strip clear of the other cards`] = hit.length === 0; if (hit.length) notes.push(`${tag} overlaps ${hit.join(', ')}`);
      await page.waitForFunction(() => [...document.querySelectorAll('#placephotos img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 }).catch(() => {});
      if (slug === 'montmartre-paris') await page.screenshot({ path: `${out}/${slug}-${vw}x${vh}-strip.png` });
      // the large view
      await page.locator('#placephotos .pp-thumb').first().click();
      await page.waitForSelector('#placephotos-view');
      const cap = await page.textContent('#placephotos-view .pp-caption');
      checks[`${tag}: caption names place, author, licence`] = /^Real photo of .+, .+, (CC0|CC BY|Public)/.test(cap ?? '');
      checks[`${tag}: where is this`] = /^Where is this\?/.test((await page.textContent('#placephotos-view .pp-where')) ?? '');
      checks[`${tag}: licence link`] = (await page.$$eval('#placephotos-view .pp-licence a', (xs) => xs.map((x) => x.href))).some((h) => h.includes('creativecommons.org')) ;
      if (slug === 'montmartre-paris') await page.screenshot({ path: `${out}/${slug}-${vw}x${vh}-large.png` });
      await page.keyboard.press('ArrowRight');
      checks[`${tag}: arrow moves on`] = (await page.getAttribute('#placephotos-view', 'data-index')) === '1';
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
      checks[`${tag}: arrows wrap round`] = (await page.getAttribute('#placephotos-view', 'data-index')) === String(n - 1);
      const x0 = await page.evaluate(() => document.documentElement.dataset.x);
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight'); // the arrow key must move the photo, never the runner
      await page.keyboard.press('Escape');
      checks[`${tag}: Esc closes`] = (await page.$('#placephotos-view')) === null;
      await page.waitForTimeout(400);
      checks[`${tag}: the runner did not move while the photo was open`] = (await page.evaluate(() => document.documentElement.dataset.x)) === x0;
    }
    checks[`${vw}x${vh}: no page errors`] = errors.length === 0; if (errors.length) notes.push(errors.join(' | '));
    // the hide switch is remembered
    await page.goto(`http://localhost:${port}/?course=/assets/experiments/osm/montmartre-paris.course.json`);
    await page.waitForSelector('#placephotos');
    await page.click('#placephotos .pp-sw');
    checks[`${vw}x${vh}: hide switch hides the thumbnails`] = !(await page.locator('#placephotos .pp-row').isVisible());
    await page.reload(); await page.waitForSelector('#placephotos');
    checks[`${vw}x${vh}: hidden choice is remembered`] = !(await page.locator('#placephotos .pp-row').isVisible());
    await page.click('#placephotos .pp-sw');
    checks[`${vw}x${vh}: switch brings them back`] = await page.locator('#placephotos .pp-row').isVisible();
    // a course that is not a real place has no strip
    await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json`);
    await page.waitForSelector('#democourses'); await page.waitForTimeout(800);
    checks[`${vw}x${vh}: no strip on the lache demo`] = (await page.$('#placephotos')) === null;
    await page.close();
  }
  // map mode: choosing a famous place shows its photos in the side panel
  const mp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await mp.goto(`http://localhost:${port}/?mode=map`);
  await mp.waitForSelector('#searchform', { timeout: 60000 });
  await mp.fill('#search', 'Montmartre'); await mp.click('#searchgo');
  const hitSel = '#hits button';
  const gotHits = await mp.waitForSelector(hitSel, { timeout: 30000 }).then(() => true, () => false);
  if (!gotHits) notes.push('search gave no buttons');
  else await mp.locator(hitSel).first().click();
  const strip = await mp.waitForSelector('#placephotos', { timeout: 20000 }).then(() => true, () => false);
  checks['map: photos appear for a famous place'] = strip;
  if (strip) { await mp.waitForFunction(() => [...document.querySelectorAll('#placephotos img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 }).catch(() => {}); await mp.screenshot({ path: `${out}/map-strip.png` }); }
  await browser.close();
} finally { server.kill(); }
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ failed: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k), total: Object.keys(checks).length, notes, pass }, null, 2));
writeFileSync(`${out}/run.json`, JSON.stringify({ checks, notes, pass }, null, 2) + '\n');
process.exit(pass ? 0 : 1);
