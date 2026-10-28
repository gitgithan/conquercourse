import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../src/sim/units';
import { MATERIALS, RIDER_MASS, fixPlank, plankHolds, sagAt, secondMoment, spanOf, stressRatio, worstCase, type PlankData } from '../src/sim/beam';

// A plank laid across a gap: physics-law tests first.
const plank = (o: Partial<PlankData> = {}): PlankData => ({ x0: 0, x1: 4, y: 0, thickness: 0.02, width: 0.6, material: 'wood', ...o });
const noWeight = (pk: PlankData): PlankData => pk; // the own-weight sag is tiny for these planks; the tests allow for it below
const mid = (pk: PlankData) => spanOf(pk) / 2;
const F = RIDER_MASS * GRAVITY;

describe('beam: the sag under a rider in the middle', () => {
  it('the rider\'s part matches F L^3 / (48 E I) within half a percent', () => {
    const pk = plank();
    const want = (F * spanOf(pk) ** 3) / (48 * MATERIALS.wood.E * secondMoment(pk));
    const got = sagAt(pk, mid(pk), mid(pk)) - sagAt(pk, -1, mid(pk)); // with the rider, minus the plank\'s own weight alone
    expect(got / want).toBeGreaterThan(0.995);
    expect(got / want).toBeLessThan(1.005);
  });

  it('the plank\'s own weight sags it by 5 q L^4 / (384 E I) when nobody is on it', () => {
    const pk = plank();
    const q = pk.width * pk.thickness * MATERIALS.wood.density * GRAVITY;
    const want = (5 * q * spanOf(pk) ** 4) / (384 * MATERIALS.wood.E * secondMoment(pk));
    expect(sagAt(pk, -1, mid(pk)) / want).toBeGreaterThan(0.995);
    expect(sagAt(pk, -1, mid(pk)) / want).toBeLessThan(1.005);
  });

  it('doubling the span makes the sag about eight times bigger (within 2 percent of the rider\'s part)', () => {
    const a = plank({ x1: 3 }), b = plank({ x1: 6 });
    const own = (pk: PlankData) => sagAt(pk, -1, mid(pk)); // nobody on it
    const sa = sagAt(a, mid(a), mid(a)) - own(a), sb = sagAt(b, mid(b), mid(b)) - own(b);
    expect(sb / sa).toBeGreaterThan(8 * 0.98);
    expect(sb / sa).toBeLessThan(8 * 1.02);
    void noWeight;
  });

  it('a plank twice as thick sags one eighth as much', () => {
    const a = plank({ thickness: 0.02 }), b = plank({ thickness: 0.04 });
    const own = (pk: PlankData) => sagAt(pk, -1, mid(pk));
    const sa = sagAt(a, mid(a), mid(a)) - own(a), sb = sagAt(b, mid(b), mid(b)) - own(b);
    expect(sa / sb).toBeGreaterThan(8 * 0.98);
    expect(sa / sb).toBeLessThan(8 * 1.02);
  });

  it('steel is about 22 times stiffer than pine, so it sags about 1/22 as much', () => {
    const w = plank(), s = plank({ material: 'steel' });
    const own = (pk: PlankData) => sagAt(pk, -1, mid(pk));
    const ratio = (sagAt(w, mid(w), mid(w)) - own(w)) / (sagAt(s, mid(s), mid(s)) - own(s));
    expect(ratio).toBeGreaterThan((200 / 9) * 0.98);
    expect(ratio).toBeLessThan((200 / 9) * 1.02);
  });

  it('a post in the middle cuts the sag a lot (each half is a plank of half the span: one eighth)', () => {
    const open = plank(), posted = plank({ support: true });
    const a = mid(open) / 2; // the rider stands in the middle of a half
    const own = (pk: PlankData, x: number) => sagAt(pk, -1, x);
    const sOpen = sagAt(open, mid(open), mid(open)) - own(open, mid(open));
    const sPost = sagAt(posted, a, a) - own(posted, a);
    expect(sOpen / sPost).toBeGreaterThan(8 * 0.98);
    expect(sOpen / sPost).toBeLessThan(8 * 1.02);
  });

  it('the load sits where the sag is: the sag is biggest under a rider in the middle and zero at the ends', () => {
    const pk = plank();
    const s = [0, 0.5, 1, 2, 3, 3.5, 4].map((a) => sagAt(pk, a, a));
    expect(s[0]).toBeCloseTo(0, 9);
    expect(s[6]).toBeCloseTo(0, 9);
    expect(s[3]).toBeGreaterThan(s[2]);
    expect(s[3]).toBeGreaterThan(s[4]);
  });
});

