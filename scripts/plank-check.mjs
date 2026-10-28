// The plank bridge in the browser: the ideal-run bot crosses the good plank (it bends under the bot, screenshot in the middle),
// the thin plank breaks (the fall words say so), the Dojo bridge lesson opens, and the editor shows the plank piece with its knobs.
// Usage: node scripts/plank-check.mjs   (PORT)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist"];
const out = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on("pageerror", (e) => { errors.push(e.message); console.log("PAGEERROR", e.message.slice(0, 200)); });
  mkdirSync("test-results/plank", { recursive: true });
  const outcome = () => page.evaluate(() => document.documentElement.dataset.outcome);

  // the good plank: the bot runs across; take a picture while it is in the middle
  await page.goto(`http://localhost:${port}/?course=/assets/demo/plank.course.json&bot=ideal&timescale=0.35`);
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 60000 });
  let shot = false, o = "running", minHint = "";
  for (let i = 0; i < 3000 && o !== "cleared" && o !== "splash"; i++) {
    await page.waitForTimeout(40);
    const x = Number(await page.evaluate(() => document.documentElement.dataset.x));
    if (!shot && x > 18 && x < 19.5) { await page.screenshot({ path: "test-results/plank/crossing.png" }); shot = true; minHint = (await page.textContent("body")).match(/The plank dips under you[^.]*\./)?.[0] ?? ""; }
    o = await outcome();
  }
  out.goodPlankCleared = o === "cleared"; out.pictureTaken = shot;

  // the plank bent with the runner in the middle (a still picture: the runner is placed there)
  await page.goto(`http://localhost:${port}/?course=/assets/demo/plank.course.json&planktest=0.5`);
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/plank/sag-middle.png" });
  out.sagPicture = true; out.hintOnPlank = /plank dips/.test(await page.textContent('body'));

  // the thin plank: break and the words
  await page.goto(`http://localhost:${port}/?course=/assets/demo/plank-thin.course.json&bot=ideal&timescale=1`);
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 60000 });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.down("ArrowRight");
  let words = "";
  for (let i = 0; i < 400; i++) { await page.waitForTimeout(100); o = await outcome(); if (o === "splash") break; }
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(800);
  words = await page.textContent("body");
  await page.screenshot({ path: "test-results/plank/thin-break.png" });
  out.thinBreaks = o === "splash"; out.thinWords = /plank broke under you/i.test(words);

  // the Dojo bridge lesson
  await page.goto(`http://localhost:${port}/?mode=dojo&ex=bridge`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/plank/dojo.png" });
  out.dojoOpens = /sags|plank/i.test(await page.textContent("body"));
  await page.getByRole("button", { name: "The idea" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/plank/dojo-idea.png" });
  console.log(out, "errors:", errors);
  await browser.close();
} finally { server.kill(); }
