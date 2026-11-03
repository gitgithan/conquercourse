import { DEFAULT_BAND, bandOnlySpeed } from './band';
import { DT, GRAVITY } from './units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from './runner';
import { DEFAULT_LANDING, landing } from './landing';
import { DEFAULT_WALL, runWall } from './wall';
import { swingStep, type Swing } from './rope';
import { DEFAULT_HANG, hangStep, measureHangPeriod, type Hang } from './holds';
import { DEFAULT_TRAMPOLINE, bounce } from './trampoline';
import { minSpeedToCross } from './needs';
import { DEFAULT_TREBUCHET, deg, launchStep, startLaunch, type TrebuchetParams } from './trebuchet';
import { DEFAULT_CART, cartStep, makeRails } from './cart';
import { DEFAULT_CANNON, DEFAULT_RECOIL, ballSpeedFromRest, levelRange, shot, standingPush } from './recoil';
import { RIDER_MASS, sagAt, worstCase, type PlankData } from './beam';
import { DEFAULT_DRONE, boardDrone, droneStep, rotorPower, weight, type DroneParams } from './drone';

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
  id: 'gap' | 'wall' | 'rope' | 'trampoline' | 'landing' | 'bars' | 'coaster' | 'lever' | 'recoil' | 'bridge' | 'cannon' | 'stored' | 'drone';
  name: string;
  question: string;
  answerUnit: string;
  answerMax: number; // top of the guess slider
  axis: 'x' | 'y' | 'meter'; // which way the guess is measured on the picture ('meter': a gauge under the plot)
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
  knobs: [
    { id: 'drop', label: 'Height you drop from', unit: 'm', min: 0.5, max: 4.5, def: 2, step: 0.1, why: 'A longer fall means a harder landing, so more energy is stored in the spring and then given back.' },
    { id: 'press', label: 'Extra push you add (Space at the bottom)', unit: 'm/s', min: 0, max: 2, def: 0, step: 0.1, why: 'Pressing at the bottom of the bounce adds speed on top of what the spring gives back, so it adds height too. In the Course a perfect press adds 2 m/s; a rough one adds less.' },
  ],
  sayings: ['The harder you land, the higher it throws you.'],
  run(v) {
    const vIn = Math.sqrt(2 * GRAVITY * v.drop);
    const b = bounce(vIn, DEFAULT_TRAMPOLINE);
    const vOut = b.vyOut + (v.press ?? 0);
    const h = (vOut * vOut) / (2 * GRAVITY);
    const rise: Point[] = [];
    for (let t = 0; t <= (2 * vOut) / GRAVITY; t += 0.02) rise.push({ x: 1.5 + t * 2, y: vOut * t - 0.5 * GRAVITY * t * t });
    return { answer: h, path: [{ x: 0, y: v.drop }, { x: 1.4, y: 0 }, ...rise], people: [{ x: 0, y: v.drop, pose: 'fly', label: 'drop' }, { x: 1.5 + ((2 * vOut) / GRAVITY / 2) * 2, y: h, pose: 'fly', label: 'top of the bounce' }], note: `It throws you ${h.toFixed(1)} m high (you dropped ${v.drop.toFixed(1)} m). The spring keeps about ${Math.round((h / v.drop) * 100)} % of your height.` };
  },
};

const landingExp: Experiment = {
  id: 'landing', name: 'Landing', question: 'How hard is the push that stops you?', answerUnit: 'm/s²', answerMax: 180, axis: 'meter', primary: 'bend',
  knobs: [
    { id: 'drop', label: 'Height you drop from', unit: 'm', min: 0.3, max: 4, def: 2.5, step: 0.1, why: 'The longer you fall, the faster you hit the ground, and the more speed has to be stopped.' },
    { id: 'bend', label: 'Time spent bending your knees', unit: 's', min: 0.05, max: 0.5, def: 0.1, step: 0.01, why: 'Stopping over more time needs a gentler push. In the Course, hold the down arrow as you land to bend your knees.' },
  ],
  sayings: ['Soft knees, safe landing: the same stop, spread over more time.'],
  run(v) {
    const impact = Math.sqrt(2 * GRAVITY * v.drop);
    const rep = landing(impact, true, { ...DEFAULT_LANDING, squatStopTime: v.bend, squatTravel: undefined });
    // push against time: a block as wide as the stopping time and as tall as the push; its area is the speed you lose (always the impact speed)
    const F = rep.peakDecel;
    const path: Point[] = [{ x: 0, y: 0 }, { x: 0, y: F }, { x: v.bend, y: F }, { x: v.bend, y: 0 }];
    return { answer: F, path, cleared: !rep.stumbled, note: `You hit the ground at ${impact.toFixed(1)} m/s and stop in ${v.bend.toFixed(2)} s, so the ground pushes you with ${F.toFixed(0)} m/s² (${(F / GRAVITY).toFixed(1)} times gravity). ${rep.stumbled ? 'In the Course, that is a stumble.' : 'In the Course, that is a clean landing.'}` };
  },
};

