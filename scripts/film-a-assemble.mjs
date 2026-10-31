// Assembles film A from captured frame folders and a card picture, on the beat grid of the music.
// Usage: node scripts/film-a-assemble.mjs spec.json
// spec: { fps, width, height, audio, audioStart (seconds into the music where the film starts; a whole number of bars), audioSeconds, out, work, segments: [ { name, dir | card, len, from, dedupe, caption, fadeOut, fadeIn } ] }
//   dir     folder of f00000.jpg frames (a capture); from = first source frame (after dropping exact repeats when dedupe is true); len = frames kept
//   card    a still picture held for len frames (only the logo cards use this)
//   caption plain words drawn on the lower left for the whole segment; fadeOut/fadeIn = frames of a fade to or from black (the dim)
// Every segment is len frames long, so a segment of 72 frames is exactly 2.4 s: one bar at 100 bpm.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { fps = 30, width = 1280, height = 720, work } = spec;
rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');
const parts = [], report = [];
for (const [k, s] of spec.segments.entries()) {
  const sd = join(work, `s${k}`); mkdirSync(sd);
  let input;
  if (s.card) input = ['-loop', '1', '-framerate', String(fps), '-i', s.card, '-frames:v', String(s.len)];
  else {
    const files = readdirSync(s.dir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
    let keep = files, prev = '';
    if (s.dedupe) { keep = files.filter((f) => { const h = createHash('md5').update(readFileSync(join(s.dir, f))).digest('hex'); const ok = h !== prev; prev = h; return ok; }); }
    const sel = keep.slice(s.from ?? 0, (s.from ?? 0) + s.len);
    if (sel.length < s.len) { console.log(`WARNING ${s.name}: only ${sel.length} of ${s.len} frames (from ${s.from ?? 0}, ${keep.length} kept of ${files.length})`); }
    sel.forEach((f, i) => symlinkSync(join(process.cwd(), s.dir, f), join(sd, `f${String(i).padStart(5, '0')}.jpg`)));
    // pad by holding the last picture so the length (and the beat grid) is exact
    for (let i = sel.length; i < s.len; i++) symlinkSync(join(process.cwd(), s.dir, sel[sel.length - 1]), join(sd, `f${String(i).padStart(5, '0')}.jpg`));
    input = ['-framerate', String(fps), '-i', join(sd, 'f%05d.jpg')];
    report.push({ name: s.name, kept: keep.length, of: files.length, used: sel.length, wanted: s.len });
  }
  const vf = [`scale=${width}:${height}:force_original_aspect_ratio=decrease`, `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x14181f`, 'setsar=1'];
  if (s.caption) vf.push(`drawtext=fontfile=${FONT}:text='${esc(s.caption)}':fontcolor=white:fontsize=34:box=1:boxcolor=0x14181fcc:boxborderw=14:x=40:y=h-th-44`);
  if (s.fadeIn) vf.push(`fade=t=in:st=0:n=${s.fadeIn}`);
  if (s.fadeOut) vf.push(`fade=t=out:st=${(s.len - s.fadeOut) / fps}:d=${s.fadeOut / fps}`);
  vf.push('format=yuv420p');
  const mp4 = join(work, `seg${String(k).padStart(2, '0')}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...input, '-vf', vf.join(','), '-r', String(fps), '-frames:v', String(s.len), '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-g', '30', mp4], { stdio: 'inherit' });
  parts.push(mp4);
}
writeFileSync(join(work, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n') + '\n');
const total = spec.segments.reduce((a, s) => a + s.len, 0) / fps;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-ss', String(spec.audioStart ?? 0), '-i', spec.audio, '-t', String(total), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=out:st=${total - 2}:d=2`, '-movflags', '+faststart', spec.out], { stdio: 'inherit' });
writeFileSync(join(work, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('wrote', spec.out, total, 's'); console.log(JSON.stringify(report));
