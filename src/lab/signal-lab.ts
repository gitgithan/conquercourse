// Signal processing: the filters, the noise stand-in and the plausibility gate, in TypeScript.
// The gate is a port of pipelines/ccpipe/gate.py and motion.py (same rules, same limits); tests/lab-signal.test.ts checks it
// against numbers the Python gate printed (tests/fixtures/lab-signal-reference.json, made by scripts/lab_signal_reference.py).
// Joints are metres, y up, run along +z, left on +x (the clip format). Frames are [frame][joint][x, y, z].

export type Frames = number[][][];
export interface SignalClip { names: string[]; parents: number[]; fps: number; frames: Frames; supportedBy?: string }

export type FilterKind = "average" | "triangle" | "savgol" | "exponential";
export const FILTERS: { kind: FilterKind; label: string; about: string }[] = [
  { kind: "average", label: "Window average", about: "Each frame becomes the plain average of its neighbours on both sides. It looks ahead as well as back, so nothing lags, but a sharp peak is rounded off." },
  { kind: "triangle", label: "Triangle window", about: "Like the window average, but near neighbours count more. The game's own smoothing is the width-2 triangle (1-2-3-2-1)." },
  { kind: "savgol", label: "Curve fit (Savitzky-Golay)", about: "Fits a small curve through the neighbours and keeps its middle. It keeps peaks and the arc of a jump better than an average does." },
  { kind: "exponential", label: "Live smoothing (one-pole)", about: "Each frame moves part of the way from the last smoothed frame to the new one. It only looks back, so it works live, and it always lags." },
];
export const MAX_STRENGTH = 8;

// ---------- the noise stand-in for raw video measurement ----------
// A shipped clip is already clean. To see jitter we add small seeded noise to every joint of every frame, so the truth is known.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const NOISE_SEED = 20261031;
/** Gaussian noise of standard deviation `sigmaCm` (centimetres), the same on all three axes, drawn in a fixed order (Box-Muller). */
export function addNoise(frames: Frames, sigmaCm: number, seed = NOISE_SEED): Frames {
  const rnd = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rnd(), 1e-12), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const s = sigmaCm / 100;
  return frames.map((f) => f.map((p) => [p[0] + s * gauss(), p[1] + s * gauss(), p[2] + s * gauss()]));
}

// ---------- the filters ----------
/** The weights of a window filter of half-width h (strength), centred; they sum to 1. Strength 0 is "do nothing". */
export function kernel(kind: FilterKind, h: number): number[] {
  if (h <= 0) return [1];
  let w: number[];
  if (kind === "average") w = Array.from({ length: 2 * h + 1 }, () => 1);
  else if (kind === "triangle") w = Array.from({ length: 2 * h + 1 }, (_, i) => h + 1 - Math.abs(i - h));
  else if (kind === "savgol") {
    // quadratic fit over 2h+1 points: c_k = 3(3h^2 + 3h - 1 - 5k^2) / ((2h-1)(2h+1)(2h+3))
    const den = (2 * h - 1) * (2 * h + 1) * (2 * h + 3);
    w = Array.from({ length: 2 * h + 1 }, (_, i) => { const k = i - h; return (3 * (3 * h * h + 3 * h - 1 - 5 * k * k)) / den; });
    return w;
  } else throw new Error("exponential has no window kernel");
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
}
/** The one-pole weight for a strength: y = y + a (x - y). Strength 0 is a = 1 (no smoothing). */
export const expAlpha = (strength: number): number => 1 / (1 + Math.max(0, strength));

