// CC-90: the "Street photos" experience is visible: chips on the picker cards, a panel in the Slicer with thumbnails along the lane, a coverage line, a large view with the credit, and ?streetphotos=0 turns it off.
// The photo service is faked here (no token, no network, no real pictures). OUT=dir. Desktop 1280 px only.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5193', out = process.env.OUT ?? 'data/eval/cc-90-street-photos'; mkdirSync(out, { recursive: true });
const slug = process.env.PLACE ?? 'edinburgh-old-town';
const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, notes = [], CDN = 'https://thumbs.example.test/';
const svg = (id) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${['#c0504d', '#4f81bd', '#9bbb59', '#8064a2', '#f79646'][Number(id.slice(-2)) % 5]}"/><text x="12" y="104" font-size="22" fill="#fff" font-family="sans-serif">stand-in picture ${id.slice(-4)}</text></svg>`;
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  for (const off of [false, true]) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    page.on('pageerror', (e) => notes.push('pageerror ' + e.message.slice(0, 120)));
    await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
    await page.route(`${CDN}**`, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(/\/(\d+)\.svg/.exec(r.request().url())?.[1] ?? '0') }));
    await page.route('**/api/photos**', (r) => { const ids = (new URL(r.request().url()).searchParams.get('id') ?? '').split(',').filter(Boolean); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: ids.map((id) => ({ id, thumb: `${CDN}${id}.svg`, creator: 'test-creator', capturedAt: Date.UTC(2021, 5, 1) })) }) }); });
    const tag = off ? 'off' : 'on';
    await page.goto(`http://localhost:${port}/?mode=map&lat=${place.lat}&lon=${place.lon}&z=16${off ? '&streetphotos=0' : ''}`);
    await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => {});
    await page.waitForSelector('.ready-list .card', { timeout: 30000 });
    await page.waitForTimeout(800);
    const chips = await page.$$eval('.ready-list .card .sp', (xs) => xs.map((x) => x.closest('.card').dataset.slug));
    checks[`picker chips ${tag}`] = off ? chips.length === 0 : chips.length === 3 && ['edinburgh-old-town', 'eixample-barcelona', 'montmartre-paris'].every((s) => chips.includes(s));
    notes.push(`${tag}: chips on ${chips.join(', ') || 'none'}`);
    if (!off) await page.locator('.ready-list').first().screenshot({ path: `${out}/picker-chips.png` }).catch(() => {});
    const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.click('#build'); await page.waitForSelector('#slice:not([disabled])', { timeout: 90000 });
    await page.click('#slice');
    await page.waitForFunction(() => document.documentElement.dataset.sliceLane === 'clearable', null, { timeout: 60000 });
    if (off) { await page.waitForTimeout(2500); checks['panel absent with ?streetphotos=0'] = (await page.$('#streetpanel')) === null; continue; }
    await page.waitForFunction(() => document.getElementById('streetpanel')?.dataset.thumbs, null, { timeout: 30000 });
    const line = await page.textContent('#streetline'), n = await page.$$eval('#streetthumbs #placephotos img', (xs) => xs.length);
    checks['coverage line says whole, part or none'] = /Street photos (along your whole lane|along part of your lane|: none here yet)/.test(line);
    checks['thumbnails show'] = n >= 1 && n <= 6; notes.push(`${slug}: "${line}" with ${n} thumbnails`);
    await page.locator('#streetpanel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/slicer-panel-${slug}.png` });
    await page.click('#streetthumbs #placephotos img');
    await page.waitForSelector('#placephotos-view', { timeout: 10000 });
    const credit = await page.textContent('#placephotos-view');
    checks['large view names creator, licence and Mapillary'] = /test-creator/.test(credit) && /CC BY-SA 4\.0/.test(credit) && /Mapillary/i.test(credit);
    await page.screenshot({ path: `${out}/slicer-photo-large-${slug}.png` });
  }
  await browser.close();
} catch (e) { checks.threw = String(e).slice(0, 200); }
server.kill();
writeFileSync(`${out}/run.json`, JSON.stringify({ checks, notes }, null, 2) + '\n');
console.log(JSON.stringify({ checks, notes }, null, 2));
