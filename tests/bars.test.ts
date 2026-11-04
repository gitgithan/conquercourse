import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { DEFAULT_BARS, barsFeet, barsStep, canReach, nextHand as nextHandOf, rungX, swingEnergy, tryGrabBars, type BarRun, type BarsHang } from '../src/sim/bars';
import { inputOfMask, maskOf } from '../src/sim/replay';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';

const row: BarRun = { x: 10, y: 2.6, n: 6, gap: 0.6 };
const start = (over: Partial<BarsHang> = {}): BarsHang => ({ run: 0, l: 0, r: 0, last: 0, pl: false, pr: false, theta: 0, omega: 0, ox: 0, oy: 0, et: 0, reaches: 0, ...over });

// A kip that swings the body: push the way it is moving, until the swing reaches about 1 rad.
const E_TARGET = (DEFAULT_BARS.hang.gravity / ((2 / 3) * DEFAULT_BARS.hang.handHeight)) * (1 - Math.cos(1.0));
const kip = (s: BarsHang): number => (swingEnergy(s) < E_TARGET ? (s.omega >= 0 ? 1 : -1) : 0);
// The hand to reach with now (the one that did not reach last), if the swing allows it.
const nextHand = (s: BarsHang): 0 | 1 | 2 => { const h = s.last === 1 ? 2 : 1; return canReach(row, s, h).ok ? h : 0; };

describe('monkey bars: laws', () => {
  it('a reach never creates swing energy', () => {
    for (const theta of [0.3, 0.6, 0.9, 1.2]) for (const omega of [0, 0.5, 2, 4]) {
      const s = start({ theta, omega });
      const e0 = swingEnergy(s);
      const { s: n, events } = barsStep(s, row, true, false, 0); // one tick: the reach and one step of the swing with no kip
      const nr = barsStep({ ...s }, row, false, false, 0).s;
      if (events.some((e) => e.type === 'bars-reach')) expect(swingEnergy(n)).toBeLessThanOrEqual(swingEnergy(nr) + 1e-12);
      expect(swingEnergy(nr)).toBeLessThanOrEqual(e0 + 1e-9); // and drag only takes energy out
    }
  });
  it('without the kip the swing only loses energy, over a whole reaching sequence', () => {
    let s = start({ theta: 0.8, omega: 0 });
    let e = swingEnergy(s);
    for (let i = 0; i < 120 * 10; i++) {
      const pressL = i % 60 === 10, pressR = i % 60 === 40;
      s = barsStep(s, row, pressL, pressR, 0).s;
      const now = swingEnergy(s);
      expect(now).toBeLessThanOrEqual(e + 1e-9);
      e = now;
    }
  });
  it('the kip adds energy, and only the kip', () => {
    let a = start({ theta: 0.1, omega: 0 }), b = a;
    for (let i = 0; i < 600; i++) { a = barsStep(a, row, false, false, kip(a)).s; b = barsStep(b, row, false, false, 0).s; }
    expect(swingEnergy(a)).toBeGreaterThan(swingEnergy(b) * 4);
  });
  it('the arm rule is exact: just inside the reach works, just outside stalls', () => {
    const theta = 0.5, reach = 2 * DEFAULT_BARS.arm * Math.sin(theta);
    const near: BarRun = { ...row, gap: reach - 1e-6 }, far: BarRun = { ...row, gap: reach + 1e-6 };
    expect(canReach(near, start({ theta, omega: 1 }), 1).ok).toBe(true);
    expect(canReach(far, start({ theta, omega: 1 }), 1)).toEqual({ ok: false, why: 'swing' });
  });
  it('the hand reaches only with the body swung forward, whichever way it is moving (a quick alternation is never held back by the phase)', () => {
    expect(canReach(row, start({ theta: 0.9, omega: -1 }), 1).ok).toBe(true);
    expect(canReach(row, start({ theta: -0.9, omega: 1 }), 1).ok).toBe(false);
    expect(canReach(row, start({ theta: 0, omega: 0 }), 1).ok).toBe(false);
  });
  it('the hands alternate and leapfrog: the back hand overtakes the front one', () => {
    let s = start({ theta: 0.9, omega: 1 });
    s = barsStep(s, row, true, false, 0).s; // left
    expect([s.l, s.r]).toEqual([1, 0]);
    s = barsStep(s, row, false, false, 0).s;
    s = barsStep(s, row, true, false, 0).s; // left again: wrong order
    expect([s.l, s.r]).toEqual([1, 0]);
    s = barsStep(s, row, false, false, 0).s;
    s = barsStep(s, row, false, true, 0).s; // right overtakes the left: rung 2
    expect([s.l, s.r]).toEqual([1, 2]);
  });
  it('the last rung: the hand still behind closes on it, then both hands are there and nothing is left to reach', () => {
    const last = row.n - 1;
    let s = start({ theta: 0.9, omega: 1, l: last - 1, r: last - 2, last: 2 });
    expect(nextHandOf(row, s)).toBe(1);
    s = barsStep(s, row, true, false, 0).s;
    expect([s.l, s.r]).toEqual([last, last - 2]); // the left overtakes onto the last rung
    s = { ...s, pl: false, pr: false, theta: 0.9, omega: 1 };
    expect(nextHandOf(row, s)).toBe(2); // the right is still behind, the left is at the end: the right goes
    s = barsStep(s, row, false, true, 0).s;
    expect([s.l, s.r]).toEqual([last, last]); // never beyond the end
    expect(nextHandOf(row, s)).toBeNull();
    expect(canReach(row, s, 1)).toEqual({ ok: false, why: 'end' });
    expect(canReach(row, s, 2)).toEqual({ ok: false, why: 'end' });
  });
  it('holding a reach key does not reach twice (a fresh press is needed)', () => {
    let s = start({ theta: 0.9, omega: 1 });
    for (let i = 0; i < 10; i++) s = barsStep(s, row, true, false, 0).s;
    expect(s.reaches).toBe(1);
  });
  it('both keys on one tick: neither hand reaches', () => {
    const { s, events } = barsStep(start({ theta: 0.9, omega: 1 }), row, true, true, 0);
    expect(s.reaches).toBe(0);
    expect(events[0]).toMatchObject({ type: 'bars-stall', why: 'both' });
  });
  it('the body is not thrown by a reach: it is carried over to the new pivot', () => {
    const s = start({ theta: 0.9, omega: 1 });
    const before = barsFeet(row, s);
    const { s: n } = barsStep(s, row, true, false, 0);
    const after = barsFeet(row, n);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.05);
  });
});

