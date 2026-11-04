// Promo storyboard scene 9 (CC-133), "Close": all eleven characters (the made ninja warrior and ten more) stand facing the camera round the logo and slogan; the Play now link stays clear and readable.
// usage: node scene9.mjs <playwright> <outdir> [baseUrl]    env NINJA=<url of the ninja glb>   SECONDS=<length, default 7>
import { openSession } from './lib.mjs';
const [pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const S = await openSession({ url: null, out, pw, marker: false }); const p = S.p;
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 200)));
const ninja = process.env.NINJA ? `&ninja=${encodeURIComponent(process.env.NINJA)}` : '';
await p.goto(`${base}/close-stage.html?backend=webgl2${ninja}`);
await p.waitForFunction(() => window.__closeReady !== undefined, null, { timeout: 300000, polling: 200 });
const ready = await p.evaluate(() => window.__closeReady); if (ready !== true) throw new Error('stage: ' + ready);
const frames = Math.round(Number(process.env.SECONDS ?? 7) * 30);
S.mark('start');
for (let i = 0; i < frames; i++) { await S.tick(); await S.shot(); }
S.mark('end'); await S.finish({});
