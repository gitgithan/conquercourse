// The film's start card and end card (CC-143): the logo panel, the slogan and (end card only) the "Play now" pill, on a soft sky with city blocks, a hill and trees.
// Frames are drawn from the time alone (no real clock), so a re-run gives the same film.
// usage: node scripts/film-d/cards.mjs <start|end> <outdir> [--stills dir]     then: ffmpeg is called here to make the mp4
import { readFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [kind, out] = process.argv.slice(2);
const stillsDir = process.argv.includes('--stills') ? process.argv[process.argv.indexOf('--stills') + 1] : '';
if (!['start', 'end'].includes(kind) || !out) throw new Error('usage: cards.mjs <start|end> <outdir> [--stills dir]');
const SECONDS = kind === 'start' ? 4.8 : 2.4, FPS = 30, N = Math.round(SECONDS * FPS);
const svg = readFileSync(new URL('../../public/brand/conquercourse-logo.svg', import.meta.url), 'utf8').replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300" style="width:100%;display:block">');
const trees = [[150, 940, 62], [330, 975, 46], [560, 925, 70], [800, 985, 42], [1010, 965, 36], [1230, 940, 66], [1480, 990, 44], [1720, 900, 92]];
const blocks = [[0, 620, 230, 460], [300, 540, 190, 540], [560, 600, 250, 480], [900, 480, 190, 600], [1180, 640, 220, 440], [1450, 560, 240, 520], [1740, 620, 220, 460]];
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000;font-family:Helvetica,Arial,'Liberation Sans',sans-serif}
#stage{position:absolute;inset:0;transform-origin:50% 45%;background:linear-gradient(#6c97c0,#92b2cf 62%,#a8c0d6)}
.b{position:absolute;background:#7f93a8;opacity:.55}
#hill{position:absolute;left:-200px;right:-200px;top:900px;height:600px;border-radius:50%;background:#86a56c}
.t{position:absolute;border-radius:50%;background:#4f8a3f;border:5px solid #1d2a1d;box-sizing:border-box}
.t i{position:absolute;left:18%;top:18%;width:30%;height:30%;border-radius:50%;background:rgba(255,255,255,.18)}
.k{position:absolute;width:12px;background:#6b4a2b}
#panel{position:absolute;left:210px;top:80px;width:1500px;border-radius:44px;box-shadow:0 22px 50px rgba(15,25,45,.35)}
#slogan{position:absolute;left:0;right:0;top:640px;text-align:center;font-weight:900;font-size:164px;line-height:1;color:#fff;letter-spacing:-2px;text-shadow:7px 7px 0 #0e1218}
#slogan b{color:#ffa63e}
#pill{position:absolute;left:260px;width:1400px;top:905px;height:130px;border-radius:65px;background:#0f6b5a;border:6px solid #0b3b30;box-sizing:border-box;color:#fff;font-weight:800;font-size:64px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.3)}
#veil{position:absolute;inset:0;background:#000;opacity:0}
</style><div id="stage">
${blocks.map(([x, y, w, h]) => `<div class="b" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`).join('')}
<div id="hill"></div>
${trees.map(([x, y, r]) => `<div class="k" style="left:${x - 6}px;top:${y}px;height:${r * 1.1}px"></div><div class="t" style="left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px"><i></i></div>`).join('')}
<div id="panel">${svg}</div>
<div id="slogan">Train slow. <b>Run fast.</b></div>
${kind === 'end' ? '<div id="pill">Play now: conquercourse.pages.dev</div>' : ''}
<div id="veil"></div></div>`;
const { chromium } = await import('playwright');
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
const frames = `${out}/frames`; rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const ease = (x) => x * x * (3 - 2 * x);
for (let i = 0; i < N; i++) {
  const u = i / (N - 1), t = i / FPS;
  const scale = kind === 'start' ? 1 + 0.05 * ease(u) : 1.0 + 0.035 * u; // a slow push in
  const veil = kind === 'start' ? 1 - ease(Math.min(1, t / 0.9)) : 0; // fade in from black (start card only)
  await p.evaluate(([s, v]) => { document.getElementById('stage').style.transform = `scale(${s})`; document.getElementById('veil').style.opacity = String(v); }, [scale, veil]);
  await p.screenshot({ path: `${frames}/${String(i).padStart(4, '0')}.png` });
}
await b.close();
const mp4 = `${out}/${kind}-card.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${frames}/%04d.png`, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', mp4]);
if (stillsDir) { mkdirSync(stillsDir, { recursive: true }); copyFileSync(`${frames}/${String(Math.round(N * 0.6)).padStart(4, '0')}.png`, `${stillsDir}/${kind}-card.png`); }
console.log(mp4, N, 'frames');
