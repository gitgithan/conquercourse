import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { testLayout } from "../src/slice/course-agent-tools";
import { parseLayout } from "../src/slice/layout-draft";
import { computePartner } from "../scripts/lab-partner-precompute";
import {
  CHALLENGES, EASED_WALL, GATES, KINDS, MAX_ITEMS, changedPieces, fixStep, hardness, harderPass, honestPass, key, oneChangePass, readAnswer, ruleProblems, setSize, swapKind, verdictOf, type Answer,
} from "../src/labs/partner/partner-core";
import { LAB_GROUPS } from "../src/ui/labs-series";

// Lab 17: the design partner loop. Claims are pinned to the game's own reader (parseLayout) and simulator tool (testLayout) and to the recorded answers.
const rec = JSON.parse(readFileSync("public/assets/lab/partner-recorded.json", "utf8")) as { answers: Answer[] };
const def = JSON.parse(readFileSync("public/assets/lab/partner-default.json", "utf8")) as { reports: Record<string, any>; extra: Record<string, any> };
const get = (id: string) => rec.answers.find((a) => a.id === id)!;
const layoutOf = (id: string) => readAnswer(get(id)).layout!;

describe("Lab 17: design partner loop", () => {
  it("has every kind of recorded answer, and the file is small", () => {
    for (const k of KINDS) expect(rec.answers.some((a) => a.kind === k.kind), k.kind).toBe(true);
    expect(readFileSync("public/assets/lab/partner-recorded.json").length).toBeLessThan(300_000);
    expect(readFileSync("public/assets/lab/partner-default.json").length).toBeLessThan(300_000);
  });
  it("the piece rule is the one the partner is told", () => { expect(MAX_ITEMS).toBe(10); });
  it("the game's reader decides which answers are courses; the rules gate catches the 12-piece one", () => {
    for (const a of rec.answers.filter((x) => x.kind === "malformed")) expect(readAnswer(a).layout, a.id).toBeNull();
    for (const a of rec.answers.filter((x) => x.kind !== "malformed")) expect(readAnswer(a).layout, a.id).not.toBeNull();
    expect(layoutOf("r1").items).toHaveLength(12);
    expect(ruleProblems(layoutOf("r1"))).toHaveLength(1);
    for (const a of rec.answers.filter((x) => x.kind !== "rule" && x.layout)) expect(ruleProblems(layoutOf(a.id)), a.id).toEqual([]);
  });
  it("the recorded layouts survive the reader unchanged (what the partner said is what is checked)", () => {
    for (const a of rec.answers.filter((x) => x.layout && x.kind !== "rule")) expect(readAnswer(a).layout, a.id).toEqual(a.layout);
    expect(parseLayout(JSON.stringify({ items: [] })).layout).toBeNull();
  });
  it("the gates name the same reasons the verdict gives", () => {
    expect(verdictOf(readAnswer(get("x1")), null)).toMatchObject({ gate: "reader", reject: "not-a-course" });
    expect(verdictOf(readAnswer(get("x2")), null).reject).toBe("not-a-course");
    expect(verdictOf(readAnswer(get("x3")), null).reject).toBe("not-a-course");
    expect(verdictOf(readAnswer(get("r1")), null)).toMatchObject({ gate: "rules", reject: "breaks-rule" });
    expect(GATES.map((g) => g.gate)).toEqual(["reader", "rules", "simulator", "shown"]);
  });
  it("the shipped simulator reports sort the answers into good, too hard and not provable", () => {
    for (const a of rec.answers) {
      const rep = def.reports[a.id], r = readAnswer(a);
      if (!r.layout || ruleProblems(r.layout).length) { expect(rep, a.id).toBeUndefined(); continue; }
      const v = verdictOf(r, rep);
      if (a.kind === "good") { expect(rep.cleared, a.id).toBe(true); expect(v.gate).toBe("shown"); }
      if (a.kind === "tooHard") { expect(rep.cleared, a.id).toBe(false); expect(rep.probes.length, a.id).toBeGreaterThan(0); expect(v.reject).toBe("not-provable"); }
      if (a.kind === "unprovable") { expect(rep.cleared, a.id).toBe(false); expect(rep.probes, a.id).toEqual([]); expect(fixStep(r.layout, rep)).toBeNull(); }
    }
  });
  it("the shipped reports equal a fresh run of the game's tool (two answers)", () => {
    const fresh = computePartner(["m003", "m000"]) as Record<string, any>;
    expect(fresh.m003).toEqual(def.reports.m003);
    expect(fresh.m000).toEqual(def.reports.m000);
  }, 120_000);
  it("Fix it applies the proved change, changes one piece, and the simulator then clears it", () => {
    for (const id of ["m003", "m002", "i02"]) {
      const l = layoutOf(id), rep = def.reports[id], fs = fixStep(l, rep)!;
      expect(fs, id).not.toBeNull();
      expect(changedPieces(l, fs.layout), id).toBe(1);
      expect(testLayout(fs.layout, { probeSeconds: 4 }).cleared, id).toBe(true);
    }
  }, 120_000);
  it("the recorded partner repair for the bench and wall brief is the same one-piece change Fix it makes", () => {
    const a = get("i02"), fs = fixStep(layoutOf("i02"), def.reports.i02)!;
    expect(a.partnerRepair).toBeDefined();
    expect(changedPieces(layoutOf("i02"), a.partnerRepair!.layout)).toBe(1);
    expect(key(fs.layout)).toBe(key(a.partnerRepair!.layout));
  });
  it("edits: set a size, swap a kind, count changed pieces", () => {
    const l = layoutOf("m003"), i = l.items.findIndex((x) => x.kind === "block");
    expect(changedPieces(l, setSize(l, i, 0.5))).toBe(1);
    expect(swapKind(l, i, "gap").items[i].kind).toBe("gap");
    expect(swapKind(l, 0, "gap")).toBe(l);
    expect(hardness(layoutOf("m000"))).toBe(3.2);
  });
  it("challenge: change one thing is judged by the simulator", () => {
    const l = layoutOf("m003"), i = l.items.findIndex((x) => x.kind === "block");
    const low = setSize(l, i, 0.72);
    expect(oneChangePass(l, low, testLayout(low, { probeSeconds: 2 })).pass).toBe(true);
    const barely = setSize(l, i, 1.7);
    expect(oneChangePass(l, barely, testLayout(barely, { probeSeconds: 2 })).pass).toBe(false);
    expect(oneChangePass(l, l, def.reports.m003).why).toContain("Nothing changed");
  }, 120_000);
  it("challenge: harder and still provable needs a clear and 25% more", () => {
    const l = layoutOf("m001"), rep = def.reports.m001;
    expect(harderPass(l, l, rep).pass).toBe(false);
    const last = l.items.map((x, k) => (x.kind === "block" ? k : -1)).filter((k) => k >= 0).pop()!;
    const harder = setSize(l, last, 1.4);
    expect(hardness(harder) / hardness(l)).toBeGreaterThanOrEqual(1.25 - 0.2);
    expect(harderPass(l, { items: l.items.filter((x) => x.kind !== "block") }, rep).pass).toBe(false);
  });
  it("challenge: the 3 m wall cannot be cleared, so the partner's easing was needed", () => {
    expect(def.extra["eased-wall"].cleared).toBe(true);
    const wall = setSize(EASED_WALL, 1, 3);
    const rep = testLayout(wall, { probeSeconds: 2 });
    expect(rep.cleared).toBe(false);
    expect(honestPass(wall, rep).pass).toBe(true);
    expect(honestPass(EASED_WALL, def.extra["eased-wall"]).pass).toBe(false);
  }, 120_000);
  it("every challenge starts from a recorded answer or our own layout", () => {
    for (const c of CHALLENGES) expect(rec.answers.some((a) => a.id === c.start) || c.start === "w3", c.id).toBe(true);
  });
  it("the Lab sits in Idea to course, a pipeline group", () => {
    expect(LAB_GROUPS.find((g) => g.id === "idea")).toMatchObject({ tier: "pipelines", title: "Idea to course", modes: ["lab-partner"] });
  });
});
