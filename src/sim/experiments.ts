import { DT, GRAVITY } from './units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from './runner';
import { landing, ouch } from './landing';
import { DEFAULT_WALL, runWall } from './wall';
import { swingStep, type Swing } from './rope';
import { DEFAULT_TRAMPOLINE, bounce } from './trampoline';
import { minSpeedToCross } from './needs';

// The Dojo's experiments: one obstacle each, a few knobs, one question. Every answer comes from running the
// simulator, never from a formula typed in here, so the lesson is always true to the game's physics.
export interface Knob { id: string; label: string; unit: string; min: number; max: number; def: number; step: number; why: string }
export interface Point { x: number; y: number }
export interface Overlay { pts: Point[]; color: string; label: string }
// The real numbers of the obstacle the player came from (the Course passes them in the link).
export interface Context { width?: number; rise?: number; needed?: number; speed?: number; wallHeight?: number; ropeLength?: number }
export type Pose = 'stand' | 'fly' | 'hang' | 'crouch' | 'climb';
export interface Person { x: number; y: number; pose: Pose; hand?: Point; label?: string } // feet position; `hand` is where the hands are (hanging)
export interface Trial {
  answer: number; // the measured value the player predicted
  path: Point[]; // side view, metres: x along the track, y up
  overlays?: Overlay[]; // pieces of the obstacle drawn in another colour
  people?: Person[]; // the runner at key moments, so every scene has a person
  cleared?: boolean; // for goals
  note?: string; // plain-words outcome
}
export interface Experiment {
  id: 'gap' | 'wall' | 'rope' | 'trampoline' | 'landing';
  name: string;
  question: string;
  answerUnit: string;
  answerMax: number; // top of the guess slider
  axis: 'x' | 'y'; // which way the guess is measured on the picture
  primary: string; // the knob the lesson sweeps
  knobs: Knob[];
  sayings: string[];
  run(values: Record<string, number>, ctx?: Context): Trial;
}

export const GAP_WIDTH = 5.5;
const arcPoints = (R: number, top: number): Point[] => {
  const pts: Point[] = [];
  for (let i = 0; i <= 30; i++) { const th = (i / 30) * (Math.PI / 2); pts.push({ x: R * Math.sin(th), y: R * (1 - Math.cos(th)) }); }
  const out = pts.filter((p) => p.y <= top + 1e-9);
  if (top > R) out.push({ x: R, y: top });
  return out;
};

const gap: Experiment = {
  id: 'gap', name: 'Gap jump', question: 'How far will you fly before you land?', answerUnit: 'm', answerMax: 14, axis: 'x', primary: 'speed',
  knobs: [
    { id: 'speed', label: 'Run-up speed', unit: 'm/s', min: 2, max: 10, def: 7, step: 0.1, why: 'Your sideways speed keeps carrying you all the time you are in the air.' },
    { id: 'jump', label: 'Take-off push upward', unit: 'm/s', min: 1, max: 8, def: 4.5, step: 0.1, why: 'A harder push up keeps you in the air longer, so the sideways speed has more time to work.' },
  ],
  sayings: ['Once your feet leave the ground, the jump is already decided.'],
  run(v, ctx = {}) {
    const width = ctx.width ?? GAP_WIDTH;
    let s = { ...startState(0), vx: v.speed };
    s = step(s, { ...NO_INPUT, run: false, jump: true, jumpSpeed: v.jump }, DEFAULT_PARAMS);
    const path: Point[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < 120 * 20 && !s.grounded; i++) { s = step(s, NO_INPUT, DEFAULT_PARAMS); path.push({ x: s.x, y: s.y }); }
    const d = s.landedAtX ?? s.x;
    const need = minSpeedToCross(width, ctx.rise ?? 0, v.jump);
    const apex = path.reduce((a, p) => (p.y > a.y ? p : a), path[0]);
    return {
      answer: d, path, cleared: d >= width,
      people: [{ x: 0, y: 0, pose: 'stand', label: 'take-off' }, { x: apex.x, y: apex.y, pose: 'fly' }, { x: d, y: 0, pose: 'stand', label: 'landing' }],
      note: (d >= width ? `You clear the ${width.toFixed(1)} m gap.` : `You land ${(width - d).toFixed(1)} m short of the far side.`) + ` With this push, this gap needs at least ${need.toFixed(1)} m/s.`,
    };
  },
};

