// CC-133: the same place and camera with the sky light off and on, at 1280 px, on the stepped clock; plus a frame-time comparison.
// Usage: node scripts/cc133-sky-shots.mjs <outdir> <port> [shots|perf|all]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'docs/evidence/cc-133-sky-light', port = process.argv[3] ?? '5744', what = process.argv[4] ?? 'all';
mkdirSync(out, { recursive: true });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const base = `http://localhost:${port}`;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const report = { shots: [], perf: [], errors: [] };
// a place becomes the editor's world exactly as the map's Build button does it: the extruded buildings as one piece, the place's position kept for the sun
async function openEditor(browser, slug, sky, sunat, cam, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => report.errors.push(`${slug}: ${e.message}`));
  await page.addInitScript(stepped);
  await page.goto(`${base}/?mode=map&welcome=0&music=0&flight=0`);
  await page.evaluate(async ({ slug, cam }) => {
    const osm = await import('/src/world/osm.ts');
    const place = await (await fetch(`/assets/places/${slug}.json`)).json();
    const m = osm.osmToMesh(place.answer, place.lat, place.lon, undefined, place.ground ? { radius: place.radius, ...place.ground } : null);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < m.positions.length; i += 3) { x0 = Math.min(x0, m.positions[i]); x1 = Math.max(x1, m.positions[i]); z0 = Math.min(z0, m.positions[i + 2]); z1 = Math.max(z1, m.positions[i + 2]); }
    const dist = Math.max(x1 - x0, z1 - z0) * (cam.zoom ?? 0.9);
    sessionStorage.setItem('cc.map.piece', JSON.stringify({ name: place.name, positions: Array.from(m.positions), indices: Array.from(m.indices), camera: { heading: cam.heading, pitch: cam.pitch, distance: dist, target: { x: (x0 + x1) / 2, z: (z0 + z1) / 2 } } }));
    sessionStorage.setItem('cc.map.sun', JSON.stringify({ lat: place.lat, lon: place.lon }));
  }, { slug, cam });
  await page.goto(`${base}/?mode=editor&welcome=0&music=0&skylight=${sky ? 1 : 0}${sunat ? `&sunat=${sunat}` : ''}${extra}`);
  await page.waitForSelector('#view3d', { timeout: 120000 });
  await page.waitForTimeout(6000);
  await page.evaluate(async () => { for (let i = 0; i < 6; i++) { window.__stepClock(16); await new Promise((r) => requestAnimationFrame(r)); } });
  return page;
}
async function shot(page, file, meta) { await page.screenshot({ path: `${out}/${file}.png` }); report.shots.push({ file, ...meta }); console.log('shot', file); }
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  if (what === 'all' || what === 'shots') {
    const places = [
      { slug: 'montmartre-paris', kind: 'street', cam: { heading: 30, pitch: 62, zoom: 0.55 } },
      { slug: 'gerlev-parkour-park', kind: 'parkour park', cam: { heading: 30, pitch: 62, zoom: 0.8 } },
    ];
    for (const p of places) {
      for (const sky of [false, true]) { const page = await openEditor(browser, p.slug, sky, null, p.cam); await shot(page, `editor-${p.slug}-${sky ? 'on' : 'off'}`, { place: p.slug, kind: p.kind, view: 'editor', sky }); await page.close(); }
    }
    for (const t of ['morning', 'noon', 'golden', 'dusk']) { const page = await openEditor(browser, 'montmartre-paris', true, t, places[0].cam); await shot(page, `editor-montmartre-paris-${t}`, { place: 'montmartre-paris', view: 'editor', sky: true, preset: t }); await page.close(); }
    // low camera: the one that shows shadows on walls and fog
    for (const sky of [false, true]) { const page = await openEditor(browser, 'montmartre-paris', sky, 'golden', { heading: 60, pitch: 82, zoom: 0.18 }); await shot(page, `editor-montmartre-paris-low-${sky ? 'on' : 'off'}`, { place: 'montmartre-paris', view: 'editor low', sky }); await page.close(); }
    // the Course over the same place (the hero lane with the place's buildings behind it)
    for (const [sky, t] of [[false, null], [true, 'golden'], [true, 'morning'], [true, 'noon'], [true, 'dusk']]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (e) => report.errors.push(`course: ${e.message}`));
      await page.addInitScript(stepped);
      await page.goto(`${base}/?course=/assets/demo/hero-montmartre-paris.course.json&photos=0&backdrop=montmartre-paris&welcome=0&music=0&skylight=${sky ? 1 : 0}${t ? `&sunat=${t}` : ''}`);
      await page.waitForSelector('html[data-ready=true]', { timeout: 400000 });
      const step = (n) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) { window.__stepClock(1000 / 60); await new Promise((r) => requestAnimationFrame(r)); } }, n);
      await step(30);
      await page.waitForFunction(() => document.documentElement.dataset.backdrop !== undefined, null, { timeout: 60000 }).catch(() => {});
      await step(40);
      await shot(page, `course-montmartre-paris-${sky ? t ?? 'on' : 'off'}`, { place: 'montmartre-paris', view: 'course', sky, preset: t, backdrop: await page.evaluate(() => document.documentElement.dataset.backdrop ?? null) });
      await page.close();
    }
  }
  if (what === 'all' || what === 'perf') {
    // real wall-clock frame times (no stepped clock): software GL is slow, so only the ratios mean anything
    for (const [label, q] of [['off', 'skylight=0'], ['on, no shadows', 'skylight=1&shadows=0'], ['on, shadows', 'skylight=1']]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(`${base}/?course=/assets/demo/hero-montmartre-paris.course.json&photos=0&backdrop=montmartre-paris&welcome=0&music=0&${q}`);
      await page.waitForSelector('html[data-ready=true]', { timeout: 400000 });
      await page.waitForTimeout(8000);
      const r = await page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(); const f = (n) => { t.push(n - last); last = n; if (t.length < 90) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ mean: t.reduce((a, b) => a + b, 0) / t.length, median: t[Math.floor(t.length / 2)], p90: t[Math.floor(t.length * 0.9)] }); } }; requestAnimationFrame(f); }));
      report.perf.push({ view: 'course', label, ...r }); console.log('perf course', label, JSON.stringify(r));
      await page.close();
    }
    for (const [label, sky, sh] of [['off', 0, 1], ['on, no shadows', 1, 0], ['on, shadows', 1, 1]]) {
      const page = await openEditor(browser, 'montmartre-paris', !!sky, 'golden', { heading: 30, pitch: 62, zoom: 0.55 }, sh ? '' : '&shadows=0');
      const r = await page.evaluate(() => new Promise((res) => { const el = document.getElementById('view3d'); const t = []; let last = performance.now(); const f = (n) => { el.dispatchEvent(new WheelEvent('wheel', { deltaY: t.length % 2 ? 4 : -4, bubbles: true, clientX: 640, clientY: 360 })); t.push(n - last); last = n; if (t.length < 60) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ mean: t.reduce((a, b) => a + b, 0) / t.length, median: t[Math.floor(t.length / 2)], p90: t[Math.floor(t.length * 0.9)] }); } }; requestAnimationFrame(f); }));
      report.perf.push({ view: 'editor', label, ...r }); console.log('perf editor', label, JSON.stringify(r));
      await page.close();
    }
  }
  await browser.close();
} finally { server.kill(); writeFileSync(`${out}/run-shots.json`, JSON.stringify(report, null, 2) + '\n'); }
