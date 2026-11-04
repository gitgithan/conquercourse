// Clip files (see pipelines/ccpipe/clip.py): joints in metres, y up, run along +z, left on +x.
export interface Clip {
  names: string[];
  parents: number[];
  fps: number;
  frames: number[][][]; // [frame][joint][x, y, z]
  takeoff?: number; // frame index
  landing?: number; // frame index
}

export type Phase = 'run' | 'leap' | 'land' | 'hang' | 'swing';

export const PHASE_FILES: Record<Phase, string> = {
  run: 'run',
  leap: 'leap',
  land: 'land',
  hang: 'hang',
  swing: 'swing',
};

// Phases that repeat; the others hold their last pose.
export const LOOPS: Record<Phase, boolean> = { run: true, leap: false, land: false, hang: true, swing: true };

export function parseClip(raw: unknown): Clip {
  const c = raw as Clip;
  if (!Array.isArray(c.names) || !Array.isArray(c.parents) || !Array.isArray(c.frames) || !(c.fps > 0)) {
    throw new Error('clip needs names, parents, fps and frames');
  }
  if (c.names.length !== c.parents.length) throw new Error(`names (${c.names.length}) and parents (${c.parents.length}) differ in length`);
  c.frames.forEach((f, i) => {
    if (f.length !== c.names.length) throw new Error(`frame ${i} has ${f.length} joints, names has ${c.names.length}`);
  });
  c.parents.forEach((p, i) => {
    if (p >= i) throw new Error(`joint ${i} must come after its parent ${p}`);
  });
  return c;
}

const clips = new Map<string, Promise<Clip>>();
export function loadClipUrl(url: string): Promise<Clip> {
  let pending = clips.get(url);
  if (!pending) {
    pending = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`clip: HTTP ${res.status}`);
      return parseClip(await res.json());
    });
    clips.set(url, pending);
    pending.catch(() => { if (clips.get(url) === pending) clips.delete(url); });
  }
  return pending;
}
export function loadClip(phase: Phase, base = '/assets/motion'): Promise<Clip> {
  return loadClipUrl(`${base}/${PHASE_FILES[phase]}.json`);
}

export const clipDuration = (c: Clip): number => (c.frames.length - 1) / c.fps;

// Joint positions at `seconds` of clip time: linear between frames, wrapped (loop) or held at the ends.
export function sampleClip(c: Clip, seconds: number, loop: boolean): number[][] {
  const n = c.frames.length;
  const pose = at(c, seconds, loop);
  if (!loop) return pose;
  // the clips are not exact cycles: over the last frames, ease the pose to the first frame so the loop has no pop
  const f = (((seconds * c.fps) % (n - 1)) + (n - 1)) % (n - 1);
  const w = (f - (n - 1 - LOOP_EASE_FRAMES)) / LOOP_EASE_FRAMES;
  if (w <= 0) return pose;
  const first = c.frames[0];
  return pose.map((p, j) => p.map((v, k) => v + (first[j][k] - v) * w));
}

const LOOP_EASE_FRAMES = 6;

function at(c: Clip, seconds: number, loop: boolean): number[][] {
  const n = c.frames.length;
  let f = seconds * c.fps;
  if (loop) f = ((f % (n - 1)) + (n - 1)) % (n - 1);
  else f = Math.min(Math.max(f, 0), n - 1);
  const i = Math.min(Math.floor(f), n - 2);
  const w = f - i;
  const a = c.frames[i];
  const b = c.frames[i + 1];
  return a.map((p, j) => [p[0] + (b[j][0] - p[0]) * w, p[1] + (b[j][1] - p[1]) * w, p[2] + (b[j][2] - p[2]) * w]);
}

// Time-warp: clip seconds for `elapsed` real seconds when the clip plays at `rate` x its own speed.
export const warp = (elapsed: number, rate: number): number => elapsed * rate;

// Metres the hips travel forward per loop (a running clip's own speed is this over its duration).
export function loopDistance(c: Clip): number {
  const last = c.frames.length - 1;
  return c.frames[last][0][2] - c.frames[0][0][2];
}

// Clip time at which the hips have run `distance` metres along a looping run (feet stay planted when the path moves with them).
export function secondsForDistance(c: Clip, distance: number): number {
  const loop = loopDistance(c);
  const laps = Math.floor(distance / loop);
  const d = distance - laps * loop + c.frames[0][0][2];
  let i = 0;
  while (i < c.frames.length - 2 && c.frames[i + 1][0][2] < d) i++;
  const a = c.frames[i][0][2];
  const b = c.frames[i + 1][0][2];
  const w = b > a ? Math.min(Math.max((d - a) / (b - a), 0), 1) : 0;
  return (laps * (c.frames.length - 1) + i + w) / c.fps;
}