/** Filter one series; the ends are padded by repeating the first and last value (as the game does). */
export function filterSeries(x: number[], kind: FilterKind, strength: number): number[] {
  const n = x.length;
  if (strength <= 0 || n < 2) return x.slice();
  if (kind === "exponential") {
    const a = expAlpha(strength);
    const y = new Array<number>(n);
    y[0] = x[0];
    for (let i = 1; i < n; i++) y[i] = y[i - 1] + a * (x[i] - y[i - 1]);
    return y;
  }
  const k = kernel(kind, strength);
  const h = (k.length - 1) / 2;
  return x.map((_, i) => {
    let s = 0;
    for (let j = -h; j <= h; j++) s += k[j + h] * x[Math.min(n - 1, Math.max(0, i + j))];
    return s;
  });
}
export function filterFrames(frames: Frames, kind: FilterKind, strength: number): Frames {
  const T = frames.length, J = frames[0].length;
  const out: Frames = frames.map((f) => f.map((p) => p.slice()));
  if (strength <= 0) return out;
  for (let j = 0; j < J; j++) for (let a = 0; a < 3; a++) {
    const y = filterSeries(frames.map((f) => f[j][a]), kind, strength);
    for (let t = 0; t < T; t++) out[t][j][a] = y[t];
  }
  return out;
}

/** What the game does after smoothing: every bone gets its median length, keeping each frame's bone directions (post.py fixed_skeleton). */
export function fixedSkeleton(frames: Frames, parents: number[]): Frames {
  const out: Frames = frames.map((f) => f.map((p) => p.slice()));
  const med = parents.map((p, i) => (p < 0 ? 0 : median(frames.map((f) => norm(sub(f[i], f[p]))))));
  for (let i = 0; i < parents.length; i++) {
    const p = parents[i];
    if (p < 0) continue;
    for (let t = 0; t < frames.length; t++) {
      const d = sub(frames[t][i], frames[t][p]);
      const n = norm(d) + 1e-9;
      out[t][i] = [0, 1, 2].map((a) => out[t][p][a] + (d[a] / n) * med[i]);
    }
  }
  return out;
}
/** The game's own smoothing, step for step: 1-2-3-2-1 triangle, then bones back to one length each. */
export const gameSmoothing = (c: SignalClip): Frames => fixedSkeleton(filterFrames(c.frames, "triangle", 2), c.parents);

/** How much of white noise's size gets through (its standard deviation out over in): sqrt(sum of squared weights). */
export function noiseGain(kind: FilterKind, strength: number): number {
  if (strength <= 0) return 1;
  if (kind === "exponential") { const a = expAlpha(strength); return Math.sqrt(a / (2 - a)); }
  return Math.sqrt(kernel(kind, strength).reduce((acc, w) => acc + w * w, 0));
}
/** The cut-off in Hz: where the filter lets through only 70.7 % of a wiggle's size (-3 dB). Null if it never drops that far. */
export function gainAt(kind: FilterKind, strength: number, omega: number): number {
  if (strength <= 0) return 1;
  if (kind === "exponential") {
    const a = expAlpha(strength), b = 1 - a;
    return Math.sqrt((a * a) / (1 - 2 * b * Math.cos(omega) + b * b));
  }
  const k = kernel(kind, strength), h = (k.length - 1) / 2;
  let re = 0;
  for (let i = 0; i < k.length; i++) re += k[i] * Math.cos((i - h) * omega);
  return Math.abs(re);
}
export function cutoffHz(kind: FilterKind, strength: number, fps: number): number | null {
  if (strength <= 0) return null;
  const target = Math.SQRT1_2;
  let prev = 0;
  for (let i = 1; i <= 2000; i++) {
    const om = (Math.PI * i) / 2000;
    if (gainAt(kind, strength, om) < target) { const f = (prev + om) / 2; return (f * fps) / (2 * Math.PI); }
    prev = om;
  }
  return null;
}

