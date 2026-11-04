// CC-133 debug: park03 sample, Make your own, end to end on a deployed site, logging every /api answer. Costs one segment job and one lift: PAID=1.
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'https://preview.conquercourse.pages.dev', out = process.argv[2] ?? 'docs/evidence/cc-133-lift-debug';
if (process.env.PAID !== '1') { console.log('Run with PAID=1'); process.exit(2); }
const t0 = Date.now(), ts = () => new Date().toISOString();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('response', async (r) => { const u = r.url(); if (!u.includes('/api/')) return; let b = ''; try { b = (await r.text()).slice(0, 160).replace(/"(glb|cutout|image)":"[^"]{40,}"/g, '"$1":"…"'); } catch {} let req = ''; try { req = (r.request().postData() ?? '').match(/"action":"[a-z]+"/)?.[0] ?? ''; } catch {} console.log(ts(), r.status(), r.request().method(), u.replace(base, ''), req, b); });
try {
  await page.goto(`${base}/?mode=communities&welcome=0&tab=make`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('img[data-sample="park03"]', { timeout: 90000 });
  await page.click('img[data-sample="park03"]'); await page.waitForSelector('.stage img', { timeout: 30000 }); await page.waitForTimeout(600);
  await page.click('#cseg');
  await page.waitForTimeout(6000); await page.mouse.click(511, 373); console.log(ts(), 'clicked turnstile box by position');
  await page.waitForFunction(() => document.querySelector('#cfound label') !== null || /not answering|No outline|busy|did not answer/i.test(document.querySelector('#cseginfo,#cprog,.panel')?.textContent ?? ''), null, { timeout: 120000 });
  if (process.env.SEGMENT_ONLY) console.log(ts(), 'segment screen text:', (await page.innerText('body')).slice(0,400).replace(/\n+/g,' | '));
  await page.screenshot({ path: `${out}/after-segment.jpg`, type: 'jpeg', quality: 60 });
  if (process.env.SEGMENT_ONLY) { await browser.close(); process.exit(0); }
  console.log(ts(), 'found', await page.$$eval('#cfound label', (n) => n.map((x) => x.textContent)));
  await page.click('.stage .box:nth-of-type(1)');
  await page.click('#cnext'); await page.waitForSelector('.item');
  for (const id of await page.$$eval('.item', (n) => n.map((x) => x.dataset.id))) { const v = await page.inputValue(`#cname-${id}`); if (!/^[a-z][a-z \-]{1,29}$/.test(v)) await page.fill(`#cname-${id}`, 'railing'); }
  await page.screenshot({ path: `${out}/before-make.jpg`, type: 'jpeg', quality: 60 });
  console.log(ts(), 'press make'); await page.click('#make-all');
  await page.waitForFunction(() => document.querySelector('#prize[data-ready="1"]') || /not answering|too long|busy|Try again/i.test(document.body.innerText), null, { timeout: 600000 });
  console.log(ts(), 'result:', (await page.evaluate(() => document.querySelector('#prize[data-ready="1"]') ? 'PRIZE' : document.body.innerText.match(/.{0,80}(not answering|too long|busy|Try again).{0,80}/i)?.[0])));
  await page.screenshot({ path: `${out}/after-make.jpg`, type: 'jpeg', quality: 60 });
} catch (e) { console.log(ts(), 'ERR', String(e).slice(0, 300)); await page.screenshot({ path: `${out}/error.jpg`, type: 'jpeg', quality: 60 }); }
await browser.close();
