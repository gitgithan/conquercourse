// The ghost wears the runner's own shape (CC-167): the same Rookie model, drawn as a see-through amber silhouette with a dark amber outline,
// so it stays visible on a blue sky, green grass and a dark tunnel alike. ?ghost=old brings back the light-blue capsule.
// A challenge link adds nothing for the first Rookie and "&rk=b" (5 characters) for the second.

import * as THREE from 'three';
import { createRookieActor, type RookieActor } from '../render/actor';
import type { GhostTrack } from '../sim/replay';

export type RookieLook = 'a' | 'b';
export const lookOfParam = (v: string | null): RookieLook => (v === 'b' ? 'b' : 'a');

const FILL = 0xffa31a, RIM = 0x7a3a00, RIM_SCALE = 1.05;
export const PLAYER_OPACITY = 0.85, GHOST_OPACITY = 0.5; // CC-180: both always shown; when they overlap exactly, the amber ghost (drawn first) shows through the player and its dark rim shows round the edge

/** Make the player's own figure a little see-through, so the ghost behind it never disappears. */
export function softenPlayer(root: THREE.Object3D, opacity = PLAYER_OPACITY): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const soft = (x: THREE.Material): THREE.Material => { const c = x.clone(); c.transparent = true; c.opacity = opacity; c.depthWrite = true; return c; };
    m.material = Array.isArray(m.material) ? m.material.map(soft) : soft(m.material);
  });
}

function paint(a: RookieActor, material: THREE.Material, order: number): void {
  a.object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.material = material; m.renderOrder = order; m.frustumCulled = false;
    m.raycast = () => undefined; // nothing can pick it
  });
}

export interface GhostFigure {
  setLook(look: RookieLook): Promise<void>;
  show(track: GhostTrack, i: number): void;
  hide(): void;
}

/** One amber fill actor and one slightly larger dark-amber back-face actor behind it for the outline. */
export function createGhostFigure(scene: THREE.Scene, first: RookieLook): GhostFigure {
  let fill: RookieActor | null = null, rim: RookieActor | null = null, look: RookieLook | null = null, loading: Promise<void> | null = null;
  const fillMat = new THREE.MeshBasicMaterial({ color: FILL, transparent: true, opacity: GHOST_OPACITY, depthWrite: false });
  const rimMat = new THREE.MeshBasicMaterial({ color: RIM, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.BackSide });
  async function load(want: RookieLook): Promise<void> {
    try {
      const [f, r] = await Promise.all([createRookieActor(scene, { rookie: want }), createRookieActor(scene, { rookie: want })]);
      paint(f, fillMat, -3); paint(r, rimMat, -4); // drawn before the player
      r.object.scale.setScalar(RIM_SCALE); // a little larger than the fill: the dark back faces show round its edge
      f.object.visible = false; r.object.visible = false;
      fill?.dispose(); rim?.dispose(); fill = f; rim = r; look = want;
      if (typeof document !== 'undefined') document.body.dataset.ghostLook = want; // for the picture script: the figure is ready
    } catch (e) { console.warn('Ghost look not loaded', e); }
  }
  const setLook = (want: RookieLook): Promise<void> => {
    if (want === look || (loading && want === pending)) return loading ?? Promise.resolve();
    pending = want; loading = load(want).finally(() => { loading = null; });
    return loading;
  };
  let pending: RookieLook = first;
  void setLook(first);
  return {
    setLook,
    show(track, i) {
      if (!fill || !rim) return;
      const x = track.xs[i], y = track.ys[i], p = Math.max(0, i - 6), n = Math.min(track.ticks, i + 6);
      const vx = ((track.xs[n] - track.xs[p]) / Math.max(1, n - p)) * 120, vy = ((track.ys[n] - track.ys[p]) / Math.max(1, n - p)) * 120;
      const s = { tick: i, x, y, vx, vy, grounded: Math.abs(vy) < 0.4, mode: 'run' as const, squat: false, landedTicksAgo: null, facing: (vx < -0.1 ? -1 : 1) as 1 | -1 };
      fill.update(s); rim.update(s);
      fill.object.visible = true; rim.object.visible = true;
    },
    hide() { if (fill) fill.object.visible = false; if (rim) rim.object.visible = false; },
  };
}