const wall: Experiment = {
  id: 'wall', name: 'Warped wall', question: 'How high up the wall will your feet get?', answerUnit: 'm', answerMax: 8, axis: 'y', primary: 'speed',
  knobs: [
    { id: 'speed', label: 'Speed at the foot of the wall', unit: 'm/s', min: 2, max: 10, def: 6, step: 0.1, why: 'The wall adds no speed of its own: the height you reach is paid for by the speed you bring.' },
    { id: 'height', label: 'Wall height', unit: 'm', min: 2, max: 6, def: 4.3, step: 0.1, why: 'This decides whether your hands can reach the top. It does not change how high your speed can lift you.' },
  ],
  sayings: ["The wall can't lift you. It only spends the speed you bring."],
  run(v, ctx = {}) {
    const R = 4.3; // constant curve; only the energy lesson matters here
    const r = runWall(v.speed, { ...DEFAULT_WALL, height: v.height, radius: R, stopAtGrab: false });
    const needed = r.needed;
    const wallLine = arcPoints(R, v.height);
    void ctx;
    return {
      answer: r.heightGained, path: r.path,
      overlays: [{ pts: wallLine, color: '#c9893b', label: `wall (${v.height.toFixed(1)} m)` }],
      people: [{ x: 0, y: 0, pose: 'stand', label: 'start' }, { ...r.path[r.path.length - 1], pose: 'climb' }],
      cleared: r.heightGained >= needed,
      note: r.heightGained >= needed ? 'Your hands reach the top of this wall.' : `Your hands stay ${(needed - r.heightGained).toFixed(1)} m short of the top.`,
    };
  },
};

const rope: Experiment = {
  id: 'rope', name: 'Rope swing', question: 'How far across will you land after you let go?', answerUnit: 'm', answerMax: 16, axis: 'x', primary: 'angle',
  knobs: [
    { id: 'speed', label: 'Speed when you grab', unit: 'm/s', min: 3, max: 10, def: 7, step: 0.1, why: 'This is the energy you carry into the swing. The rope gives back every bit of height it can afford.' },
    { id: 'length', label: 'Length above the grip', unit: 'm', min: 2, max: 9, def: 5, step: 0.1, why: 'A longer rope swings slower, and it carries you further before it turns you around. (Rope below the grip is slack and does not matter.)' },
    { id: 'angle', label: 'Where you let go (swing angle)', unit: '°', min: 10, max: 120, def: 45, step: 1, why: 'Letting go early or late sends you off in a different direction: that is the whole skill of the rope.' },
  ],
  sayings: ['Let go too early and you fall short; too late and you fall back.', 'Fall to rise: the rope gives back every bit of height you give it.'],
  run(v) {
    const L = v.length, target = (v.angle * Math.PI) / 180;
    let sw: Swing = { grip: L, theta: 0, omega: v.speed / L };
    const path: Point[] = [];
    let release: { x: number; y: number; vx: number; vy: number } | null = null;
    for (let i = 0; i < 120 * 20; i++) {
      const hx = L * Math.sin(sw.theta), hy = L * (1 - Math.cos(sw.theta));
      path.push({ x: hx, y: hy });
      if (sw.theta >= target) { const sp = sw.omega * L; release = { x: hx, y: hy, vx: sp * Math.cos(sw.theta), vy: sp * Math.sin(sw.theta) }; break; }
      const next = swingStep(sw);
      if (sw.omega > 0 && next.omega <= 0) break; // turned around before the chosen angle
      sw = next;
    }
    const anchor = { x: 0, y: L };
    const ropeAt = (th: number): Overlay => ({ pts: [anchor, { x: L * Math.sin(th), y: L * (1 - Math.cos(th)) }], color: '#8a5a2b', label: '' });
    const base: Overlay[] = [{ pts: [anchor, { x: 0, y: 0 }], color: '#c3cdc7', label: 'rope hanging straight' }];
    if (!release) return { answer: 0, path, overlays: base, people: [{ x: 0, y: -2.1, pose: 'hang', hand: { x: 0, y: 0 } }], note: 'The swing runs out of energy before that angle: you never get there and swing back. Try more speed or an earlier release.' };
    let x = release.x, y = release.y, vy = release.vy;
    const fly: Point[] = [{ x, y }];
    for (let i = 0; i < 120 * 20 && !(y < 0 && vy < 0); i++) { x += release.vx * DT; y += vy * DT - 0.5 * GRAVITY * DT * DT; vy -= GRAVITY * DT; fly.push({ x, y }); }
    const rel = ropeAt(target); rel.label = `rope at ${Math.round(v.angle)}° (where you let go)`;
    const hang = { x: release.x, y: release.y - 2.1 };
    return {
      answer: Math.max(0, x), path: [...path, ...fly], overlays: [...base, rel],
      people: [{ x: 0, y: -2.1, pose: 'hang', hand: { x: 0, y: 0 }, label: 'grab' }, { x: hang.x, y: hang.y, pose: 'hang', hand: { x: release.x, y: release.y }, label: 'let go' }, { x, y: -2.1 + 2.1, pose: 'stand', label: 'land' }],
      note: `You land ${x.toFixed(1)} m across from where you grabbed, back at the height of the grab.`,
    };
  },
};

