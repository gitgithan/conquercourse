// Opens the feedback form on the Course, types game keys into a text box, and checks the game did not react and the text arrived.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/feedback-questions.json', (r) => r.fulfill({ json: { round: 't', title: 'T', intro: 'i', questions: [{ id: 'a', type: 'text', text: 'Say something' }] } }));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.click('text=Feedback');
  await page.click('textarea');
  await page.keyboard.type('tT rR iI cC hH Space and arrows', { delay: 20 });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
  const checks = {
    stillOnCourse: !page.url().includes('mode=dojo') && (await page.$$('.dojo')).length === 0,
    typed: (await page.inputValue('textarea')) === 'tT rR iI cC hH Space and arrows',
    labelsPlain: !(await page.textContent('#cc-feedback')).includes('(optional)'),
    topNoteKept: (await page.textContent('#cc-feedback')).includes('Every question is optional'),
    runnerDidNotMove: Number(await page.evaluate(() => document.documentElement.dataset.tick)) >= 0 && (await page.textContent('body')).includes('0 m of'),
  };
  await page.click('text=Close');
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(1500);
  checks.keysWorkAfterClose = (await page.$$('.dojo')).length === 1 || page.url().includes('dojo');
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
