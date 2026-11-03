// A tiny Worker run under `wrangler dev` (workerd, the Cloudflare runtime): same outcome lines as outcomes.ts for six courses, plus the Math probe.
import { playPlan } from "../../../../src/sim/ideal";
import { newWorld, stepWorld } from "../../../../src/sim/world";
import type { RunnerInput } from "../../../../src/sim/runner";
import type { CourseData } from "../../../../src/course/course";
import drone from "../../../../public/assets/demo/drone.course.json";
import plank from "../../../../public/assets/demo/plank.course.json";
import plank2 from "../../../../public/assets/demo/plank-two.course.json";
import training from "../../../../public/assets/demo/training.course.json";
import lache from "../../../../public/assets/demo/lache.course.json";
import lacheWide from "../../../../public/assets/demo/lache-wide.course.json";

function mash(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const bits = (w: { runner: { x: number; y: number } }) => `${w.runner.x.toFixed(6)},${w.runner.y.toFixed(6)}`;
const courses: Record<string, unknown> = { "drone.course.json": drone, "plank.course.json": plank, "plank-two.course.json": plank2, "training.course.json": training, "lache.course.json": lache, "lache-wide.course.json": lacheWide };

export default {
  async fetch(): Promise<Response> {
    const seeds = 300; const out: string[] = [];
    for (const [name, c] of Object.entries(courses)) {
      const course = c as CourseData;
      if (course.plan) { let n = 0; const r = playPlan(course, course.plan, undefined, () => { n++; }); out.push(`plan ${name} ${n} ${r.world.outcome} ${bits(r.world)}`); }
      for (let seed = 1; seed <= seeds; seed++) {
        const rnd = mash(seed); let w = newWorld(course); let hold: Partial<RunnerInput> = {}; let n = 0;
        for (let i = 0; i < 2400 && w.outcome === "running"; i++) {
          if (i % 24 === 0) hold = { run: rnd() < 0.85, left: rnd() < 0.05, squat: rnd() < 0.2, roll: rnd() < 0.1, slide: rnd() < 0.1, handL: rnd() < 0.5, handR: rnd() < 0.5, vault: rnd() < 0.15, up: rnd() < 0.3, fire: rnd() < 0.2, aimUp: rnd() < 0.2, aimDown: rnd() < 0.2 };
          const input = { run: false, jump: i % 36 === 0 && rnd() < 0.6, jumpSpeed: 5 + rnd() * 3, squat: false, ...hold } as RunnerInput;
          w = stepWorld(w, input, course); n++;
        }
        out.push(`mash${seed} ${name} ${n} ${w.outcome} ${bits(w)}`);
      }
    }
    // Math.pow probe: a few raw values to see the last digits on this runtime.
    const pr = [1.5, 2.5, 7.77, 13.1].map((x) => `${x}**3=${x ** 3} pow1.5=${Math.pow(x, 1.5)}`);
    return new Response(out.join("\n") + "\n#PROBE\n" + pr.join("\n") + "\n");
  },
};
