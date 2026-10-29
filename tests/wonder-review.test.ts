import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { playImperfect, playPlan } from "../src/sim/ideal";
import { DT } from "../src/sim/units";
import { DEFAULT_HANG, feetOf, releaseHang } from "../src/sim/holds";
import { DEFAULT_ROPE, tryCatch } from "../src/sim/rope";
import { findVault } from "../src/sim/vault";
import type { CourseData } from "../src/course/course";
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from "../src/sim/runner";
import { newWorld, stepWorld, wallPath, MANTLE_RUN } from "../src/sim/world";
import { runWall } from "../src/sim/wall";
import { standingOn } from "../src/sim/terrain";

// CC-133: each test is one claim from the Muse Wonder review of src/sim (data/eval/cc-wonder-review/).
// A test that FAILS here is a real bug (the file is marked "claim" and is fixed or listed); a test that passes is a false alarm.
const course = (over: Partial<CourseData> = {}): CourseData => ({ version: 1, name: "t", startX: 0, finishX: 1000, jumpSpeed: 5, terrain: { platforms: [{ x0: -50, x1: 500, top: 0 }], waterY: -20 }, ...over } as CourseData);
const RUN = { ...NO_INPUT, run: true };

describe("wonder review: chunk a (body and world)", () => {
  it("claim 2: after a failed wall the runner stands where the ground is (the y is read where the x is)", () => {
    // a 0.4 m step in the ground between x0-1 and x0-0.5: the runner is put at x0-0.5, so its y must be the ground at x0-0.5
    const c = course({ wall: { x0: 10, height: 4.3 }, terrain: { platforms: [{ x0: -50, x1: 9.2, top: 0 }, { x0: 9.2, x1: 500, top: 0.4 }], waterY: -20 } });
    let w = newWorld(c, 9.5);
    w = { ...w, runner: { ...w.runner, vx: 3, y: 0.4 } };
    for (let i = 0; i < 2000 && w.events.every((e) => e.type !== "wall-slide"); i++) w = stepWorld(w, i < 5 ? RUN : NO_INPUT, c);
    expect(w.events.some((e) => e.type === "wall-slide")).toBe(true);
    expect(w.runner.x).toBeCloseTo(9.5, 6);
    expect(w.runner.y).toBeCloseTo(standingOn(c.terrain, w.runner.x)!.top, 6);
  });
  it("claim 6: no grip and standing still keeps x a number", () => {
    const s = step(startState(0), NO_INPUT, { ...DEFAULT_PARAMS, grip: 0 });
    expect(Number.isFinite(s.x)).toBe(true);
  });
  it("claim 7 (kept on purpose, src/modes/course.ts sounds an events array once): a step after the run keeps the last events", () => {
    const c = course({ finishX: 3 });
    let w = newWorld(c, 0);
    for (let i = 0; i < 2000 && w.outcome === "running"; i++) w = stepWorld(w, RUN, c);
    expect(w.outcome).toBe("cleared");
    expect(w.events.some((e) => e.type === "cleared")).toBe(true);
    const after = stepWorld(w, RUN, c);
    expect(after.events).toBe(w.events);
  });
  it.skip("claim 1 (unclear: no shipped course sets a radius, and where its deck stands is the course author's call): the mantle ends at the wall curve radius, not the wall height (radius 2, height 5)", () => {
    const wp = { height: 5, radius: 2, hipHeight: 1, reach: 1.3, loss: 0.1, gravity: 9.81 };
    const res = runWall(9, wp);
    expect(res.grabbed).toBe(true);
    const path = wallPath(res, 0, wp.height);
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(wp.radius + MANTLE_RUN, 6);
  });
  it.fails("claim 4: a jump pressed on the trampoline touchdown tick counts as an early press", () => {
    const c = course({ terrain: { platforms: [{ x0: -50, x1: 4, top: 0 }, { x0: 4, x1: 12, top: 0, bouncy: true }], waterY: -20 } });
    const run = (pressAt: number) => {
      let w = newWorld(c, 3);
      w = { ...w, runner: { ...w.runner, grounded: false, y: 1.5, vx: 3, vy: 0 } };
      let landTick = -1;
      for (let i = 0; i < 400; i++) {
        const landing = w.runner.y <= 0.03 && w.mode === "run";
        void landing;
        const next = stepWorld(w, i === pressAt ? { ...NO_INPUT, jump: true } : NO_INPUT, c);
        if (next.mode === "bounce" && w.mode !== "bounce") { landTick = i; w = next; break; }
        w = next;
      }
      return { w, landTick };
    };
    const probe = run(-1);
    expect(probe.landTick).toBeGreaterThan(0);
    const pressed = run(probe.landTick);
    expect(pressed.w.bed?.press).toBe(0);
  });
  it.fails("claim 3: a stumble that comes due while the runner is in another mode still counts on that tick", () => {
    const c = course({ wall: { x0: 10, height: 4.3 } });
    let w = newWorld(c, 8);
    w = { ...w, runner: { ...w.runner, vx: 6 } };
    for (let i = 0; i < 400 && w.mode !== "wall"; i++) w = stepWorld(w, RUN, c);
    expect(w.mode).toBe("wall");
    const t = w.runner.tick;
    w = { ...w, landGrace: { until: t + 1, landTick: t, before: w.runner, input: NO_INPUT, impact: 6, peakDecel: 70, squat: false, hurt: false, stumbled: true } };
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) { w = stepWorld(w, NO_INPUT, c); seen.push(...w.events.map((e) => e.type)); }
    expect(seen).toContain("stumble");
    expect(w.landGrace).toBeNull();
  });
  it.fails("claim 0: ground beyond the wall foot at the same height does not start the wall again", () => {
    const c = course({ wall: { x0: 10, height: 4.3 } });
    let w = newWorld(c, 20);
    w = { ...w, runner: { ...w.runner, vx: 6 } };
    for (let i = 0; i < 10; i++) w = stepWorld(w, RUN, c);
    expect(w.mode).toBe("run");
  });
});

