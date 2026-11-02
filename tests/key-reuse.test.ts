// Key reuse: Down / S has several meanings. The state of the run picks the meaning, and the replay log keeps the two sim inputs (squat, slide) as separate bits.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import base from '../src/course/default-course.json';
import { InputRecorder, inputOfMask, maskOf, type InputLog } from '../src/sim/replay';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { SLIDE_MIN_SPEED, SLIDE_RECOVERY } from '../src/sim/slide';
import { FLAT } from '../src/sim/terrain';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { courseSource } from './helpers/course-source';

const flat = { ...(base as unknown as CourseData), terrain: FLAT, startX: 0, checkpoints: [], shots: undefined } as CourseData;
const step = (w: WorldState, i: Partial<RunnerInput>, c = flat): WorldState => stepWorld(w, { ...NO_INPUT, ...i }, c);
const fast = (): WorldState => { let w = newWorld(flat, 0); for (let k = 0; k < 600; k++) w = step(w, { run: true }); return w; };
const types = (w: WorldState): string[] => w.events.map((e) => e.type);

// What the browser sends for one physical press of Down / S: `slide` for the single tick of the press, `squat` for every tick the key is down.
const press = (w: WorldState, held: Partial<RunnerInput> = { run: true }): { w: WorldState; seen: string[] } => {
  const s = step(w, { ...held, squat: true, slide: true });
  return { w: s, seen: types(s) };
};

// A jump on the flat: returns the world one tick before touchdown (still in the air, falling).
const justBeforeLanding = (ticksEarly = 0): WorldState => {
  const path: WorldState[] = [step(fast(), { run: true, jump: true })];
  for (let k = 0; k < 400; k++) { const next = step(path[path.length - 1], { run: true }); if (next.runner.grounded) return path[Math.max(0, path.length - 1 - ticksEarly)]; path.push(next); }
  throw new Error('never landed');
};

describe('key reuse: the same key, a different meaning in each state', () => {
  it('running at speed, a fresh press slides', () => {
    const { w, seen } = press(fast());
    expect(seen).toContain('slide');
    expect(w.slide).toBeTruthy();
  });
  it('running at speed, holding the key without a fresh press does not slide (squat is only a pose on the ground)', () => {
    let w = fast();
    for (let k = 0; k < 30; k++) w = step(w, { run: true, squat: true });
    expect(w.slide).toBeFalsy();
    expect(w.runner.vx).toBeGreaterThan(SLIDE_MIN_SPEED);
  });
  it('below the minimum speed a fresh press does nothing to the run', () => {
    const w = newWorld(flat, 0);
    const { w: after, seen } = press(w, {});
    expect(Math.abs(w.runner.vx)).toBeLessThan(SLIDE_MIN_SPEED);
    expect(seen).not.toContain('slide');
    expect(after.slide).toBeFalsy();
    expect(after.runner.x).toBeCloseTo(w.runner.x, 9);
  });
  it('in the air, the held key softens the landing and a press in the air starts no slide', () => {
    const up = justBeforeLanding(3); // three ticks before touchdown
    const air = step(up, { run: true, squat: true, slide: true });
    expect(air.runner.grounded).toBe(false);
    expect(air.slide).toBeFalsy();
    let w = air;
    while (!w.runner.grounded) w = step(w, { run: true, squat: true });
    expect(w.events.find((e) => e.type === 'land')?.detail?.squat).toBe(true);
    const stiff = step(justBeforeLanding(), { run: true }).events.find((e) => e.type === 'land');
    expect(stiff?.detail?.squat).toBe(false);
  });
  it('on cooldown a fresh press does nothing', () => {
    let w = press(fast()).w;
    while (w.slide) w = step(w, { run: true });
    expect(w.slideReadyAt! - w.runner.tick).toBeGreaterThan(SLIDE_RECOVERY * 120 - 3);
    const { w: early, seen } = press(w);
    expect(seen).not.toContain('slide');
    expect(early.slide).toBeFalsy();
  });
  it('in a drone the held key descends and never slides', () => {
    const c = JSON.parse(readFileSync('public/assets/demo/drone.course.json', 'utf8')) as CourseData;
    let w = newWorld(c);
    for (let k = 0; k < 120 * 4; k++) {
      const onPad = w.runner.x >= c.drone!.x0 && w.mode === 'run';
      w = stepWorld(w, { ...NO_INPUT, run: !onPad, handL: onPad || w.mode === 'drone', handR: onPad || w.mode === 'drone' }, c);
    }
    expect(w.mode).toBe('drone');
    const hold = { ...NO_INPUT, handL: true, handR: true };
    let up = w, down = w;
    for (let k = 0; k < 120; k++) { up = stepWorld(up, { ...hold, up: true }, c); down = stepWorld(down, { ...hold, squat: true, slide: true }, c); }
    expect(down.mode).toBe('drone');
    expect(down.slide).toBeFalsy();
    expect(down.drone!.y).toBeLessThan(up.drone!.y);
  });
});

