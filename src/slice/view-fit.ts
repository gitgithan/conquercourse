import { Vector3 } from 'three';
import type { Piece } from './world';

export interface ViewBounds { x0: number; x1: number; z0: number; z1: number; bottom?: number; top: number }

// Use each piece's actual turned mesh instead of a square around its longest side.
export function pieceBounds(pieces: Piece[]): ViewBounds {
  const b: ViewBounds = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, bottom: Infinity, top: -Infinity };
  for (const p of pieces) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), a = p.mesh.positions;
    for (let i = 0; i < a.length; i += 3) {
      const x = p.x + (a[i] * c - a[i + 2] * s) * p.scale;
      const z = p.z + (a[i] * s + a[i + 2] * c) * p.scale, y = p.y + a[i + 1] * p.scale;
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x);
      b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
      b.bottom = Math.min(b.bottom!, y); b.top = Math.max(b.top, y);
    }
  }
  return Number.isFinite(b.x0) ? b : { x0: 0, x1: 30, z0: -3, z1: 3, bottom: 0, top: 3 };
}

// Solve the perspective limits for all eight corners in the current camera direction.
export function fitDistance(b: ViewBounds, direction: Vector3, fov: number, aspect: number): number {
  const back = direction.clone().normalize(), right = new Vector3().crossVectors(new Vector3(0, 1, 0), back).normalize();
  const up = new Vector3().crossVectors(back, right);
  const centre = new Vector3((b.x0 + b.x1) / 2, ((b.bottom ?? 0) + b.top) / 2, (b.z0 + b.z1) / 2);
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * aspect;
  let distance = 0.6;
  for (const x of [b.x0, b.x1]) for (const y of [b.bottom ?? 0, b.top]) for (const z of [b.z0, b.z1]) {
    const v = new Vector3(x, y, z).sub(centre), depth = v.dot(back);
    distance = Math.max(distance, depth + 1.15 * Math.abs(v.dot(right)) / tanH, depth + 1.08 * Math.abs(v.dot(up)) / tanV, depth + 0.2);
  }
  return distance;
}
