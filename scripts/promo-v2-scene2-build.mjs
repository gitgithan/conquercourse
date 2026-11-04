#!/usr/bin/env node
// Promo v2 scene 2 build (CC-133): raw stepped frames -> retimed clip with the bottom overlay and the top-left Meta chip.
// usage: node scripts/promo-v2-scene2-build.mjs [--dir ../conquercourse-assets/promo-v2b] [--only 2a,2b]
// manifest.json clips[]: { id, dir (holds frames/), pieces: [[srcFrom, srcTo, outSeconds], ...], dur, overlay: {text}, chip: {text} | null, layout: {overlay, chip} }
// Retiming is by the stepped game clock: frame i is exactly i/30 s of game time, so a piece maps a game-time range onto an output length.
// The layout rule: overlay text at the BOTTOM of the frame, the blue chip at the TOP LEFT; `scripts/promo-v2/layout-check.py` proves they cannot touch.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('--dir', '../conquercourse-assets/promo-v2b');
const only = (arg('--only', '') ?? '').split(',').filter(Boolean);
const man = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error(cmd + ' failed: ' + args.join(' ').slice(0, 300)); };
const q = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019');
const FPS = man.fps ?? 30;
const dt = (text, L, kind) => `drawtext=fontfile=${FONT}:text='${q(text)}':fontsize=${L.size}:fontcolor=white:box=1:boxcolor=${L.box}:boxborderw=${L.border}:x=${L.x}:y=${L.y}`;
for (const c of man.clips) {
  if (only.length && !only.includes(c.id)) continue;
  const cdir = join(dir, c.dir ?? c.id), work = join(cdir, 'work'); mkdirSync(work, { recursive: true });
  const pieces = []; let cum = 0, have = 0;
  c.pieces.forEach(([a, b, out], i) => {
    cum += out; const n = Math.round(cum * FPS) - have; have += n; // whole frames per piece, so the clip is exactly dur long
    const f = join(work, `p${i}.mp4`);
    run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(cdir, 'frames/f%05d.jpg'), '-vf',
      `trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)*${(n / FPS / (b - a)).toFixed(6)},fps=${FPS},tpad=stop_mode=clone:stop_duration=1,scale=1920:1080:flags=lanczos,format=yuv420p`,
      '-frames:v', String(n), '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', f]);
    pieces.push(f);
  });
  writeFileSync(join(work, 'list.txt'), pieces.map((f) => `file '${f.split('/').pop()}'`).join('\n'));
  run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-c', 'copy', join(work, 'joined.mp4')]);
  const vf = [dt(c.overlay.text, c.layout.overlay, 'overlay'), ...(c.chip ? [dt(c.chip.text, c.layout.chip, 'chip')] : [])].join(',');
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(work, 'joined.mp4'), '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(cdir, 'clip.mp4')]);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(c.dur / 2), '-i', join(cdir, 'clip.mp4'), '-frames:v', '1', '-q:v', '3', join(cdir, 'thumb.jpg')]);
  console.log('built', c.id, c.dur, 's');
}