// Swinging on a bar (the lache pair): how long one swing takes depends only on the length, and pushing in step with it grows the swing.
const bars: Experiment = {
  id: 'bars', name: 'Swing on a bar', question: 'How long does one full swing take?', answerUnit: 's', answerMax: 3, axis: 'x', primary: 'length',
  knobs: [
    { id: 'length', label: 'Swinging length (hands to the middle of the body)', unit: 'm', min: 0.6, max: 3, def: 1.4, step: 0.05, why: 'A longer swing is a slower one, like a longer rope.' },
    { id: 'push', label: 'Push with the swing (1) or against it (−1)', unit: '', min: -1, max: 1, def: 1, step: 0.1, why: 'Pushing the way you swing adds energy and the swing grows; pushing against it takes energy away.' },
    { id: 'seconds', label: 'How long you keep pushing', unit: 's', min: 0, max: 10, def: 6, step: 0.5, why: 'Each push adds a little; the swing grows with every swing you push.' },
  ],
  sayings: ['Push with the swing and it grows; push against it and it fades.'],
  run(v) {
    const H = v.length * 1.5; // the pendulum is two thirds of the hands-to-feet length
    const p = { ...DEFAULT_HANG, handHeight: H };
    const period = measureHangPeriod(0.05, { ...p, drag: 0 });
    let s: Hang = { hold: 0, theta: 0.15, omega: 0 };
    let peak = 0, peakAt = { x: 0, y: -H };
    const path: Point[] = [];
    for (let i = 0; i < 120 * 12; i++) {
      const t = i / 120;
      s = hangStep(s, t < v.seconds ? v.push * Math.sign(s.omega || 1) : 0, p);
      const pt = { x: H * Math.sin(s.theta), y: -H * Math.cos(s.theta) };
      if (i % 4 === 0) path.push(pt);
      if (Math.abs(s.theta) > peak) { peak = Math.abs(s.theta); peakAt = pt; }
    }
    const deg = Math.round((peak * 180) / Math.PI);
    return {
      answer: period, path,
      overlays: [{ pts: [{ x: 0, y: 0 }, peakAt], color: '#8a5a2b', label: `highest swing: ${deg}°` }],
      people: [{ x: 0, y: -H, pose: 'hang', hand: { x: 0, y: 0 }, label: 'hanging' }, { x: peakAt.x, y: peakAt.y, pose: 'hang', hand: { x: 0, y: 0 }, label: 'highest' }],
      note: `One swing takes about ${period.toFixed(1)} s whatever the size of the swing. After ${v.seconds.toFixed(1)} s of pushing ${v.push > 0 ? 'with' : v.push < 0 ? 'against' : 'neither with nor against'} the swing, it climbs to about ${deg}° from straight down.`,
    };
  },
};

