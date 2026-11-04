// CC-133 step 4: a real photo facade on one wall of one building (a showpiece, not a whole-city method).
// Pure maths: a 4-point homography to straighten the photo, the wall to pick from a footprint, and the quad (corners + picture coordinates) to draw on it.
// Looks only: the footprint prism, the collision and the sim are never touched.
export type Pt = [number, number];
export type Quad = [Pt, Pt, Pt, Pt]; // top-left, top-right, bottom-right, bottom-left

/** Solves the 8 numbers of the homography that sends the 4 `from` points to the 4 `to` points (x' = (ax+by+c)/(gx+hy+1), y' = (dx+ey+f)/(gx+hy+1)). */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gauss-Jordan with partial pivoting
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('the four corners are on a line: no homography');
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  return b.map((v, i) => v / A[i][i]);
}

export function applyH(h: number[], [x, y]: Pt): Pt {
  const w = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/** Where each pixel of the straightened picture (w x h) comes from in the photo: the homography runs from the picture to the photo. */
export const rectifyMap = (photoQuad: Quad, w: number, h: number): ((x: number, y: number) => Pt) => {
  const H = homography([[0, 0], [w, 0], [w, h], [0, h]], photoQuad);
  return (x, y) => applyH(H, [x, y]);
};

/** The width of the straightened picture and its height from the real wall width and the photo's own proportions (mean of the top and bottom, left and right edge lengths). */
export function facadeAspect(q: Quad): number {
  const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return ((d(q[0], q[1]) + d(q[3], q[2])) / 2) / ((d(q[0], q[3]) + d(q[1], q[2])) / 2);
}

export interface FacadeSpec {
  /** which place's scenery shows it */
  place: string;
  /** the OpenStreetMap name tag of the building */
  building: string;
  /** the measured width in metres of the wall the picture shows (checked against the footprint edge) */
  width: number;
  /** the compass bearing (degrees clockwise from north) the wall faces */
  facing: number;
  /** picture file, width / height of the straightened crop */
  image: string;
  aspect: number;
}

/** The footprint edge to dress: among the edges facing within `slack` degrees of `facing`, the one whose length is closest to `width` (and within 25%). Points are metres east / metres south. */
export function pickWall(ring: { x: number; z: number }[], width: number, facing: number, slack = 25): { i: number; length: number } | null {
  const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a.x * b.z - b.x * a.z; }, 0);
  const sign = area > 0 ? 1 : -1; // x east, z south: a ring with positive shoelace area runs clockwise seen from above
  let best: { i: number; length: number } | null = null, bestErr = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const nx = (sign * dz) / len, nz = (-sign * dx) / len; // outward normal
    const bearing = ((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360;
    const off = Math.abs(((bearing - facing + 540) % 360) - 180);
    const err = Math.abs(len - width) / width;
    if (off <= slack && err <= 0.25 && err < bestErr) { best = { i, length: len }; bestErr = err; }
  }
  return best;
}

export interface WallQuad { positions: number[]; uvs: number[]; indices: number[]; normal: [number, number]; width: number }

/** The picture quad for edge a to b of a ring: lifted `lift` metres off the wall so it never z-fights, `height` metres tall from `base`; the picture reads left to right as seen from outside; scaled by `k`. */
export function wallQuad(a: { x: number; z: number }, b: { x: number; z: number }, outward: [number, number], height: number, o: { base?: number; lift?: number; k?: number } = {}): WallQuad {
  const k = o.k ?? 1, lift = o.lift ?? 0.04, base = o.base ?? 0;
  const [nx, nz] = outward, rx = nz, rz = -nx; // the viewer's right-hand side, seen from outside
  const left = (a.x * rx + a.z * rz) <= (b.x * rx + b.z * rz) ? a : b, right = left === a ? b : a;
  const P = (p: { x: number; z: number }, y: number) => [(p.x + nx * lift) * k, y * k, (p.z + nz * lift) * k];
  const positions = [...P(left, base), ...P(right, base), ...P(right, base + height), ...P(left, base + height)];
  return { positions, uvs: [0, 0, 1, 0, 1, 1, 0, 1], indices: [0, 1, 2, 0, 2, 3], normal: [nx, nz], width: Math.hypot(b.x - a.x, b.z - a.z) };
}

/** The switch: 1 on, 0 off; otherwise on only on the laptop (localhost) and the preview site, never on the production site. */
export function facadeOn(value: string | null, host: string): boolean {
  if (value === '1') return true;
  if (value === '0') return false;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('preview.');
}

/** The facades we ship: one hero building. The width and height come from the footprint edge and the straightened photo's own proportions. */
export const FACADES: readonly FacadeSpec[] = [
];
