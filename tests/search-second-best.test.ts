import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { playPlan, searchIdealRun } from "../src/sim/ideal";
import { readGlbMesh } from "../src/slice/glb";
import { roleCourse } from "../src/slice/roles";
import { newPiece } from "../src/slice/world";

// The greedy search takes the middle of the presses that reach farthest at each edge; that can strand a later edge. The second-best branch (CC-69) then
// tries other presses at the last two take-off edges. This layout is the Park rail run as first built: the greedy plan's 4th jump (22.48 m) leaves the
// last jump no room, and a press at 19.6 to 20.9 m clears.
const load = (glb: string, x: number) => {
  const b = readFileSync(`public/assets/objects/${glb}`);
  return newPiece(glb.replace(".glb", ""), readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), { x, z: 0 });
};

describe("the search's second-best branch", () => {
  it("finds a plan for the Park rail run layout where the greedy plan strands the last jump", () => {
    const pieces = [["rail-skate-01.glb", 3], ["rail-skate-02.glb", 8.5], ["railing-iron.glb", 13.5], ["box-skate-03.glb", 19]].map(([g, x]) => load(g as string, x as number));
    const { course } = roleCourse(pieces, { angle: 0, offset: 0, level: 0 }, "t") as { course: CourseData };
    const r = searchIdealRun(course);
    expect(r.cleared).toBe(true);
    expect(playPlan(course, r.plan).world.outcome).toBe("cleared");
    expect(r.plan.jumpXs[3]).toBeLessThan(21); // not the greedy 22.48 m
  }, 120000);
});
