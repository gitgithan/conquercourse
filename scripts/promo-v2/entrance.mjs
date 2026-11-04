// Promo v2 segment 0a: The Grand Entrance walk, entrance to stage, exactly 5.0 s at 30 fps on the stepped clock (CC-133).
// usage: node entrance.mjs <playwright> <outdir> [baseUrl]
// The page runs in ?promo=1: it loads Pip, Juno and the cast first, raises window.__entranceReady, and then walks from the clock alone.
// We wait for that flag (no pictures, the clock still), then step 150 pictures; picture n shows film time n/30 s, so the last one is the stage.
import { openSession } from './lib.mjs';
const [pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const S = await openSession({ url: null, out, pw, rafStep: true });
const p = S.p;
await p.goto(`${base}/making-of/timeline.html?promo=1&music=0`);
// wall-clock wait for the models, with the clock held (the walk's own clock starts when the flag rises)
await p.waitForFunction(() => window.__entranceReady !== undefined, null, { timeout: 240000, polling: 200 });
const ready = await p.evaluate(() => window.__entranceReady);
if (ready !== true) throw new Error('the 3D models did not load: ' + ready);
await S.hideChrome();
const FRAMES = 150;
S.mark('start');
for (let i = 0; i < FRAMES; i++) { await S.tick(); await S.shot(); }
S.mark('end');
const done = await p.evaluate(() => ({ done: window.__entranceDone === true, f: window.__entranceProgress }));
console.log('done', JSON.stringify(done));
await S.finish({ promoSeconds: 5, done });
