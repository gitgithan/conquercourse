import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGlbMesh } from "../src/slice/glb";
import { GAP_MAX, GAP_MIN } from "../src/sim/bars";
import { searchIdealRun } from "../src/sim/ideal";
import { barProfile, fitRow, regulariseRungs, roleCollider } from "../src/slice/role-collider";
import { BREAKS, DEFAULT_BREAK, FIRST_RUNG_X, KNOWN_HEIGHT, breakPeaks, compareBreak, courseFor, gapTable, playKeys, runStages, type Break } from "../src/labs/collision/collision-core";

// Lab 15 (collision from a 3D lift): the steps, the fit, the break-it controls. Every number is the game's own role-collider.ts on the real Saienji CC0 monkey-bars lift.
const buf = readFileSync("public/assets/objects/monkey-bars-saienji-cc0.glb");
const mesh = readGlbMesh(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const demoCourse = JSON.parse(readFileSync("public/assets/demo/bars-lift.course.json", "utf8"));
const demoRun = JSON.parse(readFileSync("public/assets/demo/bars-lift.run.json", "utf8"));
const st = runStages(mesh);
const B = (o: Partial<Break>): Break => ({ ...DEFAULT_BREAK, ...o });

describe("Lab 15: collision from a 3D lift", () => {
  it("the step-by-step run gives what roleCollider gives: 9 rungs, about 0.575 m apart, at 2.08 m", () => {
    const whole = roleCollider(mesh, "bar", { knownHeight: KNOWN_HEIGHT });
    expect(st.run).toEqual(whole.bars!.run);
    expect(st.run.n).toBe(9);
    expect(st.run.gap).toBeCloseTo(0.575, 3);
    expect(st.run.y).toBeCloseTo(2.08, 2);
    expect(st.counts.kept).toBe(whole.clean.kept);
    expect(st.counts.raw).toBe(whole.clean.voxels);
    expect(st.counts.filled).toBe(whole.clean.filledCells);
  });
  it("the steps shrink and fill as drawn: closing adds cells, keeping the biggest piece drops none on this lift", () => {
    expect(st.counts.closed).toBeGreaterThan(st.counts.raw);
    expect(st.counts.pieces).toBe(1);
    expect(st.counts.dropped).toBe(0);
    expect(st.counts.kept).toBe(st.counts.closed);
  });
  it("the peaks: 15 rung peaks at 5 cm, spaced about 0.29 m, so the 0.3 m limit makes every second one a rung", () => {
    expect(st.profile.kept).toHaveLength(15);
    expect(st.profile.cand.length).toBeGreaterThanOrEqual(15);
    const fit = fitRow(st.profile.peakU, st.profile.a1 - st.profile.a0);
    expect(fit.fitGap).toBeGreaterThan(0.28); expect(fit.fitGap).toBeLessThan(0.3);
    expect(fit.stride).toBe(2);
    expect(fit.notes.join(" ")).toContain("every 2th rung is used");
    expect(fit.n).toBe(9);
  });
  it("the peak line is the median plus 40% of the way to the biggest", () => {
    const p = st.profile;
    expect(p.thr).toBeCloseTo(p.base + 0.4 * (p.max - p.base), 9);
    for (const i of p.kept) expect(p.sm[i]).toBeGreaterThanOrEqual(p.thr);
  });
  it("is deterministic: the same lift gives the same numbers twice", () => {
    const again = runStages(mesh);
    expect(again.run).toEqual(st.run);
    expect(again.profile.peakU).toEqual(st.profile.peakU);
    expect(barProfile(st.kept).kept).toEqual(st.profile.kept);
    const b1 = compareBreak(st, B({ kind: "noise", seed: 3 })), b2 = compareBreak(st, B({ kind: "noise", seed: 3 }));
    expect(b1).toEqual(b2);
  });
  it("the cell size changes the answer (that is the point of the slider): 12 cm sees 4 rungs, not 9", () => {
    expect(runStages(mesh, { voxel: 0.12 }).run.n).toBe(4);
    expect(runStages(mesh, { voxel: 0.08 }).run.n).not.toBe(9);
  });

  describe("regulariseRungs", () => {
    it("rounds a double gap to two unit gaps (a missed rung) and keeps the spacing", () => {
      const r = regulariseRungs([0, 0.5, 1.0, 2.0, 2.5]); // the rung at 1.5 is missed
      expect(r.gap).toBeCloseTo(0.5, 6); expect(r.n).toBe(6); expect(r.first).toBeCloseTo(0, 6);
    });
    it("rounds a half gap to one unit gap (a split rung is not an extra rung)", () => {
      const r = regulariseRungs([0, 0.5, 0.75, 1.0, 1.5, 2.0]); // an extra peak at 0.75 splits a rung: gaps 0.25 and 0.25 add up... the median unit stays 0.5
      expect(r.gap).toBeGreaterThan(0.2); expect(r.gap).toBeLessThan(0.52);
      const clean = regulariseRungs([0, 0.5, 1.0, 1.5, 2.0]);
      expect(clean.gap).toBeCloseTo(0.5, 9); expect(clean.n).toBe(5);
    });
    it("the fitted row is exactly regular: rung i is at first + i * gap", () => {
      const noisy = [0.01, 0.52, 0.98, 1.53, 2.0, 2.51];
      const r = regulariseRungs(noisy);
      expect(r.n).toBe(6); expect(r.gap).toBeCloseTo(0.5, 1);
      expect(gapTable(noisy).every((g) => g.units === 1)).toBe(true);
    });
    it("gives the default for fewer than two peaks", () => { expect(regulariseRungs([1.2]).n).toBe(1); expect(regulariseRungs([]).n).toBe(0); });
    it("gapTable marks the double gap as 2 units", () => { expect(gapTable([0, 0.5, 1.0, 2.0, 2.5]).map((g) => g.units)).toEqual([1, 1, 2, 1]); });
  });

  describe("the editor's limits (fitRow)", () => {
    it("a spacing under GAP_MIN uses every k-th rung", () => {
      const peaks = Array.from({ length: 9 }, (_, i) => i * 0.2); // 0.2 m apart
      const r = fitRow(peaks, 1.6);
      expect(r.stride).toBe(2); expect(r.gap).toBeCloseTo(0.4, 6); expect(r.gap).toBeGreaterThanOrEqual(GAP_MIN); expect(r.n).toBe(5);
    });
    it("a spacing over GAP_MAX is held at GAP_MAX with a note", () => {
      const r = fitRow([0, 1.4, 2.8, 4.2], 4.2);
      expect(r.gap).toBe(GAP_MAX); expect(r.notes.join(" ")).toContain("held at");
    });
    it("a spacing inside the limits is kept as it is", () => { const r = fitRow([0, 0.5, 1.0, 1.5], 1.5); expect(r.stride).toBe(1); expect(r.gap).toBeCloseTo(0.5, 9); expect(r.notes).toEqual([]); });
    it("fewer than two rungs becomes two rungs at the default spacing", () => { const r = fitRow([0.3], 2); expect(r.gap).toBeCloseTo(0.6, 9); expect(r.n).toBeGreaterThanOrEqual(2); });
    it("the limits are the editor's: 0.3 m and 1.0 m", () => { expect(GAP_MIN).toBe(0.3); expect(GAP_MAX).toBe(1.0); });
  });

  describe("break it", () => {
    const none = compareBreak(st, B({ kind: "none" }));
    it("nothing broken: the fitted row is the game's row", () => { expect(none.run).toEqual(st.run); expect(none.sameAsGame).toBe(true); });
    it("a missed rung: the copied mesh has a double gap, the fitted row is the same row as the unbroken lift", () => {
      for (const index of [2, 5, 8]) {
        const c = compareBreak(st, B({ kind: "missed", index }));
        expect(c.copied.rungs).toBe(14);
        expect(c.copied.gapStd).toBeGreaterThan(none.copied.gapStd * 0.9);
        expect(c.run.n).toBe(9); expect(c.run.gap).toBeCloseTo(0.575, 1);
        expect(c.fitted.gapStd).toBe(0);
      }
    });
    it("a small wobble (3 cm, five seeds): the fitted row is the same 9 rungs, 0.575 m apart", () => {
      for (const seed of [1, 2, 3, 4, 5]) { const c = compareBreak(st, B({ kind: "noise", sigma: 0.03, seed })); expect(c.run.n).toBe(9); expect(c.run.gap).toBeCloseTo(0.575, 1); expect(c.fitted.gapStd).toBe(0); }
    });
    it("a split rung: the fit takes the half gaps as one rung step, and stays regular", () => {
      const c = compareBreak(st, B({ kind: "split", index: 5 }));
      expect(c.copied.rungs).toBe(16); expect(c.fitted.gapStd).toBe(0); expect(c.run.gap).toBeGreaterThanOrEqual(GAP_MIN);
    });
    it("fused rungs are the case the fit gets wrong: it stays regular but counts more rungs than the game (known gap)", () => {
      for (const index of [3, 6]) { const c = compareBreak(st, B({ kind: "fused", index })); expect(c.fitted.gapStd).toBe(0); expect(c.sameAsGame).toBe(false); expect(c.run.n).toBe(16); }
    });
    it("whatever breaks, the fitted row is regular and legal while the copied row is neither", () => {
      for (const b of BREAKS) {
        const c = compareBreak(st, B({ kind: b.kind, index: 4, sigma: 0.08 }));
        expect(c.run.gap).toBeGreaterThanOrEqual(GAP_MIN - 1e-6); expect(c.run.gap).toBeLessThanOrEqual(GAP_MAX + 1e-6);
        expect(c.fitted.outsideEditor).toBe(0);
        expect(c.copied.gapStd).toBeGreaterThan(0.05);
        expect(c.copied.outsideEditor).toBeGreaterThan(0);
      }
    });
    it("breakPeaks does what it says to the peak list", () => {
      const p = [0, 1, 2, 3, 4, 5];
      expect(breakPeaks(p, B({ kind: "missed", index: 2 }))).toEqual([0, 1, 3, 4, 5]);
      expect(breakPeaks(p, B({ kind: "split", index: 2 }))).toEqual([0, 1, 2, 2.5, 3, 4, 5]);
      expect(breakPeaks(p, B({ kind: "fused", index: 2 }))).toEqual([0, 1, 2.5, 4, 5]);
      expect(breakPeaks(p, B({ kind: "none" }))).toEqual(p);
      const n = breakPeaks(p, B({ kind: "noise", sigma: 0.1, seed: 4 }));
      n.forEach((v, i) => expect(Math.abs(v - p[i])).toBeLessThanOrEqual(0.1));
    });
  });

  describe("the bars simulator", () => {
    it("the course built around the fitted row is the shipped demo course (platforms, finish, row)", () => {
      const c = courseFor(st.run);
      expect(c.bars).toEqual(demoCourse.bars);
      expect(c.terrain).toEqual(demoCourse.terrain);
      expect(c.finishX).toBe(demoCourse.finishX);
      expect(demoCourse.bars[0].x).toBe(FIRST_RUNG_X);
    });
    it("the recorded ideal-run keys clear the fitted row", () => {
      const p = playKeys(courseFor(st.run), demoRun.log);
      expect(p.cleared).toBe(true); expect(p.ticks).toBe(demoRun.ticks);
    });
    it("the same keys also clear the row from a missed rung and a small wobble, but not the fused row", () => {
      expect(playKeys(courseFor(compareBreak(st, B({ kind: "missed", index: 5 })).run), demoRun.log).cleared).toBe(true);
      expect(playKeys(courseFor(compareBreak(st, B({ kind: "noise", sigma: 0.03, seed: 2 })).run), demoRun.log).cleared).toBe(true);
      expect(playKeys(courseFor(compareBreak(st, B({ kind: "fused", index: 3 })).run), demoRun.log).cleared).toBe(false);
    });
    it("the ideal-run search clears the fitted row", { timeout: 60000 }, () => {
      expect(searchIdealRun(courseFor(st.run)).cleared).toBe(true);
    });
  });
});
