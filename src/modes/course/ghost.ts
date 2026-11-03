import type * as THREE from 'three/webgpu';
import type { CourseData } from '../../course/course';
import type { Plan } from '../../sim/ideal';
import type { RunSearch } from './search';
import { createGhost, type Ghost } from '../../ui/ghost';

export interface CourseGhostCtx {
  scene: THREE.Scene;
  course: CourseData;
  params: URLSearchParams;
  idealCache: Map<number, Plan>;
  runSearch: RunSearch;
  progressZones: { x0: number; x1: number }[];
  strip: HTMLElement;
  look(): 'a' | 'b'; // read each time the ghost is drawn: the player can change the look
}

// The ghost to chase (CC-99): the same options as before, now made here.
export function mountCourseGhost(c: CourseGhostCtx): Ghost {
  const { scene, course, params, idealCache, runSearch, progressZones, strip, look } = c;
  return createGhost({
    scene, parent: document.body, course,
    idealPlan: async () => idealCache.get(course.startX) ?? course.plan ?? (await runSearch(course, { cancelled: false }, undefined, undefined, 'ghost').then((r) => r.plan).catch(() => null)),
    zoneIndexAt: (x) => progressZones.findIndex((z) => x >= z.x0 && x < z.x1),
    strip: () => strip,
    look, oldLook: params.get('ghost') === 'old',
  });
}
