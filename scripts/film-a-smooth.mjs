// Smoothness test for a film file or a frame folder (film A).
// Usage: node scripts/film-a-smooth.mjs <video.mp4 | frames-dir> [--fps 30] [--json out.json]
// It reads the mean luma change between neighbouring pictures (ffmpeg signalstats YDIF) and reports:
//   - the longest run of duplicate pictures (change below 0.02) and how many duplicates there are
//   - spikes: a change more than 4 times the middle of its 9 neighbours and above 3 (a jump, not a cut)
//   - cuts: changes above 25 (hard cuts between shots are expected on beats)
// A shot passes when the longest duplicate run is 1 or less (outside held cards) and there is no spike.
import { execFileSync } from 'node:child_process';
import { writeFileSync, statSync } from 'node:fs';

const src = process.argv[2], fps = Number(process.argv.includes('--fps') ? process.argv[process.argv.indexOf('--fps') + 1] : 30);
const input = statSync(src).isDirectory() ? ['-framerate', String(fps), '-i', `${src}/f%05d.jpg`] : ['-i', src];
const out = execFileSync('ffmpeg', ['-v', 'error', ...input, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const d = [...out.matchAll(/YDIF=([\d.]+)/g)].map((m) => Number(m[1])).slice(1);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
let dups = 0, run = 0, longest = 0, spikes = [], cuts = [];
d.forEach((v, i) => {
  if (v < 0.02) { dups++; run++; longest = Math.max(longest, run); } else run = 0;
  if (v > 25) cuts.push(i + 1);
  else { const m = med(d.slice(Math.max(0, i - 4), i + 5)); if (v > 3 && v > 4 * Math.max(m, 0.3)) spikes.push({ frame: i + 1, ydif: v, around: m }); }
});
const r = { src, frames: d.length + 1, fps, seconds: +((d.length + 1) / fps).toFixed(2), duplicates: dups, longestDuplicateRun: longest, spikes: spikes.length, spikeList: spikes.slice(0, 12), cuts: cuts.length, cutFrames: cuts.slice(0, 40), medianChange: +med(d).toFixed(3), maxChange: +Math.max(...d).toFixed(2), pass: longest <= 1 && spikes.length === 0 };
console.log(JSON.stringify(r));
const j = process.argv.indexOf('--json'); if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify(r, null, 2) + '\n');