// it.fails = a real bug found by the review and not fixed yet (CC-140); the test states the right behaviour and passes while the bug stands.
describe("wonder review: chunk c (search and replay)", () => {
  const training = JSON.parse(readFileSync("public/assets/demo/training.course.json", "utf8")) as CourseData;
  it.fails("claim c3: the Training course trampoline press is tuned (the search only tunes edges between 117 m and 119 m)", () => {
    const ticks = (bp: number) => playPlan(training, { ...training.plan!, bouncePress: bp }).world.runner.tick;
    const best = Math.min(...[0, 2, 4, 6, 8, 10, 14].map(ticks));
    expect(ticks(training.plan!.bouncePress)).toBe(best);
  });
  it.fails("claim c1: a perfect imperfect-player (sigma 0) takes exactly the plan time, with no restart second after the clear", () => {
    const t = playPlan(training, training.plan!).world.runner.tick * DT;
    expect(playImperfect(training, training.plan!, 1, 0)).toBeCloseTo(t, 6);
  });
  it.fails("claim c0: with sigma 0 the imperfect player clears the Training course (it drops hands, hangTicks, vaultXs and climbXs from the plan)", () => {
    expect(playImperfect(training, training.plan!, 1, 0)).not.toBeNull();
  });
});

describe("wonder review: chunk b (moves)", () => {
  it.fails("claim b1: letting go in the first 8 ticks after a grab keeps the feet where the screen showed them", () => {
    const h = { x: 0, y: 10 };
    const s = { hold: 0, theta: 0, omega: 1, ox: 0.6, oy: 0.48, et: 8 };
    const shown = feetOf(h, s, DEFAULT_HANG), freed = releaseHang(h, s, DEFAULT_HANG);
    expect(freed.x).toBeCloseTo(shown.x, 6);
    expect(freed.y).toBeCloseTo(shown.y, 6);
  });
  it.fails("claim b0: hands exactly on the rope anchor give a finite swing speed (or no catch)", () => {
    const p = DEFAULT_ROPE;
    const c = tryCatch(p, p.anchorX, p.anchorY - p.handHeight, 1, 0, 0);
    expect(c === null || Number.isFinite(c.omega)).toBe(true);
  });
  it.fails("claim b4: a vault never lands past the far edge of a very short top", () => {
    const t = { platforms: [{ x0: -10, x1: 3, top: 0 }, { x0: 3, x1: 3.1, top: 0.6 }], waterY: -20 };
    const v = findVault(t, 1.2, 0, 7);
    expect(v).not.toBeNull();
    expect(v!.x1).toBeLessThanOrEqual(3.1 + 1e-9);
  });
  it("claim b2 (false alarm in the game): a pump press is recorded only while the feet are on the bed, so a late press cannot reach bounce()", () => {
    const src = readFileSync("src/sim/world.ts", "utf8");
    expect(src).toMatch(/if \(k >= bed\.base\.ticksOnBed\) \{\s*\n\s*const out = bounce\(bed\.vIn, DEFAULT_TRAMPOLINE, press\)/);
  });
});
