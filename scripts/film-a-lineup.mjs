// The group photo for film A: the Rookie and the 8 cast characters on one lit stage (?demo=lineup), the camera glides across them on the stepped clock.
// Usage: node scripts/film-a-lineup.mjs --name lineup --dur 5 [--out films-a] [--fps 30] [--base URL]
import { Shot, arg } from './film-lib.mjs';
const fps = Number(arg('fps', 30)), dur = Number(arg('dur', 5)), base = arg('base', 'http://localhost:5173');
const shot = new Shot({ name: arg('name', 'lineup'), outDir: arg('out', 'films-a'), fps, width: Number(arg('width', 1280)), height: Number(arg('height', 720)) });
const page = await shot.open(`${base}/?demo=lineup&dur=${dur}&welcome=0`, { cursor: false, noTransitions: false, waitReady: (p) => p.waitForSelector('html[data-ready=true]', { timeout: 180000 }) });
shot.sub = 2;
await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => { if (/^\s*Feedback\s*$/.test(e.textContent || '') && e.tagName !== 'HTML') e.style.display = 'none'; }));
await shot.advance(500);
await shot.frames(Math.round(dur * fps));
await shot.close();
process.exit(0);
