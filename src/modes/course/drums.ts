import type { CourseData } from '../../course/course';
import type { RunSearch } from './search';
import { workSeconds, type Plan } from '../../sim/ideal';
import { drumsFor, drumsForPaths, type Drum } from '../../sim/drums';
import { pathsOn } from '../../ui/paths';
import { branchesOf } from '../../sim/branches';
import { createDrumLane } from '../../ui/drum-lane';

export interface DrumsCtx {
  course: CourseData;
  params: URLSearchParams;
  forceDrums: boolean;
  runSearch: RunSearch;
}

// The drum lane and the drums the toasts count down to (CC-195). `toastDrums()` is read each frame, so it is an accessor.
export function mountDrums(c: DrumsCtx) {
  const { course, params, forceDrums, runSearch } = c;
  const drumLane = createDrumLane(document.body, !course.track);
  let toastDrums: Drum[] = []; // the same drums as the key strip: each obstacle's toast starts a fixed lead before its key (CC-195)
  const showDrums = (result: { plan: Plan; cleared: boolean }): void => {
    try {
      const forkDrums = pathsOn(params) ? drumsForPaths(course) : null; // CC-225: both ways of a fork, each in its own row
      const fb = branchesOf(course)[0];
      const drums = forkDrums ?? (result.cleared ? drumsFor(course, result.plan) : []);
      drumLane.set(drums, forkDrums && fb ? [{ x: fb.forkX, label: `Fork: top ${fb.routes[0].name.split(':')[0]}, bottom ${fb.routes[1].name.split(':')[0]}` }, { x: fb.joinX, label: 'Join' }] : []);
      toastDrums = drums;
      const show = forceDrums || drums.length > 0;
      if (drumLane.shown !== show) drumLane.toggle();
    } catch {
      drumLane.set([]);
      if (drumLane.shown !== forceDrums) drumLane.toggle();
    }
  };
  setTimeout(() => {
    if (course.track) { drumLane.set([]); if (drumLane.shown) drumLane.toggle(); return; }
    // CC-243: a course that carries its plan (a demo course, a ready-made editor course, or an edited one the lane check already proved) shows its drums at once;
    // any other is searched in the workers, never on the page's thread (a whole-course search there froze the Course for up to two minutes)
    if (course.plan) { showDrums({ plan: course.plan, cleared: true }); return; }
    if (pathsOn(params)) { showDrums({ plan: undefined as unknown as Plan, cleared: false }); return; }
    drumLane.set([]);
    void runSearch(course, { cancelled: false }, undefined, workSeconds(60), 'drums').then((r) => showDrums(r)).catch(() => showDrums({ plan: undefined as unknown as Plan, cleared: false }));
  }, 0);
  return { drumLane, toastDrums: () => toastDrums };
}
