// real-time recording of one app page. usage: node grec.mjs <playwright> <outdir> <spec.json>
// spec: {url, lead (s, recorded then trimmed), seconds, ready (selector), actions:[{t, key|down|up|click|eval|move|drag}]}
import { readFileSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage(); const t0 = Date.now();
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(spec.url);
await p.waitForSelector(spec.ready || 'html[data-ready=true]', { timeout: 120000 }).catch(() => console.error('not ready'));
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' });
await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; }));
for (const s of spec.pre || []) { if (s.click) await p.click(s.click).catch(() => {}); if (s.wait) await p.waitForTimeout(s.wait * 1000); if (s.eval) await p.evaluate(s.eval); }
await p.waitForFunction('window.__filmRunner', null, { timeout: 90000 }).catch(() => console.error('no runner'));
await p.waitForTimeout((spec.lead || 1) * 1000);
await p.evaluate(() => window.__filmZero?.());
const start = Date.now() - t0; const T = Date.now();
for (const a of (spec.actions || []).sort((x, y) => x.t - y.t)) {
  const wait = a.t * 1000 - (Date.now() - T); if (wait > 0) await p.waitForTimeout(wait);
  try {
    if (a.key) await p.keyboard.press(a.key);
    if (a.down) await p.keyboard.down(a.down);
    if (a.up) await p.keyboard.up(a.up);
    if (a.click) await p.click(a.click);
    if (a.eval) await p.evaluate(a.eval);
    if (a.move) await p.mouse.move(a.move[0], a.move[1], { steps: a.steps || 20 });
  } catch (e) { console.error('action failed', JSON.stringify(a), e.message.split('\n')[0]); }
}
const rest = spec.seconds * 1000 - (Date.now() - T); if (rest > 0) await p.waitForTimeout(rest);
const end = Date.now() - t0; console.log(JSON.stringify({ start, end }));
await ctx.close(); await b.close();
