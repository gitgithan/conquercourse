// Scene 4 build: frames -> mp4 with the five overlay texts burned in at the bottom (no chip in this scene).
// usage: node scene4-build.mjs <framesDir> <out.mp4>      (framesDir holds frames/ and marks.json from scene4.mjs)
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [dir, outMp4] = process.argv.slice(2);
const M = JSON.parse(readFileSync(`${dir}/marks.json`, 'utf8')), m = M.marks, end = M.seconds;
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const caps = [
  ['Run your course', 0, m.pole - 0.1],
  ['Choose your path (High or Low)', m.pole, m.cleared],
  ['Share your achievements', m.report, m.rowShown + 1.0],
  ['Challenge your friend, or take their challenge', m.rowShown + 1.0, m.copy + 1.0],
  ['Watch yourself or the simulator to do better', m.copy + 1.0, end],
];
const q = (t) => t.replace(/[:\\']/g, (c) => '\\' + c);
const vf = ['scale=1920:1080:flags=lanczos', ...caps.map(([t, a, b]) => `drawtext=fontfile=${FONT}:text='${q(t)}':fontsize=38:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-96:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'`), 'format=yuv420p'].join(',');
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(M.fps), '-i', `${dir}/frames/f%05d.jpg`, '-vf', vf, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-an', outMp4], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
console.log('built', outMp4, end.toFixed(1), 's');