// ---------- small maths ----------
const sub = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: number[]): number => Math.hypot(a[0], a[1], a[2]);
const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: number[]): number[] => { const n = Math.max(norm(a), 1e-9); return [a[0] / n, a[1] / n, a[2] / n]; };
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
function median(v: number[]): number {
  const s = v.slice().sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
export const rms = (v: number[]): number => Math.sqrt(v.reduce((a, b) => a + b * b, 0) / Math.max(1, v.length));

// ---------- the plausibility gate (port of pipelines/ccpipe/gate.py and motion.py) ----------
const G = 9.81;
const GATE = { kneeJudgedAbove: 15, kneeBackwards: 120, kneeTwisted: 60, kneeMaxBend: 165, gravityTol: 0.15, feetSink: 0.03, maxHipSpeed: 12, boneTol: 0.02, footSlide: 0.03, maxAccel: 200, maxUnheld: 1.0, minFlight: 6 };
export const GATE_LIMITS = GATE;
const NAMES = ["Hips", "Spine1", "Spine2", "Chest", "Neck1", "Neck2", "Head", "Jaw", "LeftEye", "RightEye", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandThumbEnd", "LeftHandMiddleEnd", "RightShoulder", "RightArm", "RightForeArm", "RightHand", "RightHandThumbEnd", "RightHandMiddleEnd", "LeftLeg", "LeftShin", "LeftFoot", "LeftToeBase", "RightLeg", "RightShin", "RightFoot", "RightToeBase"];
const IDX: Record<string, number> = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const FEET = [IDX.LeftFoot, IDX.LeftToeBase, IDX.RightFoot, IDX.RightToeBase];
const HANDS = [IDX.LeftHand, IDX.RightHand];

// Winter's segment masses: [proximal, distal, mass, centre fraction]
const SEGMENTS: [string, string, number, number][] = [["Neck1", "Head", 0.081, 1.0], ["Hips", "Neck1", 0.497, 0.5]];
for (const s of ["Left", "Right"]) SEGMENTS.push([`${s}Arm`, `${s}ForeArm`, 0.028, 0.436], [`${s}ForeArm`, `${s}Hand`, 0.016, 0.43], [`${s}Hand`, `${s}HandMiddleEnd`, 0.006, 0.506], [`${s}Leg`, `${s}Shin`, 0.1, 0.433], [`${s}Shin`, `${s}Foot`, 0.0465, 0.433], [`${s}Foot`, `${s}ToeBase`, 0.0145, 0.5]);

function comY(f: Frames): number[] {
  return f.map((fr) => SEGMENTS.reduce((acc, [a, b, m, c]) => acc + m * (fr[IDX[a]][1] + c * (fr[IDX[b]][1] - fr[IDX[a]][1])), 0));
}
function kneeAngles(f: Frames, side: string): { bend: number[]; ang: number[] } {
  const bend: number[] = [], ang: number[] = [];
  for (const fr of f) {
    const hip = fr[IDX[`${side}Leg`]], kn = fr[IDX[`${side}Shin`]], an = fr[IDX[`${side}Foot`]];
    const thigh = sub(kn, hip), shin = sub(an, kn);
    bend.push((Math.acos(clamp(dot(unit(thigh), unit(shin)), -1, 1)) * 180) / Math.PI);
    const axis = unit(cross(thigh, shin)), side_ = unit(sub(fr[IDX.LeftLeg], fr[IDX.RightLeg]));
    ang.push((Math.acos(clamp(dot(axis, side_), -1, 1)) * 180) / Math.PI);
  }
  return { bend, ang };
}
/** Per-frame speed of every joint (m/s): central differences, one-sided at the ends (numpy gradient). */
export function jointSpeeds(f: Frames, fps: number): number[][] {
  const T = f.length;
  return f.map((_, t) => f[t].map((_, j) => {
    const a = t === 0 ? 0 : t - 1, b = t === T - 1 ? T - 1 : t + 1;
    const d = (b - a) === 2 ? 2 : 1;
    return (Math.hypot(f[b][j][0] - f[a][j][0], f[b][j][1] - f[a][j][1], f[b][j][2] - f[a][j][2]) / d) * fps;
  }));
}
function runs(mask: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  mask.forEach((m, i) => { if (m && start < 0) start = i; if (!m && start >= 0) { out.push([start, i]); start = -1; } });
  if (start >= 0) out.push([start, mask.length]);
  return out;
}
function still(sp: number[][], joint: number, thresh: number, minFrames: number): boolean[] {
  const m = new Array<boolean>(sp.length).fill(false);
  for (const [a, b] of runs(sp.map((r) => r[joint] < thresh))) if (b - a >= minFrames) for (let i = a; i < b; i++) m[i] = true;
  return m;
}
function supported(f: Frames, fps: number): boolean[] {
  const sp = jointSpeeds(f, fps);
  const m = f.map((fr) => Math.min(...fr.map((p) => p[1])) <= 0.15);
  const or = (x: boolean[]) => x.forEach((v, i) => { if (v) m[i] = true; });
  for (const j of FEET) or(still(sp, j, 0.3, 4));
  for (const j of HANDS) {
    or(still(sp, j, 0.3, 4));
    const high = f.map((fr) => fr[j][1] > fr[IDX.Head][1]);
    for (const [a, b] of runs(f.map((_, t) => sp[t][j] < 1.0 && high[t]))) if (b - a >= 4) for (let i = a; i < b; i++) m[i] = true;
  }
  return m;
}
/** Quadratic least-squares through (t, y): the t^2 coefficient (numpy polyfit(t, y, 2)[0]). */
function quadCoef(t: number[], y: number[]): number {
  const n = t.length, mt = t.reduce((a, b) => a + b, 0) / n;
  const u = t.map((v) => v - mt);
  const S = (p: number) => u.reduce((a, v) => a + v ** p, 0);
  const T = (p: number) => u.reduce((a, v, i) => a + v ** p * y[i], 0);
  // normal equations for y = c0 + c1 u + c2 u^2 (Cramer's rule)
  const m = [[n, S(1), S(2)], [S(1), S(2), S(3)], [S(2), S(3), S(4)]], r = [T(0), T(1), T(2)];
  const det3 = (a: number[][]) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const mc = m.map((row, i) => row.map((v, j) => (j === 2 ? r[i] : v)));
  return det3(mc) / det3(m);
}

export interface Rule { ok: boolean; value: number | null; limit: string }
export interface GateReport { pass: boolean; hard: Record<string, Rule>; soft: Record<string, Rule> }
const rule = (ok: boolean, value: number | null, limit: string): Rule => ({ ok, value: value === null ? null : Math.round(value * 1e4) / 1e4, limit });

export function runGate(c: { frames: Frames; fps: number; supportedBy?: string; gravity?: number }): GateReport {
  const f = c.frames, fps = c.fps;
  let worst = 0, bend = 0;
  for (const side of ["Left", "Right"]) {
    const k = kneeAngles(f, side);
    k.bend.forEach((b, i) => { if (b > GATE.kneeJudgedAbove) worst = Math.max(worst, k.ang[i]); bend = Math.max(bend, b); });
  }
  const hard: Record<string, Rule> = {
    knees_bend_forward: rule(worst < GATE.kneeBackwards, worst, `< ${GATE.kneeBackwards} deg off the side axis`),
    legs_not_twisted: rule(worst <= GATE.kneeTwisted, worst, `<= ${GATE.kneeTwisted} deg off the side axis`),
    knees_within_range: rule(bend <= GATE.kneeMaxBend, bend, `<= ${GATE.kneeMaxBend} deg`),
  };
  const sup = supported(f, fps);
  if (c.supportedBy) hard.flight_is_ballistic = rule(true, null, "not judged");
  else {
    const rs = runs(sup.map((s) => !s));
    const best = rs.reduce<[number, number] | null>((b, r) => (!b || r[1] - r[0] > b[1] - b[0] ? r : b), null);
    if (!best || best[1] - best[0] < GATE.minFlight) hard.flight_is_ballistic = rule(true, null, "no flight");
    else {
      const y = comY(f).slice(best[0], best[1]);
      const g = -2 * quadCoef(y.map((_, i) => i / fps), y), grav = c.gravity ?? G;
      hard.flight_is_ballistic = rule(Math.abs(g - grav) / grav <= GATE.gravityTol, g, `within ${GATE.gravityTol * 100}% of ${grav}`);
    }
  }
  if (c.supportedBy) {
    const longest = Math.max(0, ...runs(sup.map((s) => !s)).map(([a, b]) => (b - a) / fps));
    hard.held_clips_are_held = rule(longest <= GATE.maxUnheld, longest, `<= ${GATE.maxUnheld} s with nothing holding the body`);
  }
  const sink = -Math.min(...f.map((fr) => Math.min(...FEET.map((j) => fr[j][1]))));
  hard.feet_dont_sink = rule(sink <= GATE.feetSink, sink, `<= ${GATE.feetSink} m under the floor`);
  const sp = jointSpeeds(f, fps);
  const hip = Math.max(...sp.map((r) => r[IDX.Hips]));
  hard.no_teleport = rule(hip <= GATE.maxHipSpeed, hip, `<= ${GATE.maxHipSpeed} m/s`);

  // soft rules
  const bones = NAMES.map((_, i) => i).filter((i) => PARENTS[i] >= 0);
  let boneWorst = 0;
  for (const i of bones) {
    const len = f.map((fr) => norm(sub(fr[i], fr[PARENTS[i]]))), med = median(len);
    for (const l of len) boneWorst = Math.max(boneWorst, Math.abs(l / Math.max(med, 1e-9) - 1));
  }
  let slide = 0;
  for (const j of FEET) {
    const ys = f.map((fr) => fr[j][1]), floorish = Math.min(Math.min(...ys) + 0.05, 0.15);
    for (const [a, b] of runs(ys.map((y, t) => y < floorish && sp[t][j] < 1.0))) {
      if (b - a < 2) continue;
      for (let t = a; t < b; t++) slide = Math.max(slide, Math.hypot(f[t][j][0] - f[a][j][0], f[t][j][2] - f[a][j][2]));
    }
  }
  let acc = 0;
  for (let t = 0; t + 2 < f.length; t++) for (let j = 0; j < NAMES.length; j++) acc = Math.max(acc, Math.hypot(...[0, 1, 2].map((a) => f[t + 2][j][a] - 2 * f[t + 1][j][a] + f[t][j][a])) * fps * fps);
  const soft: Record<string, Rule> = {
    bones_keep_length: rule(boneWorst <= GATE.boneTol, boneWorst, `<= ${GATE.boneTol * 100}% off the median`),
    feet_dont_slide: rule(slide <= GATE.footSlide, slide, `<= ${GATE.footSlide} m`),
    no_jitter: rule(acc <= GATE.maxAccel, acc, `<= ${GATE.maxAccel} m/s^2`),
  };
  return { pass: Object.values(hard).every((r) => r.ok), hard, soft };
}
const PARENTS = [-1, 0, 1, 2, 3, 4, 5, 6, 6, 6, 3, 10, 11, 12, 13, 13, 3, 16, 17, 18, 19, 19, 0, 22, 23, 24, 0, 26, 27, 28];
export const failures = (r: GateReport): string[] => Object.entries(r.hard).filter(([, v]) => !v.ok).map(([k]) => k);

// ---------- the run: filter, then measure ----------
export interface LabChoice { clip: string; kind: FilterKind; strength: number; noiseCm: number; fixBones: boolean }
export const DEFAULT_CHOICE: LabChoice = { clip: "leap", kind: "triangle", strength: 2, noiseCm: 1.5, fixBones: false };
export const CLIPS: { id: string; label: string; file: string }[] = [
  { id: "run", label: "Run (motion capture)", file: "run" },
  { id: "leap", label: "Leap (motion capture)", file: "leap" },
  { id: "vault", label: "Vault (filmed, London Parkour)", file: "vault" },
];
export function clampChoice(c: LabChoice): LabChoice {
  return { clip: c.clip, kind: FILTERS.some((f) => f.kind === c.kind) ? c.kind : "triangle", strength: clamp(Math.round(c.strength), 0, MAX_STRENGTH), noiseCm: clamp(c.noiseCm, 0, 4), fixBones: !!c.fixBones };
}

export interface Result {
  choice: LabChoice;
  fps: number;
  noisy: Frames;
  filtered: Frames;
  clean: Frames;
  gateClean: GateReport;
  gateNoisy: GateReport;
  gateFiltered: GateReport;
  noiseLeftCm: number;   // wobble that gets through: filtered(noisy) against filtered(clean)
  noiseInCm: number;     // wobble that went in
  shapeLostCm: number;   // how far the filter alone moves the clean clip (squash and shift)
  lagMs: number;         // how late the filtered clean clip runs
  totalErrCm: number;    // filtered(noisy) against the truth
  cutoffHz: number | null;
  maxAccel: number;
  footSlideM: number;
}

function applyChoice(frames: Frames, c: SignalClip, ch: LabChoice): Frames {
  const f = filterFrames(frames, ch.kind, ch.strength);
  return ch.fixBones ? fixedSkeleton(f, c.parents) : f;
}
/** The frames the lab shows for a choice (used by the tests to line the filter up with the numpy one). */
export const applyForTest = (c: SignalClip, kind: FilterKind, strength: number, noiseCm: number, fixBones: boolean): Frames =>
  applyChoice(addNoise(c.frames, noiseCm), c, { clip: "", kind, strength, noiseCm, fixBones });
const diffs = (a: Frames, b: Frames): number[] => a.flatMap((fr, t) => fr.flatMap((p, j) => [p[0] - b[t][j][0], p[1] - b[t][j][1], p[2] - b[t][j][2]]));

/** Seconds the filtered clean clip runs late: the shift (in frames, tried in steps of 0.05) that makes it match the clean clip best. */
export function lagFrames(clean: Frames, filteredClean: Frames): number {
  const T = clean.length;
  const at = (t: number, j: number, a: number) => { const x = clamp(t, 0, T - 1), i = Math.min(Math.floor(x), T - 2), w = x - i; return clean[i][j][a] * (1 - w) + clean[i + 1][j][a] * w; };
  let best = 0, bestErr = Infinity;
  for (let i = 0; i <= 140; i++) {
    const d = Math.round((-1 + i * 0.05) * 100) / 100;
    let e = 0;
    for (let t = 3; t < T - 3; t++) for (let j = 0; j < clean[0].length; j += 3) for (let a = 0; a < 3; a++) e += (filteredClean[t][j][a] - at(t - d, j, a)) ** 2;
    if (e < bestErr - 1e-15) { bestErr = e; best = d; }
  }
  return best;
}

export function runSignalLab(clip: SignalClip, ch0: LabChoice): Result {
  const ch = clampChoice(ch0);
  const noisy = addNoise(clip.frames, ch.noiseCm);
  const filtered = applyChoice(noisy, clip, ch);
  const cleanFiltered = applyChoice(clip.frames, clip, ch);
  const meta = { fps: clip.fps, supportedBy: clip.supportedBy };
  const gateFiltered = runGate({ frames: filtered, ...meta });
  const cm = (v: number[]) => rms(v) * 100;
  return {
    choice: ch, fps: clip.fps, noisy, filtered, clean: clip.frames,
    gateClean: runGate({ frames: clip.frames, ...meta }), gateNoisy: runGate({ frames: noisy, ...meta }), gateFiltered,
    noiseLeftCm: cm(diffs(filtered, cleanFiltered)), noiseInCm: cm(diffs(noisy, clip.frames)),
    shapeLostCm: cm(diffs(cleanFiltered, clip.frames)), lagMs: (lagFrames(clip.frames, cleanFiltered) / clip.fps) * 1000,
    totalErrCm: cm(diffs(filtered, clip.frames)),
    cutoffHz: cutoffHz(ch.kind, ch.strength, clip.fps),
    maxAccel: gateFiltered.soft.no_jitter.value ?? 0, footSlideM: gateFiltered.soft.feet_dont_slide.value ?? 0,
  };
}

/** The game's setting on the same noisy clip: the 1-2-3-2-1 triangle, then one length per bone. */
export function runGameSetting(clip: SignalClip, noiseCm: number): Result {
  return runSignalLab(clip, { clip: "", kind: "triangle", strength: 2, noiseCm, fixBones: true });
}
