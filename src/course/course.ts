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
  id?: string; // the lifted object this stands for (the fork demo course keys its placeholders by these ids, so a real lift can replace one without touching the physics)
}

// What the editor made the course from, so the Course can open the same pieces again (CC-80). 'copy': rebuilt from a course that had no source.
export interface CourseSource {
  kind: 'editor' | 'copy';
  pieces: { src: string; x: number; z: number; y: number; yaw: number; scale: number; role?: string }[]; // machines (trebuchet, launcher) are pieces too: their src carries the numbers
  angle: number; offset: number; level: number; // the lane: turn about the rod (radians), sideways (m), level (m)
  floor?: string; // the floor you must not touch
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
  windows?: import('../sim/ideal').Window[]; // how wide the window of good presses is at each take-off edge (in metres along the run), stored with the plan: the fall tip uses it, and a search on the page would freeze it
  plan?: import('../sim/ideal').Plan; // a proved line for the whole course from its start (generated courses carry it: a whole-course proof is slow)
  jumpKeep?: number; // share of the forward speed kept when a jump takes off (default 1: none lost); below 1, a jump costs speed and a vault, which keeps more, pays
  grabReach?: number; // m, how close the hands must be to a bar for the first grab (default 0.15, src/sim/holds.ts, so the drawn hands touch the bar; CC-193)
  holds?: { x: number; y: number }[]; // bars hanging in the air: where along the run and how high (side view)
  bars?: import('../sim/bars').BarRun[]; // monkey bars: rows of rungs overhead, crossed hand over hand with Q and T (src/sim/bars.ts)
  track?: import('../sim/cart').TrackData; // a coaster: the cart rolls along these rails from the first push (src/sim/cart.ts)
  uMap?: { u0: number; u1: number; x0: number }[]; // editor lanes: where each run of ground came from
  scene?: SceneItem[]; // editor lanes: the real objects, drawn instead of blocks
  trebuchet?: Partial<import('../sim/trebuchet').TrebuchetParams> & { x: number }; // a trebuchet at x: the course starts with the rider in its sling
  recoil?: Partial<import('../sim/recoil').RecoilParams> & { x0: number; x1: number }; // a launcher pad (src/sim/recoil.ts): stepping on it clips the launcher on; K fires it
  planks?: import('../sim/beam').PlankData[]; // plank bridges laid across gaps: they sag and break under the rider (src/sim/beam.ts)
  off?: ('vault' | 'wall' | 'rope' | 'roll')[]; // shortcut search only: switch a move off (the geometry stays) to see if the course can be cleared without it
  shortcuts?: import('../sim/shortcuts').Shortcut[]; // routes the designer did not plan, found by the shortcut search and stored like `plan` (npm run plans)
  designedShortcuts?: string[]; // ids of shortcuts the designer keeps on purpose (src/sim/shortcuts.ts)
  band?: Partial<import('../sim/band').BandParams> & { x: number }; // an elastic band tied to a post at x: the course starts clipped on, one rest length behind it
  source?: CourseSource; // editor lanes: the pieces and lane this course was cut from (CC-80)
  pole?: import('../sim/pole-ride').PoleSetup; // a pole vault (src/sim/pole-ride.ts): pick the pole up, run, hold E in the box, let go at the top
  drone?: Partial<import('../sim/drone').DroneParams> & { x0: number; x1: number }; // a drone pad (src/sim/drone.ts): hold E on it to board the cargo drone and fly across
  climbPoles?: import('../sim/pole-climb').ClimbPole[]; // standing poles to climb with E held (src/sim/pole-climb.ts, CC-133): the fork's bulb lane starts on one
  branches?: import('../sim/branches').Branch[]; // forks with two or three ways through a stretch (src/sim/branches.ts, CC-224); a course without it has one way
  keepDecks?: boolean; // a course with photo objects normally draws only the first and last deck (the objects are the ground); true keeps every deck as well (the hero course: one object on a lane of decks)
  shots?: import('../sim/shots').ShotLauncher[]; // timed ball launchers: a ball every few seconds on the simulator's clock, the same for every player (src/sim/shots.ts)
  hazard?: import('./hazard').Hazard; // the floor you must not touch: water (default), lava, mud, spikes or void; paint, words and sound only
}
