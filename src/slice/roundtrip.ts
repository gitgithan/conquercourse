import type { CourseData, CourseSource } from '../course/course';
import { deviceMesh } from './device';
import { barMesh } from './holds-world';
import { pieceFromSrc } from './photo-course';
import { LIBRARY } from './shapes';
import { patternOf, stackPiece } from './stack';
import { newPiece, type Piece } from './world';

// The round trip between the Course and the editor (CC-80). A course made in the editor carries its source (the pieces, the lane, the floor), so the Course
// can open the very same pieces again; any other course (a demo, a generated one) is turned into an editable copy, as close as its terrain and bars allow.
// Pure: the Course writes a handoff into sessionStorage, the editor reads it, and "Back to the Course" writes the usual resume for the Course.
export const EDIT_KEY = 'cc.edit'; // Course -> editor
export const HIST_KEY = 'cc.edit.hist'; // the editor's undo history across the trip

export interface EditHandoff {
  course: CourseData; // the course as played (its source says how to rebuild the pieces)
  retryX: number; // where "try again" started
  zone: string | null; // the obstacle the player was at or fell at
  x: number; // where the runner was
  facing: 1 | -1;
  falls: number;
  intent: 'edit' | 'easier';
}

// A course without a source becomes boxes and bars: each platform a box as long as the ground it stands on, bars at their height.
// Approximate on purpose (the editor cuts its own lane through the pieces), and marked 'copy' so the editor can say so.
export function copySourceFrom(course: CourseData): CourseSource {
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  const inner = ps.length > 2 ? ps.slice(1, -1) : ps; // the start deck and the finish deck are added again by the lane
  const tops = inner.flatMap((p) => [p.top, ...(p.profile ?? []).map(([, y]) => y)]);
  const base = Math.min(0, ...tops);
  const pieces: CourseSource['pieces'] = [];
  const box = (x0: number, x1: number, top: number) => {
    const w = Math.max(0.1, x1 - x0), h = Math.max(0.05, top - base);
    pieces.push({ src: `box:${+w.toFixed(2)}:${+h.toFixed(2)}:2`, x: +(x0 + w / 2).toFixed(2), z: 0, y: 0, yaw: 0, scale: 1 });
  };
  for (const p of inner) {
    if (!p.profile || p.profile.length < 2) { box(p.x0, p.x1, p.top); continue; }
    // a curved or stepped top becomes columns of equal height (a 5 cm grid), runs of equal columns joined into one box
    const at = (x: number) => { const q = p.profile!; for (let i = 1; i < q.length; i++) if (x <= q[i][0] || i === q.length - 1) { const [xa, ya] = q[i - 1], [xb, yb] = q[i]; return xb === xa ? Math.max(ya, yb) : ya + (yb - ya) * Math.min(1, Math.max(0, (x - xa) / (xb - xa))); } return p.top; };
    let runStart = p.x0, runH = Math.round(at(p.x0 + 0.05) / 0.05) * 0.05;
    for (let x = p.x0 + 0.15; x < p.x1; x += 0.1) {
      const h = Math.round(at(x) / 0.05) * 0.05;
      if (Math.abs(h - runH) > 1e-6) { box(runStart, x - 0.05, runH); runStart = x - 0.05; runH = h; }
    }
    box(runStart, p.x1, runH);
  }
  for (const h of course.holds ?? []) pieces.push({ src: 'hold:bar', x: h.x, z: 0, y: +(h.y - base).toFixed(2), yaw: 0, scale: 1 });
  return { kind: 'copy', pieces, angle: 0, offset: 0, level: 0, floor: course.hazard ?? 'water' }; // machines (a trebuchet, a launcher) and planks are not copied
}

// What the Course keeps of itself in the handoff: no baked scene or plans (the editor rebuilds them, and they can be large).
export function handoffCourse(course: CourseData): CourseData {
  const { scene: _scene, plan: _plan, routes: _routes, ...rest } = course;
  void _scene; void _plan; void _routes;
  return { ...rest, source: course.source ?? copySourceFrom(course) };
}

export function readHandoff(store: Pick<Storage, 'getItem'> = sessionStorage): EditHandoff | null {
  try {
    const h = JSON.parse(store.getItem(EDIT_KEY) ?? 'null') as EditHandoff | null;
    return h && h.course && h.course.source && h.course.terrain ? h : null;
  } catch { return null; }
}

// The checkpoint the Course uses for an obstacle, or the start.
export const checkpointFor = (course: CourseData, zone: string | null): number => (zone ? course.checkpoints?.find((c) => c.id === zone)?.x : undefined) ?? course.startX;

// The pieces of a saved world, built again from their sources (library shapes, cup stacks, blocks and bars; photo objects come later because their
// meshes are loaded from files). A source the editor does not know is skipped.
export function piecesFromSource(list: CourseSource['pieces']): (Piece & { src?: string })[] {
  const out: (Piece & { src?: string })[] = [];
  for (const q of list) {
    if (q.src.startsWith('obj:')) continue;
    const at = { x: q.x, z: q.z };
    let p: (Piece & { src?: string }) | null = null;
    if (q.src.startsWith('device:')) p = { ...newPiece(q.src, deviceMesh(q.src), at), src: q.src };
    else if (patternOf(q.src)) p = stackPiece(q.src, at);
    else if (q.src.startsWith('box:')) p = pieceFromSrc(q.src, at);
    else if (q.src === 'hold:bar') p = { ...newPiece('Bar', barMesh(), at), src: q.src };
    else { const id = q.src === 'dome' ? 'block' : q.src; /* the dome piece was removed (CC-96): an old world keeps a block in its place */ const l = LIBRARY.find((x) => x.id === id); if (l) p = { ...newPiece(l.label, l.mesh(), at), src: id }; }
    if (p) out.push({ ...p, y: q.y, yaw: q.yaw, scale: q.scale, ...(q.role ? { role: q.role as Piece['role'] } : {}) });
  }
  return out;
}
