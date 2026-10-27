// Screenshots of a look in the actor demo at chosen ticks: node shots.mjs OUT_PREFIX LOOK TICK[,TICK...]
// LOOK is "default" (the Rookie) or a look name ("neutral", "tall", "url:/x.glb"); needs `npx vite --port $PORT` (default 5173).
import { chromium } from 'playwright';
const [prefix, look, ticks] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('console', (m) => ['error','warning'].includes(m.type()) && console.log(m.text().slice(0,200)));
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(`http://localhost:${process.env.PORT ?? 5173}/?demo=actor&pose=1&backend=webgl2${look === 'default' ? '' : '&look=' + encodeURIComponent(look)}`);
await p.waitForFunction(() => window.__showTick && window.__ticks, null, { timeout: 120000 });
console.log('ticks', await p.evaluate(() => window.__ticks()));
for (const t of ticks.split(',')) {
  await p.evaluate((t) => window.__showTick(Number(t)), t);
  await p.waitForTimeout(600);
  const j = await p.evaluate(() => window.__joints());
  console.log(t, 'hips', j[0].map((x) => x.toFixed(2)).join(','));
  await p.screenshot({ path: `${prefix}-${t}.png` });
}
await b.close();