// The trebuchet's lever (turning moments): a light arm turns about its pivot, a weight hangs on the short side at distance `near`, you sit on the long side at distance `far`.
// The balance is found by trying the simulator: the heaviest weight that does not turn the arm the wrong way, by bisection on the arm's first quarter second.
const RIDER_KG = 80;
const lever = (near: number, far: number, weight: number): TrebuchetParams => ({ ...DEFAULT_TREBUCHET, x: 0, armMass: 0, riderMass: RIDER_KG, long: far, short: near, sling: 0.01, counterweight: weight, startAngle: 0, stopAngle: 170 });
// How far the arm has turned after `seconds` (degrees, positive: the weight wins and your side goes up).
function leverTurn(near: number, far: number, weight: number, seconds: number): { turn: number; tip: number } {
  const p = lever(near, far, weight);
  let s = { ...startLaunch(p, 0), beta: -Math.PI / 2, fired: true };
  for (let i = 0; i < Math.round(seconds * 120); i++) s = launchStep(s, p);
  return { turn: deg(s.alpha), tip: Math.abs(s.dalpha) * far };
}
// The turn of the arm after exactly `turn` degrees: the speed of the tip (m/s) at that moment.
function tipSpeedAt(near: number, far: number, weight: number, turnDeg: number): number {
  const p = lever(near, far, weight);
  let s = { ...startLaunch(p, 0), beta: -Math.PI / 2, fired: true };
  for (let i = 0; i < 120 * 6 && deg(s.alpha) < turnDeg; i++) s = launchStep(s, p);
  return Math.abs(s.dalpha) * far;
}
const leverExp: Experiment = {
  id: 'lever', name: 'Balance the arm', question: 'How heavy must the weight be to just balance you?', answerUnit: 'kg', answerMax: 2000, axis: 'meter', primary: 'near',
  knobs: [
    { id: 'near', label: 'Distance of the weight from the pivot', unit: 'm', min: 0.4, max: 3, def: 1.3, step: 0.05, why: 'A weight far from the pivot turns the arm harder than the same weight close to it. The turning effect is the weight times its distance.' },
    { id: 'far', label: 'Distance of you from the pivot (the length of the throwing arm)', unit: 'm', min: 1, max: 8, def: 5.5, step: 0.1, why: 'You turn the arm the other way, and the farther out you sit the harder you turn it. A longer arm needs a heavier weight to balance it.' },
  ],
  sayings: ['A heavy weight close in turns the arm like a light one far out.'],
  run(v) {
    let lo = 0, hi = 8000;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (leverTurn(v.near, v.far, mid, 0.25).turn > 0) hi = mid; else lo = mid; }
    const balance = (lo + hi) / 2;
    const twice = tipSpeedAt(v.near, v.far, balance * 2, 30);
    const longer = tipSpeedAt(v.near, v.far * 1.5, balance * 2 * 1.5, 30); // the longer arm needs 1.5 times the weight to balance, so twice that weight is the same push
    const same = tipSpeedAt(v.near, v.far * 1.5, balance * 2, 30);
    const arm = (a: number): Point[] => [{ x: v.near - v.near * Math.cos(a), y: v.near * Math.sin(a) }, { x: v.near, y: 0 }, { x: v.near + v.far * Math.cos(a), y: -v.far * Math.sin(a) }]; // the pivot at x = near, so the whole picture is to the right of zero
    return {
      answer: balance,
      path: arm(0),
      overlays: [{ pts: [{ x: v.near, y: 0 }, { x: v.near, y: -0.9 }], color: '#8a5a2b', label: 'pivot' }, { pts: [{ x: 0, y: 0 }, { x: 0, y: -0.6 }], color: '#4a4f55', label: `weight, ${balance.toFixed(0)} kg` }],
      people: [{ x: v.near + v.far, y: 0, pose: 'stand', label: `you, ${RIDER_KG} kg` }],
      note: `The weight at ${v.near.toFixed(2)} m has to be ${balance.toFixed(0)} kg to balance you at ${v.far.toFixed(1)} m: ${balance.toFixed(0)} × ${v.near.toFixed(2)} = ${(balance * v.near).toFixed(0)} and ${RIDER_KG} × ${v.far.toFixed(1)} = ${(RIDER_KG * v.far).toFixed(0)}. Add weight and the arm turns your side up; with twice that weight the tip moves at ${twice.toFixed(1)} m/s after a third of a quarter turn. The same twice-the-balance push on an arm 1.5 times as long moves the tip at ${longer.toFixed(1)} m/s; the same weight on that longer arm gives ${same.toFixed(1)} m/s.`,
    };
  },
};
void leverTurn;

