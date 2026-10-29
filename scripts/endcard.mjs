// The film's end card (beat 8): the logo SVG and the tagline on a dark ground, as a still and a 9.6 s clip with a slow fade-in (4 bars at 100 bpm).
// Usage: node scripts/endcard.mjs <out-dir>
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const out = process.argv[2] ?? 'films';
mkdirSync(out, { recursive: true });
const logo = readFileSync('public/brand/conquercourse-logo.svg', 'utf8').replace(/<svg /, '<svg style="width:760px;height:auto" ');
const html = `<body style="margin:0;background:#14181f;width:1280px;height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;font-family:Helvetica,Arial,sans-serif">${logo}<div style="color:#f4f1ea;font-size:44px;letter-spacing:6px;font-weight:300">Train slow. Run fast.</div><div style="position:absolute;bottom:22px;color:#8d96a3;font-size:15px">Street map data: OpenStreetMap contributors</div></body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.setContent(html); await p.screenshot({ path: `${out}/beat8-endcard.png` }); await b.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', `${out}/beat8-endcard.png`, '-t', '9.6', '-vf', 'fade=t=in:st=0:d=1.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/beat8-endcard.mp4`]);
console.log('wrote', out);
