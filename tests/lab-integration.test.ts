import { describe, expect, it } from "vitest";
import { DEFAULT_CART, cartStep, makeRails } from "../src/sim/cart";
import { DT } from "../src/sim/units";
import { BOWL_PTS, BOWL_START, bowlRails, clampCfg, divergence, firstApart, makeStepper, measuredOrder, runBowl, runLab } from "../src/labs/integration/engine";

// Lab 6: the player picks the stepping rule and the step size; the equations and rails are the game's. These are laws about the algorithms.
describe("Lab 6: numerical integration", () => {
  it("RK4 at 1/120 s is the game's cart step, bit for bit", () => {
    const rails = makeRails([[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]]);
    const mine = makeStepper(rails, "rk4", DT, DEFAULT_CART, false);
    const brake = makeStepper(rails, "rk4", DT, DEFAULT_CART, true);
    let a = { x: 0, v: 1.5 }, b = { x: 0, v: 1.5 }, c = { x: 0, v: 1.5 }, d = { x: 0, v: 1.5 };
    for (let i = 0; i < 600; i++) {
      a = cartStep(rails, a.x, a.v, false); b = mine(b.x, b.v);
      c = cartStep(rails, c.x, c.v, true); d = brake(d.x, d.v);
      expect(b).toEqual(a);
      expect(d).toEqual(c);
    }
  });
  it("energy is the check: RK4 at a fine step keeps it, explicit Euler gains it", () => {
    expect(runBowl("rk4", 240, 120).maxDrift).toBeLessThan(1e-6);
    const e = runBowl("euler", 120, 30);
    expect(e.leftTrackAt !== null || e.maxDrift > 0.01).toBe(true);
    expect(e.maxDrift).toBeGreaterThan(runBowl("rk4", 120, 30).maxDrift * 1e4);
  });
  it("semi-implicit Euler costs the same as Euler but creeps far slower; on this rail it still creeps (the rail's slope is in the position update, so it is not a perfect swing)", () => {
    const e = runBowl("euler", 240, 90), s = runBowl("semi", 240, 90);
    expect(s.maxDrift).toBeLessThan(e.maxDrift / 3);
    const t = runBowl("semi", 240, 600);
    expect(t.leftTrackAt).toBeNull();
    expect(t.maxDrift).toBeLessThan(0.05);
    expect(t.finalDrift).toBeGreaterThan(0.01); // a slow rise, not zero
    expect(runBowl("rk4", 240, 600).maxDrift).toBeLessThan(1e-6);
  });
  it("measured order of accuracy: Euler and semi-implicit about 1, RK4 about 4", () => {
    expect(measuredOrder("euler", 240).order).toBeGreaterThan(0.9);
    expect(measuredOrder("euler", 240).order).toBeLessThan(1.2);
    expect(measuredOrder("semi", 240).order).toBeGreaterThan(0.9);
    expect(measuredOrder("semi", 240).order).toBeLessThan(1.2);
    const rk = measuredOrder("rk4", 30).order!;
    expect(rk).toBeGreaterThan(3.5);
    expect(rk).toBeLessThan(4.6);
  });
  it("a smaller step drifts less, for every rule", () => {
    for (const m of ["euler", "semi", "rk4"] as const) expect(runBowl(m, 480, 20).maxDrift).toBeLessThan(runBowl(m, 60, 20).maxDrift);
  });
  it("the same choices give the same hash twice; the game's setting reproduces the recording", () => {
    const a = runBowl("semi", 60, 60), b = runBowl("semi", 60, 60);
    expect(a.hash).toBe(b.hash);
    const r = runLab({ method: "rk4", stepsPerSecond: 120, seconds: 60 });
    expect(r.replays[1].equal).toBe(true);
    expect(r.replays[0].equal).toBe(true);
    expect(r.replays[1].apartAt).toBeNull();
    expect(r.replays[1].endGap).toBe(0);
  });
  it("any other step or rule gives a different hash from the recording, even a finer RK4", () => {
    for (const [m, s] of [["rk4", 240], ["rk4", 60], ["semi", 120], ["euler", 120]] as const) {
      const r = runLab({ method: m, stepsPerSecond: s, seconds: 60 });
      expect(r.replays[1].equal).toBe(false);
    }
  });
  it("a run that leaves the rails stops and says when", () => {
    const t = runBowl("euler", 10, 60);
    expect(t.leftTrackAt).not.toBeNull();
    expect(t.leftTrackAt!).toBeLessThan(60);
    expect(t.xs.length).toBeLessThanOrEqual(Math.ceil(t.leftTrackAt!) + 1);
  });
  it("divergence and first-apart are about metres and one millimetre", () => {
    const a = runBowl("rk4", 120, 30), b = runBowl("euler", 120, 30);
    const d = divergence(a, b);
    expect(d[0].d).toBe(0);
    expect(firstApart(divergence(a, a))).toBeNull();
    expect(firstApart(d)).not.toBeNull();
  });
  it("the bowl keeps the start under both rims and the options are clamped to the menus", () => {
    const rails = bowlRails();
    expect(rails.y(BOWL_START.x)).toBeLessThan(Math.min(BOWL_PTS[0][1], BOWL_PTS[BOWL_PTS.length - 1][1]));
    expect(clampCfg({ method: "nope" as never, stepsPerSecond: 119, seconds: 299 })).toEqual({ method: "euler", stepsPerSecond: 120, seconds: 300 });
  });
});
