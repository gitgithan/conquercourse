// Writes tests/fixtures/noisy-bars.json: a small made-up monkey-bars lift with the faults of a real one (CC-133, docs/pipelines.md).
//   npx tsx scripts/make-noisy-bars-fixture.ts
// Truth: 10 rungs, one every 0.5 m, 2.1 m up, a post at each end, 2.2 m tall in all.
// Faults: 15 % of the rung triangles missing (holes), a floating blob, the depth squeezed to 40 %, the whole thing 1.3 times too big.
import { writeFileSync } from 'node:fs';

let seed = 20261104;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; // a fixed little generator: the same file every time
const positions: number[] = [], indices: number[] = [];
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, holes: boolean) => {
  const b = positions.length / 3;
  positions.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  for (let t = 0; t < q.length; t += 3) if (!(holes && rnd() < 0.15)) indices.push(b + q[t], b + q[t + 1], b + q[t + 2]);
};
const N = 10, GAP = 0.5, Y = 2.1, HALF_Z = 0.9;
for (let i = 0; i < N; i++) { const x = (i - (N - 1) / 2) * GAP; box(x - 0.03, x + 0.03, Y - 0.03, Y + 0.03, -HALF_Z, HALF_Z, true); }
const end = ((N - 1) / 2) * GAP + 0.4;
for (const s of [-1, 1]) { box(s * end - 0.05, s * end + 0.05, 0, 2.2, -HALF_Z, -HALF_Z + 0.1, false); box(s * end - 0.05, s * end + 0.05, 0, 2.2, HALF_Z - 0.1, HALF_Z, false); } // a post at each end, both sides
for (const z of [-HALF_Z, HALF_Z - 0.1]) box(-end, end, Y - 0.05, Y + 0.05, z, z + 0.1, false); // a side rail each side holds the rungs together
box(3.5, 3.7, 1, 1.2, 1.5, 1.7, false); // the floating blob, far from the frame
const out = positions.map((v, i) => Math.round(v * (i % 3 === 2 ? 0.4 : 1) * 1.3 * 10000) / 10000); // squeezed depth, wrong scale
writeFileSync('tests/fixtures/noisy-bars.json', JSON.stringify({ truth: { rungs: N, gap: GAP, height: Y, tall: 2.2, scaleError: 1.3, depthSqueeze: 0.4 }, positions: out, indices }, null, 2) + '\n');
console.log(`${out.length / 3} vertices, ${indices.length / 3} triangles`);
