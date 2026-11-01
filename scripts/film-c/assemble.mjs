// Join the captured shots on the beat grid (30 fps; slow half 18 frames a beat, fast half 12.75 frames a beat, 51 a bar), add the music bed, run the smoothness test.
// Usage: node scripts/film-c/assemble.mjs <clips dir> <bed.m4a> <out.mp4>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { smoothness } from './smooth.mjs';
const [dir, bed, out] = process.argv.slice(2);
const F = 51;
const plan = [
  ['dojo', 108], ['lab', 72], ['slicer', 144, { from: 41 }], ['editor', 144], ['hero_fly', 144], ['hero_run', 108], ['hero_leap', 72, { dimLast: 18 }], ['card', 72],
  ['hero_catch', F], ['f_wall', F], ['f_vault', F], ['f_hang', F], ['f_swing', F], ['f_eyes', 2 * F], ['f_bounce', F], ['f_plank', F], ['f_balls', F],
  ['f_recoil', F], ['f_band', F], ['f_launch', F], ['f_drone', F], ['f_coaster', F], ['f_climb', F], ['f_ghost', F], ['community', 2 * F], ['lineup', 2 * F], ['card', 3 * F],
];
const inputs = [], parts = [], cuts = []; let at = 0;
plan.forEach(([name, n, o], i) => {
  inputs.push('-i', `${dir}/${name}.mp4`);
  let f = `[${i}:v]trim=start_frame=${o?.from ?? 0}:end_frame=${(o?.from ?? 0) + n},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2,trim=end_frame=${n},setpts=PTS-STARTPTS`;
  if (o?.dimLast) f += `,fade=t=out:st=${(n - o.dimLast) / 30}:d=${o.dimLast / 30}:color=0x0b0f0d`;
  parts.push(`${f},fps=30,format=yuv420p[v${i}]`);
  at += n; cuts.push(at / 30);
});
const total = at;
const filter = parts.join(';') + ';' + plan.map((_, i) => `[v${i}]`).join('') + `concat=n=${plan.length}:v=1:a=0[v]`;
writeFileSync('/tmp/film-c-filter.txt', filter);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-i', bed, '-filter_complex_script', '/tmp/film-c-filter.txt', '-map', '[v]', '-map', `${plan.length}:a`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-r', '30', '-vsync', 'cfr', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(`frames ${total}, ${(total / 30).toFixed(2)} s`);
const st = smoothness(out, 30, { cuts: cuts.slice(0, -1) });
writeFileSync(out.replace(/\.mp4$/, '.stats.json'), JSON.stringify({ ...st, cuts }, null, 2) + '\n');
console.log(JSON.stringify(st));
