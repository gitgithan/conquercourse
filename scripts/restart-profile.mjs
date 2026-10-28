// Usage: PORT=5490 SEED=5 node scripts/restart-profile.mjs   (CC-69)
// Like restart-check, but with the browser's CPU profiler on the page thread: prints what the main thread spent its time on until the fall panel showed.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? String(20000 + Math.floor(Math.random() * 20000)), seed = process.env.SEED ?? '5', maxWaitS = Number(process.env.MAXWAIT ?? 150);
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  // make sure the server answering is this tree's own (a busy port would be some other worktree's server)
  const served = await (await fetch(`http://localhost:${port}/src/modes/course.ts`)).text();
  console.log('served code has the stored-windows tip:', served.includes('windowTip'));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.goto(`http://localhost:${port}/?generate=${seed}`);
  await page.waitForSelector('canvas', { timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.x !== undefined, null, { timeout: 120000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
  await page.keyboard.down('ArrowRight');
  const t1 = Date.now(); let shown = false, i = 0;
  while (Date.now() - t1 < maxWaitS * 1000) {
    if (i++ % 2 === 0) await page.keyboard.press('Space');
    await page.waitForTimeout(350);
    shown = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /again \(R\)/.test(b.textContent ?? '') && b.offsetParent !== null));
    if (shown) break;
  }
  await page.keyboard.up('ArrowRight');
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map(); let total = 0;
  profile.samples.forEach((id, k) => { const n = byId.get(id); const f = n.callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`; self.set(key, (self.get(key) ?? 0) + profile.timeDeltas[k]); total += profile.timeDeltas[k]; });
  const parent = new Map(); profile.nodes.forEach((n) => (n.children ?? []).forEach((c) => parent.set(c, n.id)));
  const hits = new Map(); profile.samples.forEach((id, k) => { const n = byId.get(id); if (n.callFrame.functionName === 'playPlan') { hits.set(id, (hits.get(id) ?? 0) + profile.timeDeltas[k]); } });
  const top = [...hits.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) { const chain = []; let cur = top[0]; while (cur !== undefined) { const f = byId.get(cur).callFrame; chain.push(`${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`); cur = parent.get(cur); } console.log('CHAIN (innermost first):'); chain.slice(0, 14).forEach((c) => console.log('   ', c)); }
  console.log('panelShown', shown, 'seconds', Math.round((Date.now() - t1) / 100) / 10);
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(String(Math.round(v / 1000)).padStart(7), 'ms', k));
  await browser.close();
} finally { server.kill(); }