// The elastic band (stored energy): you stretch a band by some distance and let go; it gives back what it stored, so the speed grows with the stretch
// and with the square root of how stiff the band is. The answer is the speed the band alone gives (no legs, no friction): all the stored energy becomes motion.
const BAND_KG = DEFAULT_BAND.mass;
const storedExp: Experiment = {
  id: 'stored', name: 'Stored energy', question: 'How fast will the band throw you when it lets go?', answerUnit: 'm/s', answerMax: 20, axis: 'meter', primary: 'stretch',
  knobs: [
    { id: 'stretch', label: 'How far you stretch the band', unit: 'm', min: 1, max: 20, def: 8, step: 0.5, why: 'Stretching it farther stores more energy, and the energy grows faster than the distance: twice the stretch stores four times as much.' },
    { id: 'stiffness', label: 'How stiff the band is', unit: 'N/m', min: 20, max: 300, def: 60, step: 5, why: 'A stiffer band pulls harder for the same stretch, so it stores more. But your legs can only pull so hard, so a stiff band cannot be stretched far.' },
  ],
  sayings: ['A soft band pulled far outthrows a stiff one pulled little.'],
  run(v) {
    const p = { ...DEFAULT_BAND, k: v.stiffness };
    const speed = bandOnlySpeed(p, v.stretch);
    const reach = (DEFAULT_PARAMS.acceleration * BAND_KG) / v.stiffness; // the farthest your legs can pull it
    const path: Point[] = Array.from({ length: 25 }, (_, i) => ({ x: -v.stretch * (1 - i / 24), y: 0 }));
    const stiffer = bandOnlySpeed({ ...p, k: v.stiffness * 4 }, v.stretch);
    return {
      answer: speed,
      path,
      overlays: [{ pts: [{ x: 0, y: 0 }, { x: 0, y: 1.2 }], color: '#d33a2c', label: 'post' }, { pts: [{ x: -v.stretch, y: 1 }, { x: 0, y: 1.15 }], color: '#2ca66f', label: `band stretched ${v.stretch.toFixed(1)} m` }],
      people: [{ x: -v.stretch, y: 0, pose: 'crouch', label: `you, ${BAND_KG} kg` }],
      note: `Stretched ${v.stretch.toFixed(1)} m, a ${v.stiffness.toFixed(0)} N/m band throws you at ${speed.toFixed(1)} m/s. A band four times as stiff, stretched the same, would throw you ${stiffer.toFixed(1)} m/s: twice as fast. Your legs can only stretch this band about ${reach.toFixed(0)} m.`,
    };
  },
};

// A coaster (the cart on rails): how high a hill the cart can climb depends on the height it starts from, plus a little from the push.
const coaster: Experiment = {
  id: 'coaster', name: 'Coaster: hills and speed', question: 'How high a hill can the cart climb?', answerUnit: 'm', answerMax: 14, axis: 'y', primary: 'height',
  knobs: [
    { id: 'height', label: 'Height of the first hill', unit: 'm', min: 2, max: 12, def: 8, step: 0.25, why: 'The higher the cart starts, the more speed it has at the bottom, and speed carries it up the next hill.' },
    { id: 'push', label: 'Push at the start', unit: 'm/s', min: 0, max: 4, def: 1.5, step: 0.1, why: 'A push adds a little speed, which buys a little height.' },
  ],
  sayings: ['A coaster has no engine: it climbs no higher than where it started.'],
  run(v) {
    // the cart rolls down into a valley and up a very tall, smooth hill; where it turns round is the highest hill it could climb
    const pts: [number, number][] = [[0, v.height], [10, 0], [22, 8], [34, 24]];
    const rails = makeRails(pts);
    let x = 0, speed = v.push, top = v.height;
    const path: Point[] = [{ x: 0, y: v.height }];
    for (let i = 0; i < 120 * 40; i++) {
      ({ x, v: speed } = cartStep(rails, x, speed, false, { ...DEFAULT_CART, push: v.push }));
      const y = rails.y(x);
      if (i % 6 === 0) path.push({ x, y });
      if (y > top) top = y;
      if (speed <= 0 && rails.slope(x) > 0 && x > 10) break;
    }
    const best = top;
    return {
      answer: best, path,
      overlays: [{ pts: [{ x: 3, y: best }, { x: 34, y: best }], color: '#16a34a', label: `highest it reached: ${best.toFixed(1)} m` }],
      people: [{ x: 0, y: v.height, pose: 'stand', label: 'start' }],
      note: `The cart starts ${v.height.toFixed(1)} m up with a push of ${v.push.toFixed(1)} m/s. It climbs a hill about ${best.toFixed(1)} m high before it stops, a little lower than start plus push because friction and air take some energy.`,
    };
  },
};

