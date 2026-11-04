// Promo storyboard scene 8 (CC-133), "Create your own Character". Clip a = the real app (the preview site, so the paid maker runs for real): Training course, Characters, type, Make it, trimmed wait, Play as, camera from side to front.
// Clip b = the crowd stage (crowd-stage.html on the local dev server): the made ninja stands alone (front view), the camera turns to 45 degrees, ten characters jump onto the platform, the camera turns to the side and zooms to fit, then from the middle outwards each jumps and freezes.
// usage: node scene8.mjs <a|b> <playwright> <outdir> [baseUrl]
//   env SITE=<site for clip a, default baseUrl>   DRY=1 types the words and stops before Make it (no paid call)   NINJA=<url of the glb for clip b>
import { writeFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [which, pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const PROMPT = 'ninja warrior';

async function clipA() {
  const site = process.env.SITE || base;
  const S = await openSession({ url: null, out, pw, rafStep: true }); const p = S.p;
  await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
  await p.goto(`${site}/?welcome=0&backend=webgl2&charguard=0&sunat=noon`);
  await p.waitForSelector('#characters-btn', { timeout: 240000 });
  await S.settle(4000); await S.hideChrome();
  await S.rec(1.2); S.mark('start');
  await S.clickSel('#characters-btn', { move: 0.9, hold: 0.3, after: 0.6 }); S.mark('panelOpen');
  await p.waitForSelector('#chars input[name=prompt]', { state: 'visible', timeout: 60000 });
  await S.rec(0.6);
  await S.clickSel('#chars input[name=prompt]', { move: 0.8, hold: 0.25, after: 0.3 });
  for (const ch of PROMPT) { await p.keyboard.type(ch); await S.rec(0.11); }
  S.mark('typed'); await S.rec(0.6);
  if (process.env.DRY) { await S.finish({ dry: true }); return; }
  await S.clickSel('#chars form button[type=submit]', { move: 0.8, hold: 0.3, after: 0.1 }); S.mark('makeIt');
  // the bot check may show a small card first: wait for it to go, no pictures
  await S.until(() => ![...document.querySelectorAll('div')].some((d) => d.style.zIndex === '99999'), 'check', 120000);
  await S.rec(3.2); S.mark('progress');
  const msg = () => p.evaluate(() => document.querySelector('#chars .msg')?.textContent ?? '');
  // the wait itself is trimmed: the clock runs, no pictures are taken
  const evid = setInterval(() => p.screenshot({ path: `${out}/diag-${Date.now()}.png` }).catch(() => {}), 20000);
  p.on('console', (m) => /error|warn/.test(m.type()) && console.log('console', m.text().slice(0, 200)));
  const ok = await S.until(() => /ready|already made|Could not|too long|Stopped/.test(document.querySelector('#chars .msg')?.textContent ?? ''), 'generation', 420000);
  clearInterval(evid);
  const said = await msg(); console.log('generation said:', said);
  if (!ok || /Could not|too long|Stopped/.test(said)) throw new Error('generation failed: ' + said);
  await S.rec(1.8); S.mark('ready');
  // the new character is the first card under "Yours, not shared yet" (or, when the words were made before, the one named like them)
  const id = await p.evaluate(() => { const c = document.querySelector('#chars-mine .card') ?? [...document.querySelectorAll('#chars .card')].find((x) => /ninja/i.test(x.textContent)); return c?.dataset.id ?? null; });
  console.log('character id', id); if (!id) throw new Error('no ninja card');
  const sel = `#chars .card[data-id="${id}"] button`;
  await p.locator(sel).first().scrollIntoViewIfNeeded(); await S.rec(0.5);
  const b64 = await p.evaluate(async (i) => { const r = await fetch('/api/character?id=' + i); const b = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let k = 0; k < b.length; k += 8192) s += String.fromCharCode(...b.subarray(k, k + 8192)); return btoa(s); }, id);
  writeFileSync(`${out}/ninja.glb`, Buffer.from(b64, 'base64')); console.log('glb bytes', Buffer.from(b64, 'base64').length);
  await S.clickSel(sel, { move: 0.9, hold: 0.3, after: 0.4 }); S.mark('playAs');
  await S.rec(0.8);
  await S.clickSel('#chars button:last-of-type', { move: 0.7, hold: 0.2, after: 0.2 }).catch(() => {});   // Close
  await S.until(() => !document.getElementById('chars'), 'panel gone', 20000);
  // the runner loads (no pictures), then the camera turns from the side round to the front
  await S.until(() => document.querySelector('#charnote') === null || true, 'x', 10); await S.settle(8000);
  await S.rec(1.5); S.mark('side');
  const r = await p.evaluate(() => { const b = document.querySelector('canvas').getBoundingClientRect(); return { x: b.left + b.width * 0.55, y: b.top + b.height * 0.6 }; });
  await S.glide(r.x, r.y, 0.6);
  await S.drag(Number(process.env.DRAG ?? -330), 0, 3.2); S.mark('front');
  await S.rec(2.0); S.mark('end');
  await S.finish({ id });
}

async function clipB() {
  const S = await openSession({ url: null, out, pw, rafStep: true, marker: false }); const p = S.p;
  p.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 200)));
  const ninja = process.env.NINJA ? `&ninja=${encodeURIComponent(process.env.NINJA)}` : '';
  await p.goto(`${base}/crowd-stage.html?backend=webgl2${ninja}`);
  await p.waitForFunction(() => window.__crowdReady !== undefined, null, { timeout: 300000, polling: 200 });
  const ready = await p.evaluate(() => window.__crowdReady); if (ready !== true) throw new Error('stage: ' + ready);
  const end = await p.evaluate(() => window.__crowdEnd);
  const frames = Math.ceil(end * 30);
  S.mark('start');
  for (let i = 0; i < frames; i++) { await S.tick(); await S.shot();  }
  S.mark('end'); await S.finish({ seconds: end });
}
await (which === 'a' ? clipA() : clipB());
