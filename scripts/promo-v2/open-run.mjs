// Promo storyboard scene 0b-0e (CC-133): first person on the Training course, the ghost runs away ahead, the camera turns to about 45 degrees and ends in side view, Debug (B) 3 s in, the runner clears the Warped Wall at 7 s.
// usage: node open-run.mjs <playwright> <outdir> [baseUrl]     The runner is the bot on the ideal plan, standing still `botlag` ticks first so the ghost (same plan) is ahead.
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession, retime } from './lib.mjs';
const [pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(new URL('./params/open-run.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw, rafStep: true }); const p = S.p;
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
await p.goto(base + P.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 240000 });
await p.waitForTimeout(2500); await S.hideChrome();      // real waits only: the game clock must not move before the film starts
await p.keyboard.press('KeyH').catch(() => {});                 // Controls card off, as in the course-run clip
// wait until the ideal-run ghost is ready (its search runs once)
await p.waitForFunction(() => /Ghost: (?!working|Off|no )/.test(document.querySelector('#ghost-chip')?.textContent ?? ''), null, { timeout: 240000 });
await p.waitForTimeout(500);
const k = P.speed, g = (finalSec) => finalSec * k;                // final seconds -> game seconds
const runner = () => p.evaluate(() => ({ x: window.__filmRunner?.x ?? null }));
// the run starts when the page loaded; film from here. A mouse is parked on the picture for the camera turn.
const cx = 640, cy = 360; S.mx = cx; S.my = cy;                                          // the cursor first shows when the drag starts
const at = async (finalSec) => { const want = Math.round(g(finalSec) * S.fps); if (want > S.n) await S.rec((want - S.n) / S.fps); };
S.mark('start');
await at(P.firstSecs);                                          // first person, ghost running away
await p.keyboard.press('KeyC'); S.mark('toSide');               // first person -> side view
await at(P.dragStart);
const dx = -Math.round(P.angleDeg * Math.PI / 180 / 0.006);   // a drag turns the view: 0.006 rad per pixel
await p.mouse.move(cx - 90, cy + 40); await p.mouse.move(cx, cy, { steps: 6 }); await S.rec(0.15 * k); await p.mouse.down(); await S.rec(P.dragSecs * k, async (u) => { await p.mouse.move(cx + dx * (u * u * (3 - 2 * u)), cy); }); S.mark('angle');
await S.rec(P.angleHold * k);
await at(P.debugAt); await p.keyboard.press('KeyB'); S.mark('debug');     // B 3 s into the run, while the camera is turned
await S.rec(P.backSecs * k, async (u) => { await p.mouse.move(cx + dx * (1 - u * u * (3 - 2 * u)), cy); }); await p.mouse.up(); S.mark('sideAgain');
await at(P.endSecs);
S.mark('end');
const dbg = await p.evaluate(() => ({ x: window.__filmRunner?.x ?? null }));
await S.finish({ params: P, runner: dbg });
const secs = S.n / S.fps;
retime(out, `${out}/clip.mp4`, { k });
writeFileSync(`${out}/retime.json`, JSON.stringify({ gameSeconds: +secs.toFixed(2), speedUp: k, finalSeconds: +(secs / k).toFixed(2) }, null, 2));
console.log('done', secs, 'game s ->', secs / k, 's final');
