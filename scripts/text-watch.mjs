// Prints every message that appears on the Course (hint, toast, banner) with the game tick it first showed and how long it stayed (game seconds).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const query = process.env.QUERY ?? 'bot=ideal&startx=60&timescale=0.25';
const until = process.env.UNTIL ?? 'swing';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.goto(`http://localhost:${port}/?${query}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  const log = await page.evaluate((until) => new Promise((res) => {
    const seen = new Map(); const out = [];
    const iv = setInterval(() => {
      const tick = Number(document.documentElement.dataset.tick), mode = document.documentElement.dataset.mode;
      const texts = [...document.querySelectorAll('div')].filter((d) => d.children.length === 0 && d.textContent.trim() && getComputedStyle(d).display !== 'none' && getComputedStyle(d).position === 'fixed' && /^(Press|Hold|Trampoline|Firm|Hard|Ouch|Land|Next gap|Back|Working)/.test(d.textContent.trim()) && !/^Next gap/.test(d.textContent.trim())).map((d) => d.textContent.trim());
      for (const t of texts) if (!seen.has(t)) { seen.set(t, tick); out.push({ text: t, tick, mode }); }
      for (const [t, t0] of seen) if (!texts.includes(t)) { const o = out.find((x) => x.text === t && x.seconds === undefined); if (o) o.seconds = ((tick - t0) / 120).toFixed(2); seen.delete(t); }
      if (mode === until || document.documentElement.dataset.outcome !== 'running') { clearInterval(iv); res(out); }
    }, 25);
    setTimeout(() => { clearInterval(iv); res(out); }, 200000);
  }), until);
  console.log(JSON.stringify(log, null, 1));
  await browser.close();
} finally { server.kill(); }
