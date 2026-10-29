// Shared helpers for the CC-186 real-page checks: a vite server, a stepped clock (one rAF = one step, the game time never depends on machine speed).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
export const OUT = new URL('.', import.meta.url).pathname;
export const port = Number(process.env.PORT ?? 5170);
export const base = `http://127.0.0.1:${port}`;
export const stepInit = `(() => { let t = 1000; const real = window.requestAnimationFrame.bind(window); performance.now = () => t;
  window.__hold = false; window.__stepClock = (ms) => { t += ms; return t; };
  window.requestAnimationFrame = (cb) => real(() => { if (window.__auto) t += window.__autoMs ?? 1000 / 60; cb(t); });
  window.__auto = false; })();`;
export const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
export const results = [];
export const ok = (area, name, pass, note = '') => { results.push({ area, name, pass, note }); console.log(pass ? 'PASS' : 'FAIL', area, name, note); };
export const save = (file) => writeFileSync(OUT + file, JSON.stringify(results, null, 2) + '\n');
// advance n game frames in the stepped clock
export const frames = (page, n) => page.evaluate(async (n) => { for (let i = 0; i < n; i++) { window.__stepClock(1000 / 60); await new Promise((r) => requestAnimationFrame(() => r())); } }, n);
export const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` });
