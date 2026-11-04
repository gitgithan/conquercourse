import { describe, expect, it } from "vitest";
import { askPartner } from "../functions/api/design-partner";
import { askDesignPartner } from "../src/labs/systemdesign/partner-client";
import { BRIEFS, PBLOCKS, SLOTS, SLOT_IDS, STARTER, blocksOf, cleanDesign, designPrompt, differences, ladderOf, otherGoodDesign, passingDesigns, recordedForDesign, score, tradeOff, type BriefId, type Design } from "../src/labs/systemdesign/pipeline";
import { LAB_LIST, labName, labNumberOf } from "../src/ui/labs-series";
import { blockById } from "../src/labs/systemdesign/blocks";

// Lab 18 block board: pure scoring, a 3-step hint ladder for every misfit, and more than one good design.
const online = (o: Partial<Design> = {}): Design => ({ photo: "link", find: "cutout", lift: "ondemand", place: "runtime", wait: "warmup", collider: "box", sim: "fixed", search: "pruned", share: "keys", ...o });
const kiosk = (o: Partial<Design> = {}): Design => online({ place: "build", photo: "blur", wait: "progress", ...o });
const m = (d: Design, b: BriefId, id: string) => score(d, b).meters.find((x) => x.id === id)!;

describe("block board: the data", () => {
  it("has at least 6 slots, each with at least 3 blocks, and unique ids", () => {
    expect(SLOTS.length).toBeGreaterThanOrEqual(6);
    for (const s of SLOTS) expect(blocksOf(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    expect(new Set(PBLOCKS.map((b) => b.id)).size).toBe(PBLOCKS.length);
  });
  it("the pipeline slots follow the real stages and the recorded numbers are reused", () => {
    expect(SLOTS.map((s) => s.stage)).toEqual(expect.arrayContaining(["Photo or map place", "Find objects", "Lift to 3D", "Fit a collider", "Simulate", "Search the ideal run", "Show and share"]));
    expect(PBLOCKS.find((b) => b.id === "cutout")!.secs).toBe(blockById("sam3")!.latency);
    expect(PBLOCKS.find((b) => b.id === "ondemand")!.cold).toBe(46);
    expect(PBLOCKS.find((b) => b.id === "alwayson")!.monthly).toBeCloseTo(1423.5, 1);
  });
  it("the starter is runnable and has something to fix", () => {
    for (const s of SLOT_IDS) expect(blocksOf(s).some((b) => b.id === STARTER[s]), s).toBe(true);
    const o = score(STARTER, "online");
    expect(o.cleared).toBe(false); expect(o.misfits.length).toBeGreaterThanOrEqual(3);
  });
});
describe("block board: scoring is pure and obeys the lessons", () => {
  it("is deterministic and does not change its input", () => {
    const d = { ...STARTER }, a = score(d, "online");
    expect(score(d, "online")).toEqual(a); expect(d).toEqual(STARTER);
    for (const b of BRIEFS) expect(score(online(), b.id)).toEqual(score(online(), b.id));
  });
  it("a designed pass clears the online brief; the same choices fail the kiosk (needs internet)", () => {
    expect(score(online(), "online").cleared).toBe(true);
    expect(m(online(), "kiosk", "offline").level).toBe("bad");
  });
  it("a frozen page and a sleeping GPU make the first visitor wait; an early wake-up removes it", () => {
    expect(m(online({ wait: "block" }), "online", "smooth").level).toBe("bad");
    const asleep = score(online({ wait: "progress" }), "online");
    expect(asleep.cold).toBe(blockById("sam3")!.cold + blockById("sam3d")!.cold); expect(m(online({ wait: "progress" }), "online", "time").level).toBe("bad");
    expect(score(online(), "online").cold).toBe(0);
  });
  it("an always-on GPU costs the recorded monthly price per 1,000 and fails the bill", () => {
    const o = score(online({ lift: "alwayson", wait: "progress" }), "online");
    expect(o.costPer1000).toBeGreaterThan(1400); expect(m(online({ lift: "alwayson" }), "online", "cost").level).toBe("bad");
  });
  it("the collider: raw skin changes the run, a hull loses the gaps, a fitted box keeps both", () => {
    expect(m(online({ collider: "skin" }), "online", "same").level).toBe("bad");
    expect(m(online({ collider: "hull" }), "online", "shape").level).toBe("bad");
    expect(m(online(), "online", "same").level).toBe("ok"); expect(m(online(), "online", "shape").level).toBe("ok");
  });
  it("sim, search and share: frame-time steps and a learned player break the same run; a video breaks privacy and cost", () => {
    expect(m(online({ sim: "frame" }), "online", "same").level).toBe("bad");
    expect(m(online({ search: "policy" }), "online", "same").level).toBe("bad");
    expect(m(online({ search: "brute" }), "online", "time").level).toBe("bad");
    const v = score(online({ share: "video" }), "online"); expect(m(online({ share: "video" }), "online", "privacy").level).toBe("bad"); expect(v.cleared).toBe(false);
    expect(m(online({ photo: "store" }), "online", "privacy").level).toBe("bad");
  });
  it("build time: fast and offline, but a new place gets no object; the brief decides what counts", () => {
    expect(m(online({ place: "build" }), "online", "places").level).toBe("bad");
    expect(score(kiosk(), "kiosk").cleared).toBe(true);
    expect(m(kiosk(), "online", "places").level).toBe("bad"); expect(m(kiosk(), "kiosk", "places").level).toBe("info");
    expect(score(kiosk(), "kiosk").first).toBeLessThan(score(online(), "online").first);
  });
});
describe("block board: discovery and hints", () => {
  it("every block that is ever a misfit has a 3-step ladder: a meter, an earlier Lab, and why a better block fits", () => {
    const seen = new Set<string>();
    // walk every single-slot change from many bases, so every culprit shows up
    const bases = [STARTER, online(), kiosk(), online({ place: "build" })];
    for (const br of BRIEFS) for (const base of bases) for (const s of SLOT_IDS) for (const b of blocksOf(s)) {
      const d = { ...base, [s]: b.id } as Design;
      for (const mf of score(d, br.id).misfits) seen.add(mf.block + "@" + mf.slot);
      for (const mf of score(d, br.id).misfits) {
        const l = ladderOf(mf.block, mf.meters);
        expect(l, mf.block).not.toBeNull();
        expect(l!.steps[0].length).toBeGreaterThan(20); expect(l!.steps[1].labText.length).toBeGreaterThan(10); expect(l!.steps[2].length).toBeGreaterThan(20);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(15);
  });
  it("every hint chip points at a real Lab, by name from the series list, and no number is typed into a hint", () => {
    for (const b of PBLOCKS) if (b.hint) {
      expect(LAB_LIST.some((l) => l.mode === b.hint!.lab), b.id).toBe(true);
      expect(labNumberOf(b.hint.lab)).toBeGreaterThan(0); expect(labName(b.hint.lab).length).toBeGreaterThan(2);
      expect(b.hint.labText + b.hint.why).not.toMatch(/\bLab \d/);
    }
  });
  it("the first hint names the meter that is red", () => {
    const d = online({ wait: "block" }), mf = score(d, "online").misfits.find((x) => x.slot === "wait")!;
    expect(mf.meters).toEqual(expect.arrayContaining(["smooth"]));
    expect(ladderOf(mf.block, ["smooth"])!.steps[0]).toMatch(/page-alive/i);
    expect(ladderOf(mf.block, mf.meters)!.steps[0]).toMatch(/meter/);
  });
  it("a meter that is red points at the misfit slot that causes it", () => {
    const o = score(online({ collider: "skin" }), "online");
    expect(o.misfits.map((x) => x.slot)).toContain("collider");
    expect(score(online(), "online").misfits).toEqual([]);
  });
});
describe("block board: more than one good design", () => {
  it("at least two distinct designs clear each brief, and they differ in a real choice", () => {
    for (const br of BRIEFS) {
      const p = passingDesigns(br.id);
      expect(p.length, br.id).toBeGreaterThanOrEqual(2);
      for (const d of p.slice(0, 50)) expect(score(d, br.id).cleared).toBe(true);
    }
    const a = online(), b = online({ photo: "blur" });
    expect(score(b, "online").cleared).toBe(true); expect(differences(a, b)).toEqual(["photo"]);
  });
  it("a passing design gets a different good design with its trade-off in words", () => {
    const d = online(), o = otherGoodDesign(d, "online")!;
    expect(o).not.toBeNull(); expect(differences(d, o).length).toBe(1);
    expect(tradeOff(d, o, "online").length).toBeGreaterThan(5);
  });
});
describe("block board: the partner still works with the current choices", () => {
  it("cleanDesign takes one known block per slot and a cleaned note, and nothing else", () => {
    expect(cleanDesign({ brief: "online", design: online(), note: "<b>hi</b>" })!.note).not.toContain("<");
    expect(cleanDesign({ brief: "x", design: online() })).toBeNull();
    expect(cleanDesign({ brief: "online", design: { ...online(), find: "nope" } })).toBeNull();
    expect(cleanDesign({ brief: "online", design: { ...online(), find: undefined } })).toBeNull();
  });
  it("the prompt carries the choices and the simulated facts; the server sends one system and one user message", async () => {
    expect(designPrompt({ brief: "online", design: STARTER, note: "" })).toContain("FAIL: Page stays alive");
    let sent: { messages: { content: string }[] } | null = null;
    const f = (async (_u: unknown, init: RequestInit) => { sent = JSON.parse(String(init.body)); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Pros: a. Cons: b." } }] }) } as Response; }) as typeof fetch;
    expect(await askPartner("k", { brief: "online", design: STARTER, note: "" }, f)).toEqual({ status: 200, body: { reply: "Pros: a. Cons: b." } });
    expect(sent!.messages).toHaveLength(2); expect(sent!.messages[1].content).toContain("Freeze the page");
    expect((await askPartner("k", { brief: "online", design: { ...STARTER, find: "zzz" } }, f)).status).toBe(400);
  });
  it("falls back to a recorded comment made from the meters, labelled as recorded", async () => {
    const down = (async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response) as typeof fetch;
    const a = await askDesignPartner({ brief: "online", design: STARTER, note: "" }, down);
    expect(a.kind).toBe("recorded"); expect(a.text).toMatch(/^Pros:.*Cons:/); expect(a.text).toBe(recordedForDesign(STARTER, "online"));
  });
});
