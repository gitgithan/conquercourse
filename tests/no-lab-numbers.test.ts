import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CC-133 (owner decision): Labs are known by NAME only. No "Lab 12" style text in the page, the docs of the Labs or the assets table.
// Order stays implicit (Previous / Next and the position in the panel's boxes). This test keeps the numbers from creeping back.
const NUMBERED = /\bLab \d+\b/i;
const PLURAL = /\bLabs \d+\b/i;

// Quoted history that must keep a number (file -> why). Keep this list short and give a reason for each entry.
const ALLOW: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const textFiles = (dir: string, exts: RegExp): string[] => walk(dir).filter((f) => exts.test(f));

function offenders(files: string[]): string[] {
  const bad: string[] = [];
  for (const f of files) {
    if (ALLOW[f]) continue;
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (NUMBERED.test(line) || PLURAL.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  return bad;
}

describe("no Lab numbers", () => {
  it("src has no 'Lab N' text (page text, titles, comments)", () => {
    expect(offenders(textFiles("src", /\.(ts|tsx|json|html|css)$/))).toEqual([]);
  });
  it("the Lab docs and the assets table have no 'Lab N' text", () => {
    expect(offenders([...textFiles("docs/labs", /\.md$/), "docs/ASSETS.md", "docs/university-labs.md", "docs/pipelines.md"])).toEqual([]);
  });
  it("the Lab tests and Lab scripts have no 'Lab N' text", () => {
    const own = (f: string) => !f.endsWith("no-lab-numbers.test.ts");
    expect(offenders([...textFiles("tests", /\.test\.ts$/).filter(own), ...textFiles("scripts", /lab.*\.(mjs|ts|py)$/i)])).toEqual([]);
  });
  it("the picker and the Labs bar show names, not numbers", async () => {
    const { LAB_LIST } = await import("../src/ui/labs-series");
    for (const l of LAB_LIST) expect(l.name).not.toMatch(/^\d|Lab \d/i);
    const picker = readFileSync("src/ui/world-picker.ts", "utf8");
    for (const l of LAB_LIST) expect(picker).toContain(`'${l.mode}', '${l.name}'`);
  });
});