describe('key reuse: can one press do two things?', () => {
  it('a press just before landing softens the landing and starts no slide, now or on the next ticks', () => {
    let w = step(justBeforeLanding(3), { run: true, squat: true, slide: true }); // the one tick of the press, in the air
    const all: string[] = [];
    for (let k = 0; k < 30; k++) { w = step(w, { run: true, squat: true }); all.push(...types(w)); } // the key stays down through the touchdown
    expect(all).toContain('land');
    expect(all).not.toContain('slide');
    expect(w.slide).toBeFalsy();
  });
  it('a press on the very tick of touchdown is a squat landing only; the slide needs the runner already on the ground', () => {
    const touch = step(justBeforeLanding(), { run: true, squat: true, slide: true });
    expect(touch.runner.grounded).toBe(true);
    expect(types(touch)).not.toContain('slide');
    expect(touch.slide).toBeFalsy();
    expect(touch.events.find((e) => e.type === 'land')?.detail?.squat).toBe(true);
    const next = step(touch, { run: true, squat: true }); // the slide signal is spent: holding on does not slide
    expect(next.slide).toBeFalsy();
  });
  it('a second, fresh press after the touchdown can start a slide (a new press with its own meaning)', () => {
    let w = step(justBeforeLanding(), { run: true, squat: true });
    for (let k = 0; k < 5; k++) w = step(w, { run: true });
    expect(Math.abs(w.runner.vx)).toBeGreaterThanOrEqual(SLIDE_MIN_SPEED);
    w = step(w, { run: true, squat: true, slide: true });
    expect(types(w)).toContain('slide');
  });
});

describe('key reuse: the replay stores the two meanings as separate bits', () => {
  it('squat and slide are different bits of the mask and each comes back unchanged', () => {
    const a = maskOf({ ...NO_INPUT, squat: true }), b = maskOf({ ...NO_INPUT, slide: true }), both = maskOf({ ...NO_INPUT, squat: true, slide: true });
    expect(a).not.toBe(b);
    expect(both).toBe(a | b);
    expect(inputOfMask(a).squat).toBe(true);
    expect(inputOfMask(a).slide).toBeFalsy();
    expect(inputOfMask(b).slide).toBe(true);
    expect(inputOfMask(b).squat).toBe(false);
  });
  it('a recorded run plays back the same: the sim reads the bits and never guesses the meaning again', () => {
    const script: Partial<RunnerInput>[] = [];
    for (let k = 0; k < 600; k++) script.push({ run: true });
    script.push({ run: true, squat: true, slide: true }); // press: slide
    for (let k = 0; k < 200; k++) script.push({ run: true, squat: true }); // key still down, no fresh press
    script.push({ run: true, jump: true });
    for (let k = 0; k < 120; k++) script.push({ run: true, squat: true }); // held through the landing
    const rec = new InputRecorder(), live: WorldState[] = [];
    let w = newWorld(flat, 0);
    for (const i of script) { const input = { ...NO_INPUT, ...i }; rec.push(input); w = stepWorld(w, input, flat); live.push(w); }
    expect(rec.valid).toBe(true);
    const log: InputLog = rec.snapshot();
    let r = newWorld(flat, 0), k = 0;
    for (const [m, n] of log) for (let j = 0; j < n; j++, k++) { r = stepWorld(r, inputOfMask(m), flat); expect(r.runner.x).toBe(live[k].runner.x); expect(r.runner.vx).toBe(live[k].runner.vx); expect(!!r.slide).toBe(!!live[k].slide); }
    expect(k).toBe(script.length);
  });
  it('the same held key with and without the fresh-press bit gives two different runs, and the log tells them apart', () => {
    const go = (slide: boolean): { x: number; log: InputLog } => {
      const rec = new InputRecorder(); let w = fast();
      for (let k = 0; k < 60; k++) { const i = { ...NO_INPUT, run: true, squat: true, slide: slide && k === 0 }; rec.push(i); w = stepWorld(w, i, flat); }
      return { x: w.runner.x, log: rec.snapshot() };
    };
    const a = go(true), b = go(false);
    expect(a.x).toBeLessThan(b.x); // the slide gave up speed to friction; the plain hold kept running
    expect(JSON.stringify(a.log)).not.toBe(JSON.stringify(b.log));
  });
});

// The page must treat S exactly like Arrow Down for the cannon tilt (and the squat, slide and drone descent).
describe('S matches Arrow Down in the page', () => {
  it('the cannon tilt-down input reads both keys', () => {
    const src = courseSource();
    expect(src).toContain("aimDown: st.keys.has('ArrowDown') || st.keys.has('KeyS')");
  });
});
