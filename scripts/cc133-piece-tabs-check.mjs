// CC-133: Add pieces has Shared by players and My pieces as tabs of their own, beside the built-in ones. PORT picks the dev server.
import { chromium } from 'playwright';
const port = process.env.PORT ?? '5191';
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`http://localhost:${port}/?mode=editor&welcome=0&backend=webgl2`);
await p.waitForSelector('#addpiece', { timeout: 120000 });
await p.click('#addpiece'); await p.waitForTimeout(1500);
const tabs = await p.$$eval('.pb-tab', (t) => t.map((x) => x.textContent));
await p.click('#pbtab-shared'); await p.waitForTimeout(2500);
const shared = await p.$$eval('#piecegrid .pb-group, #piecegrid .pb-none', (n) => n.map((x) => x.textContent));
await p.screenshot({ path: 'docs/evidence/cc-133-piece-tabs/shared-tab.png' });
await p.click('#pbtab-mine'); await p.waitForTimeout(500);
const mine = await p.$$eval('#piecegrid .pb-group, #piecegrid .pb-none', (n) => n.map((x) => x.textContent));
await p.click('#pbtab-real'); await p.waitForTimeout(500);
const real = await p.$$eval('#piecegrid .pb-group', (n) => n.map((x) => x.textContent));
console.log(JSON.stringify({ tabs, shared, mine, realGroups: real }));
await b.close();
