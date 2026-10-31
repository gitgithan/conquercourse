// What the player sees: every starter character (and the Rookie) in the REAL Course, holding Right and then Left.
// For each: how far the runner moved on screen, where the toe bone points, and which way the SKIN faces against the way it moved (shoe cues on the posed skin).
// usage (worktree with node_modules): node data/eval/cc-chars-facing/scripts/probe-course.mjs OUT_DIR [only-name]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [OUT, ONLY] = process.argv.slice(2);
const DSF = Number(process.env.DSF ?? 1); // DSF=3 for close-up pictures
const COURSE = process.env.COURSE ?? '/assets/parts/run.course.json'; // COURSE=/assets/demo/training.course.json for a course on a curved track
const cast = JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')).items;
const who = [{ name: 'Rookie', id: null }, ...cast.map((c) => ({ name: c.name, id: c.id }))].filter((w) => !ONLY || ONLY.split(',').includes(w.name));
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5198', '--strictPort'], { stdio: 'ignore' });
mkdirSync(OUT, { recursive: true });
const rows = [];
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: flags });
  for (const w of who) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: DSF });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:5198/?course=${COURSE}&welcome=0&nav=0&music=0&photos=0&probe=1&charguard=0&nosave=1${w.id ? `&char=${w.id}` : ''}`);
    await page.waitForFunction(() => { try { return !!window.__heading?.()?.skinScoreRight !== undefined && window.__heading?.() !== null; } catch { return false; } }, null, { timeout: 240000 });
    await page.waitForTimeout(w.id ? 8000 : 2000); // the character loads and is fitted after the first frame
    const row = { name: w.name, errors };
    const still = async () => { let p = await page.evaluate(() => window.__heading().x); for (let k = 0; k < 120; k++) { await page.waitForTimeout(1500); const q = await page.evaluate(() => window.__heading().x); if (Math.abs(q - p) < 0.002) break; p = q; } }; // wait until the runner has stopped
    const shot = async (tag) => {
      const h = await page.evaluate(() => window.__heading()), x = Math.max(0, Math.min(1280 - 240, h.screen.x - 120)), y = Math.max(0, Math.min(720 - 200, h.screen.y - 110));
      await page.screenshot({ path: join(OUT, `${w.name.replace(/ /g, '-').toLowerCase()}-${tag}.jpg`), type: 'jpeg', quality: 80, clip: { x, y, width: 240, height: 200 } });
    };
    const reading = (h) => ({ x: h.x, hipsX: +h.hipsX.toFixed(2), heading: Math.sign(Math.round(h.heading)), boneToeDx: +h.boneToeDx.toFixed(3), skinLean: +h.skinScoreRight.toFixed(3), skinConfidence: +h.skinConfidenceRight.toFixed(3), votes: h.votes });
    // idle (feet flat): the skin's lean toward screen-right against the heading the Course renderer gave the actor
    row.idleStart = reading(await page.evaluate(() => window.__heading()));
    for (const [side, key] of [['right', 'ArrowRight'], ['left', 'ArrowLeft']]) {
      const a = await page.evaluate(() => window.__heading());
      await page.keyboard.down(key);
      let b = a;
      for (let k = 0; k < 120 && Math.abs(b.hipsX - a.hipsX) < 1.5; k++) { await page.waitForTimeout(500); b = await page.evaluate(() => window.__heading()); } // game time is slow on a software GPU: hold until it has really moved
      await shot(`${side}-running`);
      await page.keyboard.up(key); await still();
      const idle = await page.evaluate(() => window.__heading());
      await shot(`${side}-idle`);
      const dir = Math.sign(idle.hipsX - a.hipsX), r = reading(idle); // on screen, from the hips bone
      row[side] = { moved: +(idle.hipsX - a.hipsX).toFixed(2), movedDir: dir, ...r, skinFacesMovement: Math.sign(r.skinLean) === dir, skinFacesHeading: Math.sign(r.skinLean) === r.heading, headingFollowsPress: r.heading === dir };
    }
    rows.push(row); console.log(JSON.stringify(row));
    await page.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'probe.json'), JSON.stringify(rows, null, 2));
} finally { server.kill(); }