describe('beam: where it breaks', () => {
  it('stress in the middle is 3 F L / (2 w h^2): the ratio to the strength passes 1 at h = sqrt(3 F L / (2 w strength))', () => {
    const base = plank();
    const hBreak = Math.sqrt((3 * F * spanOf(base)) / (2 * base.width * MATERIALS.wood.strength));
    expect(stressRatio({ ...base, thickness: hBreak * 1.1 }, mid(base))).toBeLessThan(1); // the plank\'s own weight adds a few percent, so the margin is 10 percent
    expect(stressRatio({ ...base, thickness: hBreak * 0.97 }, mid(base))).toBeGreaterThan(1);
  });

  it('a thin plank breaks and a thicker one holds; a plank breaks first under a rider in the middle', () => {
    expect(plankHolds(plank({ thickness: 0.012 }))).toBe(false);
    expect(plankHolds(plank({ thickness: 0.02 }))).toBe(true);
    expect(worstCase(plank({ thickness: 0.012 })).at).toBeCloseTo(2, 1);
  });

  it('a longer span breaks a plank that held (the stress grows with the span)', () => {
    expect(plankHolds(plank({ x1: 4 }))).toBe(true);
    expect(plankHolds(plank({ x1: 8 }))).toBe(false);
  });

  it('a post in the middle lets a long plank hold', () => {
    expect(plankHolds(plank({ x1: 8 }))).toBe(false);
    expect(plankHolds(plank({ x1: 8, support: true }))).toBe(true);
  });

  it('steel holds where pine breaks (8 m, 2 cm thick)', () => {
    expect(plankHolds(plank({ x1: 8, thickness: 0.02 }))).toBe(false);
    expect(plankHolds(plank({ x1: 8, thickness: 0.02, material: 'steel' }))).toBe(true);
  });

  it('a thin steel plate over a long span breaks under its own weight, before anyone steps on it', () => {
    expect(stressRatio(plank({ x1: 8, thickness: 0.012, material: 'steel' }), -1)).toBeGreaterThan(1);
  });
});

describe('beam: Fix it', () => {
  it('offers the smallest change that holds with a margin', () => {
    const bad = plank({ thickness: 0.012 });
    const f = fixPlank(bad);
    expect(f.ok).toBe(true);
    expect(f.steps.length).toBe(1);
    expect(worstCase(f.plank).ratio).toBeLessThanOrEqual(0.8);
  });
  it('leaves a safe plank alone', () => {
    const f = fixPlank(plank({ thickness: 0.03 }));
    expect(f.steps).toEqual([]);
  });
  it('says so when nothing thin enough can hold', () => {
    const f = fixPlank(plank({ x1: 40, thickness: 0.005 }));
    expect(f.ok).toBe(false);
  });
});

import { EXPERIMENTS, classify, defaults } from "../src/sim/experiments";
import { LESSONS } from "../src/modes/lessons";
import { diagram } from "../src/modes/diagrams";

describe("Dojo: the bridge lesson", () => {
  const bridge = EXPERIMENTS.find((e) => e.id === "bridge")!;
  const sweep = (knob: string, from: number, to: number, n = 10) => {
    const d = defaults(bridge);
    return Array.from({ length: n }, (_, i) => { const x = from + ((to - from) * i) / (n - 1); return { x, y: bridge.run({ ...d, [knob]: x }).answer }; });
  };
  it("the sweep over the span is a cube curve and over the thickness an inverse cube curve", () => {
    expect(classify(sweep("span", 2, 8)).shape).toBe("cube");
    expect(classify(sweep("thickness", 1.5, 6)).shape).toBe("inverse-cube");
  });
  it("twice the span gives eight times the sag, a post cuts it, and it says when the plank would snap", () => {
    const d = defaults(bridge);
    const a = bridge.run({ ...d, span: 3 }).answer, b = bridge.run({ ...d, span: 6 }).answer;
    expect(b / a).toBeGreaterThan(8 * 0.98);
    expect(b / a).toBeLessThan(8 * 1.02);
    expect(bridge.run({ ...d, span: 6, post: 1 }).answer).toBeLessThan(b / 7);
    expect(bridge.run({ ...d, span: 8, thickness: 1 }).note).toMatch(/snap/);
  });
  it("has a lesson and both diagrams, and the formula page gives the same number as the experiment", () => {
    const L = LESSONS.bridge;
    expect(L.inputs).toEqual(["span", "thickness"]);
    expect(diagram("bridge", "real")).toContain("<svg");
    expect(diagram("bridge", "principle")).toContain("<svg");
    const d = defaults(bridge);
    const c = L.calc({ span: d.span, thickness: d.thickness });
    expect(c.value / bridge.run(d).answer).toBeGreaterThan(0.99);
    expect(c.value / bridge.run(d).answer).toBeLessThan(1.01);
  });
});