// Recoil (CC-66): momentum is conserved. The launcher throws a ball back; the ball carries away some momentum, and you carry the same away forward.
const recoilExp: Experiment = {
  id: 'recoil', name: 'Recoil: push back, go forward', question: 'How fast do you fly forward after the shot?', answerUnit: 'm/s', answerMax: 15, axis: 'meter', primary: 'muzzle',
  knobs: [
    { id: 'mass', label: 'Mass of the ball', unit: 'kg', min: 2, max: 40, def: 12, step: 1, why: 'A heavier ball carries more push away with it, so it pushes you harder.' },
    { id: 'muzzle', label: 'Speed of the ball leaving the launcher', unit: 'm/s', min: 5, max: 40, def: 30, step: 1, why: 'A faster ball carries more push away with it. Twice as fast, twice the push.' },
  ],
  sayings: ['The heavy thing goes slow, the light thing fast, and both carry the same.'],
  run(v) {
    const p = { ...DEFAULT_RECOIL, ballMass: v.mass, muzzle: v.muzzle };
    const push = standingPush(p), ball = ballSpeedFromRest(p);
    const t = 0.5, back = ball * t, fwd = push * t, x0 = back + 1; // half a second after the shot; the picture stays to the right of zero
    return {
      answer: push,
      path: Array.from({ length: 6 }, (_, i) => ({ x: x0 + (fwd * i) / 5, y: 0 })), // where you are each tenth of a second after the shot
      overlays: [{ pts: [{ x: x0, y: 0.7 }, { x: x0 - back, y: 0.7 }], color: '#e8622c', label: `ball: ${ball.toFixed(1)} m/s backward, ${v.mass.toFixed(0)} kg` }, { pts: [{ x: x0, y: 0 }, { x: x0 + fwd, y: 0 }], color: '#16a34a', label: `you: ${push.toFixed(1)} m/s forward, ${DEFAULT_RECOIL.charMass} kg` }],
      people: [{ x: x0, y: 0, pose: 'stand', label: 'the shot' }, { x: x0 + fwd, y: 0, pose: 'stand', label: 'half a second later' }],
      note: `The ${v.mass.toFixed(0)} kg ball leaves at ${v.muzzle.toFixed(0)} m/s from you, which is ${ball.toFixed(1)} m/s against the ground. You go forward at ${push.toFixed(1)} m/s. The heavy ball is slow and you are fast: ${(v.mass * ball).toFixed(0)} kg·m/s of push goes back, and ${(DEFAULT_RECOIL.charMass * push).toFixed(0)} kg·m/s of push goes forward.`,
    };
  },
};

// A plank bridge: how far a plank sags with you in the middle. Sag grows with the cube of the span and falls with the cube of the thickness; a post in the middle halves the span.
const bridge: Experiment = {
  id: 'bridge', name: 'Plank bridge: how far it sags', question: 'How much further does the plank sag with you standing on it?', answerUnit: 'cm', answerMax: 150, axis: 'meter', primary: 'span',
  knobs: [
    { id: 'span', label: 'Length of the gap', unit: 'm', min: 1.5, max: 10, def: 4, step: 0.25, why: 'A longer plank has more of itself to bend between its two ends, and it bends far more than you would guess.' },
    { id: 'thickness', label: 'Thickness of the plank', unit: 'cm', min: 1, max: 6, def: 2, step: 0.25, why: 'A thicker plank is much stiffer: the stiffness grows with the thickness multiplied by itself three times.' },
    { id: 'post', label: 'Post under the middle (0 = none, 1 = one)', unit: '', min: 0, max: 1, def: 0, step: 1, why: 'A post makes two short planks out of one long one, and a short plank sags far less.' },
  ],
  sayings: ['A plank that is twice as long sags eight times as much.'],
  run(v) {
    const pk: PlankData = { x0: 0, x1: v.span, y: 0, thickness: v.thickness / 100, width: 0.6, material: 'wood', support: v.post >= 0.5 };
    // you stand where the plank bends most: the middle of the plank, or the middle of one half if there is a post
    const a = pk.support ? v.span / 4 : v.span / 2;
    const extra = sagAt(pk, a, a) - sagAt(pk, -1, a); // how much more it sags because you stand on it
    const path: Point[] = [];
    for (let i = 0; i <= 40; i++) { const x = (v.span * i) / 40; path.push({ x, y: -sagAt(pk, a, x) }); }
    const wc = worstCase(pk);
    return {
      answer: extra * 100,
      path,
      overlays: [{ pts: [{ x: 0, y: 0 }, { x: v.span, y: 0 }], color: '#9aa3ab', label: 'level' }],
      people: [{ x: a, y: -sagAt(pk, a, a), pose: 'stand', label: `you, ${RIDER_MASS} kg` }],
      note: `A ${v.span.toFixed(2)} m pine plank ${v.thickness.toFixed(2)} cm thick${pk.support ? ', with a post under the middle,' : ''} sags ${(extra * 100).toFixed(1)} cm more with you on it. ${wc.ratio >= 1 ? 'It would snap: the bending is more than pine can take.' : `It holds, using ${(wc.ratio * 100).toFixed(0)}% of what pine can take before snapping.`}`,
    };
  },
};

