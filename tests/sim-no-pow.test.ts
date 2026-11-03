import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// CC-133: `x ** n` and Math.pow round differently in V8 12.4 (Node 22) and V8 13.6 (Node 24), so the world after a tick differed in the last digit.
// Multiplication, division and Math.sqrt are exactly rounded by the IEEE rule, so they match on every engine.
// This scan fails if a power operator comes back anywhere the simulator can reach.
// It starts at the files that run a tick, replay a run or fingerprint a course, and follows their relative imports.
const ROOTS = ["src/sim/world.ts", "src/sim/replay.ts", "src/sim/ideal.ts", "src/sim/predict.ts", "src/sim/experiments.ts", "src/labs/integration/engine.ts"];

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
const resolve = (from: string, spec: string): string | null => {
  const base = join(dirname(from), spec);
  for (const c of [base + ".ts", join(base, "index.ts"), base]) if (existsSync(c) && /\.ts$/.test(c)) return c;
  return null;
};
function reach(): string[] {
  const seen = new Set<string>(), todo = [...ROOTS];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) { const r = resolve(f, m[1]); if (r) todo.push(r); }
  }
  return [...seen].sort();
}
// Files reached from the roots that only draw or format (never feed a tick or a fingerprint) may keep a power; list each with its reason.
const DISPLAY_ONLY: Record<string, string> = {};

describe("the simulator uses only exactly rounded arithmetic", () => {
  const files = reach();
  it("reaches the real sim files (the scan is not empty)", () => {
    expect(files).toContain("src/sim/beam.ts");
    expect(files).toContain("src/sim/cart.ts");
    expect(files).toContain("src/sim/drone.ts");
    expect(files).toContain("src/sim/vault.ts");
  });
  it("has no ** and no Math.pow in any file a tick, a replay or a course fingerprint reaches", () => {
    const bad: string[] = [];
    for (const f of files) {
      if (f in DISPLAY_ONLY) continue;
      strip(readFileSync(f, "utf8")).split("\n").forEach((line, i) => { if (/\*\*|Math\.pow/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`); });
    }
    expect(bad).toEqual([]);
  });
});
