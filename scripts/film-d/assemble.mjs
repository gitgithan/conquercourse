// Film assembly (CC-143): storyboard + per-shot clips -> one 1920x1080, 30 fps film on the 100 bpm grid.
// Usage: node scripts/film-d/assemble.mjs [--dir ../conquercourse-assets/film] [--out conquercourse_v0.2.mp4] [--offset 5=0.4]
// Missing clips become a labelled placeholder card, so the pipeline always runs end to end.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const dir = resolve(root, opt('dir', '../conquercourse-assets/film'));
const outName = opt('out', 'conquercourse_v0.2.mp4');
const offsets = {};
args.forEach((a, i) => {
  if (a === '--offset') {
    const [n, s] = args[i + 1].split('=');
    offsets[n] = Number(s);
  }
});

const W = 1920, H = 1080, FPS = 30;
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const board = JSON.parse(readFileSync(join(root, 'docs/film-storyboard.json'), 'utf8'));
const work = join(dir, '.work');
mkdirSync(work, { recursive: true });

function ff(argv) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...argv], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + argv.join(' ').slice(0, 300));
}

// Highest version of this shot's clip: <key>_v2.mp4 or shot<id>_v2.mp4 (the next character must not be a digit).
function findClip(shot) {
  const re = new RegExp(`^(?:shot${shot.id}|${shot.key})(?!\\d)[^]*?v(\\d+)\\.mp4$`);
  let best = null;
  for (const f of readdirSync(dir)) {
    const m = re.exec(f);
    if (m && (!best || Number(m[1]) > best.v)) best = { v: Number(m[1]), file: join(dir, f) };
  }
  return best?.file ?? null;
}

let textN = 0;
function textFile(text) {
  const p = join(work, `t${textN++}.txt`);
  writeFileSync(p, text);
  return p;
}
// A drawtext filter that shows `text` between a and b seconds; y is the centre line.
function caption(text, a, b, { size = 64, y = 'h-110', box = true, color = 'white' } = {}) {
  return (
    `drawtext=fontfile=${FONT}:textfile=${textFile(text)}:fontsize=${size}:fontcolor=${color}` +
    `:x=(w-text_w)/2:y=${y}-text_h/2` +
    (box ? ':box=1:boxcolor=black@0.6:boxborderw=18' : '') +
    `:enable='between(t,${a},${b})'`
  );
}

const segs = [];
const report = [];
for (const shot of board.shots) {
  const slot = shot.seconds;
  const clip = findClip(shot);
  const seg = join(work, `seg${String(shot.id).padStart(2, '0')}.mp4`);
  let vf = [];
  let input;
  if (clip) {
    const off = offsets[shot.id] ?? 0;
    input = ['-ss', String(off), '-i', clip];
    vf.push(
      `fps=${FPS}`,
      `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`,
      `tpad=stop_mode=clone:stop_duration=${slot}`,
      `trim=duration=${slot}`,
      'setpts=PTS-STARTPTS',
    );
  } else {
    input = ['-f', 'lavfi', '-i', `color=c=0x1e2428:s=${W}x${H}:r=${FPS}:d=${slot}`];
    vf.push(
      caption(`shot ${shot.id}: not recorded yet`, 0, slot, { size: 84, y: 'h/2-20', box: false, color: 'white' }),
      caption(shot.title, 0, slot, { size: 44, y: 'h/2+70', box: false, color: '0xaab4bc' }),
    );
  }
  // Overlay words: split the slot evenly (shot 5 gives each of its three overlays one bar).
  const n = shot.overlay.length;
  const isEnd = shot.id === board.shots.length;
  if (!isEnd) {
    shot.overlay.forEach((t, i) => vf.push(caption(t, +(slot * i / n + 0.15).toFixed(3), +(slot * (i + 1) / n - 0.05).toFixed(3))));
  }
  // Shot 1 carries the logo and slogan in the clip itself; the app adds the OSM credit there.
  if (shot.key === 'matrix') {
    // Cut to black over silence: the last 1.2 s of this slot.
    vf.push(`drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='gte(t,${(slot - 1.2).toFixed(3)})'`);
  }
  if (isEnd) {
    // Dim into the end card over the last bar, then slogan, Play Now, link and credits.
    const d = +(slot - 2.4).toFixed(3);
    vf.push(`drawbox=x=0:y=0:w=iw:h=ih:color=0x10141a:t=fill:enable='gte(t,${d})'`);
    vf.push(caption('ConquerCourse', d, slot, { size: 110, y: '250', box: false }));
    vf.push(caption('Train slow. Run fast.', d + 0.2, slot, { size: 72, y: '400', box: false, color: '0xffd15c' }));
    vf.push(caption(shot.overlay[0], d + 0.4, slot, { size: 96, y: '600', box: false }));
    vf.push(caption(shot.overlay[1], d + 0.4, slot, { size: 60, y: '730', box: false, color: '0x8fd3ff' }));
    vf.push(caption('Map data: OpenStreetMap contributors. Railing: CC0.', d + 0.4, slot, { size: 32, y: '960', box: false, color: '0xaab4bc' }));
  }
  ff([
    ...input,
    '-vf', vf.join(','),
    '-t', String(slot),
    '-an', '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p',
    seg,
  ]);
  segs.push(seg);
  report.push(`shot ${shot.id} ${shot.key}: ${clip ? clip.split('/').pop() : 'PLACEHOLDER'}`);
}

const list = join(work, 'list.txt');
writeFileSync(list, segs.map((s) => `file '${s}'\n`).join(''));
const total = board.total_seconds;
const silent = join(work, 'silent.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

// Click track at 100 bpm (accent on each bar) so the grid can be checked by ear against any music.
const beat = 60 / board.bpm;
const click = join(dir, 'click_100bpm.wav');
ff([
  '-f', 'lavfi',
  '-i', `aevalsrc='sin(2*PI*(1000+500*lt(mod(t,${board.bar_seconds}),${beat}))*t)*exp(-40*mod(t,${beat}))*0.5':s=44100:d=${total}`,
  click,
]);

const music = join(dir, 'music.wav');
const out = join(dir, outName);
if (existsSync(music)) {
  // Real silence for the last 1.2 s of shot 6 (the cut to black).
  const m6 = board.shots.find((s) => s.key === 'matrix');
  const a = (m6.start + m6.seconds - 1.2).toFixed(3), b = (m6.start + m6.seconds).toFixed(3);
  ff(['-i', silent, '-i', music, '-map', '0:v', '-map', '1:a', '-af', `atrim=0:${total},volume=0:enable='between(t,${a},${b})',afade=t=out:st=${total - 1.5}:d=1.5`,
    '-t', String(total), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', out]);
  report.push('music: music.wav mixed');
} else {
  ff(['-i', silent, '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`, '-map', '0:v', '-map', '1:a',
    '-t', String(total), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', out]);
  report.push('music: none (silent film; click track in click_100bpm.wav)');
}
console.log(report.join('\n'));
console.log('wrote', out);