// The cannon (CC-66): the same push, aimed. The runner is pushed forward and up by the angle of the barrel, so the angle sets both speeds; on level ground the range peaks near 45 degrees.
const cannonExp: Experiment = {
  id: 'cannon', name: 'Cannon: the best angle', question: 'How far from the cannon do you land, on level ground?', answerUnit: 'm', answerMax: 90, axis: 'x', primary: 'angle',
  knobs: [
    { id: 'angle', label: 'Angle of the push above level', unit: '°', min: 5, max: 85, def: 25, step: 1, why: 'The barrel points backward and down, so you are pushed forward and up. A steeper barrel puts more of the push into going up and less into going forward.' },
    { id: 'mass', label: 'Mass of the ball', unit: 'kg', min: 20, max: 120, def: DEFAULT_CANNON.ballMass, step: 5, why: 'A heavier ball carries more push away with it, so the whole push is bigger.' },
    { id: 'muzzle', label: 'Speed of the ball leaving the cannon', unit: 'm/s', min: 20, max: 60, def: DEFAULT_CANNON.muzzle, step: 1, why: 'A faster ball carries more push away with it.' },
  ],
  sayings: ['Aim between high and flat: the middle angle flies farthest.'],
  run(v) {
    const p = { ...DEFAULT_RECOIL, kind: 'bigcannon' as const, ballMass: v.mass, muzzle: v.muzzle };
    const a = (v.angle * Math.PI) / 180, s = shot(p, 0, 0, false, a);
    let x = 0, y = 0, vy = s.dvy, top = 0;
    const path: Point[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < 120 * 40; i++) {
      const ny = y + vy * DT - 0.5 * GRAVITY * DT * DT;
      vy -= GRAVITY * DT; x += s.dvx * DT; y = ny; top = Math.max(top, y);
      if (y <= 0) { y = 0; path.push({ x, y }); break; }
      if (i % 6 === 0) path.push({ x, y });
    }
    const flat = Array.from({ length: 5 }, (_, i) => 15 + i * 15).map((d) => { const q = shot(p, 0, 0, false, (d * Math.PI) / 180); return { d, r: levelRange(q.dvx, q.dvy) }; });
    return {
      answer: x, path,
      overlays: [{ pts: [{ x: 0, y: top }, { x, y: top }], color: '#16a34a', label: `highest point: ${top.toFixed(0)} m` }],
      people: [{ x: 0, y: 0, pose: 'stand', label: 'the shot' }, { x: x / 2, y: top, pose: 'fly' }, { x, y: 0, pose: 'stand', label: 'landing' }],
      note: `The push is ${(Math.hypot(s.dvx, s.dvy)).toFixed(1)} m/s at ${v.angle.toFixed(0)}° above level: ${s.dvx.toFixed(1)} m/s forward and ${s.dvy.toFixed(1)} m/s up. You fly ${x.toFixed(0)} m and rise ${top.toFixed(0)} m. The same push at 15°, 30°, 45°, 60° and 75° flies ${flat.map((f) => f.r.toFixed(0)).join(', ')} m.`,
    };
  },
};

