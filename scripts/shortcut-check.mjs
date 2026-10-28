// Shortcuts in the Course: (1) ?bot=shortcut plays the stored shortcut line and clears; (2) Shift+I plays the planned run, then the end panel says a shortcut exists and "Watch the shortcut" plays it to the finish.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const course = process.env.COURSE ?? '/assets/demo/generated-1.course.json';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/shortcut', { recursive: true });
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
    await page.goto(`http://localhost:${port}/?course=${course}${q}`);
    await page.waitForSelector('canvas', { timeout: 60000 });
    return page;
  };
  const until = async (page, re, secs) => { for (let i = 0; i < secs; i++) { await page.waitForTimeout(1000); if (re.test(await page.textContent('body'))) return true; } return false; };
  // (1) the bot plays the shortcut line
  const a = await open('&bot=shortcut');
  checks.botShortcutCleared = await until(a, /You made it/, Number(process.env.SECONDS ?? 150));
  await a.screenshot({ path: 'test-results/shortcut/bot-end.png' });
  await a.close();
  // (2) Shift+I, then the shortcut note and button in the end panel
  const b = await open('');
  await b.waitForTimeout(1500);
  await b.keyboard.press('Shift+KeyI');
  checks.idealNoteHasShortcut = await until(b, /Shortcut: /, 60);
  await b.screenshot({ path: 'test-results/shortcut/ideal-note.png' });
  checks.endPanelShortcut = await until(b, /(A shortcut exists|keeps a shortcut)/, Number(process.env.SECONDS ?? 150));
  await b.screenshot({ path: 'test-results/shortcut/end-panel.png' });
  if (checks.endPanelShortcut) {
    await b.click('#watchshortcut');
    checks.watchedShortcutCleared = await until(b, /You made it/, Number(process.env.SECONDS ?? 150));
    await b.screenshot({ path: 'test-results/shortcut/watched.png' });
  }
  console.log(checks);
  await browser.close();
} finally { server.kill(); }
