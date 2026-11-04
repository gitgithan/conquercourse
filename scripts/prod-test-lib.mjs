// CC-133 helpers: one headless browser, logs page errors and failed or 4xx/5xx requests per check
import { chromium } from 'playwright';
export const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist', '--autoplay-policy=document-user-activation-required'];
export async function start() { return chromium.launch({ args: flags }); }
export async function newPage(browser, log, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  const entry = (log[name] ??= { errors: [], bad: [], api: {} });
  page.on('pageerror', (e) => entry.errors.push(e.message.slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') entry.errors.push('console: ' + m.text().slice(0, 140)); });
  page.on('requestfailed', (r) => entry.bad.push(`FAILED ${r.url().slice(0, 100)} ${r.failure()?.errorText}`));
  page.on('response', (r) => { const u = r.url(); if (r.status() >= 400) entry.bad.push(`${r.status()} ${u.slice(0, 110)}`); if (u.includes('/api/')) entry.api[new URL(u).pathname + ' ' + r.request().method()] = r.status(); });
  return { page, ctx };
}
