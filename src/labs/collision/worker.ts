import { readGlbMesh } from '../../slice/glb';
import type { Mesh } from '../../slice/slice';
import { GLB_URL } from './collision-core';
import { runView } from './stages-view';

// Runs the voxel stages off the page's thread (about two thirds of a second), so the page never freezes. It fetches the lift itself and keeps the parsed mesh.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; voxel: number } }) => void) | null; postMessage(m: unknown): void };
let mesh: Promise<Mesh> | null = null;
ctx.onmessage = async (e) => {
  const { id, voxel } = e.data;
  try {
    mesh ??= fetch(GLB_URL).then((r) => r.arrayBuffer()).then(readGlbMesh);
    const t0 = Date.now(), view = runView(await mesh, voxel);
    ctx.postMessage({ id, view, ms: Date.now() - t0 });
  } catch (err) { ctx.postMessage({ id, error: String(err) }); }
};
