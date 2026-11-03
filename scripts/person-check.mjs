// The editor always shows one Rookie and gold cone at the start; turning keeps that point fixed and Fit fills the picture.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5191', out = process.env.OUT ?? 'test-results/editor-start';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const world = { pieces: [12, 22, 32].map((x) => ({ src: 'block', x, z: 4, y: 0, yaw: 0, scale: 3 })), angle: 0, offset: 4, level: 0 };
// A saved, hidden scale reference must not create another person or hide the new start marker.
world.pieces.push({ src: 'obj:../characters/rookie-a.glb', x: -90, z: 30, y: 0, yaw: 0, scale: 1 });
const errors = [];
let browser;
try {
  await new Promise((r) => setTimeout(r, 2500));
  browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((w) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('seeded', '1'); localStorage.setItem('cc.world.v1', JSON.stringify(w)); localStorage.setItem('cc.person', '0'); }
  }, world);
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForFunction(() => document.querySelector('#view3d')?.dataset.startCharacter === 'a');
  await page.locator('#glossaryhide').click().catch(() => {});
  assert.equal(await page.locator('#personfind, #personhide, [data-object="person"]').count(), 0);
  const start = () => page.locator('#view3d').evaluate((c) => JSON.parse(c.dataset.start));
  const initial = await start(); assert.ok(initial.x > 5); assert.equal(initial.z, 4); assert.ok(initial.y > 2);
  await page.click('#fitview'); await page.waitForTimeout(700);
  const frame = await page.locator('#view3d').boundingBox();
  const screen = await page.evaluate(() => window.ccPieceScreen());
  const span = Math.max(...screen.map((p) => p.x)) - Math.min(...screen.map((p) => p.x));
  assert.ok(span > frame.width * 0.45, `3D Fit should fill the view: span ${span}, width ${frame.width}`);
  for (const p of screen) assert.ok(p.x > frame.x && p.x < frame.x + frame.width && p.y > frame.y && p.y < frame.y + frame.height);
  await page.screenshot({ path: `${out}/fit-3d.png` });
  for (const deg of [15, 45, 90, 135, 180, 0]) {
    await page.locator('#angle').evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, deg);
    const now = await start();
    for (const key of ['x', 'y', 'z']) assert.ok(Math.abs(now[key] - initial[key]) < 1e-8, `${key} moved at ${deg} degrees`);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cc.world.v1')));
    assert.ok(Math.abs(-initial.x * Math.sin(saved.angle) + initial.z * Math.cos(saved.angle) - saved.offset) < 1e-8);
    assert.deepEqual(saved.pieces, world.pieces.slice(0, 3));
  }
  await page.locator('#angle').evaluate((input) => { input.value = '45'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.screenshot({ path: `${out}/turned-45.png` });
  await page.click('#undo'); assert.deepEqual(await start(), initial);
  await page.click('#redo'); assert.deepEqual(await start(), initial);
  await page.reload(); await page.waitForFunction(() => document.querySelector('#view3d')?.dataset.startCharacter === 'a');
  assert.deepEqual(await start(), initial);
  await page.click('#fitview'); await page.waitForTimeout(700);
  await page.click('#viewmode'); await page.click('#fitview');
  await page.screenshot({ path: `${out}/fit-plan.png` });
  assert.deepEqual(errors, []);
  console.log('PASS: permanent Rookie, old hidden preference ignored, fixed pivot at six angles, unchanged pieces, saved pivot, undo/redo, close 3D Fit and top plan; no page errors.');
} finally { await browser?.close(); server.kill(); }
