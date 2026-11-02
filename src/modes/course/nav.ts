import type { CourseData } from '../../course/course';
import { handoffCourse, EDIT_KEY, type EditHandoff } from '../../slice/roundtrip';
import { isAimable } from '../../sim/recoil';
import { recoilParams, type GameEvent, type WorldState } from '../../sim/world';
import { DEFAULT_WALL } from '../../sim/wall';
import { DEFAULT_ROPE } from '../../sim/rope';
import { dojoOf } from '../../course/obstacles';
import type { gapSpecs } from '../../sim/needs';
import { track } from '../../ui/feedback';
import type { CourseState } from './state';

// What the page keeps in sessionStorage when the player goes to the Dojo, so the Course comes back exactly as it was.
export interface Resume { course: CourseData; world: WorldState | null; retryX: number; facing: 1 | -1; falls: number }

export interface NavDeps {
  course: CourseData;
  st: CourseState;
  log: GameEvent[];
  specs: ReturnType<typeof gapSpecs>;
  msg: HTMLElement;
  facing: () => 1 | -1;
  zoneAt: (x: number) => { id: string } | undefined;
}

// Leaving the Course for the Dojo or the editor, and the way back (R2-G4, CC-80).
export function createNav(deps: NavDeps) {
  const { course, st, log, specs, msg } = deps;
  // The Dojo is reachable any time: it opens on the obstacle nearest the runner (R2-G4).
  function saveResume() {
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course, world: st.world.outcome === 'running' ? st.world : null, retryX: st.retryX, facing: deps.facing(), falls: st.falls } satisfies Resume)); } catch { /* the Course starts again */ }
  }
  // The editor opens on the course's own pieces (its source, or a copy built from its ground and bars), at the obstacle the runner is at.
  // A coaster opens its track in the coaster builder. "Make it easier" opens the editor already looking for the smallest change.
  function openEditor(intent: 'edit' | 'easier') {
    track('edit_opens');
    if (course.track) { location.href = `?mode=coaster&coaster=${course.track.pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')}&push=${+(course.track.push ?? 1.5).toFixed(2)}`; return; }
    const zone = st.world.outcome === 'running' ? deps.zoneAt(st.world.runner.x)?.id ?? null : st.lastZone;
    const h: EditHandoff = { course: handoffCourse(course), retryX: st.retryX, zone, x: st.world.runner.x, facing: deps.facing(), falls: st.falls, intent };
    try { sessionStorage.setItem(EDIT_KEY, JSON.stringify(h)); } catch { msg.textContent = 'This course is too big to hand to the World Editor.'; return; }
    location.search = '?mode=editor';
  }
  function openDojo() {
    track('dojo_opens');
    saveResume();
    const x = st.world.runner.x;
    const z = deps.zoneAt(x)?.id ?? 'gap';
    location.search = trainLink(z, x);
  }

  // The Dojo opens on the very obstacle the player fell at, with its real numbers (R1-L1, R1-L3).
  function trainLink(zoneId: string, x: number): string {
    const q = new URLSearchParams({ mode: 'dojo', ex: zoneId === 'recoil' && course.recoil && isAimable(recoilParams(course)) ? 'cannon' : dojoOf(zoneId), from: 'course' }); // the lache pair trains on the bar swing
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    if (jump?.detail?.vx) q.set('speed', (jump.detail.vx as number).toFixed(1));
    if (zoneId === 'gap' || zoneId === 'landing') {
      const g = specs.find((q2) => x >= q2.x - 0.5 && x <= q2.x + q2.width + 1) ?? specs.find((q2) => q2.x >= x - 12);
      if (g) { q.set('ex', 'gap'); q.set('width', g.width.toFixed(1)); q.set('rise', g.rise.toFixed(1)); q.set('needed', g.needed.toFixed(1)); }
    }
    if (zoneId === 'wall') { q.set('ex', 'wall'); q.set('wallh', String(course.wall?.height ?? DEFAULT_WALL.height)); }
    if (zoneId === 'rope') { q.set('ex', 'rope'); q.set('length', String(course.rope?.length ?? DEFAULT_ROPE.length)); }
    return '?' + q.toString();
  }

  return { saveResume, openEditor, openDojo, trainLink };
}
