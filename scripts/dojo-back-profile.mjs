// CC-243: where the Course spends its time after a visit to the Dojo (a CPU profile of the page). Run: PORT=5199 node scripts/dojo-back-profile.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5199';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const base = `http://localhost:${port}/`;
  await page.goto(base); await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 0, null, { timeout: 200000 }); await page.waitForTimeout(2000);
  await page.goto(`${base}?mode=dojo&welcome=0`); await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  const t = Date.now();
  await page.goBack(); await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 0, null, { timeout: 200000 }); await page.waitForTimeout(3000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); });
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const incl = new Map();
  profile.samples.forEach((id, i) => { const seen = new Set(); for (let x = id; x !== undefined; x = parent.get(x)) { const n = byId.get(x); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber}`; if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); } } });
  console.log('INCLUSIVE'); console.log([...incl].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(0)} ms  ${k}`).join('\n'));
  console.log('total ms', Date.now() - t);
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v.toFixed(0)} ms  ${k}`).join('\n'));
  await browser.close();
} finally { server.kill(); }
