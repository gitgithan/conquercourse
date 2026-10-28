import type { Terrain } from '../sim/terrain';
import type { RopeParams } from '../sim/rope';
import type { WallParams } from '../sim/wall';

// Course data: versioned JSON. Platforms and water are the ground; the wall and the rope are placed on it.
// A real object drawn in the game where the editor put it (looks only; collision is the platform profile)
export interface SceneItem {
  url?: string; // a baked .glb under /assets
  mesh?: { positions: number[]; indices: number[] }; // or an inline mesh (basic shapes, cropped pieces), already standing on y = 0 and centred
  stack?: string; // or a sport-stacking pattern ("3-6-3"): drawn as instanced cups, scale = metres per cup metre
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
  routes?: import('../sim/ideal').Route[]; // the ways through a pair of bars and their times (bar to bar, or a skip), found with the plan
  plan?: import('../sim/ideal').Plan; // a proved line for the whole course from its start (generated courses carry it: a whole-course proof is slow)
  jumpKeep?: number; // share of the forward speed kept when a jump takes off (default 1: none lost); below 1, a jump costs speed and a vault, which keeps more, pays
  holds?: { x: number; y: number }[]; // bars hanging in the air: where along the run and how high (side view)
  track?: import('../sim/cart').TrackData; // a coaster: the cart rolls along these rails from the first push (src/sim/cart.ts)
  uMap?: { u0: number; u1: number; x0: number }[]; // editor lanes: where each run of ground came from
  scene?: SceneItem[]; // editor lanes: the real objects, drawn instead of blocks
  trebuchet?: Partial<import('../sim/trebuchet').TrebuchetParams> & { x: number }; // a trebuchet at x: the course starts with the rider in its sling
  recoil?: Partial<import('../sim/recoil').RecoilParams> & { x0: number; x1: number }; // a launcher pad (src/sim/recoil.ts): stepping on it clips the launcher on; K fires it
  planks?: import('../sim/beam').PlankData[]; // plank bridges laid across gaps: they sag and break under the rider (src/sim/beam.ts)
  hazard?: import('./hazard').Hazard; // the floor you must not touch: water (default), lava, mud, spikes or void; paint, words and sound only
}
