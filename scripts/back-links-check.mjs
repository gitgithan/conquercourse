// "Back" links (CC-147): every way into the World editor, and the Back links of the Dojo and the gallery, must end on the Course.
// The editor case that used to fail: the simulator answers "cannot clear" (stubbed here) and the Design partner panel is closed.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5173";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"], { stdio: "ignore" });
const flags = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist"];
const base = `http://localhost:${port}/`;
const COURSE = "/assets/demo/lache.course.json";
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync("test-results/back", { recursive: true });
  const open = [];
  const fresh = async (stubUnclearable = false) => {
    for (const c of open.splice(0)) await c.close(); // the earlier page stops using the processor
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); open.push(ctx);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
    if (stubUnclearable) await page.addInitScript(() => { window.Worker = class { postMessage(m) { setTimeout(() => this.onmessage?.({ data: { id: m.id, cleared: false } }), 300); } terminate() {} }; });
    return { page, errors };
  };
  const onCourse = (page, ms = 60000) => page.waitForFunction(() => !location.search.includes("mode=") && !!document.getElementById("editcourse") || (!location.search.includes("mode=") && !!document.getElementById("canvas3d")), null, { timeout: ms }).then(() => true, () => false);
  const inEditor = async (page) => { await page.waitForSelector("#backcourse", { timeout: 300000 }); await page.waitForTimeout(2500); };
  // (a) straight from the URL
  { const { page, errors } = await fresh();
    await page.goto(base + "?mode=editor"); await inEditor(page);
    await page.click("#backcourse"); checks.fromUrl = (await onCourse(page)) && !errors.length; await page.screenshot({ path: "test-results/back/a-course.png" }); }
  // (b) from the Course, the very course comes back
  { const { page, errors } = await fresh();
    await page.goto(base + `?course=${COURSE}`); await page.waitForSelector("#editcourse", { timeout: 300000 }); await page.waitForTimeout(1500);
    await page.click("#editcourse"); await inEditor(page);
    await page.click("#backcourse"); checks.fromCourse = (await onCourse(page)) && !errors.length;
    checks.sameCourse = await page.evaluate(() => !!document.getElementById("editcourse")); await page.screenshot({ path: "test-results/back/b-course.png" }); }
  // (b2) from the Course, the simulator says "cannot clear", the Design partner panel is closed: Back still goes back
  { const { page } = await fresh(true);
    await page.goto(base + `?course=${COURSE}`); await page.waitForSelector("#editcourse", { timeout: 300000 }); await page.waitForTimeout(1500);
    await page.click("#editcourse"); await inEditor(page);
    await page.click("#closehelper"); await page.click("#backcourse");
    checks.backWhenUnclearable = await onCourse(page); await page.screenshot({ path: "test-results/back/b2-course.png" }); }
  // (b3) "Apply and try it" may refuse, and then the refusal is seen (the panel opens)
  { const { page } = await fresh(true);
    await page.goto(base + `?course=${COURSE}`); await page.waitForSelector("#editcourse", { timeout: 300000 }); await page.waitForTimeout(1500);
    await page.click("#editcourse"); await inEditor(page);
    await page.click("#closehelper");
    const hasApply = await page.$("#applytry");
    checks.applyRefusalSeen = hasApply ? await (async () => { await page.$eval("#applytry", (e) => e.click()); return page.waitForFunction(() => !document.querySelector(".helper.closed") && /cannot find a way/.test(document.getElementById("reply")?.textContent ?? ""), null, { timeout: 20000 }).then(() => true, () => false); })() : "not tested (no proposal to apply)"; }
  // (c) from the gallery
  { const { page, errors } = await fresh();
    await page.goto(base + "?mode=gallery"); await page.waitForSelector("a:has-text('World editor')", { timeout: 300000 });
    await page.click("a:has-text('World editor')"); await inEditor(page);
    await page.click("#backcourse"); checks.fromGallery = (await onCourse(page)) && !errors.length; }
  // the gallery's own Back link and the Dojo's
  { const { page } = await fresh();
    await page.goto(base + "?mode=gallery"); await page.waitForSelector("a:has-text('Back to the Course')", { timeout: 300000 });
    await page.click("a:has-text('Back to the Course')"); checks.galleryBack = await onCourse(page); }
  { const { page } = await fresh();
    await page.goto(base + "?mode=dojo"); await page.waitForSelector("a:has-text('Back to the Course')", { timeout: 300000 });
    await page.click("a:has-text('Back to the Course')"); checks.dojoBack = await onCourse(page); }
  console.log(checks);
  await browser.close();
  process.exit(Object.values(checks).every((v) => v === true || (typeof v === "string" && v.startsWith("not tested"))) ? 0 : 1);
} finally { server.kill(); }
