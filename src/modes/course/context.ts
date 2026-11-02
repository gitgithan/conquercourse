import type * as THREE from 'three/webgpu';
import type { CourseData } from '../../course/course';
import type { gapSpecs } from '../../sim/needs';
import type { GameEvent } from '../../sim/world';
import type { CourseState } from './state';

// What the parts of one Course session share besides the state: the course, the log of the run, the guide meshes and the facts about the wall.
// Like CourseState it is one object made once in startCourse; parts take it as their first argument and read it by property.
export interface CourseCtx {
  course: CourseData;
  st: CourseState;
  log: GameEvent[]; // the events of the run on screen (cleared on a restart, never replaced)
  guides: THREE.Group; // the green and orange lines of the slow-motion replay
  specs: ReturnType<typeof gapSpecs>;
  wallNeed: number; // the slowest speed that clears the wall (Infinity when there is none)
  wallEntry: number; // the speed at the foot of the wall on the last climb
}
