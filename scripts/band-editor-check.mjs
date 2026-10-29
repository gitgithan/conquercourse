// The Band piece in the editor on its own (the long editor-check also has these steps): a Band button starts the lane at a band with a stiffness box,
// the stiffness is kept, and Fix it speaks (a softer band, or that it already works, or that no band reaches).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist"];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  mkdirSync("test-results/editor", { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=editor&editorui=old`);
  await page.evaluate(() => localStorage.removeItem("cc.world.v1"));
  await page.reload();
  await page.waitForSelector("#view3d", { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces === "3", null, { timeout: 30000 });
  const checks = {};
  await page.click('#addpiece'); await page.$eval('#addband', (e) => e.click());
  checks.bandOn = await page.waitForFunction(() => document.documentElement.dataset.band === "35", null, { timeout: 10000 }).then(() => true, () => false);
  checks.bandBoxShown = await page.isVisible("#bandk");
  await page.fill("#bandk", "150"); await page.dispatchEvent("#bandk", "change");
  checks.bandStiffnessKept = await page.waitForFunction(() => document.documentElement.dataset.band === "150", null, { timeout: 10000 }).then(() => true, () => false);
  await page.screenshot({ path: "test-results/editor/band.png" });
  await page.click("#fixit", { noWaitAfter: true, timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.fixed !== undefined && /band|works/i.test(document.getElementById("reply")?.textContent ?? ""), null, { timeout: 240000 }).catch(() => {});
  const reply = await page.textContent("#reply");
  checks.bandFixItSpeaks = /softer band|already works|No band/.test(reply);
  await page.click('#addpiece'); checks.bandOffAgain = await page.$eval('#addband', (e) => e.click()).then(() => page.waitForFunction(() => document.documentElement.dataset.band === "", null, { timeout: 10000 })).then(() => true, () => false);
  console.log("Fix it says:", reply.slice(0, 160));
  console.log(checks, "errors:", errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
