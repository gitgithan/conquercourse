import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import {
  CLEAN, COURSES, GRIDS, LEVELS, NO_PINS, compare, fewestPins, fmaExample, frameHash, hashStrip, judge, keyOrder, levels, pinCount, recordKeys, runMachine, snapOf, sumOrders, traceOfPlan,
  type Machine, type Pins,
} from "../src/labs/determinism/determinism-core";
import { newWorld } from "../src/sim/world";

// Lab 19 (same run, any machine): physics-law style checks first (the simulated habits do what real machines do), then the real recorded traces and the challenge.
const golden = JSON.parse(readFileSync("tests/golden/sim-trace.json", "utf8")) as Record<string, string>;
const load = (file: string): CourseData => JSON.parse(readFileSync(`public/assets/demo/${file}`, "utf8"));
const plank = load("plank.course.json");
const keys = recordKeys(plank);
const M = (o: Partial<Machine>): Machine => ({ ...CLEAN, ...o });
const ALL: Pins = { fixed: true, ordered: true, grid: 0.01 };

describe("Lab 19: same run, any machine", () => {
  it("a machine with no habits is the game's own simulator: the same run twice gives the same hash on every frame", () => {
    const a = runMachine(plank, keys, CLEAN, true), b = runMachine(plank, keys, CLEAN, true);
    expect(hashStrip(a, CLEAN, NO_PINS)).toEqual(hashStrip(b, CLEAN, NO_PINS));
    expect(a.outcome).toBe("cleared");
    expect(a.ticks).toBe(709);
  });
  it("the stored trace is reproduced: ticks and hash of the plank plan equal tests/golden/sim-trace.json", () => {
    expect(traceOfPlan(plank)).toBe(golden["plan plank.course.json"]);
  });
  it("every course in the picker matches its stored trace", () => {
    for (const c of COURSES) expect(traceOfPlan(load(c.file)), c.id).toBe(golden[c.planKey]);
  });
  it("fused multiply-add: two roundings lose the tiny part, one rounding keeps it (exactly -e^2)", () => {
    const f = fmaExample(30);
    expect(f.e).toBe(2 ** -30);
    expect(f.unfused).toBe(0);
    expect(f.fused).toBe(-(2 ** -60));
    const near = fmaExample(20); // e^2 = 2^-40 is above the gap of 2^-53, so even two roundings see it
    expect(near.unfused).toBeCloseTo(near.fused, 12);
    expect(near.unfused).not.toBe(0);
  });
  it("adding in another order changes the last digits but not the first ones", () => {
    const xs = Array.from({ length: 200 }, (_, i) => runMachine(plank, keys, CLEAN, true).snaps[i + 1].vx);
    const s = sumOrders(xs);
    expect(new Set([s.forward, s.backward, s.sorted, s.pairs]).size).toBeGreaterThan(1);
    for (const v of [s.backward, s.sorted, s.pairs]) expect(Math.abs(v - s.forward)).toBeLessThan(1e-9 * Math.max(1, Math.abs(s.forward)));
  });
  it("the walk order of a map changes the hash of the very same state; sorting the names makes it the same again", () => {
    const s = snapOf(newWorld(plank)), m2 = M({ order: "shuffled", seed: 2 });
    expect(frameHash(s, m2, NO_PINS)).not.toBe(frameHash(s, CLEAN, NO_PINS));
    const pinned: Pins = { ...NO_PINS, ordered: true };
    expect(frameHash(s, m2, pinned)).toBe(frameHash(s, CLEAN, pinned));
    expect(keyOrder(["b", "a", "c"], m2, pinned)).toEqual(["a", "b", "c"]);
    expect([...keyOrder(["b", "a", "c", "d", "e"], m2, NO_PINS)].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("a last-digit habit: the real numbers stay within 1e-9, yet the strict fingerprint differs on almost every frame", () => {
    const m = M({ rounding: "fused", seed: 2 });
    const a = runMachine(plank, keys, CLEAN, true), b = runMachine(plank, keys, m, true);
    const c = compare({ raw: a, hashes: hashStrip(a, CLEAN, NO_PINS) }, { raw: b, hashes: hashStrip(b, m, NO_PINS) });
    expect(c.peak).toBeGreaterThan(0);
    expect(c.peak).toBeLessThan(1e-9);
    expect(c.mismatches).toBeGreaterThan(300);
    expect(c.sameOutcome).toBe(true);
    expect(levels(c).map((l) => l.ok)).toEqual([true, true, true, false]); // levels 1 to 3 hold, exact bits do not
  });
  it("rounding the hashed numbers to a grid hides a last-digit habit; a finer grid than the habit does not", () => {
    const m = M({ rounding: "fused", seed: 2 });
    const a = runMachine(plank, keys, CLEAN, true), b = runMachine(plank, keys, m, true);
    const miss = (g: number | null) => { const p: Pins = { ...NO_PINS, grid: g }; return compare({ raw: a, hashes: hashStrip(a, CLEAN, p) }, { raw: b, hashes: hashStrip(b, m, p) }).mismatches; };
    expect(miss(1e-6)).toBe(0);
    expect(miss(1e-9)).toBe(0);
    expect(miss(null)).toBeGreaterThan(300);
  });
  it("32-bit numbers are a bigger habit: a fine grid still sees them (a boundary flip), a coarse grid hides them", () => {
    const m = M({ rounding: "single" });
    const a = runMachine(plank, keys, CLEAN, true), b = runMachine(plank, keys, m, true);
    const miss = (g: number) => { const p: Pins = { ...NO_PINS, grid: g }; return compare({ raw: a, hashes: hashStrip(a, CLEAN, p) }, { raw: b, hashes: hashStrip(b, m, p) }).mismatches; };
    expect(miss(1e-9)).toBeGreaterThan(600);
    expect(miss(1e-3)).toBeGreaterThan(0);
    expect(miss(1e-2)).toBe(0);
  });
  it("a frame clock that runs late reads later keys; a fixed step ignores it", () => {
    const late = M({ drift: 0.004 });
    const free = runMachine(plank, keys, late, false), fixed = runMachine(plank, keys, late, true), clean = runMachine(plank, keys, CLEAN, true);
    const strip = (r: typeof clean, m: Machine) => hashStrip(r, m, NO_PINS);
    expect(strip(free, late)).not.toEqual(strip(clean, CLEAN));
    expect(strip(fixed, late)).toEqual(strip(clean, CLEAN));
  });
  it("a late clock can change what happens, not only the digits: on the drop course the late machine does not finish", () => {
    const drop = load("drop.course.json"), dk = recordKeys(drop), late = M({ drift: 0.004 });
    const free = runMachine(drop, dk, late, false), ref = runMachine(drop, dk, CLEAN, true);
    expect(ref.outcome).toBe("cleared");
    expect(free.outcome).not.toBe(ref.outcome);
  });
  it("is deterministic: the same machine gives the same strip twice, whatever the seed's order of use", () => {
    const m = M({ rounding: "fused", order: "shuffled", seed: 5, drift: 0.002 });
    expect(hashStrip(runMachine(plank, keys, m, false), m, NO_PINS)).toEqual(hashStrip(runMachine(plank, keys, m, false), m, NO_PINS));
  });
  it("the four levels are nested: exact bits imply close enough imply same end imply same outcome", () => {
    for (const m of [CLEAN, M({ rounding: "fused", seed: 2 }), M({ rounding: "single" })]) {
      const a = runMachine(plank, keys, CLEAN, true), b = runMachine(plank, keys, m, true);
      const ok = levels(compare({ raw: a, hashes: hashStrip(a, CLEAN, NO_PINS) }, { raw: b, hashes: hashStrip(b, m, NO_PINS) })).map((l) => l.ok);
      for (let i = 3; i > 0; i--) if (ok[i]) expect(ok[i - 1]).toBe(true);
    }
  });
  it("challenge: with no pins no level agrees; with every pin every level agrees (all frames, same outcome)", () => {
    for (const L of LEVELS) {
      expect(judge(L.machines.map((m) => runMachine(plank, keys, m, false)), L.machines, NO_PINS).allAgree, `level ${L.id} no pins`).toBe(false);
      expect(judge(L.machines.map((m) => runMachine(plank, keys, m, true)), L.machines, ALL).allAgree, `level ${L.id} all pins`).toBe(true);
    }
  });
  it("challenge: the fewest pins are 1, 2 and 3, found by trying every pin set and grid", () => {
    expect(LEVELS.map((L) => fewestPins(plank, keys, L)?.fewest)).toEqual([1, 2, 3]);
    const l1 = fewestPins(plank, keys, LEVELS[0])!;
    expect(l1.sets).toEqual([{ fixed: false, ordered: true, grid: null }]);
    const l3 = fewestPins(plank, keys, LEVELS[2])!;
    for (const s of l3.sets) { expect(s.fixed && s.ordered && s.grid !== null).toBe(true); expect(pinCount(s)).toBe(3); }
  });
  it("challenge: no single pin is enough for level 3, and a grid alone never fixes a walk order", () => {
    const L = LEVELS[2];
    for (const p of [{ fixed: true, ordered: false, grid: null }, { fixed: false, ordered: true, grid: null }, ...GRIDS.map((g) => ({ fixed: false, ordered: false, grid: g }))] as Pins[]) {
      expect(judge(L.machines.map((m) => runMachine(plank, keys, m, p.fixed)), L.machines, p).allAgree).toBe(false);
    }
  });
  it("the runs agree on the outcome whenever the clock is fixed", () => {
    for (const L of LEVELS) for (const m of L.machines) expect(runMachine(plank, keys, m, true).outcome).toBe("cleared");
  });
});
