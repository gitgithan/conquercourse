import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_DETECTOR, bestF1, byPrompt, evaluate, hardness, judge, sweep, tally, type DetectorData } from "../src/lab/detector-lab";

const data = JSON.parse(readFileSync("public/assets/lab/detector-partllm.json", "utf8")) as DetectorData;
const recorded = JSON.parse(readFileSync("data/eval/partllm/scores.json", "utf8"));

describe("Evaluating a detector", () => {
  it("reproduces the recorded PartLLM numbers at the shipped settings: 2 of 9 found, 11 of 13 made up", () => {
    const t = evaluate(data, DEFAULT_DETECTOR).tally;
    expect(t.found).toBe(recorded.summary.present_hits);
    expect(t.real).toBe(recorded.summary.present_total);
    expect(t.madeUp).toBe(recorded.summary.absent_false_claims);
    expect(t.none).toBe(recorded.summary.absent_total);
  });
  it("matches every recorded verdict case by case", () => {
    for (const c of data.cases) {
      const v = recorded.objects[c.object].prompts[c.prompt].verdict as string;
      const o = judge(c, DEFAULT_DETECTOR);
      const want = v === "hit" ? ["found"] : v === "miss" ? ["missed-silent", "missed-wrong-place"] : v === "false claim" ? ["made-up"] : v === "correctly empty" ? ["correct-empty"] : ["not-scored"];
      expect(want).toContain(o);
    }
  });
  it("precision, recall and F1 follow their definitions", () => {
    const t = tally(["found", "found", "made-up", "made-up", "made-up", "missed-silent", "correct-empty"]);
    expect(t.precision).toBeCloseTo(2 / 5);
    expect(t.recall).toBeCloseTo(2 / 3);
    expect(t.f1).toBeCloseTo((2 * (2 / 5) * (2 / 3)) / (2 / 5 + 2 / 3));
    expect(tally([]).f1).toBe(0);
  });
  it("raising the claim threshold never adds made-up claims or finds, and a detector that claims nothing finds nothing", () => {
    const c = sweep(data, DEFAULT_DETECTOR);
    for (let i = 1; i < c.length; i++) { expect(c[i].tally.madeUp).toBeLessThanOrEqual(c[i - 1].tally.madeUp); expect(c[i].tally.found).toBeLessThanOrEqual(c[i - 1].tally.found); }
    const top = evaluate(data, { ...DEFAULT_DETECTOR, claimMin: 1 }).tally;
    expect(top.found + top.madeUp).toBe(0);
  });
  it("finds the best F1 on the curve, which is still weak", () => {
    const b = bestF1(sweep(data, DEFAULT_DETECTOR));
    expect(b.tally.f1).toBeLessThan(0.5);
    expect(b.tally.f1).toBeGreaterThanOrEqual(evaluate(data, DEFAULT_DETECTOR).tally.f1);
  });
  it("asking only for 'rail' finds the real rails; 'ledge' finds nothing", () => {
    const by = Object.fromEntries(byPrompt(data, DEFAULT_DETECTOR).map((b) => [b.prompt, b.tally]));
    expect(by.rail.found).toBe(2);
    expect(by.ledge.found).toBe(0);
  });
  it("lists the hard parts lowest first and leaves unclear cases out", () => {
    const h = hardness(data, DEFAULT_DETECTOR);
    expect(h.length).toBe(22);
    expect(h[0].rightShare).toBeLessThanOrEqual(h[h.length - 1].rightShare);
    expect(h.some((x) => x.object === "stairs-park-07" && x.prompt === "ledge" && x.rightShare === 0)).toBe(true);
  });
  it("is deterministic", () => { expect(JSON.stringify(evaluate(data, DEFAULT_DETECTOR))).toBe(JSON.stringify(evaluate(data, DEFAULT_DETECTOR))); });
});
