// Characterization of the World editor: drives the toolbar, the add menu, the knobs, undo/redo, copy/paste, Moves and the Fix menu,
// and writes what it sees as JSON. Run it before and after a refactor and diff the two files (node scripts/editor-characterize.mjs out.json).
// It is a refactor safety net (CC-133), not a pass/fail check.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const out = process.argv[2] ?? 'test-results/editor-characterize.json';
const port = process.env.PORT ?? '5173';
const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: flags });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
await page.goto(`http://localhost:${port}/?mode=editor`);
await page.waitForSelector('#view3d', { timeout: 60000 });
await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 60000 });
await page.waitForTimeout(3000);

const KNOBS = ['trebkg', 'recoilkg', 'recoilspeed', 'bandk', 'dronekg', 'dronewh', 'trackshape'];
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);
const steps = [];
async function snap(name) {
  const s = await page.evaluate((knobs) => {
    const vis = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent); };
    const txt = (id) => (document.getElementById(id)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    return {
      pieces: Number(document.documentElement.dataset.pieces),
      knobs: Object.fromEntries(knobs.map((k) => [k, vis(k) ? document.getElementById(k).value : null])),
      panel: txt('panel'),
      lane: ['angle', 'offset', 'level'].map((k) => document.getElementById(k)?.value),
      undoDisabled: document.getElementById('undo')?.disabled, redoDisabled: document.getElementById('redo')?.disabled,
      fix: document.getElementById('fixit') ? { fixit: vis('fixit'), easier: vis('easier') } : null,
      saved: (() => { try { const w = JSON.parse(localStorage.getItem('cc.world.v1') ?? 'null'); return w ? { n: w.pieces?.length, lane: [w.angle, w.offset, w.level] } : null; } catch { return 'unreadable'; } })(),
      redo: document.getElementById('redo')?.disabled,
      suggest: txt('suggest'), advice: txt('advice').slice(0, 300), helperOpen: vis('helper'),
    };
  }, KNOBS);
  s.panel = s.panel.replace(/\d+(\.\d+)?/g, '#').slice(0, 300); // sizes and ids move; the words must not
  steps.push({ name, ...s });
}
const step = async (name, fn, wait = 400) => { try { await fn(); } catch (e) { steps.push({ name, error: String(e.message).split('\n')[0].slice(0, 100) }); return; } await page.waitForTimeout(wait); await snap(name); };

await snap('start');
const addIds = await page.$$eval('button[id^="add"]', (b) => b.map((x) => x.id).filter((id) => !['addpiece'].includes(id)));
for (const id of addIds) {
  await step(`add ${id}`, async () => {
    await page.evaluate((i) => document.getElementById(i).click(), id); // the picture cards of the add menu forward to these buttons
  });
}
// the knobs of the special pieces: change a value and see the panel and the knob follow
for (const [id, val] of [['trebkg', '1500'], ['recoilkg', '20'], ['recoilspeed', '25'], ['bandk', '60'], ['dronekg', '80'], ['dronewh', '60']]) {
  await step(`knob ${id}`, async () => { const el = page.locator(`#${id}`); if (!(await el.isVisible())) throw new Error('knob not shown'); await el.fill(val); await el.dispatchEvent('change'); });
}
await step('undo x3', async () => { for (let i = 0; i < 3; i++) await page.click('#undo'); });
await step('redo x2', async () => { for (let i = 0; i < 2; i++) await page.click('#redo'); });
await step('ctrl+z', async () => { await page.keyboard.press('Control+z'); });
await step('ctrl+y', async () => { await page.keyboard.press('Control+y'); });
await step('lane angle', async () => { await page.fill('#angle', '10'); await page.dispatchEvent('#angle', 'change'); });
await step('floor lava', async () => { await page.selectOption('#floor', { index: 1 }); });
await step('top plan', async () => { await page.click('#viewmode'); });
await step('3d view', async () => { await page.click('#viewmode'); });
await step('fit', async () => { await page.click('#fitview'); });
await step('copy+paste', async () => { await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); });
await step('delete', async () => { await page.keyboard.press('Delete'); });
await step('moves open', async () => { await page.click('#movesbtn'); }, 6000);
await step('moves close', async () => { await page.click('#movesbtn'); });
await step('design partner toggle', async () => { await page.click('#helperbtn'); });
for (const id of ['fixit', 'easier', 'findroutes', 'what']) {
  await step(`fix menu ${id}`, async () => { await page.click('#fixmenubtn'); await page.click(`#fixmenu-${id}`); }, 9000);
}
await step('suggest', async () => { await page.click('#suggest'); }, 4000);
await step('reset to starter', async () => { await page.click('#overflow'); await page.click('#resetworld'); }, 1500);
await step('preset', async () => { await page.selectOption('#presetpick', { index: 1 }); }, 2500);

const result = { errors, steps: steps.map((s) => ({ ...s, advice: s.advice ? `#${hash(s.advice)}:${s.advice.length > 0}` : s.advice })) };
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(`${steps.length} steps, ${steps.filter((s) => s.error).length} errored, ${errors.length} page errors -> ${out}`);
await browser.close();
