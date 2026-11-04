import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { setRoofStart } from "../src/slice/slice";
import { laneFacts, looksCrossable } from "../src/slice/why";
import { replayDefault, type DefaultsFile } from "../src/slice/slicer-default";
import { CHALLENGES, GAME_LIMITS, JUMP_GAP_M, MIN_LANE_M, SLUGS, analyse, inputOf, judge, looksOk, openKnobs, placeOf, reachOf, ruleRows, startKnobs, tryLane, type Challenge, type Knobs } from "../src/labs/slicer/slicer-lab-core";

// Lab 18 (map to lane): the Lab's claims, pinned to the game's own Slicer code and the recorded OpenStreetMap places. No network, no photos.
const defaults = JSON.parse(readFileSync("public/assets/places/slicer-defaults.json", "utf8")) as DefaultsFile;
const raw = (slug: string) => JSON.parse(readFileSync(`public/assets/places/${slug}.json`, "utf8"));
const place = (slug: string) => placeOf(raw(slug));
const dflt = (slug: string) => defaults.places.find((d) => d.slug === slug)!;
const chal = (id: string): Challenge => CHALLENGES.find((c) => c.id === id)!;
const knobs = (slug: string, o: Partial<Knobs> = {}): Knobs => ({ ...openKnobs(place(slug), dflt(slug)), ...o });
setRoofStart(true);

describe("Lab 18: the recorded places", () => {
  it("are in the picker's list, are recorded OpenStreetMap buildings, and have a stored proved default", () => {
    expect(SLUGS).toHaveLength(5);
    for (const s of SLUGS) {
      const r = raw(s);
      expect(r.answer.elements.length).toBeGreaterThan(0);
      expect(r.answer.elements.every((e: { tags?: Record<string, string> }) => !!e.tags?.building)).toBe(true);
      expect(dflt(s).clear).toBe(true);
    }
  });
  it("the Alfama facts quoted on the page: 278 buildings drawn, 64 with a height tag", () => {
    const a = analyse(place("alfama-lisbon"), knobs("alfama-lisbon"), { prove: false });
    expect(a.counts.found).toBe(278);
    expect(a.counts.real).toBe(64);
  });
});

describe("Lab 18: our setting is the game's proved line", () => {
  for (const s of ["eixample-barcelona", "alfama-lisbon", "zocalo-mexico-city", "lakeside-garden-skatepark"]) {
    it(`${s}: the page's verdict equals the game's replay of the stored default`, () => {
      const a = analyse(place(s), knobs(s)), r = replayDefault(dflt(s), inputOf(place(s)));
      expect(r.cleared).toBe(true);
      expect(a.proved).toBe(true);
      expect(Math.abs(a.lengthM - r.lengthM)).toBeLessThan(0.2);
      expect(a.counts.outside).toBe(0); // the opening circle holds every recorded building
    });
  }
  it("the opening circle reaches the farthest recorded building", () => {
    const p = place("eixample-barcelona");
    expect(reachOf(p)).toBeGreaterThanOrEqual(p.radius);
  });
});

describe("Lab 18: the buildings that are left out", () => {
  it("a smaller circle drops buildings and the numbers add up", () => {
    const p = place("alfama-lisbon"), big = analyse(p, knobs("alfama-lisbon"), { prove: false }), small = analyse(p, knobs("alfama-lisbon", { radiusM: 40 }), { prove: false });
    expect(small.counts.outside).toBeGreaterThan(big.counts.outside);
    for (const a of [big, small]) expect(a.counts.kept + a.counts.below + a.counts.outside + a.counts.guessed).toBe(a.counts.found);
  });
  it("counting only height-tagged buildings leaves out exactly the buildings with no tag", () => {
    const a = analyse(place("alfama-lisbon"), knobs("alfama-lisbon", { realOnly: true }), { prove: false });
    expect(a.counts.guessed).toBe(a.counts.found - a.counts.real);
  });
  it("a higher cut puts more roofs below it", () => {
    const lo = analyse(place("alfama-lisbon"), knobs("alfama-lisbon", { cutM: 4 }), { prove: false }), hi = analyse(place("alfama-lisbon"), knobs("alfama-lisbon", { cutM: 20 }), { prove: false });
    expect(hi.counts.below).toBeGreaterThan(lo.counts.below);
  });
  it("hills change the roof heights", () => {
    const flat = analyse(place("alfama-lisbon"), knobs("alfama-lisbon", { hills: false }), { prove: false }), hill = analyse(place("alfama-lisbon"), knobs("alfama-lisbon"), { prove: false });
    expect(flat.tops.map((t) => Math.round(t.top)).join()).not.toBe(hill.tops.map((t) => Math.round(t.top)).join());
  });
});

