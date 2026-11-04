// Browser smoke for hashing: opens ?mode=lab-hashing&labs=1 at 1280 px, runs the avalanche, opens the maths, saves a screenshot.
// Usage: node scripts/smoke-lab-hashing.mjs [baseUrl] [outPng]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? "docs/evidence/lab-hashing-run.png";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${base}/?mode=lab-hashing&labs=1&welcome=0`);
await page.waitForSelector("#lh-rows tr");
const rows = await page.locator("#lh-rows tr").count();
await page.click("#lh-aval");
await page.waitForSelector("#lh-bars .bar");
await page.click("#lh-eq-btn");
await page.selectOption("#lh-key", "aimUp");
await page.waitForTimeout(300);
const seen = await page.locator("#lh-rows tr td:nth-child(3)").allTextContents();
await page.waitForSelector("#lh-ours li");
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ rows, seenForAimUp: seen, bars: await page.locator("#lh-bars .bar").count(), errors }));
await browser.close();
if (errors.length || rows !== 9) process.exit(1);
