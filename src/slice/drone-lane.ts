import type { CourseData } from '../course/course';
import { DEFAULT_DRONE } from '../sim/drone';

// A lane with a drone (CC-87): a pad on a deck, hold E on it to board the cargo drone. The editor keeps the lane as it is and calls this on the course it makes,
// so the proof and the Play button see the drone too. The knobs are the rider's weight and the battery. The pad sits where the editor's drone piece is (`range`),
// or on the start deck when no piece position is given.
export interface DroneCfg { payload: number; battery: number }
export const DRONE_PAD_LENGTH = 4;

export function withDrone(c: CourseData, cfg: DroneCfg, range?: { x0: number; x1: number }): CourseData {
  const p0 = range ? c.terrain.platforms.find((p) => p.x0 <= range.x0 && p.x1 >= range.x1) : c.terrain.platforms.find((p) => p.x0 <= c.startX + 0.01 && p.x1 > c.startX);
  if (!p0) return c;
  const x0 = Math.round((range?.x0 ?? c.startX + 1.5) * 100) / 100;
  const x1 = Math.round((range?.x1 ?? Math.min(c.startX + 1.5 + DRONE_PAD_LENGTH, p0.x1 - 0.5)) * 100) / 100;
  if (x1 - x0 < 2) return c; // no room for a pad
  const { plan: _plan, routes: _routes, ...keep } = c;
  void _plan; void _routes; // a stored line was found without the drone
  return { ...keep, drone: { ...DEFAULT_DRONE, x0, x1, payload: cfg.payload, battery: cfg.battery } };
}
