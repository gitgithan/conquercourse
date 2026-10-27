import type { Mesh } from './slice';

// Pieces to build a world from. Sizes are in metres, except the brick, which is a toy-sized model (3 cm) to be enlarged.
export const box = (w: number, h: number, d: number): Mesh => {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  return {
    positions: [x0, 0, z0, x1, 0, z0, x1, h, z0, x0, h, z0, x0, 0, z1, x1, 0, z1, x1, h, z1, x0, h, z1],
    indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2],
  };
};

export const dome = (rx: number, ry: number, rz: number, n = 24): Mesh => {
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const th = (Math.PI / 2) * (i / n), ph = 2 * Math.PI * (j / n); positions.push(rx * Math.sin(th) * Math.cos(ph), ry * Math.cos(th), rz * Math.sin(th) * Math.sin(ph)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, c = a + n + 1; indices.push(a, c, a + 1, a + 1, c, c + 1); }
  return { positions, indices };
};

// Steps going up along x: `count` steps, each `rise` high and `tread` long.
export const stairs = (count: number, rise: number, tread: number, width: number): Mesh => {
  const parts: Mesh[] = [];
  for (let i = 0; i < count; i++) { const b = box(tread, rise * (i + 1), width); parts.push({ positions: Array.from(b.positions as number[]).map((v, k) => (k % 3 === 0 ? v + i * tread : v)), indices: b.indices }); }
  return join(parts);
};

// A rail: a thin bar on two posts.
export const rail = (length: number, height: number): Mesh => join([shift(box(length, 0.05, 0.05), 0, height - 0.05, 0), shift(box(0.05, height, 0.05), -length / 2 + 0.05, 0, 0), shift(box(0.05, height, 0.05), length / 2 - 0.05, 0, 0)]);

// A toy brick with studs (about 3 cm): enlarge it ×15 and it is a half-metre block.
export const brick = (): Mesh => {
  const body = box(0.032, 0.0096, 0.016);
  const studs: Mesh[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) studs.push(shift(box(0.0048, 0.0017, 0.0048), -0.012 + i * 0.008, 0.0096, -0.004 + j * 0.008));
  return join([body, ...studs]);
};

function shift(m: Mesh, dx: number, dy: number, dz: number): Mesh {
  const p = Array.from(m.positions as ArrayLike<number>);
  for (let i = 0; i < p.length; i += 3) { p[i] += dx; p[i + 1] += dy; p[i + 2] += dz; }
  return { positions: p, indices: m.indices };
}
export function join(parts: Mesh[]): Mesh {
  const positions: number[] = [], indices: number[] = [];
  for (const m of parts) { const base = positions.length / 3; positions.push(...Array.from(m.positions as ArrayLike<number>)); indices.push(...Array.from(m.indices ?? []).map((i) => i + base)); }
  return { positions, indices };
}

export const LIBRARY: { id: string; label: string; mesh: () => Mesh }[] = [
  { id: 'bench', label: 'Bench', mesh: () => box(1.8, 0.45, 0.5) },
  { id: 'low-wall', label: 'Low wall', mesh: () => box(3, 0.9, 0.4) },
  { id: 'block', label: 'Block', mesh: () => box(2, 0.7, 1.4) },
  { id: 'dome', label: 'Dome / mound', mesh: () => dome(1.5, 0.8, 1) },
  { id: 'steps', label: 'Steps', mesh: () => stairs(4, 0.17, 0.4, 1.4) },
  { id: 'rail', label: 'Rail', mesh: () => rail(3, 1) },
  { id: 'brick', label: 'Toy brick (3 cm)', mesh: () => brick() },
];
