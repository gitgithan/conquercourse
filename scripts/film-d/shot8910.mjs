// Shots 8, 9, 10 (CC-143): Courses page scroll, Dojo gap Try It sliders, Lab 3 hand drag. One script, spec.shot picks the take.
// usage: node shot8910.mjs <playwright> <outdir> <spec.json>; prints JSON {start, end}; shots/*.png are checkpoint stills in <outdir>/../s
import { readFileSync, mkdirSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
mkdirSync('/b/s', { recursive: true });
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage(); const t0 = Date.now();
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(spec.url, { waitUntil: 'load' });
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' });
await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; }));
const shot = (n) => p.screenshot({ path: `/b/s/${spec.shot}_${n}.png` });
const raf = (fn, ms) => p.evaluate(({ fn, ms }) => new Promise((res) => { const f = new Function('u', fn); const s = performance.now(); const e = (x) => x * x * (3 - 2 * x); const g = () => { const u = Math.min(1, (performance.now() - s) / ms); f(e(u)); u < 1 ? requestAnimationFrame(g) : res(); }; g(); }), { fn, ms });
let start;
if (spec.shot === 8) {
  await p.waitForSelector('#courses-btn', { state: 'attached', timeout: 90000 }); await p.waitForTimeout(3000); await p.evaluate(() => document.querySelector('#courses-btn').click()); await p.waitForSelector('.wg-card', { timeout: 30000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => {
    const grp = (re) => [...document.querySelectorAll('.wg *')].find((e) => e.children.length === 0 && re.test(e.textContent));
    const d = grp(/^Dojo \(/), l = grp(/^Labs \(/);
    let sc = d; while (sc && !(sc.scrollHeight > sc.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    sc.dataset.sc = '1'; const r0 = sc.getBoundingClientRect();
    return { dojo: d.getBoundingClientRect().top - r0.top + sc.scrollTop, labs: l.getBoundingClientRect().top - r0.top + sc.scrollTop, h: sc.clientHeight, max: sc.scrollHeight - sc.clientHeight };
  });
  console.error(JSON.stringify(info));
  const a = Math.max(0, info.dojo - 90), z = Math.min(info.max, Math.max(a + 200, info.labs - 40));
  await p.evaluate((a) => { document.querySelector('[data-sc]').scrollTop = a; }, a);
  await p.waitForTimeout(1200); start = Date.now() - t0; const S = Date.now(); await shot('a');
  await raf(`document.querySelector('[data-sc]').scrollTop=${a}+(${z}-${a})*u`, spec.scrollMs); await shot('z');
  await p.waitForTimeout(1200);
} else if (spec.shot === 9) {
  await p.waitForSelector('.dojo', { timeout: 60000 }); if (spec.zoom) await p.addStyleTag({ content: `.dojo.v2{zoom:${spec.zoom}}` }); await p.waitForTimeout(2000); await shot('why');
  start = Date.now() - t0;
  await p.waitForTimeout(1200);
  await p.click('.path .node:nth-child(2)'); await p.waitForSelector('input[type=range]'); await p.waitForTimeout(1000); await shot('try0');
  const knobs = await p.$$eval('input[type=range]', (a) => a.map((x) => [x.id, +x.min, +x.max, +x.value]));
  console.error(JSON.stringify(knobs));
  // scripted slider moves: each knob eases to a second value and back a bit; the graph redraws on every input event
  let k = 0;
  for (const [id, mn, mx, v] of knobs) {
    const to = v + (mx - v) * 0.55, mid = mn + (mx - mn) * 0.2;
    for (const [from, tgt] of [[v, to], [to, mid]]) {
      await raf(`const i=document.getElementById(${JSON.stringify(id)});const v=${from}+(${tgt}-${from})*u;i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))`, spec.moveMs);
      await shot('k' + k++); await p.waitForTimeout(500);
    }
  }
  await p.waitForTimeout(800);
} else {
  await p.waitForSelector('#ik-pic', { timeout: 60000 }); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; })); // the Sound label is added after load
  await p.evaluate(() => { const h = document.querySelector('#ik-h1'); const t = document.createElement('span'); t.textContent = 'University level'; t.style.cssText = 'margin-left:14px;padding:4px 12px;border-radius:999px;background:#0f6b5c;color:#fff;font:700 15px system-ui;vertical-align:middle'; h.append(t); });
  await shot('a');
  const bb = await p.evaluate(() => { const r = document.querySelector('#ik-pic').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  console.error(JSON.stringify(bb));
  const P = (fx, fy) => [bb[0] + bb[2] * fx, bb[1] + bb[3] * fy];
  start = Date.now() - t0; await p.waitForTimeout(800);
  const path = spec.path;
  let [x, y] = P(...path[0]); await p.mouse.move(x, y); await p.mouse.down(); await shot('b');
  for (let i = 1; i < path.length; i++) { const [nx, ny] = P(...path[i]); await p.mouse.move(nx, ny, { steps: spec.steps }); await shot('c' + i); await p.waitForTimeout(250); }
  await p.mouse.up(); await p.waitForTimeout(900);
}
const end = Date.now() - t0; console.log(JSON.stringify({ start, end }));
await ctx.close(); await b.close();
