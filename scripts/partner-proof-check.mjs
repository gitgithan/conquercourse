// Live Muse Spark Open test: one paid request through the editor's real API, then actual simulator workers.
// Usage: PORT=5198 node scripts/partner-proof-check.mjs (requires the configured Baseten key).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const port = process.env.PORT ?? '5198', out = 'test-results/partner-proof';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const errors = [], report = { liveModelCalls: 0, model: 'meta-models/muse-spark-open-1026', checks: {} };
let browser;
try {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (r.url().endsWith('/api/designer') && r.method() === 'POST') report.liveModelCalls++; });
  await page.addInitScript(() => {
    localStorage.setItem('cc.world.v1', JSON.stringify({ pieces: [{ src: 'block', x: 12, z: 0, y: 0, yaw: 0, scale: 10 }], angle: 0, offset: 0, level: 0 }));
    localStorage.setItem('cc.partner.pref', '0');
    const NativeWorker = window.Worker;
    window.proofWorkers = []; window.heldProofs = []; window.holdProofs = false;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.record = { url: String(url), posted: 0, completed: 0, hasPlan: false };
        window.proofWorkers.push(this.record);
        this.addEventListener('message', (e) => { if (typeof e.data?.cleared === 'boolean') { this.record.completed++; this.record.hasPlan = !!e.data.plan; } });
      }
      postMessage(message, options) {
        const send = () => { this.record.posted++; super.postMessage(message, options); };
        if (window.holdProofs && this.record.url.includes('/sim/ideal-worker')) window.heldProofs.push(send);
        else send();
      }
    };
  });
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForFunction(() => document.documentElement.dataset.laneClear === '1', null, { timeout: 120000 });
  await page.locator('#glossaryhide').click().catch(() => {});
  await page.click('#fitview'); await page.waitForTimeout(600);
  await page.click('#partnertab');
  await page.fill('#ask', 'Suggest exactly one change: move the existing ground block 0.5 metres further along the lane. Keep its scale, height, turn and sideways position unchanged. Include the edit JSON for its existing piece id.');
  const answer = page.waitForResponse((r) => r.url().endsWith('/api/designer') && r.request().method() === 'POST', { timeout: 180000 });
  await page.click('#send');
  const response = await answer;
  assert.equal(response.status(), 200, `live designer returned HTTP ${response.status()}`);
  const body = await response.json();
  assert.ok(body.reply?.length > 0);
  report.modelReply = body.reply;
  await page.waitForSelector('#applyedits', { timeout: 10000 });
  assert.match(await page.locator('#reply').innerText(), /simulator has not checked/i);
  report.checks.modelAdviceIsNotAProof = true;
  const original = await page.evaluate(() => localStorage.getItem('cc.world.v1'));
  await page.evaluate(() => { window.holdProofs = true; });
  await page.click('#applyedits');
  assert.equal(await page.locator('#applypreview').isDisabled(), true);
  assert.match(await page.locator('#previewverdict').innerText(), /Checking with the simulator/);
  // Calling the handler directly must not apply an unverified preview either.
  await page.locator('#applypreview').evaluate((b) => b.onclick?.(new MouseEvent('click')));
  assert.equal(await page.evaluate(() => localStorage.getItem('cc.world.v1')), original);
  report.checks.applyWaitsForSimulator = true;
  await page.screenshot({ path: `${out}/checking.jpg`, type: 'jpeg', quality: 75 });
  await page.evaluate(() => { window.holdProofs = false; window.heldProofs.splice(0).forEach((send) => send()); });
  await page.waitForFunction(() => document.documentElement.dataset.preview === 'clears', null, { timeout: 120000 });
  assert.match(await page.locator('#previewverdict').innerText(), /Simulator verified/);
  await page.screenshot({ path: `${out}/verified.jpg`, type: 'jpeg', quality: 75 });
  const count = () => page.evaluate(() => window.proofWorkers.filter((w) => w.url.includes('/sim/ideal-worker')).reduce((n, w) => n + w.posted, 0));
  const checkedCount = await count();
  await page.locator('#reply .pvrow input').first().uncheck();
  assert.equal(await page.locator('#applypreview').isDisabled(), true);
  await page.locator('#reply .pvrow input').first().check();
  await page.waitForFunction(() => document.documentElement.dataset.preview === 'clears');
  assert.equal(await count(), checkedCount);
  await page.click('#applypreview');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.laneState), 'done');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.laneClear), '1');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.laneProof), 'cached');
  await page.waitForTimeout(1000);
  assert.equal(await count(), checkedCount, 'Apply started another simulator search');
  report.checks.applyReusesVerifiedRun = true;
  await page.screenshot({ path: `${out}/applied.jpg`, type: 'jpeg', quality: 75 });
  await page.click('#closehelper'); await page.click('#play');
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
  assert.equal(await count(), checkedCount, 'Play started another ideal-run search');
  report.checks.playReusesVerifiedRun = true;
  assert.deepEqual(errors, []);
  assert.equal(report.liveModelCalls, 1);
  report.checks.noPageErrors = true;
  report.idealSearches = checkedCount;
  writeFileSync(`${out}/run.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); server.kill(); }
