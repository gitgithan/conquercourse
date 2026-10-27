import type { Terrain } from '../sim/terrain';
import type { RopeParams } from '../sim/rope';
import type { WallParams } from '../sim/wall';

// Course data: versioned JSON. Platforms and water are the ground; the wall and the rope are placed on it.
export interface CourseData {
  version: 1;
  name: string;
  startX: number;
  finishX: number; // crossing it standing on a platform clears the course
  jumpSpeed: number; // m/s upward when Space is pressed on the ground
  terrain: Terrain;
  wall?: { x0: number } & Partial<WallParams>; // curve starts at x0 and rises over `height` metres of run
  rope?: Partial<RopeParams> & { anchorX: number; anchorY: number };
}
