import { describe, expect, it } from "vitest";
import { BLOCKS, BLOCK_IDS, blockById } from "../src/labs/systemdesign/blocks";
import { REAL, SCENARIOS, diffFromReal, failureOutcome, judge } from "../src/labs/systemdesign/judge";

// Lab 18 (System design): the judge is deterministic and pinned to docs/lessons.md and the numbers in docs/model-limits.md.
const state = (v: ReturnType<typeof judge>, id: string) => v.rules.find((r) => r.id === id)?.state;
describe("Lab 18: blocks", () => {
  it("ids are unique, every block cites a source, and prices match the docs", () => {
    expect(new Set(BLOCK_IDS).size).toBe(BLOCKS.length);
    for (const b of BLOCKS) expect(b.source.length, b.id).toBeGreaterThan(5);
    expect(blockById("sam3")!.perObject).toBeCloseTo(0.00059, 5); // 2.65 s x $0.80 / 3600
    expect(blockById("sam3d")!.perObject).toBeCloseTo(0.00623, 5); // 11.5 s x $1.95 / 3600
    expect(blockById("alwayson")!.monthly).toBeCloseTo(1423.5, 1); // $1.95 x 730 h
    expect(blockById("safety")!.latency).toBe(7); // median in model-limits.md
    expect(blockById("sam3")!.cold).toBe(14); expect(blockById("sam3d")!.cold).toBe(46);
  });
});
describe("Lab 18: the judge", () => {
  it("the real design clears every scenario and passes every lesson that applies", () => {
    for (const s of SCENARIOS) { const v = judge(s.id, [...REAL]); expect(v.cleared, s.id + JSON.stringify(v.checks.filter((c) => !c.ok))).toBe(true); expect(v.lessonsPassed).toBe(v.lessonsTotal); }
    expect(diffFromReal([...REAL])).toEqual({ missing: [], extra: [] });
  });
  it("a key in the page fails the keys lesson", () => expect(state(judge("photo", ["browser", "pages", "keyinpage", "sam3", "sam3d"]), "keys")).toBe("fail"));
  it("a model before the mask fails; no mask fails; mask first passes", () => {
    const base = ["functions", "limits", "safety"];
    expect(state(judge("photo", [...base, "sam3", "mask", "sam3d"]), "mask")).toBe("fail");
    expect(state(judge("photo", [...base, "sam3", "sam3d"]), "mask")).toBe("fail");
    expect(state(judge("photo", [...base, "mask", "sam3", "sam3d"]), "mask")).toBe("pass");
  });
  it("skipping the safety check, or running it after the GPU, fails", () => {
    expect(state(judge("photo", ["functions", "limits", "mask", "sam3", "sam3d"]), "safety")).toBe("fail");
    expect(state(judge("photo", ["functions", "limits", "mask", "sam3", "safety"]), "safety")).toBe("fail");
  });
  it("a contributor model fails and raises the privacy meter", () => {
    const v = judge("photo", ["functions", "limits", "safety-meta", "mask", "sam3"]);
    expect(state(v, "contributor")).toBe("fail"); expect(v.meters.privacy).toBeGreaterThanOrEqual(40);
    expect(judge("photo", [...REAL]).meters.privacy).toBe(0);
  });
  it("the mesh as collider and an AI judge both fail; fitted collider and simulator pass", () => {
    expect(state(judge("photo", ["sam3d", "meshcollider", "sim"]), "skin")).toBe("fail");
    expect(state(judge("photo", ["sam3d", "fitcollider", "modeljudge"]), "simtruth")).toBe("fail");
    expect(state(judge("photo", ["sam3d", "fitcollider", "sim"]), "skin")).toBe("pass");
  });
  it("costs: the real design is about $10 per 1,000 objects; an always-on GPU is far above the free budget", () => {
    const real = judge("free", [...REAL]); expect(real.meters.costPer1000).toBeGreaterThan(9); expect(real.meters.costPer1000).toBeLessThan(11); expect(real.meters.monthly).toBeLessThan(150);
    const on = judge("free", ["pages", "functions", "limits", "safety", "sam3", "alwayson"]);
    expect(on.meters.monthly).toBeGreaterThan(1400); expect(on.checks.find((c) => c.text.startsWith("Bill"))!.ok).toBe(false); expect(state(on, "ondemand")).toBe("fail");
  });
  it("time: warm is the sum of recorded times; a warm-up call removes the cold start", () => {
    const a = judge("photo", ["functions", "safety", "sam3", "sam3d"]);
    expect(a.meters.warm).toBeCloseTo(21.15, 0); expect(a.meters.coldExtra).toBe(60);
    expect(judge("photo", ["functions", "safety", "warm", "sam3", "sam3d"]).meters.coldExtra).toBe(0);
  });
  it("failure outcomes: library gives a result, polling a message, nothing leaves a spinner; safety fails closed", () => {
    expect(failureOutcome(["sam3d", "library"], "sam3d").level).toBe("result");
    expect(failureOutcome(["sam3d", "queue"], "sam3d").level).toBe("message");
    expect(failureOutcome(["sam3d"], "sam3d").level).toBe("broken");
    expect(failureOutcome(["functions", "safety"], "safety").level).toBe("message");
    expect(failureOutcome(["pages"], "pages").level).toBe("broken");
  });
  it("model jobs: Muse Image is the wrong model for a lift and costs money as an extra", () => {
    const ok = ["functions", "safety", "mask", "sam3", "sam3d"];
    expect(judge("models", ok).cleared).toBe(true);
    expect(judge("models", [...ok, "museimage"]).cleared).toBe(false);
    expect(judge("models", ["functions", "safety-meta", "mask", "sam3", "sam3d"]).cleared).toBe(false);
  });
  it("is deterministic and an empty design clears nothing", () => {
    expect(judge("photo", ["pages", "sam3"])).toEqual(judge("photo", ["pages", "sam3"]));
    for (const s of SCENARIOS) expect(judge(s.id, []).cleared).toBe(false);
  });
});
