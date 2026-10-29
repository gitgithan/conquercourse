// Climb, let go (the drop), land and climb again with real keys; a picture after every step of the slowed clock, named by phase.
// Output: test-results/climb-film/<LABEL>/*.png. CUT is the climb progress at which E is let go; CAMS presses C that many times.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173", label = process.env.LABEL ?? "rejump";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist", "--no-sandbox"];
const CUT = Number(process.env.CUT ?? 0.5), W = Number(process.env.W ?? 960), H = Number(process.env.H ?? 540);
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync(`test-results/climb-film/${label}`, { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/climb.course.json&startx=${process.env.STARTX ?? 19}&timescale=${process.env.TIMESCALE ?? 0.03}&welcome=0&onboarding=0${process.env.EXTRA ?? ""}`);
  await page.waitForSelector("html[data-ready=true]", { timeout: 120000 });
  await page.keyboard.press("h"); await page.keyboard.press("g");
  for (let i = 0; i < Number(process.env.CAMS ?? 1); i++) await page.keyboard.press("c");
  await page.mouse.move(W / 2, H / 2); await page.mouse.wheel(0, Number(process.env.ZOOM ?? -300));
  const st = () => page.evaluate(() => ({ c: document.documentElement.dataset.climb, g: document.documentElement.dataset.grounded, x: Number(document.documentElement.dataset.x) }));
  let n = 0, phase = "run", climbs = 0, dropped = false, t0 = Date.now();
  const shot = async (tag) => { await page.screenshot({ path: `test-results/climb-film/${label}/${String(n).padStart(3, "0")}-${tag}.png` }); n++; };
  await page.keyboard.down("ArrowRight");
  while (n < Number(process.env.MAXSHOTS ?? 40) && Date.now() - t0 < 800000) {
    const s = await st();
    if (phase === "run" && s.x > 23.2) { await page.keyboard.down("KeyE"); phase = "climb1"; }
    if (phase === "climb1" && s.c) { await shot(`climb1-p${s.c}`); if (Number(s.c) >= CUT) { await page.keyboard.up("KeyE"); phase = "drop"; } }
    else if (phase === "drop") { await shot(`drop-g${s.g}`); if (s.g === "1") { await page.keyboard.down("KeyE"); phase = "climb2"; } }
    else if (phase === "climb2") { await shot(`climb2-p${s.c || "-"}`); if (s.c && Number(s.c) > 0.6) break; }
    else await page.waitForTimeout(30);
  }
  console.log({ shots: n }, "errors:", errors);
  await browser.close();
} finally { server.kill(); }
