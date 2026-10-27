import { DT, GRAVITY } from './units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from './runner';
import { landing } from './landing';
import { DEFAULT_WALL, runWall } from './wall';
import { swingStep, type Swing } from './rope';
import { DEFAULT_TRAMPOLINE, bounce } from './trampoline';

// The Dojo's experiments: one obstacle each, a few knobs, one question. Every answer comes from running the
// simulator, never from a formula typed in here, so the lesson is always true to the game's physics.
export interface Knob { id: string; label: string; unit: string; min: number; max: number; def: number; step: number }
export interface Point { x: number; y: number }
export interface Trial {
  answer: number; // the measured value the player predicted
  path: Point[]; // side view, metres: x along the track, y up
  cleared?: boolean; // for goals (the gap)
  note?: string; // plain-words outcome
}
export interface Experiment {
  id: 'gap' | 'wall' | 'rope' | 'trampoline' | 'landing';
  name: string;
  question: string;
  answerUnit: string;
  answerMax: number; // top of the guess slider
  axis: 'x' | 'y'; // which way the guess is measured on the picture
  knobs: Knob[];
  sayings: string[];
  run(values: Record<string, number>): Trial;
}

export const GAP_WIDTH = 5.5;

const gap: Experiment = {
  id: 'gap', name: 'Gap jump', question: 'How far will you fly before you land?', answerUnit: 'm', answerMax: 14, axis: 'x',
  knobs: [
    { id: 'speed', label: 'Run-up speed', unit: 'm/s', min: 2, max: 10, def: 7, step: 0.1 },
    { id: 'jump', label: 'Take-off push upward', unit: 'm/s', min: 1, max: 8, def: 4.5, step: 0.1 },
  ],
  sayings: ['Once your feet leave the ground, the jump is already decided.'],
  run(v) {
    let s = { ...startState(0), vx: v.speed };
    s = step(s, { ...NO_INPUT, run: false, jump: true, jumpSpeed: v.jump }, DEFAULT_PARAMS);
    const path: Point[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < 120 * 20 && !s.grounded; i++) { s = step(s, NO_INPUT, DEFAULT_PARAMS); path.push({ x: s.x, y: s.y }); }
    const d = s.landedAtX ?? s.x;
    return { answer: d, path, cleared: d >= GAP_WIDTH, note: d >= GAP_WIDTH ? `You clear the ${GAP_WIDTH} m gap.` : `You land ${(GAP_WIDTH - d).toFixed(1)} m short of the far side.` };
  },
};

const wall: Experiment = {
  id: 'wall', name: 'Warped wall', question: 'How high up the wall will your feet get?', answerUnit: 'm', answerMax: 6, axis: 'y',
  knobs: [
    { id: 'speed', label: 'Speed at the wall', unit: 'm/s', min: 2, max: 10, def: 6, step: 0.1 },
    { id: 'height', label: 'Wall height', unit: 'm', min: 2, max: 6, def: 4.3, step: 0.1 },
  ],
  sayings: ["The wall can't lift you. It only spends the speed you bring."],
  run(v) {
    const r = runWall(v.speed, { ...DEFAULT_WALL, height: v.height });
    return { answer: r.heightGained, path: r.path, cleared: r.grabbed, note: r.grabbed ? 'Your hands reach the top.' : `You slide back, ${Math.abs(r.margin).toFixed(2)} m short.` };
  },
};

const rope: Experiment = {
  id: 'rope', name: 'Rope swing', question: 'How high will the rope carry you above where you grabbed it?', answerUnit: 'm', answerMax: 8, axis: 'y',
  knobs: [
    { id: 'speed', label: 'Speed when you grab', unit: 'm/s', min: 2, max: 10, def: 6, step: 0.1 },
    { id: 'length', label: 'Length below the grip', unit: 'm', min: 2, max: 9, def: 5, step: 0.1 },
  ],
  sayings: ['Fall to rise: the rope gives back every bit of height you give it.', 'A longer rope is slower, but carries you further.'],
  run(v) {
    let sw: Swing = { grip: v.length, theta: 0, omega: v.speed / v.length };
    const path: Point[] = [];
    let peak = 0;
    let turned = 0;
    for (let i = 0; i < 120 * 20 && turned < 1; i++) {
      path.push({ x: sw.grip * Math.sin(sw.theta), y: sw.grip * (1 - Math.cos(sw.theta)) });
      peak = Math.max(peak, sw.grip * (1 - Math.cos(sw.theta)));
      const next = swingStep(sw);
      if (sw.omega > 0 && next.omega <= 0) turned++;
      sw = next;
    }
    return { answer: peak, path, note: `The rope carries you ${peak.toFixed(1)} m up, then it brings you back.` };
  },
};

const trampoline: Experiment = {
  id: 'trampoline', name: 'Trampoline', question: 'How high will the trampoline throw you?', answerUnit: 'm', answerMax: 8, axis: 'y',
  knobs: [{ id: 'drop', label: 'Height you drop from', unit: 'm', min: 0.5, max: 4.5, def: 2, step: 0.1 }],
  sayings: ['The harder you land, the higher it throws you.'],
  run(v) {
    const vIn = Math.sqrt(2 * GRAVITY * v.drop);
    const b = bounce(vIn, DEFAULT_TRAMPOLINE);
    const h = (b.vyOut * b.vyOut) / (2 * GRAVITY);
    const rise: Point[] = [];
    for (let t = 0; t <= (2 * b.vyOut) / GRAVITY; t += 0.02) rise.push({ x: 1.5 + t * 2, y: b.vyOut * t - 0.5 * GRAVITY * t * t });
    return { answer: h, path: [{ x: 0, y: v.drop }, { x: 1.4, y: 0 }, ...rise], note: `It throws you ${h.toFixed(1)} m high (you dropped ${v.drop.toFixed(1)} m).` };
  },
};

const landingExp: Experiment = {
  id: 'landing', name: 'Landing', question: 'How hard is the landing? (1 = your own weight)', answerUnit: '×', answerMax: 15, axis: 'y',
  knobs: [
    { id: 'drop', label: 'Height you drop from', unit: 'm', min: 0.3, max: 3, def: 1.5, step: 0.1 },
    { id: 'bend', label: 'Time spent bending your knees', unit: 's', min: 0.05, max: 0.5, def: 0.08, step: 0.01 },
  ],
  sayings: ['Soft knees, safe landing: the same stop, spread over more time.'],
  run(v) {
    const impact = Math.sqrt(2 * GRAVITY * v.drop);
    const rep = landing(impact, true, { stiffStopTime: v.bend, squatStopTime: v.bend, stumbleDecel: 45, stumbleKeep: 0.3 });
    const g = rep.peakDecel / GRAVITY;
    const path: Point[] = [];
    const tf = impact / GRAVITY;
    for (let t = 0; t <= tf; t += DT * 4) path.push({ x: t, y: v.drop - 0.5 * GRAVITY * t * t });
    path.push({ x: tf + v.bend, y: 0 });
    return { answer: g, path, cleared: !rep.stumbled, note: rep.stumbled ? 'That landing is too hard: you stumble.' : 'You land cleanly.' };
  },
};

export const EXPERIMENTS: Experiment[] = [gap, wall, rope, trampoline, landingExp];
export const defaults = (e: Experiment): Record<string, number> => Object.fromEntries(e.knobs.map((k) => [k.id, k.def]));

// A guess is close when it is within a generous band of the truth (learning design: about 25 %).
export const closeEnough = (guess: number, truth: number, band = 0.25): boolean => Math.abs(guess - truth) <= Math.max(band * Math.abs(truth), 0.3);