const trampoline: Experiment = {
  id: 'trampoline', name: 'Trampoline', question: 'How high will the trampoline throw you?', answerUnit: 'm', answerMax: 8, axis: 'y', primary: 'drop',
  knobs: [{ id: 'drop', label: 'Height you drop from', unit: 'm', min: 0.5, max: 4.5, def: 2, step: 0.1, why: 'A longer fall means a harder landing, so more energy is stored in the spring and then given back.' }],
  sayings: ['The harder you land, the higher it throws you.'],
  run(v) {
    const vIn = Math.sqrt(2 * GRAVITY * v.drop);
    const b = bounce(vIn, DEFAULT_TRAMPOLINE);
    const h = (b.vyOut * b.vyOut) / (2 * GRAVITY);
    const rise: Point[] = [];
    for (let t = 0; t <= (2 * b.vyOut) / GRAVITY; t += 0.02) rise.push({ x: 1.5 + t * 2, y: b.vyOut * t - 0.5 * GRAVITY * t * t });
    return { answer: h, path: [{ x: 0, y: v.drop }, { x: 1.4, y: 0 }, ...rise], people: [{ x: 0, y: v.drop, pose: 'fly', label: 'drop' }, { x: 1.5 + ((2 * b.vyOut) / GRAVITY / 2) * 2, y: h, pose: 'fly', label: 'top of the bounce' }], note: `It throws you ${h.toFixed(1)} m high (you dropped ${v.drop.toFixed(1)} m). The spring keeps about ${Math.round((h / v.drop) * 100)} % of your height.` };
  },
};

const landingExp: Experiment = {
  id: 'landing', name: 'Landing', question: 'How much will the landing hurt? (0 = a feather, 10 = broken bones)', answerUnit: 'out of 10', answerMax: 12, axis: 'y', primary: 'bend',
  knobs: [
    { id: 'drop', label: 'Height you drop from', unit: 'm', min: 0.3, max: 4, def: 2.5, step: 0.1, why: 'The longer you fall, the faster you hit the ground, and the more speed has to be stopped.' },
    { id: 'bend', label: 'Time spent bending your knees', unit: 's', min: 0.05, max: 0.5, def: 0.1, step: 0.01, why: 'Stopping over more time needs a gentler push. In the Course, hold the down arrow as you land to bend your knees.' },
  ],
  sayings: ['Soft knees, safe landing: the same stop, spread over more time.'],
  run(v) {
    const impact = Math.sqrt(2 * GRAVITY * v.drop);
    const rep = landing(impact, true, { stiffStopTime: v.bend, squatStopTime: v.bend, stumbleDecel: 45, stumbleKeep: 0.3 });
    const g = ouch(rep.peakDecel);
    const path: Point[] = [];
    const tf = impact / GRAVITY;
    for (let t = 0; t <= tf; t += DT * 4) path.push({ x: t, y: v.drop - 0.5 * GRAVITY * t * t });
    path.push({ x: tf + v.bend, y: 0 });
    const word = g < 3 ? 'a soft landing' : g < 6 ? 'a firm landing' : g < 8 ? 'a hard landing: you stumble' : 'a dangerous landing: you could break something';
    return { answer: g, path, people: [{ x: 0, y: v.drop, pose: 'fly', label: 'drop' }, { x: tf + v.bend, y: 0, pose: 'crouch', label: 'landing' }], cleared: !rep.stumbled, note: `That is ${g.toFixed(1)} out of 10: ${word}.` };
  },
};

