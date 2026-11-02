import { describe, expect, it } from "vitest";
import { DEFAULT_PLANK, isPlankPiece, plankPiece, plankSpecOf, plankSrc, planksOf, setPlank } from "../src/slice/plank-world";
import { laneToCourse, sliceProfile } from "../src/slice/slice";
import { newPiece, worldSamples } from "../src/slice/world";
import { fixPlank, plankHolds } from "../src/sim/beam";
import { searchIdealRun } from "../src/sim/ideal";
import type { P } from "../src/slice/holds-world";
import { box, lane } from './helpers/pieces';

const deck = (x: number, w: number): P => ({ ...newPiece("Deck", box(w, 0.5, 1.8), { x, z: 0 }), src: "x" });

// two decks 9 m apart; a plank lies across the gap (the plank bridge, as built in the editor)
const world = (thickness = 0.035): P[] => [deck(0, 8), deck(17, 8), { ...plankPiece({ ...DEFAULT_PLANK, span: 9, thickness }, { x: 8.5, z: 0 }) }];

const courseOf = (ps: P[]) => {
  const ground = ps.filter((p) => !isPlankPiece(p));
  const planks = planksOf(ps, lane).map((pl) => ({ u0: pl.u0, u1: pl.u1, thickness: pl.spec.thickness, width: pl.spec.width, material: pl.spec.material, support: pl.spec.support }));
  return laneToCourse(sliceProfile(worldSamples(ground), { x: 0, z: 0 }, lane), "test", [], {}, planks);
};

describe("plank bridge built in the editor", () => {
  it("keeps its knobs in the src, so saving and copying keep them", () => {
    const spec = { ...DEFAULT_PLANK, material: "steel" as const, span: 7.5, thickness: 0.03, width: 0.8, support: true };
    expect(plankSpecOf(plankSrc(spec))).toEqual(spec);
    expect(plankSpecOf("hold:bar")).toBeUndefined();
  });

  it("is found along the lane, is not ground, and is ignored when turned across the lane", () => {
    expect(planksOf(world(), lane).length).toBe(1);
    const p = world()[2];
    expect(planksOf([{ ...p, yaw: Math.PI / 2 }], lane)).toEqual([]);
    expect(worldSamples([p]).length).toBe(0); // it adds nothing to the ground samples
  });

  it("becomes a plank in the course across the real gap (not squeezed)", () => {
    const c = courseOf(world());
    expect(c.planks?.length).toBe(1);
    const [a, b] = c.terrain.platforms.slice(1);
    expect(c.planks![0].x0).toBeCloseTo(a.x1, 2);
    expect(c.planks![0].x1).toBeCloseTo(b.x0, 2);
    expect(c.planks![0].x1 - c.planks![0].x0).toBeGreaterThan(8);
  });

  it("makes a lane the simulator can clear that it could not without the plank", () => {
    expect(searchIdealRun(courseOf(world())).cleared).toBe(true);
    expect(searchIdealRun({ ...courseOf(world()), planks: undefined }).cleared).toBe(false);
  });

  it("a thin plank makes a lane that cannot be cleared, and Fix it gives a thicker one or a post", () => {
    const c = courseOf(world(0.02));
    expect(searchIdealRun(c).cleared).toBe(false);
    const f = fixPlank(c.planks![0]);
    expect(f.ok).toBe(true);
    expect(plankHolds(f.plank)).toBe(true);
    const p = world(0.02)[2];
    setPlank(p, { ...plankSpecOf(p.src)!, thickness: f.plank.thickness, support: !!f.plank.support });
    expect(searchIdealRun(courseOf([deck(0, 8), deck(17, 8), p])).cleared).toBe(true);
  });
});
