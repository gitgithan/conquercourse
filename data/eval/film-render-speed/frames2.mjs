// usage: node frames2.mjs <playwright path> <mode soft|gpu> <base> <outdir>
const [pw, mode, base, out] = process.argv.slice(2);
const { chromium } = await import(pw);
const { mkdirSync } = await import('node:fs'); mkdirSync(out, { recursive: true });
const args = mode === 'gpu' ? ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu-rasterization']
  : ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const b = await chromium.launch({ args });
const pages = { course: '/?welcome=0', editor: '/?mode=editor&welcome=0', slicer: '/?mode=slicer&welcome=0', dojo: '/?mode=dojo&ex=coaster&welcome=0&tab=2' };
for (const [name, path] of Object.entries(pages)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(`(() => { let t = 1000; performance.now = () => t; const D = 1.7e12; Date.now = () => D + t; window.__stepClock = (ms) => { t += ms; return t; }; })();`);
  await p.goto(base + path); await p.waitForTimeout(8000);
  for (let i = 0; i < 3; i++) await p.evaluate((ms) => { window.__stepClock(ms); return new Promise((r) => requestAnimationFrame(r)); }, 1000 / 24);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${name}.png` });
  await p.close();
}
await b.close();
