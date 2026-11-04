// Helper for finding UI hooks: node explore.mjs <playwright> <outdir> <steps.json>; steps: [{url}|{click}|{eval}|{wait ms}|{shot name}|{dump selector}]
import { readFileSync, mkdirSync } from 'node:fs';
const [pw, out, f] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 160)));
for (const s of JSON.parse(readFileSync(f, 'utf8'))) {
  try {
    if (s.url) await p.goto(s.url); if (s.click) await p.click(s.click, { timeout: 8000 }); if (s.wait) await p.waitForTimeout(s.wait);
    if (s.eval) console.log(JSON.stringify(await p.evaluate(s.eval)));
    if (s.shot) await p.screenshot({ path: `${out}/${s.shot}.png` });
    if (s.dump) console.log(await p.$$eval(s.dump, (a) => a.map((e) => `${e.tagName}#${e.id}.${e.className} "${(e.textContent || '').trim().slice(0, 40)}"`).join('\n')));
  } catch (e) { console.log('step failed', JSON.stringify(s), e.message.split('\n')[0]); }
}
await b.close();
