// The per-tick world fingerprint (FNV-1a over the JSON of the world after EVERY tick) for every shipped course the golden covers; same code runs in Node and in workerd (no node:crypto).
// Lines: "<plan|mashN> <course> <ticks> <hash>". Compare the Node output with the workerd output byte for byte.
import { playPlan } from "../../../src/sim/ideal";
import { newWorld, stepWorld } from "../../../src/sim/world";
import type { RunnerInput } from "../../../src/sim/runner";
import type { CourseData } from "../../../src/course/course";

function mash(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const M = (1n << 64n) - 1n;
function fnv() { let h = 0xcbf29ce484222325n; return { add(s: string) { for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & M; } }, hex: () => h.toString(16).padStart(16, "0") }; }

export function hashLines(courses: Record<string, CourseData>): string[] {
  const out: string[] = [];
  for (const [name, course] of Object.entries(courses)) {
    if (course.plan) { const f = fnv(); let n = 0; playPlan(course, course.plan, undefined, (w) => { f.add(JSON.stringify(w)); n++; }); out.push(`plan ${name} ${n} ${f.hex()}`); }
    for (const seed of [1, 2, 3]) {
      const rnd = mash(seed), f = fnv(); let w = newWorld(course); let hold: Partial<RunnerInput> = {}; let n = 0;
      for (let i = 0; i < 2400 && w.outcome === "running"; i++) {
        if (i % 24 === 0) hold = { run: rnd() < 0.85, left: rnd() < 0.05, squat: rnd() < 0.2, roll: rnd() < 0.1, slide: rnd() < 0.1, handL: rnd() < 0.5, handR: rnd() < 0.5, vault: rnd() < 0.15, up: rnd() < 0.3, fire: rnd() < 0.2, aimUp: rnd() < 0.2, aimDown: rnd() < 0.2 };
        const input = { run: false, jump: i % 36 === 0 && rnd() < 0.6, jumpSpeed: 5 + rnd() * 3, squat: false, ...hold } as RunnerInput;
        w = stepWorld(w, input, course); f.add(JSON.stringify(w)); n++;
      }
      out.push(`mash${seed} ${name} ${n} ${w.outcome} ${f.hex()}`);
    }
  }
  return out;
}

// The Math probe with the same FNV hash, so Node and workerd print comparable lines (no node:crypto in a Worker).
export function probeLines(): string[] {
  let a = 12345; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const xs = Array.from({ length: 50000 }, () => (rnd() - 0.5) * 40), pos = xs.map(Math.abs), n = xs.length;
  const f: Record<string, [(x: number, i: number) => number, number[]]> = {
    sin: [Math.sin, xs], cos: [Math.cos, xs], tan: [Math.tan, xs], atan: [Math.atan, xs], exp: [Math.exp, xs.map((x) => x / 4)], log: [Math.log, pos], sqrt: [Math.sqrt, pos],
    atan2: [(x, i) => Math.atan2(x, xs[(i + 1) % n]), xs], hypot: [(x, i) => Math.hypot(x, xs[(i + 1) % n]), xs], asin: [(x) => Math.asin(x / 21), xs], acos: [(x) => Math.acos(x / 21), xs],
    sinSmall: [(x) => Math.sin(x / 40), xs], cosSmall: [(x) => Math.cos(x / 40), xs], expNeg: [(x) => Math.exp(-Math.abs(x) / 500), xs], tanSmall: [(x) => Math.tan(x / 40), xs],
  };
  return Object.entries(f).map(([k, [fn, inp]]) => { const h = fnv(); inp.forEach((x, i) => h.add(String(fn(x, i)))); return `${k.padEnd(8)} ${h.hex()}`; });
}
