// CC-132 check: by default (no flag, looks like a player) every route fetches its own loop and shows it in html[data-music]; without the flag nothing is fetched.
// Prints a table route -> file and fails if a screen has no loop or the wrong one.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:5199";
const ROUTES = [
  ["course", "", "course"],
  ["generated course", "generate=7", "course"],
  ["dojo", "mode=dojo", "dojo"],
  ["rookie", "mode=rookie", "course"],
  ["park", "mode=park", "course"],
  ["editor", "mode=editor", "editor"],
  ["coaster", "mode=coaster", "editor"],
  ["map", "mode=map", "map"],
  ["slicer (part of map)", "mode=map&slicer=1", "map"],
  ["lab-search", "mode=lab-search", "dojo"],
  ["gallery (photo library)", "mode=gallery", "library"],
  ["diagrams", "mode=diagrams", "course"],
];
// "autoplay" lets sound start at load; the default asks for a gesture first, like a normal Chrome
const policy = [process.argv[3] === "autoplay" ? "--autoplay-policy=no-user-gesture-required" : "--autoplay-policy=document-user-activation-required"];
const b = await chromium.launch({ args: policy });
async function open(q, human = false) {
  const p = await b.newPage();
  if (human) await p.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));; // looks like a player: music is on without a flag
  const got = []; const errs = [];
  p.on("response", (r) => { if (r.url().includes("/assets/music/")) got.push(r.url().split("/").pop() + ":" + r.status()); });
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${base}/?${q}`); await p.waitForSelector("html[data-ready=true]", { timeout: 60000 });
  await p.waitForTimeout(2500); // no key press: the music must try on its own
  return { p, got, errs };
}
const rows = []; let ok = true;
const off = await open(""); rows.push(["automated, no flag (silent)", "-", off.got.join(",") || "none", off.got.length === 0 && off.errs.length === 0]); await off.p.close();
for (const [name, q, want] of ROUTES) {
  const r = await open(q, true); const shown = await r.p.evaluate(() => document.documentElement.dataset.music ?? "none");
  rows.push([name, `${want}.ogg`, `${shown}.ogg (${r.got.join(",") || "no fetch"})`, shown === want && r.got.length === 1 && r.got[0] === `${want}.ogg:200` && r.errs.length === 0]); await r.p.close();
}
// report and retry: the ideal bot clears the lache course, the report opens, then Try again goes back to the run
{
  const r = await open("course=/assets/demo/lache.course.json&bot=ideal&welcome=0", true);
  const got = await r.p.waitForSelector("#report-again", { timeout: 240000 }).then(() => true).catch(() => false);
  await r.p.waitForTimeout(500);
  const rep = await r.p.evaluate(() => document.documentElement.dataset.music ?? "none");
  rows.push(["report page (run ends)", "report.ogg", `${rep}.ogg (report shown: ${got})`, got && rep === "report"]);
  let back = "no button";
  if (got) { await r.p.locator("#report-again").click(); await r.p.waitForTimeout(1500); back = await r.p.evaluate(() => document.documentElement.dataset.music ?? "none"); }
  rows.push(["retry (back to the run)", "course.ogg", `${back}.ogg`, back === "course"]); await r.p.close();
}
{
  const r = await open("", true); const path = await r.p.evaluate(() => ({ path: document.documentElement.dataset.musicPath ?? "none", chip: !!document.getElementById("music-chip") }));
  console.log(`path at load (${process.argv[3] ?? "default policy"}): ${JSON.stringify(path)}`);
  if (!path.chip) { rows.push(["autoplay path", "no chip", "played at load", path.path === "autoplay"]); }
  else { await r.p.mouse.move(50, 50); await r.p.waitForTimeout(300); const still = !!(await r.p.$("#music-chip")); await r.p.mouse.click(60, 60); await r.p.waitForTimeout(800);
    const after = await r.p.evaluate(() => ({ path: document.documentElement.dataset.musicPath, chip: !!document.getElementById("music-chip") }));
    rows.push(["gesture path", "chip, then gone", `chip stays on mouse move: ${still}; after click ${JSON.stringify(after)}`, still && !after.chip && after.path === "gesture"]); }
  await r.p.close();
}
// the browser refuses sound until a gesture (headless Chromium does not refuse, so the refusal is simulated): the chip shows, a mouse move does nothing, the first click starts the music
{
  const p = await b.newPage();
  await p.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    let gesture = false; for (const g of ["pointerdown", "keydown", "touchstart"]) addEventListener(g, () => { gesture = true; }, true);
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      get state() { return gesture ? super.state : "suspended"; }
      resume() { return gesture ? super.resume() : new Promise(() => {}); }
      suspend() { return Promise.resolve(); }
    };
  });
  await p.goto(`${base}/?welcome=0`); await p.waitForSelector("html[data-ready=true]", { timeout: 60000 }); await p.waitForTimeout(1500);
  const st = () => p.evaluate(() => ({ path: document.documentElement.dataset.musicPath ?? "none", chip: !!document.getElementById("music-chip") }));
  const atLoad = await st(); await p.mouse.move(120, 120); await p.waitForTimeout(300); const moved = await st();
  await p.mouse.click(300, 300); await p.waitForTimeout(800); const clicked = await st();
  rows.push(["refused at load (simulated)", "chip, then click", `load ${JSON.stringify(atLoad)}; move ${JSON.stringify(moved)}; click ${JSON.stringify(clicked)}`, atLoad.chip && moved.chip && !clicked.chip && clicked.path === "gesture"]);
  await p.close();
}
for (const [n, w, g, k] of rows) { console.log(`${k ? "ok  " : "FAIL"} ${n.padEnd(26)} wants ${w.padEnd(11)} got ${g}`); ok = ok && k; }
await b.close(); console.log(ok ? "PASS" : "FAIL"); process.exit(ok ? 0 : 1);
