// Automatic smoothness test for film B: run it on every shot and on the final cut.
// Usage: node scripts/film-b-smooth.mjs <video.mp4> [log.json]   (prints one JSON line; exit 1 when a rule fails)
// Rules (the product owner asked for smooth video):
//  - constant frame rate: every packet is one frame period apart (ffprobe), no dropped or doubled frames;
//  - no duplicate-frame runs: no two neighbouring pictures are identical (mean difference above a tiny floor);
//  - no frame-time spikes: the picture change per frame never jumps above spikeK times the median of its neighbours (a lag-then-jump would show as a spike); cuts are skipped with --cuts t1,t2 (seconds);
//  - subject continuity (needs the capture log): the runner's x between frames never jumps more than jumpK times the median step.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [, , video, logPath, ...rest] = process.argv;
const cutsArg = [logPath, ...rest].find((a) => a?.startsWith('--cuts='));
const stArg = [logPath, ...rest].find((a) => a?.startsWith('--static='));
const statics = stArg ? stArg.slice(9).split(',').map((r) => r.split('-').map(Number)) : []; // [from, to] seconds that are meant to hold still (final photo, logo card)
const cuts = cutsArg ? cutsArg.slice(7).split(',').map(Number) : [];
const W = 160, H = 90, spikeK = 4, jumpK = 4, floor = 0.02;
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,avg_frame_rate,nb_frames', '-show_entries', 'packet=pts_time', '-of', 'json', video], { maxBuffer: 1 << 28 }).toString());
const pts = probe.packets.map((p) => Number(p.pts_time)).sort((a, b) => a - b);
const fps = (() => { const [a, b] = probe.streams[0].avg_frame_rate.split('/').map(Number); return a / b; })();
const dts = pts.slice(1).map((v, i) => v - pts[i]);
const cfrBad = dts.filter((d) => Math.abs(d - 1 / fps) > 0.002).length;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `scale=${W}:${H}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
const n = raw.length / (W * H), diffs = [];
for (let i = 1; i < n; i++) { let s = 0; const a = (i - 1) * W * H, b = i * W * H; for (let k = 0; k < W * H; k++) s += Math.abs(raw[a + k] - raw[b + k]); diffs.push(s / (W * H)); }
const inStatic = (i) => statics.some(([a, b]) => (i + 1) / fps >= a && (i + 1) / fps <= b);
const isCut = (i) => inStatic(i) || cuts.some((t) => Math.abs((i + 1) / fps - t) < 1.5 / fps);
const dups = diffs.filter((d, i) => d < floor && !isCut(i)).length;
let dupRuns = 0, run = 0; for (const d of diffs) { if (d < floor) { run++; if (run === 2) dupRuns++; } else run = 0; }
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
let spikes = 0, maxRatio = 0;
for (let i = 0; i < diffs.length; i++) {
  if (isCut(i)) continue;
  const nb = diffs.slice(Math.max(0, i - 4), i + 5).filter((_, j, arr) => j !== Math.min(4, i)); const m = med(nb) + 0.05;
  const r = diffs[i] / m; if (r > maxRatio) maxRatio = r; if (r > spikeK) { spikes++; if (process.env.SMOOTH_DEBUG) console.error('spike at', ((i + 1) / fps).toFixed(2), r.toFixed(1)); }
}
let subject = null;
if (logPath && !logPath.startsWith('--')) {
  const log = JSON.parse(readFileSync(logPath, 'utf8')).log, dx = log.slice(1).map((l, i) => Math.hypot(l.x - log[i].x, (l.y ?? 0) - (log[i].y ?? 0)));
  const m = med(dx) + 0.02; subject = { maxStep: +Math.max(...dx).toFixed(3), medianStep: +med(dx).toFixed(3), jumps: dx.filter((d) => d > jumpK * m).length };
}
const out = { video, fps: +fps.toFixed(3), frames: n, cfrBad, duplicateFrames: dups, duplicateRuns: dupRuns, spikes, maxSpikeRatio: +maxRatio.toFixed(2), subject };
console.log(JSON.stringify(out));
process.exit(cfrBad || dups || spikes || (subject && subject.jumps) ? 1 : 0);
