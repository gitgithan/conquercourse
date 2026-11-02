import type { CourseData } from '../../course/course';
import { isAimable } from '../../sim/recoil';
import { predictShot, type Prediction } from '../../sim/predict';
import { recoilParams, type WorldState } from '../../sim/world';
import type { CourseScene } from './scene';

// The moving pieces of the scene (trebuchet, cannon, pole, band, drone, rope) follow the world once per picture.
export function createViews(course: CourseData, s: Pick<CourseScene, 'trebView' | 'shotsView' | 'poleView' | 'recoilView' | 'bandView' | 'droneView' | 'ropeMesh' | 'ropeLen'>) {
  const { trebView, shotsView, poleView, recoilView, bandView, droneView, ropeMesh, ropeLen } = s;
  let shotCache: { key: string; pr: Prediction } | null = null; // the dotted preview of a loaded cannon: the same prediction the debug view uses, worked out once per tick
  const shotPreview = (w: WorldState): Prediction | null => {
    if (!course.recoil || !isAimable(recoilParams(course)) || w.mode !== 'run' || (w.recoil?.armed ?? 0) <= 0) return null;
    const key = `${w.runner.tick}:${w.recoil!.aim}`;
    if (shotCache?.key !== key) shotCache = { key, pr: predictShot(w, course) };
    return shotCache.pr;
  };
  function update(world: WorldState, facing: 1 | -1) {
    trebView?.update(world);
    shotsView?.update(world);
    poleView?.update(world);
    recoilView?.update(world, facing, shotPreview(world)?.path);
    bandView?.update(world);
    droneView?.update(world, facing);
    if (ropeMesh && course.rope) {
      // the rope swings about its anchor with the runner: its middle is half a rope length along the swing
      const th = world.swing ? world.swing.theta : 0;
      ropeMesh.rotation.z = th;
      ropeMesh.position.set(course.rope.anchorX + (ropeLen / 2) * Math.sin(th), course.rope.anchorY - (ropeLen / 2) * Math.cos(th), 0);
      ropeMesh.updateMatrix(); ropeMesh.updateMatrixWorld(true);
    }
  }
  return { shotPreview, update };
}
