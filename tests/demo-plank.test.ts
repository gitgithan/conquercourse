import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { sagAt } from "../src/sim/beam";
import { searchIdealRun, playPlan } from "../src/sim/ideal";
import { NO_INPUT } from "../src/sim/runner";
import { newWorld, stepWorld, type WorldState } from "../src/sim/world";
import { loadDemo as load } from './helpers/course';

const good = load("plank.course.json"), thin = load("plank-thin.course.json");

function run(course: CourseData, ticks: number, input = { ...NO_INPUT, run: true }, from?: WorldState) {
  let w = from ?? newWorld(course);
  const events: string[] = [];
  let minY = Infinity, minVx = Infinity, modes = new Set<string>();
  for (let i = 0; i < ticks && w.outcome === "running"; i++) {
    w = stepWorld(w, input, course);
    for (const e of w.events) events.push(e.type);
    if (w.mode === "plank") { minY = Math.min(minY, w.runner.y); minVx = Math.min(minVx, w.runner.vx); }
    modes.add(w.mode);
  }
  return { w, events, minY, minVx, modes };
}

describe("plank bridge in the world", () => {
  it("running onto a plank hands the runner to it, the plank dips under the feet and the runner crosses", () => {
    const r = run(good, 120 * 30);
    expect(r.modes.has("plank")).toBe(true);
    expect(r.events).toContain("plank-sag");
    expect(r.events).not.toContain("plank-break");
    expect(r.minY).toBeLessThan(-0.15); // the feet go down with the plank
    expect(r.minY).toBeGreaterThan(-1.5);
    expect(r.w.outcome).toBe("cleared");
  });

  it("the dip follows the beam: the feet are where the sag formula says at the middle", () => {
    const pk = good.planks![0];
    let w = newWorld(good);
    let atMid = NaN;
    for (let i = 0; i < 120 * 30 && w.outcome === "running"; i++) {
      w = stepWorld(w, { ...NO_INPUT, run: true }, good);
      if (w.mode === "plank" && Math.abs(w.runner.x - (pk.x0 + pk.x1) / 2) < 0.03) atMid = w.runner.y;
    }
    expect(atMid).toBeCloseTo(pk.y - sagAt(pk, (pk.x1 - pk.x0) / 2, (pk.x1 - pk.x0) / 2), 1);
  });

  it("the dip takes speed: the runner is slower on the plank than on the deck", () => {
    const r = run(good, 120 * 30);
    const onDeck = run({ ...good, planks: undefined, terrain: { waterY: -3, platforms: [{ x0: -10, x1: 40, top: 0 }] } }, 120 * 6);
    expect(r.minVx).toBeLessThan(onDeck.w.runner.vx - 0.2);
  });

  it("a thin plank breaks under the runner, and the runner falls into the water", () => {
    const r = run(thin, 120 * 30);
    expect(r.events).toContain("plank-break");
    expect(r.w.outcome).toBe("splash");
    expect(r.w.broken).toEqual([0]);
  });

  it("Space on the plank jumps off it", () => {
    let w = newWorld(good);
    for (let i = 0; i < 120 * 30 && w.mode !== "plank"; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, good);
    expect(w.mode).toBe("plank");
    for (let i = 0; i < 40; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, good);
    w = stepWorld(w, { ...NO_INPUT, run: true, jump: true }, good);
    expect(w.mode).toBe("run");
    expect(w.runner.vy).toBeGreaterThan(3);
  });

  it("standing still on the plank does not make it break more than walking across (the load is the same weight)", () => {
    const r = run(good, 120 * 8);
    expect(r.events).not.toContain("plank-break");
  });

  it("a long plank breaks and a post in the middle saves it", () => {
    const long = { ...good, terrain: { waterY: -3, platforms: [{ x0: -10, x1: 14, top: 0 }, { x0: 30, x1: 50, top: 0 }] }, planks: [{ ...good.planks![0], x1: 30 }] } as CourseData;
    expect(run(long, 120 * 40).events).toContain("plank-break");
    const posted = { ...long, planks: [{ ...long.planks![0], support: true }] } as CourseData;
    const r = run(posted, 120 * 40);
    expect(r.events).not.toContain("plank-break");
    expect(r.w.outcome).toBe("cleared");
  });
});

describe("plank bridge: the proof and the demo", () => {
  it("the ideal-run search clears the good plank without a jump", () => {
    const found = searchIdealRun(good);
    expect(found.cleared).toBe(true);
    expect(found.plan.jumpXs).toEqual([]);
    expect(playPlan(good, found.plan).world.outcome).toBe("cleared");
  });

  it("the search says the thin plank cannot be crossed", () => {
    expect(searchIdealRun(thin).cleared).toBe(false);
  });

  it("without the plank the 9 m gap cannot be cleared by any jump: the plank is what makes the course possible", () => {
    const bare = { ...good, planks: undefined } as CourseData;
    expect(searchIdealRun(bare).cleared).toBe(false);
  });
});
