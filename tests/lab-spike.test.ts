import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BARS, SCENARIOS, STORIES, WALL, WALL_ROUND_MINUTES, WALL_TEST_NEEDS, buildOrder, checkChallenge, cloneScenario, earlyPlan, evaluate, expectedExtra, latePlan, rankByScare,
  referencePlan, riding, ridingHours, scare, spikeOrder, storyTotals, validatePlan, verdict, type Step,
} from "../src/labs/spike/spike-core";

// Lab 17: Spike the riskiest call first. Laws first: finding a failure earlier never wastes more, a test with a missing input is "not tested", the order of tests obeys what they need.
const J = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const shuffle = <T,>(a: T[], seed: number): T[] => { const o = [...a]; let s = seed; for (let i = o.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [o[i], o[j]] = [o[j], o[i]]; } return o; };

describe("Lab 17: the data is self-consistent", () => {
  it("every id used in deps and needs exists, and there is no cycle", () => {
    for (const sc of SCENARIOS) {
      const ids = sc.risks.map((r) => r.id);
      for (const r of sc.risks) { for (const d of [...r.deps, ...r.needs]) expect(ids).toContain(d); expect(r.p).toBeGreaterThanOrEqual(0); expect(r.p).toBeLessThanOrEqual(100); }
      expect(buildOrder(sc)).toHaveLength(ids.length);
      expect(spikeOrder(sc)).toHaveLength(ids.length);
    }
  });
  it("a test is always cheaper than the work it guards (that is why it is worth running)", () => {
    for (const sc of SCENARIOS) for (const r of sc.risks) expect(r.test).toBeLessThan(ridingHours(sc, r.id));
  });
});

describe("Lab 17: the risk board", () => {
  it("work riding on a risk is itself plus everything built on it", () => {
    expect([...riding(BARS, "find")].sort()).toEqual(["find", "fit", "lift", "reach"]);
    expect(ridingHours(BARS, "find")).toBe(1 + 2 + 4 + 6);
    expect(ridingHours(BARS, "body")).toBe(8);
    expect(ridingHours(WALL, "reach")).toBe(4 + 3 + 2 + 3);
  });
  it("scare is chance times work riding on it", () => {
    expect(scare(BARS, "find")).toBeCloseTo(0.5 * 13, 9);
    expect(scare(BARS, "body")).toBeCloseTo(0.85 * 8, 9);
  });
  it("ranking is by scare, highest first, and the slider changes it", () => {
    expect(rankByScare(BARS)[0]).toBe("body");
    expect(rankByScare(BARS)[1]).toBe("find");
    expect(rankByScare(WALL)[0]).toBe("reach");
    const sc = cloneScenario(BARS);
    sc.risks.find((r) => r.id === "find")!.p = 90;
    expect(rankByScare(sc)[0]).toBe("find");
    const ranks = rankByScare(BARS).map((id) => scare(BARS, id));
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });
  it("a tie goes to the cheaper test", () => {
    const sc = cloneScenario(BARS);
    for (const r of sc.risks) { r.p = 10; r.deps = []; r.build = 2; }
    sc.risks[0].test = 0.9; sc.risks[3].test = 0.1;
    expect(rankByScare(sc)[0]).toBe(sc.risks[3].id);
  });
});