export const EXPERIMENTS: Experiment[] = [gap, wall, rope, trampoline, landingExp];
export const defaults = (e: Experiment, ctx: Context = {}): Record<string, number> => {
  const d = Object.fromEntries(e.knobs.map((k) => [k.id, k.def]));
  if (e.id === 'gap' && ctx.speed) d.speed = Math.min(10, Math.max(2, ctx.speed));
  if (e.id === 'wall' && ctx.wallHeight) d.height = ctx.wallHeight;
  if (e.id === 'rope' && ctx.ropeLength) d.length = ctx.ropeLength;
  return d;
};

// A guess is close when it is within a generous band of the truth (learning design: about 25 %).
export const closeEnough = (guess: number, truth: number, band = 0.25): boolean => Math.abs(guess - truth) <= Math.max(band * Math.abs(truth), 0.3);

// Sweep one knob across its range with the others fixed, to show the shape of the relationship.
export function sweep(e: Experiment, values: Record<string, number>, knobId: string, ctx: Context = {}, n = 24): Point[] {
  const k = e.knobs.find((q) => q.id === knobId)!;
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) { const x = k.min + ((k.max - k.min) * i) / n; out.push({ x, y: e.run({ ...values, [knobId]: x }, ctx).answer }); }
  return out;
}

export type Shape = 'direct' | 'inverse' | 'square' | 'root' | 'hump' | 'exponential' | 'flat' | 'other';
// Classify the curve by its log-log slope (a power law shows as a straight line there) and a few simple checks.
export function classify(pts: Point[]): { shape: Shape; slope: number } {
  const ok = pts.filter((p) => p.x > 0 && p.y > 0.02);
  if (ok.length < 6) return { shape: 'other', slope: NaN };
  const ys = ok.map((p) => p.y);
  const peak = Math.max(...ys);
  const iPeak = ys.indexOf(peak);
  if (iPeak > 1 && iPeak < ys.length - 2 && ys[0] < peak * 0.9 && ys[ys.length - 1] < peak * 0.9) return { shape: 'hump', slope: NaN };
  const fit = (xs: number[], zs: number[]) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, mz = zs.reduce((a, b) => a + b) / n;
    let sxx = 0, sxz = 0, szz = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxz += (xs[i] - mx) * (zs[i] - mz); szz += (zs[i] - mz) ** 2; }
    return { slope: sxz / sxx, r2: (sxz * sxz) / (sxx * szz) };
  };
  const lx = ok.map((p) => Math.log(p.x)), ly = ok.map((p) => Math.log(p.y));
  const pw = fit(lx, ly);
  if (Math.abs(pw.slope) < 0.1) return { shape: 'flat', slope: pw.slope };
  const ex = fit(ok.map((p) => p.x), ly);
  if (pw.r2 > 0.985) {
    const s = pw.slope;
    if (Math.abs(s - 1) < 0.2) return { shape: 'direct', slope: s };
    if (Math.abs(s - 2) < 0.35) return { shape: 'square', slope: s };
    if (Math.abs(s + 1) < 0.25) return { shape: 'inverse', slope: s };
    if (Math.abs(s - 0.5) < 0.15) return { shape: 'root', slope: s };
    return { shape: 'other', slope: s };
  }
  if (ex.r2 > 0.99 && ex.slope > 0) return { shape: 'exponential', slope: ex.slope };
  return { shape: 'other', slope: pw.slope };
}
