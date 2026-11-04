import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KNOBS, OURS, judgePhoto, parseTable, summarize, sweep, type Photo } from "../src/labs/vision/rule";

// computer vision: the rule laws first, then the shipped table, then the Python rule agreeing with the TypeScript one.
const photo = (finds: [number, number, number][], truth: [number, number][] = []): Photo => ({
  id: "t", unionMask30: 0, finds: finds.map(([score, box, mask]) => ({ score, box, mask })), truth: truth.map(([size, find]) => ({ size, find })),
});

describe("Computer vision: the keep-or-drop rule", () => {
  it("keeps a photo with no find and drops one with too much masked", () => {
    expect(judgePhoto(photo([]), OURS).kept).toBe(true);
    expect(judgePhoto(photo([[0.9, 0.1, 0.2]]), OURS).kept).toBe(false); // 20 percent masked
    expect(judgePhoto(photo([[0.9, 0.1, 0.15]]), OURS).kept).toBe(true); // exactly 15 percent is allowed
  });
  it("drops a photo when one person box is over a quarter of it, whatever the mask share", () => {
    expect(judgePhoto(photo([[0.9, 0.26, 0.05]]), { ...OURS, maxMasked: 0.5 }).kept).toBe(false);
  });
  it("ignores finds under the score cut and under the smallest size, which leaves those people missed", () => {
    const p = photo([[0.2, 0.01, 0.01], [0.8, 0.002, 0.003]], [[0.01, 0], [0.002, 1]]);
    const a = judgePhoto(p, OURS); // score cut 0.3: first ignored
    expect(a.missed).toBe(1);
    const b = judgePhoto(p, { ...OURS, scoreCut: 0.1, minSize: 0.005 }); // first now active, second too small
    expect(b.covered).toBe(1);
    expect(b.missed).toBe(1);
    expect(judgePhoto(p, { scoreCut: 0.1, minSize: 0, maxMasked: 1 }).missed).toBe(0);
  });
  it("counts a mask on nobody as a false mask and a person nobody found as missed", () => {
    const j = judgePhoto(photo([[0.9, 0.05, 0.06], [0.9, 0.05, 0.06]], [[0.05, 0], [0.05, -1]]), OURS);
    expect(j.falseMasks).toBe(1);
    expect(j.missed).toBe(1);
  });
  it("moving the score cut up never masks more: photos kept rise and people missed never fall", () => {
    const table = readFileSync("public/assets/lab/vision/scores.txt", "utf8");
    const photos = parseTable(table);
    const c = sweep(photos, OURS, "scoreCut");
    for (let i = 1; i < c.length; i++) expect(c[i].s.missed).toBeGreaterThanOrEqual(0);
    // at the top score cut almost nobody is masked, so almost every photo is kept and many people are missed
    expect(c[c.length - 1].s.keptShare).toBeGreaterThanOrEqual(c[0].s.keptShare);
    expect(c[c.length - 1].s.missedShare).toBeGreaterThanOrEqual(c[0].s.missedShare);
  });
});

describe("Computer vision: the shipped table", () => {
  const table = readFileSync("public/assets/lab/vision/scores.txt", "utf8");
  const photos = parseTable(table);
  it("has a labelled set big enough to draw a curve", () => {
    expect(photos.length).toBeGreaterThanOrEqual(100);
    expect(photos.reduce((n, p) => n + p.truth.length, 0)).toBeGreaterThanOrEqual(150);
    for (const p of photos) for (const t of p.truth) expect(t.find).toBeLessThan(p.finds.length);
  });
  it("stays within the shipped size budget (table plus thumbnails plus credits, 300 KB)", () => {
    const dir = "public/assets/lab/vision";
    let total = statSync(`${dir}/scores.txt`).size + statSync(`${dir}/credits.json`).size;
    for (const f of readdirSync(`${dir}/t`)) { expect(f.endsWith(".jpg")).toBe(true); total += statSync(`${dir}/t/${f}`).size; }
    expect(total).toBeLessThanOrEqual(300 * 1024);
  });
  it("gives every thumbnail a credit row and a table row", () => {
    const credits = JSON.parse(readFileSync("public/assets/lab/vision/credits.json", "utf8")) as { id: string; flickr_url: string; licence: string }[];
    const ids = new Set(photos.map((p) => p.id));
    for (const c of credits) { expect(ids.has(c.id)).toBe(true); expect(existsSync(`public/assets/lab/vision/t/${c.id}.jpg`)).toBe(true); expect(c.licence).toMatch(/CC BY 2\.0|no known/i); }
    expect(readdirSync("public/assets/lab/vision/t").length).toBe(credits.length);
  });
  it("is deterministic: the same setting gives the same counts twice", () => {
    expect(JSON.stringify(summarize(photos, OURS))).toBe(JSON.stringify(summarize(photos, OURS)));
  });
});

describe("Computer vision: the Python rule and the TypeScript rule agree", () => {
  const have = spawnSync("python3", ["--version"]).status === 0;
  it.skipIf(!have)("gives the same kept and missed counts on a grid of settings", () => {
    const photos = parseTable(readFileSync("public/assets/lab/vision/scores.txt", "utf8"));
    const settings: [number, number, number][] = [];
    for (const sc of [0.05, 0.3, 0.5, 0.8]) for (const ms of [0, 0.005, 0.02]) for (const mm of [0, 0.05, 0.15, 0.3, 0.5]) settings.push([sc, ms, mm]);
    const out = execFileSync("python3", ["scripts/lab_vision_rule.py", "public/assets/lab/vision/scores.txt", ...settings.map((s) => s.join(","))], { encoding: "utf8" }).trim().split("\n");
    expect(out.length).toBe(settings.length);
    settings.forEach(([scoreCut, minSize, maxMasked], i) => {
      const py = JSON.parse(out[i]);
      const s = summarize(photos, { scoreCut, minSize, maxMasked });
      expect(py, JSON.stringify([scoreCut, minSize, maxMasked])).toEqual({ photos: s.photos, kept: s.kept, people: s.people, covered: s.covered, missed: s.missed, falseMasks: s.falseMasks });
    });
  });
});

it("declares knob ranges that contain the game's own setting", () => {
  expect(OURS.scoreCut).toBeGreaterThanOrEqual(KNOBS.scoreCut.min);
  expect(OURS.maxMasked).toBeLessThanOrEqual(KNOBS.maxMasked.max);
});