describe("Lab 17: plans and the laws of finding out", () => {
  it("the late and early plans are complete and valid", () => {
    for (const sc of SCENARIOS) for (const p of [latePlan(sc), earlyPlan(sc), referencePlan(sc)]) { expect(validatePlan(sc, p)).toEqual([]); expect(p).toHaveLength(sc.risks.length * 2); }
  });
  it("a build before the work it sits on is flagged; a missing or doubled step is flagged", () => {
    const p = latePlan(BARS), swap = [...p];
    const a = swap.findIndex((s) => s.kind === "build" && s.id === "gate"), b = swap.findIndex((s) => s.kind === "build" && s.id === "find");
    [swap[a], swap[b]] = [swap[b], swap[a]];
    expect(validatePlan(BARS, swap).some((x) => x.includes("built before"))).toBe(true);
    expect(validatePlan(BARS, p.slice(1)).some((x) => x.includes("missing"))).toBe(true);
    expect(validatePlan(BARS, [...p, p[0]]).some((x) => x.includes("twice"))).toBe(true);
  });
  it("test-at-the-end throws away exactly the work riding on the failure", () => {
    for (const sc of SCENARIOS) for (const r of sc.risks) {
      const o = evaluate(sc, latePlan(sc), r.id);
      expect(o.how).toBe("spike");
      expect(o.wasted).toBeCloseTo(ridingHours(sc, r.id), 9);
    }
  });
  it("spike-first wastes nothing and finds every failure within the hours of all the tests", () => {
    for (const sc of SCENARIOS) {
      const tests = sc.risks.reduce((a, r) => a + r.test, 0);
      for (const r of sc.risks) {
        const o = evaluate(sc, referencePlan(sc), r.id);
        expect(o.how).toBe("spike"); expect(o.wasted).toBe(0); expect(o.foundHour!).toBeLessThanOrEqual(tests + 1e-9);
        expect(o.total).toBeLessThan(evaluate(sc, latePlan(sc), r.id).total);
      }
    }
  });
  it("with nothing failing, spiking first costs only the tests: the extra time of the early plan over the late plan equals zero", () => {
    for (const sc of SCENARIOS) expect(evaluate(sc, referencePlan(sc), null).hours).toBeCloseTo(evaluate(sc, latePlan(sc), null).hours, 9);
  });
  it("law: moving a test earlier never finds the failure later in the work, and never wastes more (random plans)", () => {
    for (const sc of SCENARIOS) {
      for (let seed = 1; seed <= 60; seed++) {
        // a valid plan: builds in dependency order, tests anywhere
        const builds = buildOrder(sc).map((id): Step => ({ kind: "build", id }));
        const spikes = shuffle(sc.risks.map((r): Step => ({ kind: "spike", id: r.id })), seed);
        let plan: Step[] = [...builds]; for (const s of spikes) plan.splice(Math.floor(((seed * 7 + plan.length) % (plan.length + 1))), 0, s);
        plan = plan.filter((s, i, a) => a.findIndex((t) => t.kind === s.kind && t.id === s.id) === i);
        for (const r of sc.risks) {
          const i = plan.findIndex((s) => s.kind === "spike" && s.id === r.id);
          if (i === 0) continue;
          const moved = [...plan]; const [s] = moved.splice(i, 1); moved.unshift(s);
          const a = evaluate(sc, plan, r.id), b = evaluate(sc, moved, r.id);
          if (a.how === "spike" && b.how === "spike") expect(b.wasted).toBeLessThanOrEqual(a.wasted + 1e-9);
        }
      }
    }
  });
  it("a test that runs before the test it needs is NOT TESTED: no result, the failure is found only by the final play", () => {
    const order = spikeOrder(BARS).filter((x) => x !== "fit");
    order.unshift("fit"); // fit needs lift, so it has nothing real to run on
    const plan = earlyPlan(BARS, order);
    const o = evaluate(BARS, plan, "fit");
    expect(o.notTested).toContain("fit");
    expect(o.how).toBe("play");
    expect(o.wasted).toBeGreaterThan(0);
    // and its own test is not "passed": a dependent test later is also not counted as tested
    expect(evaluate(BARS, plan, "reach").notTested).toEqual(expect.arrayContaining(["fit", "reach"]));
  });
  it("the allowed spike order puts every test after the tests it needs", () => {
    for (const sc of SCENARIOS) { const o = spikeOrder(sc); for (const r of sc.risks) for (const n of r.needs) expect(o.indexOf(n)).toBeLessThan(o.indexOf(r.id)); }
  });
  it("expected extra time is lower for spike-first than for test-at-the-end, and a bigger chance raises the late number", () => {
    for (const sc of SCENARIOS) expect(expectedExtra(sc, referencePlan(sc))).toBeLessThan(expectedExtra(sc, latePlan(sc)));
    const sc = cloneScenario(BARS); sc.risks.find((r) => r.id === "find")!.p = 90;
    expect(expectedExtra(sc, latePlan(sc))).toBeGreaterThan(expectedExtra(BARS, latePlan(BARS)));
  });
});

describe("Lab 17: the challenge is a hard check", () => {
  it("test-at-the-end fails it, the reference plan passes it, in both scenarios", () => {
    for (const sc of SCENARIOS) {
      expect(checkChallenge(sc, latePlan(sc)).ok).toBe(false);
      expect(checkChallenge(sc, referencePlan(sc)).ok).toBe(true);
    }
  });
  it("a plan with the tests out of needs order fails even if every step is there", () => {
    const order = spikeOrder(BARS).reverse();
    const r = checkChallenge(BARS, earlyPlan(BARS, order));
    expect(r.ok).toBe(false);
    expect(r.rows.some((x) => !x.viaTest)).toBe(true);
  });
  it("one build before the tests passes while it stays inside the limits, and fails when it goes over", () => {
    const ref = referencePlan(BARS);
    const small = [ref.find((s) => s.kind === "build" && s.id === "gate")!, ...ref.filter((s) => !(s.kind === "build" && s.id === "gate"))];
    expect(checkChallenge(BARS, small).ok).toBe(true); // 1 h of building first: found by 3.5 h, 1 h at risk
    const big = [...ref.filter((s) => s.kind === "build" && ["gate", "find", "lift"].includes(s.id)), ...ref.filter((s) => !(s.kind === "build" && ["gate", "find", "lift"].includes(s.id)))];
    expect(checkChallenge(BARS, big).ok).toBe(false); // 4 h of building first: more than the hour limit
  });
  it("the money limit is a hard line", () => {
    const sc = cloneScenario(BARS); sc.budget.usd = 0.05;
    expect(checkChallenge(sc, referencePlan(sc)).usdOk).toBe(false);
    expect(checkChallenge(sc, referencePlan(sc)).ok).toBe(false);
  });
  it("every scenario's budget is tight: no plan of only builds-first-then-tests within it", () => {
    for (const sc of SCENARIOS) expect(checkChallenge(sc, latePlan(sc)).rows.every((r) => r.foundOk)).toBe(false);
  });
});

