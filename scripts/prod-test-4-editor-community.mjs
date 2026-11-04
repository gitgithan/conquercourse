// CC-133 checks 5 (editor: Top plan, Ask AI once) and 6 (Community: Explore, Make your own, sample photo, outline finder once)
import { start, newPage } from './prod-test-lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, out] = [process.argv[2], process.argv[3]]; mkdirSync(out, { recursive: true });
const tag = base.includes('preview') ? 'preview' : 'prod', log = {}, res = {}, b = await start();
async function step(name, fn) { try { res[name] = await fn(); } catch (e) { res[name] = 'ERROR ' + e.message.slice(0, 250); } console.log(name, JSON.stringify(res[name])); }
await step('editor', async () => { const { page } = await newPage(b, log, 'editor'); page.setDefaultTimeout(60000);
  await page.goto(base + '/?mode=editor&welcome=0'); await page.waitForSelector('#view3d'); await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3); await page.waitForTimeout(2500);
  const r = {}; const v0 = await page.textContent('#viewmode'); await page.click('#viewmode'); await page.waitForTimeout(1500); r.topPlanButton = `${v0} -> ${await page.textContent('#viewmode')}`; await page.screenshot({ path: `${out}/${tag}-editor-top.png` });
  await page.click('#viewmode'); await page.waitForTimeout(800);
  await page.click('#addpiece'); await page.waitForTimeout(800); r.addPiecesBenchVisible = await page.isVisible('#add-bench'); await page.screenshot({ path: `${out}/${tag}-editor-addpieces.png` });
  await page.click('#movesbtn'); await page.waitForTimeout(1000); r.movesText = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 0) + (await page.isVisible('#movesbtn') ? 'button visible' : '');
  r.movesPanel = await page.evaluate(() => { const e = document.querySelector('[id*=moves]:not(#movesbtn)'); return e ? e.id + ' visible=' + (e.getBoundingClientRect().height > 0) : 'no panel id'; });
  await page.click('#fixmenubtn'); await page.waitForTimeout(800); r.improveMenuVisible = await page.isVisible('#fixmenu-what');
  let ask = null; if (process.env.NO_AI) return r; page.on('response', async (x) => { if (x.url().includes('/api/designer')) ask = x.status(); });
  await page.click('#fixmenu-what'); await page.waitForTimeout(500);
  if (!(await page.isVisible('#what'))) await page.click('#helperbtn').catch(() => {});
  if (await page.isVisible('#what')) await page.click('#what');
  await page.waitForFunction(() => { const t = document.getElementById('reply')?.textContent ?? ''; return t.length > 60 && !/^Ask AI for ideas from/.test(t); }, null, { timeout: 90000 }).catch(() => {});
  r.askAiStatus = ask; r.askAiReply = (await page.evaluate(() => document.getElementById('reply')?.textContent ?? '')).slice(0, 220);
  await page.screenshot({ path: `${out}/${tag}-editor-ask.png` }); await page.close(); return r; });
await step('community', async () => { const { page } = await newPage(b, log, 'community'); page.setDefaultTimeout(60000);
  await page.goto(base + '/?mode=communities&welcome=0'); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(4000);
  const r = { tabs: await page.$$eval('.com .tabs button', (e) => e.map((x) => x.textContent)), explore: (await page.evaluate(() => document.querySelector('.com')?.innerText.replace(/\s+/g, ' ').slice(0, 260))), imgs: await page.$$eval('.com img', (e) => e.map((i) => i.complete && i.naturalWidth > 0)) };
  r.imagesLoaded = `${r.imgs.filter(Boolean).length}/${r.imgs.length}`; delete r.imgs; await page.screenshot({ path: `${out}/${tag}-community.png` });
  await page.click('#make-own'); await page.waitForTimeout(1500); r.makeOwnText = (await page.evaluate(() => document.querySelector('.com')?.innerText.replace(/\s+/g, ' ').slice(0, 260)));
  const sample = page.locator('img[data-sample]').first(); r.samples = await page.locator('img[data-sample]').count();
  if (r.samples) { await sample.click(); await page.waitForTimeout(2500); r.afterSample = (await page.evaluate(() => document.querySelector('.com')?.innerText.replace(/\s+/g, ' ').slice(0, 300))); r.buttons = await page.$$eval('.com button', (e) => e.map((x) => x.id + '|' + x.textContent.trim().slice(0, 28))); }
  await page.screenshot({ path: `${out}/${tag}-community-make.png` }); r._pageHandle = undefined; globalThis.__cpage = page; return r; });
await step('segment-once', async () => { const page = globalThis.__cpage; const calls = [];
  page.on('response', (x) => { if (/\/api\/segment/.test(x.url())) calls.push(x.request().method() + ' ' + x.status()); });
  await page.click('#cmark'); await page.waitForTimeout(1500);
  const zone = await page.$('.markzone'); const r = { markZone: !!zone };
  await page.screenshot({ path: `${out}/${tag}-community-mark.png` });
  if (zone) { const bx = await zone.boundingBox(); await page.mouse.move(bx.x + bx.width * 0.3, bx.y + bx.height * 0.3); await page.mouse.down(); await page.mouse.move(bx.x + bx.width * 0.6, bx.y + bx.height * 0.7, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1000);
    r.afterDraw = (await page.evaluate(() => document.querySelector('.com')?.innerText.replace(/\s+/g, ' ').slice(0, 300))); r.buttons = await page.$$eval('.com button', (e) => e.map((x) => x.id + '|' + x.textContent.trim().slice(0, 28))); }
  if (zone && !process.env.NO_SEG) { await page.getByRole('button', { name: 'bench', exact: true }).click().catch(() => {}); await page.click('#markuse'); r.segmentRequests = calls;
    await page.waitForFunction(() => /could not|failed|try again|verify|not answering|error|unavailable|outline|ready|Next/i.test(document.querySelector('#markmsg')?.textContent + ' ' + (document.querySelector('.com .err,.com [role=alert]')?.textContent ?? '')), null, { timeout: 45000 }).catch(() => {}); await page.waitForTimeout(8000);
    r.segmentCalls = calls; r.messages = await page.evaluate(() => [...document.querySelectorAll('.com .err,.com [role=alert],#markmsg,.com .muted')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 6));
    r.turnstileFrame = await page.evaluate(() => !!document.querySelector('iframe[src*="challenges.cloudflare.com"]')); await page.screenshot({ path: `${out}/${tag}-community-segment.png` }); }
  return r; });
writeFileSync(`${out}/${tag}-4-editor-community.json`, JSON.stringify({ res, log }, null, 2)); await b.close();
