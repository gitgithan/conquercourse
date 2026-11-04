import type { Mesh } from '../../slice/slice';
import { runStages, type Stages } from './collision-core';

// What the Collision Lab page draws from a run of the stages. The big voxel grids and the full mesh stay behind (the page needs only the side-on shadows, the counts and the
// profile), so this is small enough to cache as a file and to send back from the worker. Pure, no DOM.
export type StagesView = Omit<Stages, 'raw' | 'closed' | 'kept' | 'scaled'> & { points: number; triangles: number };

export function viewOf(st: Stages): StagesView {
  const { raw: _r, closed: _c, kept: _k, scaled, ...rest } = st;
  return { ...rest, points: scaled.positions.length / 3, triangles: Math.round((scaled.indices?.length ?? 0) / 3) };
}
export function runView(mesh: Mesh, voxel: number): StagesView { return viewOf(runStages(mesh, { voxel })); }

// The file form: bytes become base64 text and every other typed array becomes a plain list, so the JSON stays small and plain.
const b64 = (u: Uint8Array) => (typeof Buffer !== 'undefined' ? Buffer.from(u).toString('base64') : btoa(String.fromCharCode(...u)));
const unb64 = (s: string) => (typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
export function packView(v: StagesView): unknown {
  return JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Uint8Array ? { b64: b64(x) } : ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x)));
}
export function unpackView(j: unknown): StagesView {
  return revive(j) as StagesView;
}
function revive(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(revive);
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.b64 === 'string' && Object.keys(o).length === 1) return unb64(o.b64);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, revive(v)]));
  }
  return x;
}
