import type { SceneItem } from '../course/course';
import type { Piece } from './world';
import { patternOf } from './stack';

// The editor's pieces, placed in the game: the same lane (turn, sideways, level) that made the course, with each piece
// shifted along the run to where its ground ended up once the gaps were squeezed (a piece uses the run nearest its middle).
export function sceneFor(pieces: (Piece & { src?: string })[], lane: { angle: number; offset: number; level: number }, uMap: { u0: number; u1: number; x0: number }[]): SceneItem[] {
  const c = Math.cos(lane.angle), s = Math.sin(lane.angle);
  const out: SceneItem[] = [];
  for (const p of pieces) {
    const u = p.x * c + p.z * s, v = -p.x * s + p.z * c;
    let best = uMap[0], d = Infinity;
    for (const r of uMap) { const dd = u < r.u0 ? r.u0 - u : u > r.u1 ? u - r.u1 : 0; if (dd < d) { d = dd; best = r; } }
    if (!best) continue;
    const item: SceneItem = { x: u + (best.x0 - best.u0), y: p.y - lane.level, z: v - lane.offset, rotY: -p.yaw + lane.angle, scale: p.scale };
    if (patternOf(p.src)) item.stack = patternOf(p.src)!.id;
    else if (p.src?.startsWith('obj:')) item.url = `/assets/objects/${p.src.slice(4)}`;
    else item.mesh = { positions: Array.from(p.mesh.positions as ArrayLike<number>, (n) => Math.round(n * 100) / 100), indices: Array.from((p.mesh.indices ?? []) as ArrayLike<number>) };
    out.push(item);
  }
  return out;
}
