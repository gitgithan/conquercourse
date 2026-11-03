import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { searchIdealRun, type SearchResult } from "../src/sim/ideal";
import { searchKey, shareSearches, type NoteFn, type PanelHandle, type Sig } from "../src/modes/course/search-share";

// CC-133: one shared result cache for the ideal-run search. A fake search stands in for the pool so the sharing rules can be checked without playing the simulator.
const course = JSON.parse(readFileSync("public/assets/demo/training.course.json", "utf8")) as CourseData;
const noPlan = (c: CourseData): CourseData => { const d = { ...c }; delete d.plan; return d; };
const fake = (n: number): SearchResult => ({ plan: { jumpXs: [n] } as SearchResult["plan"], windows: [], cleared: true });

function slowSearch() {
  const calls: { c: CourseData; sig: Sig; finish(r?: SearchResult): void; fail(e: Error): void; note: NoteFn }[] = [];
  const raw = (c: CourseData, sig: Sig, note: NoteFn) => new Promise<SearchResult>((res, rej) => {
    calls.push({ c, sig, note, finish: (r = fake(calls.length)) => res(r), fail: rej });
  });
  return { raw, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("shared ideal-run search cache", () => {
  it("shares a search that is still running: three askers, one run", async () => {
    const { raw, calls } = slowSearch();
    const run = shareSearches(raw);
    const a = run(course, { cancelled: false }, undefined, undefined, "ghost");
    const b = run(course, { cancelled: false }, undefined, 100, "drums");
    const w = run(course, { cancelled: false });
    await tick();
    expect(calls.length).toBe(1);
    calls[0].finish();
    const [ra, rb, rw] = await Promise.all([a, b, w]);
    expect(rb).toBe(ra); expect(rw).toBe(ra);
  });

  it("reuses a finished answer without searching again", async () => {
    const { raw, calls } = slowSearch();
    const run = shareSearches(raw);
    const p = run(course, { cancelled: false }, undefined, undefined, "ghost");
    await tick(); calls[0].finish();
    const first = await p;
    expect(await run(course, { cancelled: false }, undefined, undefined, "ideal")).toBe(first);
    expect(calls.length).toBe(1);
  });

  it("does not store a cancelled search, and one asker leaving does not stop the others", async () => {
    const { raw, calls } = slowSearch();
    const run = shareSearches(raw);
    const ghostSig = { cancelled: false }, idealSig = { cancelled: false };
    const g = run(course, ghostSig, undefined, undefined, "ghost");
    const i = run(course, idealSig, undefined, undefined, "ideal");
    await tick();
    idealSig.cancelled = true;
    await expect(i).rejects.toThrow("cancelled");
    await new Promise((r) => setTimeout(r, 150));
    expect(calls[0].sig.cancelled).toBe(false); // the ghost still needs it
    calls[0].finish();
    await expect(g).resolves.toBeTruthy();
    // every asker gone: the search is told to stop and nothing is kept
    const { raw: raw2, calls: calls2 } = slowSearch();
    const run2 = shareSearches(raw2);
    const s = { cancelled: false };
    const only = run2(course, s, undefined, undefined, "ideal");
    await tick(); s.cancelled = true;
    await expect(only).rejects.toThrow("cancelled");
    expect(calls2[0].sig.cancelled).toBe(true);
    calls2[0].fail(new Error("cancelled"));
    const again = run2(course, { cancelled: false }, undefined, undefined, "ghost");
    await tick();
    expect(calls2.length).toBe(2); // searched afresh: the cancelled run left nothing behind
    calls2[1].finish(); await again;
  });

  it("a failed (budget) search is not stored; a bigger budget retries on its own", async () => {
    const { raw, calls } = slowSearch();
    const run = shareSearches(raw);
    const small = run(course, { cancelled: false }, undefined, 10, "drums");
    const big = run(course, { cancelled: false }, undefined, undefined, "ghost");
    await tick();
    calls[0].fail(new Error("budget"));
    await expect(small).rejects.toThrow("budget");
    await tick();
    expect(calls.length).toBe(2); // the unlimited asker went again
    calls[1].finish();
    await expect(big).resolves.toBeTruthy();
  });

  it("a different start x is a different search", async () => {
    const { raw, calls } = slowSearch();
    const run = shareSearches(raw);
    const a = run(course, { cancelled: false });
    const b = run({ ...course, startX: course.startX + 5 }, { cancelled: false });
    await tick();
    expect(calls.length).toBe(2);
    expect(searchKey(course)).not.toBe(searchKey({ ...course, startX: course.startX + 5 }));
    calls[0].finish(); calls[1].finish(); await Promise.all([a, b]);
  });

  it("the stored plan is not part of the key (it is an answer, not an input)", () => {
    expect(searchKey(course)).toBe(searchKey(noPlan(course)));
  });

  it("opens one panel for several visible askers, and a late visible asker opens it on a quiet search", async () => {
    const { raw, calls } = slowSearch();
    let opened = 0, cancelBtn = () => undefined as void;
    const panel: PanelHandle = { note: () => undefined, done: () => undefined, close: () => undefined };
    const run = shareSearches(raw, { openPanel: (cb) => { opened++; cancelBtn = cb; return panel; } });
    const quiet = run(course, { cancelled: false });
    await tick(); expect(opened).toBe(0);
    const g = run(course, { cancelled: false }, undefined, undefined, "ghost");
    const d = run(course, { cancelled: false }, undefined, 60, "drums");
    await tick();
    expect(opened).toBe(1);
    cancelBtn(); // the Cancel button stops the visible askers, not the quiet one
    await expect(g).rejects.toThrow("cancelled"); await expect(d).rejects.toThrow("cancelled");
    expect(calls[0].sig.cancelled).toBe(false);
    calls[0].finish(); await expect(quiet).resolves.toBeTruthy();
  });

  it("a cached answer is identical to a fresh search", async () => {
    const fresh = searchIdealRun(noPlan(course));
    const run = shareSearches(async (c) => searchIdealRun(c));
    const first = await run(noPlan(course), { cancelled: false });
    const second = await run(noPlan(course), { cancelled: false });
    expect(second).toBe(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(fresh));
  });
});
