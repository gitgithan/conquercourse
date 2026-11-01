// usage: node bench.mjs <playwright path> <label> <url> [gpu]
const [pw, label, url, mode] = process.argv.slice(2);
const { chromium } = await import(pw);
const args = mode === 'gpu' ? ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu-rasterization']
  : ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const b = await chromium.launch({ args });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url); await p.waitForSelector('html[data-ready=true]', { timeout: 120000 }).catch(() => {});
const r = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); });
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 5000) res(n / 5); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
const t0 = Date.now();
for (let i = 0; i < 20; i++) { await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await p.screenshot({ path: `/tmp/bench/${label}-${i}.png` }); }
console.log(JSON.stringify({ label, renderer: r, liveFps: +fps.toFixed(1), twentyFramesSeconds: +((Date.now() - t0) / 1000).toFixed(1) }));
await b.close();
