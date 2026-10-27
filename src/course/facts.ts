import type { CourseData } from './course';
import { gapSpecs, minSpeedForWall, type GapSpec } from '../sim/needs';
import { DEFAULT_WALL } from '../sim/wall';
import { DEFAULT_ROPE } from '../sim/rope';
import { DEFAULT_TRAMPOLINE, bounce } from '../sim/trampoline';
import { DEFAULT_LANDING, landing, ouch } from '../sim/landing';
import { GRAVITY } from '../sim/units';

// What a course really asks of the player, worked out from its data by trying the simulator. The Dojo reads these
// numbers instead of carrying its own, so when the course changes (a Park course, a redesign) the lessons follow.
export interface CourseFacts {
  gaps: GapSpec[];
  wall?: { height: number; needSpeed: number };
  rope?: { length: number; anchorHeight: number };
  trampoline?: { drop: number; farRise: number; springHeight: number; extraNeeded: number; pump: number };
  biggestDrop?: { height: number; ouchStiff: number; ouchBent: number; pushStiff: number; pushBent: number };
}

export function courseFacts(course: CourseData): CourseFacts {
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  const facts: CourseFacts = { gaps: gapSpecs(course) };
  if (course.wall) {
    const wp = { ...DEFAULT_WALL, ...course.wall };
    facts.wall = { height: wp.height, needSpeed: minSpeedForWall(course.wall) };
  }
  if (course.rope) facts.rope = { length: course.rope.length ?? DEFAULT_ROPE.length, anchorHeight: course.rope.anchorY };
  const bed = ps.find((p) => p.bouncy);
  if (bed) {
    const before = [...ps].reverse().find((p) => p.x1 <= bed.x0 + 0.01);
    const after = ps.find((p) => p.x0 >= bed.x1 && !p.bouncy);
    if (before && after) {
      const drop = Math.max(0.1, before.top - bed.top);
      const vOut = bounce(Math.sqrt(2 * GRAVITY * drop)).vyOut;
      const farRise = after.top - bed.top;
      const needV = Math.sqrt(2 * GRAVITY * (farRise + 0.3));
      facts.trampoline = { drop, farRise, springHeight: (vOut * vOut) / (2 * GRAVITY), extraNeeded: Math.max(0, needV - vOut), pump: DEFAULT_TRAMPOLINE.pump };
    }
  }
  let best = 0;
  ps.forEach((p, i) => { const n = ps[i + 1]; if (n && !n.bouncy && n.x0 - p.x1 < 0.5 && p.top - n.top > best) best = p.top - n.top; });
  if (best > 0) {
    const v = Math.sqrt(2 * GRAVITY * best);
    facts.biggestDrop = { height: best, ouchStiff: ouch(landing(v, false, DEFAULT_LANDING).peakDecel), ouchBent: ouch(landing(v, true, DEFAULT_LANDING).peakDecel), pushStiff: landing(v, false, DEFAULT_LANDING).peakDecel, pushBent: landing(v, true, DEFAULT_LANDING).peakDecel };
  }
  return facts;
}
