// The course the World Editor builds for each ready-made preset, built in Node (real objects read from public/assets/objects). Used by scripts/preset-plans.ts and tests/preset-plans.test.ts.
import { readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { readGlbMesh } from '../src/slice/glb';
import type { P } from '../src/slice/holds-world';
import { PRESETS, type Preset } from '../src/slice/presets';
import { roleCourse } from '../src/slice/roles';
import { piecesFromSource } from '../src/slice/roundtrip';
import { setRoofStart } from '../src/slice/slice';
import { newPiece } from '../src/slice/world';

const idx = JSON.parse(readFileSync('public/assets/objects/index.json', 'utf8')) as { objects: { glb: string; hang_m?: number }[] };
const hangOf = new Set(idx.objects.filter((o) => o.hang_m).map((o) => `obj:${o.glb}`));
const isDevice = (p: { src?: string }) => p.src?.startsWith('device:') ?? false;

export function presetCourse(pre: Preset): CourseData {
  const objs = pre.pieces.filter((q) => q.src.startsWith('obj:')).map((q) => {
    const b = readFileSync(`public/assets/objects/${q.src.slice(4)}`);
    const p: P = { ...newPiece(q.src, readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale };
    if (hangOf.has(q.src)) p.noGround = true;
    return p;
  });
  const ps = [...(piecesFromSource(pre.pieces.filter((q) => !q.src.startsWith('obj:'))) as P[]), ...objs].filter((p) => !isDevice(p));
  // The page runs with the roof start on, and the proof key follows the lane it makes.
  setRoofStart(true);
  return roleCourse(ps as never[], { angle: 0, offset: 0, level: 0 }, 'My world').course;
}
export const presetCourses = (): Record<string, CourseData> => Object.fromEntries(PRESETS.map((p) => [p.id, presetCourse(p)]));
