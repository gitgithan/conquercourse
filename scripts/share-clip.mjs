// Make the share clip without a person (CC-129): node scripts/share-clip.mjs "<challenge link>" [out.mp4]
// Opens the link in a headless browser with ?clip=auto, waits for the clip, saves it. Needs the site (or `vite`) to be reachable.
import { chromium } from 'playwright';
const [link, file = 'films/conquercourse-run.mp4'] = process.argv.slice(2);
if (!link) { console.error('usage: node scripts/share-clip.mjs "<challenge link>" [out.mp4]'); process.exit(2); }
const url = new URL(link); url.searchParams.set('clip', 'auto'); url.searchParams.set('welcome', '0'); url.searchParams.set('tour', '0');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true })).newPage();
await page.goto(url.href, { waitUntil: 'load' });
await page.waitForSelector('#clip-download', { timeout: 540000 });
const [d] = await Promise.all([page.waitForEvent('download'), page.click('#clip-download')]);
const { mkdirSync } = await import('node:fs'); const { dirname } = await import('node:path');
mkdirSync(dirname(file), { recursive: true }); await d.saveAs(file);
console.log('saved', file); await b.close();
