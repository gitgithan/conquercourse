import type { Terrain } from '../sim/terrain';
import type { RopeParams } from '../sim/rope';
import type { WallParams } from '../sim/wall';

// Course data: versioned JSON. Platforms and water are the ground; the wall and the rope are placed on it.
// A real object drawn in the game where the editor put it (looks only; collision is the platform profile)
export interface SceneItem {
  url?: string; // a baked .glb under /assets
  mesh?: { positions: number[]; indices: number[] }; // or an inline mesh (basic shapes, cropped pieces), already standing on y = 0 and centred
  x: number; y: number; z: number; rotY: number; scale: number;
}

export interface CourseData {
  version: 1;
  name: string;
  startX: number;
  finishX: number; // crossing it standing on a platform clears the course
  jumpSpeed: number; // m/s upward when Space is pressed on the ground
  terrain: Terrain;
  checkpoints?: { id: string; x: number }[]; // each obstacle can be started from standing still just before it (id = the zone id)
  zones?: { id: string; name: string; x0: number; x1: number }[]; // where each obstacle lives, for messages and the Dojo link
  wall?: { x0: number } & Partial<WallParams>; // curve starts at x0 and rises over `height` metres of run
  rope?: Partial<RopeParams> & { anchorX: number; anchorY: number };
  uMap?: { u0: number; u1: number; x0: number }[]; // editor lanes: where each run of ground came from
  scene?: SceneItem[]; // editor lanes: the real objects, drawn instead of blocks
}
