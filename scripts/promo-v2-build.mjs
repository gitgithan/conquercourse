#!/usr/bin/env node
// Promo v2 rebuild (CC-133): re-assemble the final film from the per-segment clips listed in manifest.json.
// usage: node scripts/promo-v2-build.mjs [--dir ../conquercourse-assets/promo-v2] [--out final/promo-v2.mp4] [--only seg1,seg2 (rebuild those work files, reuse the rest)]
// To reshoot one segment: run its capture script (see docs/promo-v2.md), put the new clip at the manifest `file`, update `dur` if it changed, run this again.
// Needs ffmpeg and the DejaVu Sans Bold font. No secrets, no machine paths: every path is relative to --dir.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('--dir', '../conquercourse-assets/promo-v2');
const man = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const outName = arg('--out', man.final ?? 'final/promo-v2.mp4');
const only = arg('--only', '')?.split(',').filter(Boolean);
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const work = join(dir, 'work'); mkdirSync(work, { recursive: true }); mkdirSync(join(dir, 'final'), { recursive: true });
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error(cmd + ' failed: ' + args.join(' ').slice(0, 300)); };
const q = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019');
const FPS = man.fps ?? 30, M = man.music;
const drawtext = (text, from, to, kind) => kind === 'tag'
  ? `drawtext=fontfile=${FONT}:text='${q(text)}':fontsize=26:fontcolor=white:box=1:boxcolor=0x1a4fa0@0.85:boxborderw=12:x=28:y=24:enable='between(t,${from},${to})'`
  : `drawtext=fontfile=${FONT}:text='${q(text)}':fontsize=38:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-96:enable='between(t,${from},${to})'`;
const parts = [];
for (const s of man.segments) {
  const v = join(work, s.id + '.v.mp4'), a = join(work, s.id + '.a.wav');
  if (!only.length || only.includes(s.id) || !existsSync(v)) {
    const caps = (s.captions ?? []).map((c) => drawtext(c.text, c.from, c.to, 'cap'));
    const vf = [`scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=${FPS}`, `tpad=stop_mode=clone:stop_duration=${s.dur}`, ...caps, `trim=duration=${s.dur}`, 'setpts=PTS-STARTPTS', 'format=yuv420p'].join(',');
    const inArgs = s.reverse ? [] : [];
    run('ffmpeg', ['-y', '-loglevel', 'error', ...(s.ss ? ['-ss', String(s.ss)] : []), '-i', join(dir, s.file), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-r', String(FPS), v]);
    // audio: the old music range; longer slot = loop the last bars with a crossfade; shorter = cut
    const [a0, a1] = s.audio; const len = a1 - a0; const master = join(dir, M.master);
    if (s.dur <= len + 0.01) run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(a0), '-t', String(s.dur), '-i', master, a]);
    else {
      const L = M.loopSeconds ?? 4.8, X = M.crossfade ?? 0.3; let cur = join(work, s.id + '.a0.wav');
      run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(a0), '-t', String(len), '-i', master, cur]);
      const tail = join(work, s.id + '.tail.wav'); run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(a1 - L), '-t', String(L), '-i', master, tail]);
      let have = len, k = 0;
      while (have < s.dur) { const nxt = join(work, `${s.id}.a${++k}.wav`); run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cur, '-i', tail, '-filter_complex', `acrossfade=d=${X}:c1=tri:c2=tri`, nxt]); cur = nxt; have += L - X; }
      run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cur, '-t', String(s.dur), '-af', `afade=t=out:st=${Math.max(0, s.dur - 0.05)}:d=0.05`, a]);
    }
  }
  parts.push({ s, v, a });
}
// join, then the credit tags at film time
let t = 0; const starts = {}; for (const p of parts) { starts[p.s.id] = t; t += p.s.dur; }
const tags = (man.tags ?? []).map((g) => drawtext(g.text, +(starts[g.segment] + g.from).toFixed(2), +(starts[g.segment] + g.to).toFixed(2), 'tag'));
const list = join(work, 'list.txt'); writeFileSync(list, parts.map((p) => `file '${p.s.id}.v.mp4'`).join('\n'));
const alist = join(work, 'alist.txt'); writeFileSync(alist, parts.map((p) => `file '${p.s.id}.a.wav'`).join('\n'));
run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', join(work, 'silent.mp4')]);
run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', join(work, 'music.wav')]);
run('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(work, 'silent.mp4'), '-i', join(work, 'music.wav'), '-vf', tags.length ? tags.join(',') : 'null', '-af', 'afade=t=in:st=0:d=0.15', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '3500k', '-bufsize', '7000k', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', join(dir, outName)]);
for (const s of man.segments) { s.start = +starts[s.id].toFixed(2); s.end = +(starts[s.id] + s.dur).toFixed(2); }
const manOut = { ...man, built: new Date().toISOString().slice(0, 10), total_seconds: +t.toFixed(2), segment_starts: starts };
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manOut, null, 2));
console.log('wrote', join(dir, outName), t.toFixed(1), 's');
