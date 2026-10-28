import type { Mesh } from './slice';
import { box, join } from './shapes';

export const TREBUCHET_PIVOT_FROM_CENTRE = 2.8125;
export const RECOIL_PAD_LENGTH = 2.5;

function beam(ax: number, ay: number, bx: number, by: number, thick: number, depth: number): Mesh {
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  const m = box(length, thick, depth), c = Math.cos(angle), s = Math.sin(angle), cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const p = Array.from(m.positions as number[]);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1] - thick / 2;
    p[i] = cx + x * c - y * s; p[i + 1] = cy + x * s + y * c;
  }
  return { positions: p, indices: m.indices };
}

function block(w: number, h: number, d: number, x: number, y: number): Mesh {
  const m = box(w, h, d), p = Array.from(m.positions as number[]);
  for (let i = 0; i < p.length; i += 3) { p[i] += x; p[i + 1] += y; }
  return { positions: p, indices: m.indices };
}

// Display meshes only. The course simulator builds its collision geometry from the lane pieces.
export function deviceMesh(src: string): Mesh {
  if (src.startsWith('device:trebuchet:')) return join([
    beam(-4.25, 0.12, 0, 5.5, 0.42, 0.34), beam(-1.25, 0.12, 0, 5.5, 0.42, 0.34),
    beam(-1.25, 0.12, 1.15, 0.12, 0.28, 0.32), beam(-1.25, 0.12, 0, 5.5, 0.18, 0.18),
    beam(1.15, 0.12, 0, 5.5, 0.18, 0.18), block(0.5, 0.5, 2.7, 0, 4.9),
    beam(-4.3, 2.1, 1.3, 6.3, 0.42, 0.5), beam(-4.3, 2.1, -7.05, 0.9, 0.07, 0.07),
    block(0.8, 0.85, 0.75, -7.05, 0), block(1.05, 1.2, 1.05, 1.3, 5.65),
  ]);
  if (src.startsWith('device:drone:')) { // a pad with a cargo drone resting on it: body, battery, four arms with rotor discs, skids
    const len = Math.max(2, Number(src.split(':')[4]) || 4);
    return join([
      block(len, 0.12, 1.5, 0, 0), block(1.5, 0.28, 0.9, 0, 1.25), block(0.9, 0.18, 0.6, 0, 1.5),
      block(0.05, 1.1, 0.05, -0.6, 0.15), block(0.05, 1.1, 0.05, 0.6, 0.15), block(1.7, 0.05, 0.07, 0, 0.14),
      block(1.3, 0.04, 0.5, -1.1, 1.4), block(1.3, 0.04, 0.5, 1.1, 1.4),
    ]);
  }
  const [, kind = 'cannon', , , rawLength] = src.split(':');
  const padLength = Math.max(0.8, Number(rawLength) || RECOIL_PAD_LENGTH);
  const pad = block(padLength, 0.12, 1.3, 0, 0);
  if (kind === 'bigcannon') return join([pad, block(2.4, 0.3, 1.3, -0.4, 0.55), block(1.5, 0.9, 0.9, 0.5, 1.1), beam(0.3, 0.95, -2.3, 0.35, 0.85, 0.85), block(0.5, 0.7, 0.2, -0.9, 0.35)]); // a wheeled cannon: carriage, pressure tank, a wide barrel pointing backward and down, a wheel
  if (kind === 'crate') return join([pad, block(0.95, 0.8, 0.9, 0, 0.12), beam(-0.38, 0.22, 0.38, 0.82, 0.05, 0.05), beam(-0.38, 0.82, 0.38, 0.22, 0.05, 0.05)]);
  return join([pad, block(1.65, 0.48, 0.5, 0, 0.45), block(0.85, 0.2, 1.0, 0, 0.12)]);
}

