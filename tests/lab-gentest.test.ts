import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_RULES, buildProposals, clampRules, ease, fits, randomLayout, rng, tally, testProposal, type Proposal } from "../src/labs/gentest/core";

// Lab 9: generate and test. The proposals are recorded; the verdicts come from the real ideal-run search.
const pool = JSON.parse(readFileSync("public/assets/lab/gentest-proposals.json", "utf8")) as { proposals: { id: string; theme: string; recordedClear: boolean; layout: any }[] };
const gap = (w: number) => ({ items: [{ kind: "ground", length: 12 }, { kind: "gap", width: w }, { kind: "ground", length: 8 }] }) as any;
const prop = (id: string, layout: any): Proposal => ({ id, source: "recorded", theme: "t", layout });

describe("Lab 9: generate and test", () => {
  it("ships a small pool of 100 recorded proposals", () => {
    expect(pool.proposals.length).toBe(100);
    expect(readFileSync("public/assets/lab/gentest-proposals.json").length).toBeLessThan(300_000);
  });
  it("the simulator keeps the last word: an easy gap clears, an impossible one is thrown out for the gap", () => {
    expect(testProposal(prop("a", gap(2)), DEFAULT_RULES, 0).firstClear).toBe(true);
    const v = testProposal(prop("b", gap(40)), DEFAULT_RULES, 0);
    expect(v.cleared).toBe(false);
    expect(v.why).toBe("A gap is too wide");
  });
  it("a reply that is not a course is thrown out, and a lane under 8 m is too", () => {
    expect(testProposal(prop("c", null), DEFAULT_RULES, 2).why).toBe("The reply was not a course");
    expect(testProposal(prop("d", { items: [{ kind: "ground", length: 5 }] }), DEFAULT_RULES, 0).why).toBe("Under 8 m of ground");
  });
  it("repairs only ease the piece it stopped at, never past the player's minimum", () => {
    const l = gap(10);
    expect(ease(l, 1, { ...DEFAULT_RULES, gapMin: 9.5 })!.items[1]).toEqual({ kind: "gap", width: 9.5 });
    expect(ease(l, 1, { ...DEFAULT_RULES, gapMin: 10 })).toBeNull();
    expect(ease(l, 0, DEFAULT_RULES)).toBeNull();
  });
  it("repair can only raise the number cleared, and the same input gives the same answer", () => {
    const ps = buildProposals(pool.proposals, { ...DEFAULT_CONFIG }).slice(0, 12);
    const a = tally(ps.map((p) => testProposal(p, DEFAULT_RULES, 0)));
    const b = tally(ps.map((p) => testProposal(p, DEFAULT_RULES, 3)));
    expect(b.first).toBe(a.first);
    expect(b.first + b.afterRepair).toBeGreaterThanOrEqual(a.first);
    expect(JSON.stringify(ps.map((p) => testProposal(p, DEFAULT_RULES, 3)))).toBe(JSON.stringify(ps.map((p) => testProposal(p, DEFAULT_RULES, 3))));
  });
  it("the rules filter recorded proposals and bound the random ones", () => {
    const none = { ...DEFAULT_RULES, gap: false, bar: false };
    const kept = buildProposals(pool.proposals, { ...DEFAULT_CONFIG, rules: none }).filter((p) => p.layout);
    expect(kept.every((p) => fits(p.layout!, none))).toBe(true);
    expect(kept.length).toBeLessThan(95);
    const r = clampRules({ ...DEFAULT_RULES, gapMin: 2, gapMax: 3, blockMax: 1, maxItems: 5 });
    const rand = rng(3);
    for (let i = 0; i < 50; i++) { const l = randomLayout(rand, r); expect(l.items.length).toBeLessThanOrEqual(5); expect(fits(l, r)).toBe(true); }
    expect(JSON.stringify(randomLayout(rng(9), r))).toBe(JSON.stringify(randomLayout(rng(9), r)));
  });
  it("the maths: expected tries to one clear is 1 over the clear rate", () => {
    const t = tally([{ firstClear: true, cleared: true, why: null, ticks: 1 }, { firstClear: false, cleared: false, why: "A gap is too wide", ticks: 1 }, { firstClear: false, cleared: false, why: "A gap is too wide", ticks: 1 }, { firstClear: false, cleared: false, why: "A block is too tall", ticks: 1 }] as any);
    expect(t.pFirst).toBe(0.25);
    expect(t.triesFirst).toBe(4);
    expect(t.reasons["A gap is too wide"]).toBe(2);
    expect(t.firstIndex).toBe(1);
  });
  it("replay agrees with the recorded run on whether a readable proposal clears as drawn", () => {
    const sample = pool.proposals.filter((p) => p.layout).slice(0, 25);
    let agree = 0;
    for (const p of sample) if (testProposal(prop(p.id, p.layout), DEFAULT_RULES, 0).firstClear === p.recordedClear) agree++;
    expect(agree).toBeGreaterThanOrEqual(23);
  }, 300_000);
});