describe('monkey bars: a stall never falls', () => {
  const course: CourseData = JSON.parse(JSON.stringify({ version: 1, name: 't', startX: 0, finishX: 40, jumpSpeed: 4.5, terrain: { platforms: [{ x0: -5, x1: 8, top: 0 }, { x0: 20, x1: 40, top: 0 }], waterY: -3 }, bars: [row] }));
  const hanging = (): WorldState => {
    const w = newWorld(course, 0);
    const g = tryGrabBars([row], 10, 0.5, 0, 0, false)!;
    expect(g).not.toBeNull();
    const f = barsFeet(row, g);
    return { ...w, mode: 'bars', bars: g, runner: { ...w.runner, x: f.x, y: f.y, grounded: false } };
  };
  const hold = (extra: Partial<RunnerInput>): RunnerInput => ({ ...NO_INPUT, handL: true, handR: true, ...extra });
  for (const [name, f] of [
    ['no keys at all', () => hold({})],
    ['reach with no swing', (i: number) => hold({ reachL: i % 120 === 0, reachR: i % 120 === 60 })],
    ['wrong order, left again and again', (i: number) => hold({ reachL: i % 40 === 0 })],
    ['both keys together', (i: number) => hold({ reachL: i % 40 < 20, reachR: i % 40 < 20 })],
    ['a gap too wide for any swing the grip holds', () => hold({})],
  ] as [string, (i: number) => RunnerInput][]) {
    it(`stays on the bars: ${name}`, () => {
      const wide: CourseData = { ...course, bars: [{ ...row, gap: name.startsWith('a gap') ? 1.4 : row.gap }] };
      let w = hanging();
      for (let i = 0; i < 120 * 20; i++) { w = stepWorld(w, f(i), wide); if (w.mode !== 'bars') break; }
      expect(w.mode).toBe('bars');
      expect(w.outcome).toBe('running');
    });
  }
  it('after a stall the kip restarts the swing and the reaches go through', () => {
    let w = hanging();
    for (let i = 0; i < 120 * 30 && (w.bars?.l ?? 0) < 3; i++) {
      const b = w.bars!;
      const input = hold({ run: kip(b) > 0, left: kip(b) < 0, reachL: nextHand(b) === 1 && i % 2 === 0, reachR: nextHand(b) === 2 && i % 2 === 0 });
      w = stepWorld(w, input, course);
    }
    expect(w.bars!.l).toBeGreaterThanOrEqual(3);
  });
  it('letting go of E releases and flies on with the swing', () => {
    let w = hanging();
    w = { ...w, bars: { ...w.bars!, theta: 0.8, omega: 2 } };
    w = stepWorld(w, NO_INPUT, course);
    expect(w.mode).toBe('run');
    expect(w.runner.vx).toBeGreaterThan(0);
  });
});

