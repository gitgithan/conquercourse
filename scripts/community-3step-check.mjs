// CC-249: Community shows pieces people made; Make your own has three steps (Photo, Pick, Make).
// Run: BASE=https://preview.conquercourse.pages.dev node scripts/community-3step-check.mjs out-dir
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/community-3step'; mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const checks = {};
await page.goto(`${base}/?mode=communities&welcome=0`); await page.waitForSelector('#ex-objects', { timeout: 60000 });
await page.waitForTimeout(2500);
checks.noCoursesSection = (await page.$('#ex-courses')) === null;
checks.noKindFilter = (await page.$('#shared-kind')) === null;
checks.examplePieces = (await page.$$('#objgrid .card')).length >= 1;
await page.screenshot({ path: `${out}/1-community.png`, fullPage: true });
await page.click('#make-own'); await page.waitForSelector('#step-photo');
checks.threeSteps = (await page.$$('ol.steps li')).length === 3;
checks.stepNames = (await page.$$eval('ol.steps button', (n) => n.map((x) => x.textContent))).join(' | ');
await page.screenshot({ path: `${out}/2-make-photo.png` });
await page.click('img[data-sample]'); await page.waitForSelector('#cseg', { timeout: 30000 });
checks.pickNextIsMake = (await page.$eval('#cnext', (e) => e.textContent)) === 'Next: Make';
await page.screenshot({ path: `${out}/3-make-pick.png` });
console.log(JSON.stringify(checks, null, 1)); await b.close();
