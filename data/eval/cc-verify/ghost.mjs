// CC-186 (2): ghost and player both visible by default. (a) the bot on the ideal line with ?ghost=bot: they overlap exactly; (b) a person-like run: the ghost ahead; N cycles. Also logs every 404.
import { launch, ok, save, shot, base, stepInit, OUT } from './lib.mjs';
const b = await launch();
const step = (page, ms, n = 1) => page.evaluate(async ([ms, n]) => { for (let i = 0; i < n; i++) { window.__stepClock(ms); await new Promise((r) => requestAnimationFrame(() => r())); } }, [ms, n]);
async function open(q, ms = 0) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(base, '')); });
  await page.addInitScript(stepInit);
  await page.goto(`${base}/?${q}&welcome=0&tour=0`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
  return { page, bad };
}
const st = (page) => page.evaluate(() => ({ chip: document.querySelector('#ghost-chip')?.textContent, gap: document.querySelector('#ghost-gap')?.textContent, look: document.body.dataset.ghostLook, x: document.documentElement.dataset.x, tick: document.documentElement.dataset.tick }));
// (a) overlap
{
  const { page, bad } = await open('bot=ideal&ghost=bot');
  await step(page, 200, 5);
  let s; for (let i = 0; i < 40; i++) { s = await st(page); if (/Ideal run/.test(s.chip ?? '')) break; await page.waitForTimeout(500); await step(page, 16, 1); }
  console.log('ghost ready', JSON.stringify(s));
  await step(page, 200, 9); await shot(page, 'ghost-overlap-at-1-8s');
  const s1 = await st(page); await step(page, 200, 12); await shot(page, 'ghost-overlap-at-4s'); const s2 = await st(page);
  console.log(JSON.stringify([s1, s2]), bad.join(','));
  ok('2 ghost', 'bot on the ideal line: chip says Ideal run and gap is level', /Ideal run/.test(s2.chip ?? '') && /Level/.test(s2.gap ?? ''), JSON.stringify(s2));
  ok('2 ghost', 'ghost look (amber Rookie) loaded', !!s2.look, String(s2.look));
  ok('2 ghost', 'no 404 on the default course', bad.length === 0, bad.join(','));
  await page.close();
}
// (b) person-like run, ghost ahead
{
  const { page } = await open('');
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 40; i++) { const s = await st(page); if (/Ideal run/.test(s.chip ?? '') && s.look) break; await step(page, 100, 3); await page.waitForTimeout(300); }
  console.log('b ready', JSON.stringify(await st(page)));
  await step(page, 100, 10); await shot(page, 'ghost-run-ahead-1'); console.log(JSON.stringify(await st(page)));
  await step(page, 100, 10); await shot(page, 'ghost-run-ahead-2'); console.log(JSON.stringify(await st(page)));
  const modes = [];
  for (let k = 0; k < 5; k++) { await page.keyboard.press('KeyN'); await step(page, 16, 3); modes.push((await st(page)).chip); }
  console.log('N', modes.join(' -> '));
  ok('2 ghost', 'N cycles modes', new Set(modes).size >= 2, modes.join(' -> '));
  await page.keyboard.up('ArrowRight'); await page.close();
}
// training course 404s
{
  const { page, bad } = await open('course=/assets/demo/training.course.json');
  await step(page, 100, 10); await page.waitForTimeout(1500);
  ok('1 training', 'no 404 when the Training course loads', bad.length === 0, bad.join(' , '));
  await page.close();
}
save('run-ghost.json'); await b.close();