// The thrust a drone needs to hold its height at a lean, measured by flying the drone: the stabiliser settles on the push that keeps it level.
export function holdThrust(payload: number, leanDeg: number): { thrust: number; weight: number; power: number } {
  const p: DroneParams = { ...DEFAULT_DRONE, payload, drag: 0, leanLag: 0.01, maxLean: (leanDeg * Math.PI) / 180, maxThrust: 1e6 };
  let s = { ...boardDrone(p, 0, 0), y: 50, hold: 50 };
  for (let i = 0; i < 360; i++) s = droneStep(s, { lean: leanDeg > 0 ? 1 : 0, climb: 0 }, p);
  return { thrust: s.thrust, weight: weight(p), power: rotorPower(s.thrust, p) };
}

const droneExp: Experiment = {
  id: 'drone', name: 'Hover: push against weight', question: 'How hard must the rotors push to just hold the drone up?', answerUnit: 'N', answerMax: 6000, axis: 'meter', primary: 'payload',
  knobs: [
    { id: 'payload', label: 'Weight of the rider', unit: 'kg', min: 0, max: 200, def: 70, step: 5, why: 'Everything the drone carries has to be held up by the rotors, so a heavier rider needs a harder push.' },
    { id: 'lean', label: 'How far the drone leans', unit: '°', min: 0, max: 60, def: 0, step: 1, why: 'A leaning drone pushes partly sideways, which is how it moves. Only the upward part holds it up, so it has to push harder in total.' },
  ],
  sayings: ['Lean to go, but a leaning drone must push harder to stay up.'],
  run(v) {
    const h = holdThrust(v.payload, v.lean), a = (v.lean * Math.PI) / 180, W = h.weight;
    const cx = 2.2, cy = 1.6, k = 1 / 1300; // metres of arrow per newton
    const up = (len: number, ang: number): Point[] => [{ x: cx, y: cy }, { x: cx + len * Math.sin(ang), y: cy + len * Math.cos(ang) }];
    return {
      answer: h.thrust,
      path: [{ x: cx - 0.9, y: cy }, { x: cx - 0.3, y: cy }, { x: cx + 0.3, y: cy }, { x: cx + 0.9, y: cy }], // the frame of the drone
      overlays: [
        { pts: up(h.thrust * k, a), color: '#16a34a', label: `push, ${h.thrust.toFixed(0)} N` },
        { pts: [{ x: cx, y: cy }, { x: cx, y: cy - W * k }], color: '#e8622c', label: `weight, ${W.toFixed(0)} N` },
        { pts: [{ x: cx, y: cy }, { x: cx, y: cy + W * k }], color: '#16a34a88', label: 'the upward part equals the weight' },
      ],
      people: [{ x: cx, y: 0, pose: 'stand', label: `rider, ${v.payload.toFixed(0)} kg` }],
      note: `The drone and a ${v.payload.toFixed(0)} kg rider weigh ${W.toFixed(0)} N. Leaning ${v.lean.toFixed(0)}° the rotors must push ${h.thrust.toFixed(0)} N to hold the height, ${(h.thrust / W).toFixed(2)} times the weight, and that costs ${(h.power / 1000).toFixed(1)} kW from the battery. Push less and it sinks; push more and it climbs.`,
    };
  },
};

export const EXPERIMENTS: Experiment[] = [gap, wall, rope, trampoline, landingExp, bars, coaster, leverExp, recoilExp, bridge, cannonExp, storedExp, droneExp];
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

export type Shape = 'direct' | 'inverse' | 'square' | 'cube' | 'inverse-cube' | 'root' | 'hump' | 'exponential' | 'flat' | 'other';
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
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxz += (xs[i] - mx) * (zs[i] - mz); szz += (zs[i] - mz) * (zs[i] - mz); }
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
    if (Math.abs(s - 3) < 0.4) return { shape: 'cube', slope: s };
    if (Math.abs(s + 3) < 0.4) return { shape: 'inverse-cube', slope: s };
    if (Math.abs(s + 1) < 0.25) return { shape: 'inverse', slope: s };
    if (Math.abs(s - 0.5) < 0.15) return { shape: 'root', slope: s };
    return { shape: 'other', slope: s };
  }
  if (ex.r2 > 0.99 && ex.slope > 0) return { shape: 'exponential', slope: ex.slope };
  return { shape: 'other', slope: pw.slope };
}