describe("Lab 18: the rules table", () => {
  it("shows laneFacts against the game's limits, and its quick look is looksCrossable", () => {
    for (const s of ["eixample-barcelona", "montmartre-paris"]) {
      const a = analyse(place(s), knobs(s), { prove: false });
      expect(a.facts).toEqual(laneFacts({ cells: a.cells, length: a.lengthM, origin: a.origin }));
      expect(looksOk(a.facts)).toBe(looksCrossable(a.facts));
      expect(a.quick).toBe(looksCrossable(a.facts));
    }
    expect(GAME_LIMITS.gap).toBe(JUMP_GAP_M + 0.5);
  });
  it("the simulator has the last word: Eixample has a 13.8 m gap that the quick look refuses and the simulator clears", () => {
    const a = analyse(place("eixample-barcelona"), knobs("eixample-barcelona"));
    expect(a.facts.widestGapM).toBeGreaterThan(JUMP_GAP_M);
    expect(a.quick).toBe(false);
    expect(a.proved).toBe(true);
  });
  it("loosening a limit turns a rule from no to ok", () => {
    const f = analyse(place("montmartre-paris"), knobs("montmartre-paris", { cutM: 42 }), { prove: false }).facts;
    expect(ruleRows(f).find((r) => r.id === "step")!.ok).toBe(false);
    expect(ruleRows(f, { ...GAME_LIMITS, climb: 9 }).find((r) => r.id === "step")!.ok).toBe(true);
    expect(MIN_LANE_M).toBe(8);
  });
});

describe("Lab 18: the four design challenges each start failing and each has a way to pass", () => {
  const start = (c: Challenge) => startKnobs(c, place(c.slug), dflt(c.slug));
  it("each starts at a state that fails", () => {
    for (const c of CHALLENGES) {
      const a = analyse(place(c.slug), start(c));
      expect(a.proved, c.id).toBe(false);
      expect(openKnobs(place(c.slug), dflt(c.slug)).cutM).toBeDefined();
    }
  });
  it("cut too high: our cut of 18 m clears, 10 m and 14 m clear, 22 m does not", () => {
    const run = (cutM: number) => analyse(place("alfama-lisbon"), start(chal("cut-high")) && { ...start(chal("cut-high")), cutM }).proved;
    expect(dflt("alfama-lisbon").cutM).toBe(18);
    expect([10, 14, 18].map(run)).toEqual([true, true, true]);
    expect(run(22)).toBe(false);
    expect(judge(chal("cut-high"), analyse(place("alfama-lisbon"), { ...start(chal("cut-high")), cutM: 18 })).pass).toBe(true);
    expect(judge(chal("cut-high"), analyse(place("alfama-lisbon"), start(chal("cut-high")))).pass).toBe(false);
  });
  it("say why: Montmartre at 42 m has a step far above a climb, and only 'wall' passes", () => {
    const c = chal("say-why"), a = analyse(place(c.slug), start(c));
    expect(a.why.blocked).toBe("wall");
    expect(a.facts.tallestStepM).toBeGreaterThan(7);
    expect(judge(c, a, "wall").pass).toBe(true);
    for (const wrong of ["short", "gap", "drop"] as const) expect(judge(c, a, wrong).pass).toBe(false);
    expect(judge(c, a).pass).toBe(false);
    expect(dflt(c.slug).cutM).toBe(50); // what we stored
  });
  it("small circle: 30 m holds one building and the lane is too short; 70 m is enough", () => {
    const c = chal("small-circle"), a = analyse(place(c.slug), start(c));
    expect(a.counts.kept + a.counts.below).toBe(1);
    expect(a.lengthM).toBeLessThan(MIN_LANE_M);
    expect(judge(c, analyse(place(c.slug), { ...start(c), radiusM: 70 })).pass).toBe(true);
  });
  it("tagged only: 64 of 278 are tagged and the lane fails; counting the guessed ones passes", () => {
    const c = chal("guessed"), a = analyse(place(c.slug), start(c));
    expect(a.counts.real).toBe(64);
    expect(judge(c, a).pass).toBe(false);
    expect(judge(c, analyse(place(c.slug), { ...start(c), realOnly: false })).pass).toBe(true);
  });
  it("every challenge has a reveal and a place that is in the list", () => {
    for (const c of CHALLENGES) { expect(c.reveal.length).toBeGreaterThan(40); expect(SLUGS).toContain(c.slug); }
  });
});

describe("Lab 18: the simulator tries the lane", () => {
  it("a proved lane has a recorded run that ends at the finish, and an unproved one does not clear", () => {
    const a = analyse(place("lakeside-garden-skatepark"), knobs("lakeside-garden-skatepark")), t = tryLane(a)!;
    expect(t.cleared).toBe(true);
    expect(t.clearS).toBeGreaterThan(0);
    expect(t.xs.length).toBeGreaterThan(20);
    expect(t.xs[t.xs.length - 1]).toBeGreaterThan(t.finishX - 3);
    expect(tryLane(analyse(place("alfama-lisbon"), { ...knobs("alfama-lisbon"), cutM: 26 }, { prove: false }))).toBeNull();
  });
});

describe("Lab 18: the doc and the page", () => {
  const doc = readFileSync("docs/labs/slicer.md", "utf8");
  it("has the four required sections", () => {
    for (const h of ["How it was designed", "How we prove the lesson is right", "Limits", "How to make the lesson better"]) expect(doc).toContain(`## ${h}`);
  });
  it("is the 18th Lab and shows the OpenStreetMap credit", () => {
    expect(readFileSync("src/ui/labs-series.ts", "utf8")).toContain("lab-slicer");
    expect(readFileSync("src/modes/lab-slicer.ts", "utf8")).toContain("OSM_CREDIT");
  });
});
