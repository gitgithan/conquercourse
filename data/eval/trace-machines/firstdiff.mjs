// Finds the first tick and first field (path) that differ between two dump folders.
import { readdirSync, readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2);
const diffs = (x, y, p = "") => {
  if (typeof x === "number" && typeof y === "number") return x === y || (Number.isNaN(x) && Number.isNaN(y)) ? [] : [[p, x, y]];
  if (x && y && typeof x === "object" && typeof y === "object") { const out = []; for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) out.push(...diffs(x[k], y[k], `${p}.${k}`)); return out; }
  return JSON.stringify(x) === JSON.stringify(y) ? [] : [[p, x, y]];
};
for (const f of readdirSync(a).sort()) {
  const A = readFileSync(`${a}/${f}`, "utf8").split("\n"), B = readFileSync(`${b}/${f}`, "utf8").split("\n");
  let t = A.findIndex((l, i) => l !== B[i]);
  if (t < 0) { console.log(f, "identical", A.length - 1, "ticks"); continue; }
  const d = diffs(JSON.parse(A[t] || "null"), JSON.parse(B[t] || "null"));
  const ulp = d.map(([p, x, y]) => `${p} ${x} vs ${y} (rel ${typeof x === "number" ? Math.abs((x - y) / (x || 1)).toExponential(2) : "-"})`);
  console.log(f, `lengths ${A.length - 1}/${B.length - 1}`, `first diff tick ${t}`, `fields ${d.length}`, ulp.slice(0, 4).join(" | "));
}
