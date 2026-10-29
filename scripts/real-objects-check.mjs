// CC-110: the Real objects tab grouped by move, the flat view, and a hang bar that brings its own hold.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist"];
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector("#view3d", { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces === "3", null, { timeout: 30000 });
  mkdirSync("test-results/real-objects", { recursive: true });
  await page.waitForSelector("button[data-object=pullup-black]", { state: "attached", timeout: 20000 });
  await page.click("#addpiece"); await page.click("#pbtab-real"); await page.waitForTimeout(600);
  const heads = await page.$$eval(".pb-group", (e) => e.map((x) => x.textContent));
  checks.sixMoveGroups = heads.join("|") === "Jump over|Climb up|Vault|Swing and hang|Balance|Duck under";
  checks.cardsCount = (await page.$$(".pb-card")).length >= 19;
  checks.duckSaysEmpty = /No real object/.test(await page.textContent(".pb-group-none"));
  await page.waitForTimeout(800);
  await page.mouse.move(900, 600); await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/real-objects/by-move.png" });
  await page.$eval("#piecegrid", (g) => { g.scrollTop = g.scrollHeight; }); await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/real-objects/by-move-bottom.png" });
  await page.click("#pbbymove"); await page.waitForTimeout(300);
  checks.flatHasNoGroups = (await page.$$(".pb-group")).length === 0;
  await page.screenshot({ path: "test-results/real-objects/all-together.png" });
  await page.click("#pbbymove");
  // a hang bar: the frame is scenery and the crossbar is a hold
  const before = await page.evaluate(() => Number(document.documentElement.dataset.pieces));
  await page.click(".pb-card[data-piece=real-pullup-black]");
  await page.waitForTimeout(2500);
  checks.hangBarBringsItsHold = (await page.evaluate(() => Number(document.documentElement.dataset.pieces))) >= before + 2;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/real-objects/hang-bar-in-editor.png" });
  checks.noPageErrors = errors.length === 0;
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
  if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
} finally { server.kill(); }
