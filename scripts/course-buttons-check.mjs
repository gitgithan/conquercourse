// The Course (CC-80): its top-right buttons never overlap each other or the other fixed controls, at 1280x720 and 1024x640.
//   PORT=5391 node scripts/course-buttons-check.mjs      (screenshots in test-results/course-buttons/)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"];
mkdirSync("test-results/course-buttons", { recursive: true });
let bad = 0;
const browser = await chromium.launch({ args: flags });
try {
  for (const [w, h] of [[1280, 720], [1024, 640]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    let up = false;
    for (let i = 0; i < 40 && !up; i++) { try { await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&welcome=0`); up = true; } catch { await new Promise((r) => setTimeout(r, 500)); } }
    await page.waitForSelector("#editcourse", { timeout: 60000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll("button, select")].filter((e) => { const s = getComputedStyle(e); const q = e.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && q.width > 0 && q.height > 0 && q.bottom > 0 && q.top < 120; })
        .map((e) => { const q = e.getBoundingClientRect(); return { name: e.id || e.textContent.trim().slice(0, 28), x0: q.left, x1: q.right, y0: q.top, y1: q.bottom }; });
      const clash = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1) clash.push(`${a.name} x ${b.name}`); }
      const wrapped = boxes.filter((b) => b.name === "editcourse" || b.name === "wholeideal").map((b) => b.name + ":" + Math.round(b.y1 - b.y0));
      return { n: boxes.length, clash, wrapped };
    });
    await page.screenshot({ path: `test-results/course-buttons/${w}x${h}.png` });
    console.log(`${w}x${h}: ${r.n} top controls, overlaps: ${r.clash.length ? r.clash.join("; ") : "none"}, heights ${r.wrapped.join(" ")}`);
    if (r.clash.length) bad++;
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
process.exit(bad ? 1 : 0);
