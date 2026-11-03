// Hashes the results of each Math function over fixed inputs; run on each machine/Node and compare the lines.
import { createHash } from "node:crypto";
let a = 12345; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const xs = Array.from({ length: 200000 }, () => (rnd() - 0.5) * 40);
const pos = xs.map(Math.abs);
const f = { sin: [Math.sin, xs], cos: [Math.cos, xs], tan: [Math.tan, xs], atan: [Math.atan, xs], exp: [Math.exp, xs.map((x) => x / 4)], log: [Math.log, pos], sqrt: [Math.sqrt, pos], cbrt: [Math.cbrt, xs],
  pow15: [(x) => Math.pow(x, 1.5), pos], pow2: [(x) => Math.pow(x, 2), pos], powInt3: [(x) => x ** 3, xs], pow05: [(x) => x ** 0.5, pos], pow: [(x, i) => Math.pow(pos[i], xs[(i + 1) % xs.length] / 8), xs],
  atan2: [(x, i) => Math.atan2(x, xs[(i + 1) % xs.length]), xs], hypot: [(x, i) => Math.hypot(x, xs[(i + 1) % xs.length]), xs], asin: [(x) => Math.asin(x / 21), xs], acos: [(x) => Math.acos(x / 21), xs] };
console.log(process.version, process.versions.v8, process.arch);
for (const [k, [fn, inp]] of Object.entries(f)) {
  const h = createHash("sha256"); let bad = 0;
  inp.forEach((x, i) => { const y = fn(x, i); h.update(String(y)); });
  console.log(k.padEnd(8), h.digest("hex").slice(0, 16));
}
