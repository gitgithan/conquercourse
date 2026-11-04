// CC-133 check 3: Dojo lesson + Try It slider, Labs panel, Posing a character Lab slider, one more Lab
import { start, newPage } from './prod-test-lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, out] = [process.argv[2], process.argv[3]]; mkdirSync(out, { recursive: true });
const tag = base.includes('preview') ? 'preview' : 'prod', log = {}, res = {}, b = await start();
async function step(name, fn) { try { res[name] = await fn(); } catch (e) { res[name] = 'ERROR ' + e.message.slice(0, 200); } console.log(name, JSON.stringify(res[name])); }
await step('dojo', async () => { const { page } = await newPage(b, log, 'dojo'); await page.goto(base + '/?mode=dojo&welcome=0'); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(1500);
  await page.getByText('Gap jump', { exact: false }).first().click(); await page.waitForTimeout(3000);
  const r = { lessonText: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160) };
  await page.getByRole('button', { name: /Try it/ }).first().click(); await page.waitForTimeout(2000);
  const sl = await page.evaluate(() => [...document.querySelectorAll('input[type=range]')].map((x) => `${x.id}|${x.min}-${x.max}=${x.value}`));
  r.sliders = sl;
  if (sl.length) { const before = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await page.evaluate(() => { const e = document.querySelector('input[type=range]'); e.value = String(Number(e.min) + (Number(e.max) - Number(e.min)) * 0.8); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(1500); const after = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); r.textChangedAfterSlider = before !== after; r.sliderNow = await page.evaluate(() => document.querySelector('input[type=range]').value); }
  await page.screenshot({ path: `${out}/${tag}-dojo-tryit.png` }); await page.close(); return r; });
await step('labs-ik', async () => { const { page } = await newPage(b, log, 'lab-ik'); await page.goto(base + '/?mode=lab-ik&welcome=0'); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(3000);
  const r = {}; const read = () => page.evaluate(() => ({ v: document.getElementById('ik-fold').value, label: document.querySelector('label[for=ik-fold]')?.textContent ?? document.getElementById('ik-fold').closest('label')?.textContent ?? '', canvasHash: (() => { const c = document.querySelector('canvas'); try { return c ? c.toDataURL().length + ':' + c.toDataURL().slice(-40) : 'nocanvas'; } catch { return 'err'; } })() }));
  const a = await read(); await page.evaluate(() => { const e = document.getElementById('ik-fold'); e.value = '0.1'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(1500); const c = await read();
  r.before = a.v + ' ' + a.label.slice(0, 50); r.after = c.v + ' ' + c.label.slice(0, 50); r.labelUpdated = a.label !== c.label; r.canvasChanged = a.canvasHash !== c.canvasHash;
  await page.screenshot({ path: `${out}/${tag}-lab-ik.png` });
  await page.click('#labs-open'); await page.waitForTimeout(1200);
  r.labsPanel = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 700);
  r.labLinks = await page.evaluate(() => [...document.querySelectorAll('a[href*="mode=lab"]')].map((x) => x.getAttribute('href')).slice(0, 30));
  await page.close(); return r; });
await step('another-lab', async () => { const { page } = await newPage(b, log, 'lab-other'); const mode = 'lab-search'; await page.goto(base + `/?mode=${mode}&welcome=0`); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(3000);
  const r = { mode, text: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 250), controls: await page.evaluate(() => [...document.querySelectorAll('input,select')].length) }; await page.screenshot({ path: `${out}/${tag}-lab-other.png` }); await page.close(); return r; });
writeFileSync(`${out}/${tag}-2-dojo-labs.json`, JSON.stringify({ res, log }, null, 2)); await b.close();
