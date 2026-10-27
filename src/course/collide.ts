import type { CourseData } from './course';
import { DEFAULT_WALL } from '../sim/wall';
import { heightAt } from '../sim/terrain';

// Where a point of the body is inside the world (a platform or the warped wall), and how far to move it out.
// The Rookie's joints are pushed out of these so the body never sinks into a block or the curve.
export type Obstacle = (x: number, y: number, skin?: number) => { dx: number; dy: number } | null;

const DEFAULT_SIDE = 0.16; // m, how far outside a side face or the curve a body point is kept by default (a body's half thickness; the feet use less)
const TOP = 0.02;

export function makeObstacle(course: CourseData): Obstacle {
  const platforms = course.terrain.platforms;
  const wall = course.wall ? { x0: course.wall.x0, R: course.wall.radius ?? course.wall.height ?? DEFAULT_WALL.height } : null;
  return (x, y, SIDE = DEFAULT_SIDE) => {
    let best: { dx: number; dy: number } | null = null;
    const take = (dx: number, dy: number) => { if (!best || Math.hypot(dx, dy) > Math.hypot(best.dx, best.dy)) best = { dx, dy }; };
    for (const p of platforms) {
      const top = heightAt(p, Math.min(p.x1, Math.max(p.x0, x))); // the surface under this point (a curved top is not flat)
      if (x <= p.x0 - SIDE || x >= p.x1 + SIDE || y >= top - 0.01) continue;
      const up = top - y + TOP, left = x - p.x0 + SIDE, right = p.x1 - x + SIDE;
      // a point only a little under the top is lifted onto it (feet sunk into the floor); a deeper one goes out sideways (toes in a vertical face)
      const lift = top - y < 0.2 ? up : up * 4;
      const m = Math.min(lift, left, right);
      take(m === lift ? 0 : m === left ? -left : right, m === lift ? up : 0);
    }
    if (wall && x > wall.x0 && x < wall.x0 + wall.R && y > -1 && y < wall.R) {
      // the solid is under the quarter circle whose centre is (x0, R): points farther than R from the centre
      const d = Math.hypot(x - wall.x0, y - wall.R);
      if (d > wall.R) take(((wall.x0 - x) / d) * (d - wall.R + SIDE), ((wall.R - y) / d) * (d - wall.R + SIDE));
    }
    return best;
  };
}