describe('monkey bars: determinism and replay', () => {
  const course: CourseData = JSON.parse(JSON.stringify({ version: 1, name: 't', startX: 0, finishX: 40, jumpSpeed: 4.5, terrain: { platforms: [{ x0: -5, x1: 8, top: 0 }, { x0: 20, x1: 40, top: 0 }], waterY: -3 }, bars: [row] }));
  const keys = (i: number, b: BarsHang): RunnerInput => ({ ...NO_INPUT, handL: true, handR: true, run: kip(b) > 0, left: kip(b) < 0, reachL: nextHand(b) === 1 && i % 2 === 0, reachR: nextHand(b) === 2 && i % 2 === 0 });
  const play = (feed?: RunnerInput[]) => {
    let w = newWorld(course, 0);
    const g = tryGrabBars([row], 10, 0.5, 0, 0, false)!, f = barsFeet(row, g);
    w = { ...w, mode: 'bars', bars: g, runner: { ...w.runner, x: f.x, y: f.y, grounded: false } };
    const log: RunnerInput[] = [];
    for (let i = 0; i < 120 * 8; i++) { const inp = feed ? feed[i] : keys(i, w.bars ?? g); log.push(inp); w = stepWorld(w, inp, course); }
    return { w, log };
  };
  it('the same keys give the same state, bit for bit', () => {
    const a = play(), b = play();
    expect(JSON.stringify(a.w)).toBe(JSON.stringify(b.w));
  });
  it('keys packed into the replay mask and played again end where the live run ended', () => {
    const live = play();
    const again = play(live.log.map((i) => inputOfMask(maskOf(i))));
    expect(JSON.stringify(again.w)).toBe(JSON.stringify(live.w));
    expect(live.w.bars?.reaches).toBeGreaterThan(0);
  });
  it('the reach keys are two new mask bits above the old ones', () => {
    expect(maskOf({ ...NO_INPUT, reachL: true })).toBe(1 << 13);
    expect(maskOf({ ...NO_INPUT, reachR: true })).toBe(1 << 14);
    expect(maskOf({ ...NO_INPUT, slide: true })).toBe(1 << 12);
  });
});

describe('from a bar to the monkey bars', () => {
  // bar A at x 6, the first rung of the row 2.4 m on: swing on A with the arrows, release at tick T, hold E again in the air.
  const c = { version: 1, name: 't', startX: 0, finishX: 40, jumpSpeed: 4.5, terrain: { platforms: [{ x0: -5, x1: 4, top: 0 }, { x0: 22, x1: 40, top: 0 }], waterY: -3 }, holds: [{ x: 6, y: 2.6 }], bars: [{ x: 8.4, y: 2.6, n: 6, gap: 0.6 }] } as CourseData;
  const tryRelease = (T: number): WorldState => {
    let w = newWorld(c, 0);
    w = { ...w, mode: 'hang', hang: { hold: 0, theta: 0, omega: 0.3 }, runner: { ...w.runner, x: 6, y: 0.5, grounded: false } };
    for (let i = 0; i < T + 240; i++) {
      const e = i < T || i > T + 2; // E held, let go for two ticks at T, held again
      const h = w.hang;
      const input: RunnerInput = { ...NO_INPUT, handL: e, handR: e, run: !!h && h.omega >= 0 && i < T, left: !!h && h.omega < 0 && i < T };
      w = stepWorld(w, input, c);
      if (w.mode === 'bars' || w.outcome !== 'running') break;
    }
    return w;
  };
  it('some release of the swing on the single bar puts the hands on the first rung of the row', () => {
    const got: number[] = [];
    for (let T = 60; T < 600; T += 3) if (tryRelease(T).mode === 'bars') got.push(T);
    expect(got.length).toBeGreaterThan(0);
    const w = tryRelease(got[0]);
    expect(rungX(c.bars![0], w.bars!.l)).toBe(8.4 + w.bars!.l * 0.6);
    expect(w.bars!.l).toBeLessThanOrEqual(1); // it catches the first rung or the one beside it, never the far end
  });
  it('a release too early (the body lands short) does not grab and does not break anything', () => {
    expect(tryRelease(5).mode).not.toBe('bars');
  });
});