describe("Lab 17: not tested is not failed", () => {
  it("a test with a missing input has no result", () => {
    expect(verdict([...WALL_TEST_NEEDS], [], 0, 36)).toEqual({ status: "not tested", missing: ["path", "targets", "ik", "gate"] });
    expect(verdict([...WALL_TEST_NEEDS], ["gate", "ik"], 0, 36).missing).toEqual(["path", "targets"]);
  });
  it("with every input, no pass is a real fail and any pass is a pass (the CC-17 stop rule)", () => {
    expect(verdict([...WALL_TEST_NEEDS], [...WALL_TEST_NEEDS], 0, 8).status).toBe("failed");
    expect(verdict([...WALL_TEST_NEEDS], [...WALL_TEST_NEEDS], 8, 8).status).toBe("passed");
    expect(verdict([], [], 2, 8).status).toBe("passed");
    expect(verdict([], [], 0, 8).status).toBe("failed");
  });
});

describe("Lab 17: the real stories match the experiment files", () => {
  const wall = J("data/eval/cc-17-wall/run.json"), bars = J("data/eval/bar-motion/run.json");
  const wallStory = STORIES.find((s) => s.id === "wall")!, barsStory = STORIES.find((s) => s.id === "bars")!;
  it("the wall rounds, minutes and spend are run.json's", () => {
    expect(wall.rounds.map((r: { gpu_minutes: number }) => r.gpu_minutes)).toEqual([...WALL_ROUND_MINUTES]);
    expect(wall.gpu_minutes_total).toBeCloseTo(WALL_ROUND_MINUTES[0] + WALL_ROUND_MINUTES[1], 2);
    const t = storyTotals(wallStory, wallStory.events.length - 1);
    expect(t.usd).toBeCloseTo(wall.cost_usd_estimate, 2);
    expect(t.minutes).toBeCloseTo(wall.gpu_minutes_total, 2);
    expect(t.paid).toBe(2);
    expect(wall.rounds[0].best_pass_lines).toBe(2); expect(wall.rounds[1].best_pass_lines).toBe(2);
  });
  it("the wall story's numbers are in the README", () => {
    const md = readFileSync("data/eval/cc-17-wall/README.md", "utf8");
    for (const s of ["2.42 m", "1.07 m", "0 of 36", "frame 65", "0.95 m", "stop rule"]) expect(md).toContain(s);
  });
  it("the bars story is bar-motion's: 22 stretches, none pass travel, Kimodo 0 of 8, about $0.10", () => {
    expect(bars.results.cmu_01).toMatchObject({ stretches: 22, pass_travel: 0, pass_idle: 12, pass_kip: 11 });
    expect(bars.results.kimodo_travel).toMatchObject({ gate_pass: 3, bar_pass: 0, of: 8 });
    expect(bars.results.kimodo_kip.bar_pass).toBe(0);
    expect(storyTotals(barsStory, barsStory.events.length - 1).usd).toBeCloseTo(bars.kimodo.cost_usd_estimate, 2);
    expect(Object.values(bars.results.procedural)).toEqual(["pass", "pass", "pass"]);
  });
  it("the cheap free checks come before the paid ones in both real stories", () => {
    for (const s of STORIES) { const firstPaid = s.events.findIndex((e) => e.kind === "paid"); expect(s.events.slice(0, firstPaid).every((e) => e.usd === 0)).toBe(true); }
  });
  it("totals add up and only grow", () => {
    for (const s of STORIES) { let last = -1; for (let i = 0; i < s.events.length; i++) { const t = storyTotals(s, i); expect(t.usd).toBeGreaterThanOrEqual(last); last = t.usd; } }
  });
});

describe("Lab 17: the wall scenario uses its own facts", () => {
  it("the doc's numbers: the free check is the scariest, the paid round is cheap", () => {
    const wall = J("data/eval/cc-17-wall/run.json");
    expect(rankByScare(WALL)[0]).toBe("reach");
    const h = WALL.risks.find((r) => r.id === "height")!;
    expect(h.usd).toBeLessThanOrEqual(wall.cost_usd_estimate);
    expect(WALL.risks.find((r) => r.id === "reach")!.usd).toBe(0);
  });
});
