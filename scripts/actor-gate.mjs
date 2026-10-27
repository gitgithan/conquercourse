// CC-31: export the posed Rookie actor over stretches of the real simulator run (30 fps, the clips' axes) for the plausibility gate.
// Usage: node scripts/actor-gate.mjs [a|b] -> data/eval/cc-31-actor/posed-<stretch>-<rookie>.json
// Then:  uv run --no-project --with numpy python -I pipelines/gate_posed.py data/eval/cc-31-actor/posed-run-a.json ...
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const rookie = process.argv[2] ?? 'a';
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
// the run: from the start through the sprint; the leap: from the last strides, through the flight, to the run on
const STRETCHES = { run: [120, 480], leap: [440, 680] };
mkdirSync('data/eval/cc-31-actor', { recursive: true });
const server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://localhost:5173/?demo=actor&pose=1&rookie=${rookie}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  for (const [name, [a, b]] of Object.entries(STRETCHES)) {
    const frames = await page.evaluate(([a, b]) => {
      const out = [];
      for (let t = a - 20; t <= b; t++) {
        window.__showTick(t);
        if (t >= a && (t - a) % 4 === 0) out.push(window.__joints());
      }
      return out;
    }, [a, b]);
    writeFileSync(`data/eval/cc-31-actor/posed-${name}-${rookie}.json`, JSON.stringify({ fps: 30, frames }, null, 2) + '\n');
    console.log(name, frames.length, 'frames');
  }
  await browser.close();
} finally {
  server.kill();
}
