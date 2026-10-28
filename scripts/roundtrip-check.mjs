// CC-80: the round trip. Play a 5 m gap from the editor, fall, "Make it easier" (the editor opens at the gap, looks for a smaller gap), "Apply and try it"
// (back in the Course at the same place), then "Edit this course" and "Back to the Course" (the undo list survives), and the changed lane clears.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const WORLD = { pieces: [{ src: 'box:8:0.5:2', x: 0, z: 0, y: 0, yaw: 0, scale: 1 }, { src: 'box:8:0.5:2', x: 13, z: 0, y: 0, yaw: 0, scale: 1 }], angle: 0, offset: 0, level: 0 };
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  var page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  await page.addInitScript((w) => { try { if (!localStorage.getItem('rt.seeded')) { localStorage.setItem('cc.world.v1', JSON.stringify(w)); localStorage.setItem('rt.seeded', '1'); } } catch { /* no storage */ } }, WORLD);
  mkdirSync('test-results/roundtrip', { recursive: true });
  const shot = (n) => page.screenshot({ path: `test-results/roundtrip/${n}.png` });
  const url = `http://localhost:${port}/`;

  // 1. editor -> Course
  await page.goto(`${url}?mode=editor`);
  await page.waitForSelector('#play', { timeout: 60000 });
  await page.click('#play');
  await page.waitForSelector('#editcourse', { timeout: 60000 });
  checks.courseHasEditButton = true;

  // 2. fall into the gap by running without jumping
  await page.keyboard.down('ArrowRight');
  await page.waitForSelector('#makeeasier', { timeout: 90000 });
  await page.keyboard.up('ArrowRight');
  checks.fellAndSawMakeItEasier = true;
  await shot('1-fall');

  // 3. Make it easier -> the editor opens at the gap and looks for a change
  await Promise.all([page.waitForURL(/mode=editor/, { timeout: 120000 }), page.click('#makeeasier')]);
  await page.waitForFunction(() => document.documentElement.dataset.fromcourse === 'easier', null, { timeout: 60000 });
  checks.editorOpenedFromCourse = true;
  await page.waitForFunction(() => document.documentElement.dataset.easier !== undefined, null, { timeout: 180000 });
  checks.foundAChange = (await page.evaluate(() => document.documentElement.dataset.easier)) === '1';
  checks.cardText = (await page.textContent('#reply'))?.replace(/\s+/g, ' ').slice(0, 220);
  await shot('2-easier-preview');
  checks.hasApplyAndTry = (await page.$('#applytry')) !== null;

  // 4. Apply and try it -> back in the Course at the same place
  await Promise.all([page.waitForURL((u) => !/mode=editor/.test(u.search), { timeout: 120000 }), page.click('#applytry')]);
  await page.waitForSelector('#editcourse', { timeout: 60000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.x) > 0, null, { timeout: 60000 });
  checks.backInCourseAtX = Number(await page.evaluate(() => document.documentElement.dataset.x));
  await shot('3-back-in-course');

  // 5. Edit this course -> the editor has the changed pieces and the undo list; Back to the Course returns
  await Promise.all([page.waitForURL(/mode=editor/, { timeout: 120000 }), page.click('#editcourse')]);
  await page.waitForFunction(() => document.documentElement.dataset.fromcourse === 'edit', null, { timeout: 60000 });
  checks.pieces = await page.evaluate(() => document.documentElement.dataset.pieces);
  checks.undoSurvived = (await page.evaluate(() => !document.getElementById('undo').disabled));
  await shot('4-edit-this-course');
  await Promise.all([page.waitForURL((u) => !/mode=editor/.test(u.search), { timeout: 120000 }), page.click('#backcourse')]);
  await page.waitForSelector('#editcourse', { timeout: 60000 });
  checks.backAgain = true;

  // 6. the changed lane clears (the ideal-run bot plays the editor's saved world)
  await page.goto(`${url}?mode=editor&bot=ideal`);
  await page.waitForSelector('#play', { timeout: 60000 });
  await page.click('#play');
  let cleared = false;
  for (let i = 0; i < 120 && !cleared; i++) { await page.waitForTimeout(1000); cleared = /You made it/.test(await page.textContent('body')); }
  checks.cleared = cleared;
  await shot('5-cleared');
  console.log(checks, 'errors:', errors);
  await browser.close();
} catch (e) { console.log('FAILED at', e.message.split('\n')[0], checks); try { console.log('covering', await page.evaluate(() => { const b = document.getElementById('editcourse'); if (!b) return 'no button'; const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t ? (t.id || t.tagName) + ' ' + (t.textContent || '').slice(0, 60) : 'nothing'; })); } catch { /* page gone */ } process.exitCode = 1; } finally { server.kill(); }
