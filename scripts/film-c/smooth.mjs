// The automatic smoothness test for a film clip (version C).
// It decodes the clip to 160 x 90 grey, measures how much the picture changes from each frame to the next, and reports:
//  - dupRuns: frames that are exact repeats of the one before (a stutter) in a clip that should be moving;
//  - spikes: a frame-to-frame change much bigger than the ones around it (a jump or a flash that is not a planned cut);
//  - trackJumps: the biggest change in the per-frame speed of a tracked point (camera or runner), a jump in motion.
import { spawnSync } from 'node:child_process';

export function frameDiffs(file, w = 160, h = 90) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  const buf = r.stdout, n = Math.floor(buf.length / (w * h)), d = [];
  for (let i = 1; i < n; i++) {
    let s = 0; const a = (i - 1) * w * h, b = i * w * h;
    for (let k = 0; k < w * h; k++) s += Math.abs(buf[a + k] - buf[b + k]);
    d.push(s / (w * h));
  }
  return { frames: n, d };
}

export function smoothness(file, fps, { moving = true, track = [], cuts = [] } = {}) {
  const { frames, d } = frameDiffs(file);
  const sorted = [...d].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const cutIdx = new Set(cuts.map((c) => Math.round(c * fps)));
  let dupRuns = 0, dupFrames = 0, spikes = [];
  for (let i = 0; i < d.length; i++) {
    if (d[i] < 0.02) { dupFrames++; if (i === 0 || d[i - 1] >= 0.02) dupRuns++; }
    const lo = Math.max(0, i - 4), hi = Math.min(d.length, i + 5); const nb = d.slice(lo, hi).filter((_, j) => lo + j !== i);
    const m = nb.reduce((a, b) => a + b, 0) / Math.max(1, nb.length);
    if (!cutIdx.has(i + 1) && d[i] > 4 * m + 3) spikes.push({ frame: i + 1, diff: +d[i].toFixed(2), around: +m.toFixed(2) });
  }
  // a tracked point (record e.g. {x, y} of the camera or the runner each frame): the biggest change of its per-frame step
  let trackJumps = null;
  if (track.length > 3 && track[0] && typeof track[0] === 'object') {
    const keys = Object.keys(track[0]).filter((k) => typeof track[0][k] === 'number');
    trackJumps = {};
    for (const k of keys) {
      const v = track.map((p) => p[k]); let worst = 0, at = 0;
      for (let i = 2; i < v.length; i++) { const a = (v[i] - v[i - 1]) - (v[i - 1] - v[i - 2]); if (Math.abs(a) > worst) { worst = Math.abs(a); at = i; } }
      trackJumps[k] = { maxAccelPerFrame: +worst.toFixed(4), atFrame: at };
    }
  }
  return { frames, fps, medianDiff: +med.toFixed(3), maxDiff: +Math.max(...d, 0).toFixed(2), dupFrames: moving ? dupFrames : undefined, dupRuns: moving ? dupRuns : undefined, spikes: spikes.slice(0, 8), spikeCount: spikes.length, trackJumps };
}

if (process.argv[1]?.endsWith('smooth.mjs')) {
  const f = process.argv[2], fps = Number(process.argv[3] ?? 30);
  console.log(JSON.stringify(smoothness(f, fps), null, 2));
}
