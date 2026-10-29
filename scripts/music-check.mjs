// CC-132 smoke check: with ?music=1 the page fetches its screen loop after a key press, and with no flag it fetches none.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:5199";
const b = await chromium.launch();
async function run(q, mode) {
  const p = await b.newPage(); const got = [];
  p.on("response", (r) => { if (r.url().includes("/assets/music/")) got.push(r.url().split("/").pop() + ":" + r.status()); });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${base}/?${q}`); await p.waitForSelector("html[data-ready=true]", { timeout: 60000 });
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(2500); await p.close();
  return { q, got, errs };
}
const off = await run("", "course");
const on = await run("music=1", "course");
const dojo = await run("music=1&mode=dojo", "dojo");
const map = await run("music=1&mode=editor", "editor");
console.log(JSON.stringify({ off, on, dojo, map }, null, 1));
await b.close();
const ok = off.got.length === 0 && on.got.includes("course.ogg:200") && dojo.got.includes("dojo.ogg:200") && map.got.includes("editor.ogg:200") && [off, on, dojo, map].every((r) => r.errs.length === 0);
console.log(ok ? "PASS" : "FAIL"); process.exit(ok ? 0 : 1);
