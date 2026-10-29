// The climb stage by stage on the Climb demo: the bot runs at the wall with the game clock slowed (the software renderer takes seconds per frame),
// and a picture is taken as soon as the climb reaches each stage. VIEW=side|front|back picks the camera (orbit yaw); LABEL names the output folder.
// Output: test-results/climb-film/<LABEL>/*.png
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173", label = process.env.LABEL ?? "now";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist", "--no-sandbox"];
const stages = (process.env.STAGES ?? "0.02,0.2,0.4,0.6,0.8,0.97").split(",").map(Number);
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const W = Number(process.env.W ?? 960), H = Number(process.env.H ?? 540);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync(`test-results/climb-film/${label}`, { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/climb.course.json&bot=ideal&startx=${process.env.STARTX ?? 17}&timescale=${process.env.TIMESCALE ?? 0.01}&welcome=0&onboarding=0${process.env.EXTRA ?? ""}`);
  await page.waitForSelector("html[data-ready=true]", { timeout: 120000 });
  await page.keyboard.press("h");
  await page.keyboard.press("g"); for (let i = 0; i < Number(process.env.CAMS ?? 0); i++) await page.keyboard.press("c");
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.wheel(0, Number(process.env.ZOOM ?? -500));
  if (process.env.DRAG) { await page.mouse.down(); await page.mouse.move(W / 2 + Number(process.env.DRAG), H / 2, { steps: 5 }); await page.mouse.up(); }
  let next = 0, last = "";
  const t0 = Date.now();
  while (next < stages.length && Date.now() - t0 < 900000) {
    const v = await page.evaluate(() => document.documentElement.dataset.climb);
    if (v !== "" && v !== undefined) {
      last = v;
      if (Number(v) >= stages[next]) { await page.screenshot({ path: `test-results/climb-film/${label}/f${String(next).padStart(2, "0")}-p${stages[next]}.png` }); console.log("shot", next, "at", v); next++; continue; }
    } else if (last !== "" && Number(last) > 0.9) break;
    await page.waitForTimeout(40);
  }
  console.log({ shots: next, of: stages.length }, "errors:", errors);
  await browser.close();
} finally { server.kill(); }
