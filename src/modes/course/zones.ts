import type { CourseData } from '../../course/course';

export interface ProgressZone { id: string; name: string; x0: number; x1: number }

// The progress strip's zones for a course that does not store its own: one per obstacle found in the terrain and the extras, each reaching halfway to the next.
export function progressZonesOf(course: CourseData): ProgressZone[] {
  const found: { id: string; name: string; x0: number; x1: number }[] = [];
  const add = (id: string, name: string, x0: number, x1: number) => {
    if (x1 > x0) found.push({ id, name, x0, x1 });
  };
  const platforms = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  platforms.forEach((p, i) => {
    const next = platforms[i + 1];
    if (!next) return;
    const gap = next.x0 - p.x1, rise = next.top - p.top;
    if (gap > 0.15) add('gap', 'Gap', p.x1, next.x0 + 0.1);
    else if (rise > 0.25) add('step', 'Step up', next.x0 - 1.5, next.x0 + 2);
    else if (rise < -1.2) add('drop', 'Drop landing', p.x1 - 1.5, next.x0 + 2);
  });
  platforms.filter((p) => p.bouncy).forEach((p) => add('trampoline', 'Trampoline', p.x0, p.x1));
  if (course.wall) add('wall', 'Warped wall', course.wall.x0, course.wall.x0 + Math.max(8, (course.wall.height ?? 4.3) * 2));
  if (course.rope) add('rope', 'Rope swing', course.rope.anchorX - Math.max(6, course.rope.length ?? 9), course.rope.anchorX + 3);
  if (course.holds?.length) add('lache', 'Bars', course.holds[0].x - 3, course.holds[course.holds.length - 1].x + 3);
  if (course.trebuchet) add('launch', 'Trebuchet launch', course.trebuchet.x - 12, course.trebuchet.x + 5);
  if (course.recoil) add('recoil', 'Recoil launcher', course.recoil.x0, course.recoil.x1);
  if (course.track) add('coaster', 'Coaster', course.startX, course.finishX);
  const ordered = found
    .map((z) => ({ ...z, center: (z.x0 + z.x1) / 2 }))
    .filter((z) => z.center >= course.startX && z.center <= course.finishX)
    .sort((a, b) => a.center - b.center);
  if (!ordered.length) return [{ id: 'course', name: course.name, x0: course.startX, x1: course.finishX }];
  return ordered.map((z, i) => ({ ...z, x1: i + 1 < ordered.length ? (z.center + ordered[i + 1].center) / 2 : course.finishX }));
}
