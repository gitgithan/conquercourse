// Runs the bundle in a Playwright browser: node run-browser.mjs chromium|firefox|webkit > out.json
import { readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
const kind = process.argv[2] ?? 'chromium';
const d = new URL('./dist/', import.meta.url).pathname;
const b = await { chromium, firefox, webkit }[kind].launch();
const page = await b.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: readFileSync(d + 'engine.js', 'utf8') });
const courses = JSON.parse(readFileSync(d + 'courses.json', 'utf8'));
const t = Date.now();
const res = await page.evaluate((list) => ({ runs: globalThis.determinismReal.runAll(list), info: globalThis.determinismReal.engineInfo() }), courses);
console.log(JSON.stringify({ machine: { engine: `${kind} ${b.version()}`, arch: process.arch, platform: process.platform, info: res.info, seconds: (Date.now() - t) / 1000 }, runs: res.runs }));
await b.close();
