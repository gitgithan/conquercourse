// Assembles film B from captured shots on the beat grid of the owner-cut score (100 bpm: beat 0.6 s = 18 frames at 30 fps, bar 2.4 s = 72 frames).
// Usage: node scripts/film-b-assemble.mjs <timeline.json> <out.mp4>
// timeline: { fps, music: { file, start, fadeOut }, segments: [ { file, ss, n, still?, fade?, cap?: [text, fromFrame, toFrame] } ], dim?: [fromFrame, toFrame] }
//  - ss and n are frames of the source clip (the first frame is 0); fade = frames of dissolve from the previous segment (0 or missing = hard cut).
//  - every cut lands on a beat: n is a multiple of 18; a dissolve eats its frames from both neighbours, so the beat grid does not move.
//  - captions are plain words, faded in and out over 9 frames; frames are counted from the start of the segment that carries the caption.
// Method: every piece is cut to its own lossless file with an exact frame count, joined with the concat demuxer, then captions and the encode happen in one last pass.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [, , tl, out] = process.argv;
const T = JSON.parse(readFileSync(tl, 'utf8')), fps = T.fps ?? 30, segs = T.segments;
const tmp = `${out}.parts`; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const run = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed: ' + args.join(' ').slice(0, 200)); };
const norm = `scale=1280:720,fps=${fps},format=yuv420p`;
const src = (s, a, b) => s.still
  ? [['-loop', '1', '-framerate', String(fps), '-i', s.file], `trim=end_frame=${b - a},setpts=PTS-STARTPTS,${norm}`]
  : [['-i', s.file], `trim=start_frame=${(s.ss ?? 0) + a}:end_frame=${(s.ss ?? 0) + b},setpts=PTS-STARTPTS,${norm}`];
const piece = (name, s, a, b) => { if (b <= a) return null; const [inp, vf] = src(s, a, b); const f = `${tmp}/${name}.mkv`; run([...inp, '-vf', vf, '-c:v', 'ffv1', '-an', f]); return f; };
const list = [], starts = []; let len = 0;
segs.forEach((s, i) => {
  const fin = s.fade ?? 0, fout = segs[i + 1]?.fade ?? 0;
  if (fin > 0) { // dissolve: the tail of the previous segment melts into the head of this one
    const p = segs[i - 1], [ia, va] = src(p, p.n - fin, p.n + 1), [ib, vb] = src(s, 0, fin + 1), f = `${tmp}/x${i}.mkv`;
    run([...ia, ...ib, '-filter_complex', `[0:v]${va}[a];[1:v]${vb}[b];[a][b]blend=all_expr='A*(1-(N+1)/${fin + 1})+B*((N+1)/${fin + 1})',fps=${fps}[v]`, '-map', '[v]', '-frames:v', String(fin), '-c:v', 'ffv1', '-an', f]);
    list.push(f); starts.push(len - fin); len += 0; // the frames of the dissolve were already counted by the previous segment's tail
    len += fin; // (counted below by body maths)
  } else starts.push(len);
  const bodyA = fin, bodyB = s.n - fout, f = piece(`s${i}`, s, bodyA, bodyB);
  if (f) list.push(f);
  len += (fin > 0 ? 0 : 0) + (bodyB - bodyA) + (fin > 0 ? 0 : 0);
});
// recompute total length from the list for the caption clock
const probe = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f]).stdout.toString().trim());
let total = 0; const cum = []; list.forEach((f) => { cum.push(total); const c = probe(f); if (process.env.FILM_DEBUG) console.log(f, c); total += c; });
// caption clock: a segment starts where its first own frame (or its dissolve) starts
const segStart = []; { let t = 0; segs.forEach((s, i) => { const fin = s.fade ?? 0; segStart.push(t - fin); t += s.n - fin; }); segStart[0] = 0; }
writeFileSync(`${tmp}/list.txt`, list.map((f) => `file '${f}'`).join('\n'));
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const filt = []; let cur = '0:v';
segs.forEach((s, i) => {
  if (!s.cap) return;
  const [text, a, b] = s.cap, ta = (segStart[i] + (s.fade ?? 0) + a) / fps, tb = (segStart[i] + (s.fade ?? 0) + b) / fps, nxt = `t${i}`;
  filt.push(`[${cur}]drawtext=fontfile=${font}:text='${text.replace(/'/g, '’').replace(/:/g, '\\:')}':fontsize=44:fontcolor=white:box=1:boxcolor=0x14181fb0:boxborderw=14:x=48:y=h-th-56:alpha='min(1,min((t-${ta})/0.3,(${tb}-t)/0.3))':enable='between(t,${ta},${tb})'[${nxt}]`); cur = nxt;
});
if (T.dim) { const [a, b] = T.dim; filt.push(`[${cur}]fade=t=out:st=${a / fps}:d=${(b - a) / fps}:color=0x14181f[dim]`); cur = 'dim'; }
const m = T.music, secs = total / fps;
run(['-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`, '-ss', String(m.start), '-t', String(secs), '-i', m.file,
  ...(filt.length ? ['-filter_complex', filt.join(';'), '-map', `[${cur}]`] : ['-map', '0:v']), '-map', '1:a', '-af', `afade=t=out:st=${secs - m.fadeOut}:d=${m.fadeOut}`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-vsync', 'cfr', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
console.log(`frames ${total} (${secs.toFixed(2)} s), segment starts (s): ${segStart.map((s) => (s / fps).toFixed(2)).join(' ')}`);
rmSync(tmp, { recursive: true, force: true });
