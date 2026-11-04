import type { Mesh } from "../../slice/slice";
import { projectPoint, bounds, type Cam } from "./lift-core";

// the 3D picture of a lifted object. Painter's algorithm on a canvas, perspective camera, flat shading, vertex colours.
// Draws a ground grid (y = 0) and an arrow for the side camera's looking direction, so "facing the side camera" is something you can see.
const rgbCache = new WeakMap<string[], Uint8Array>();
function rgbOf(tri: string[]): Uint8Array {
  let a = rgbCache.get(tri);
  if (!a) { a = new Uint8Array(tri.length * 3); tri.forEach((s, i) => { const m = /(\d+),(\d+),(\d+)/.exec(s); if (m) { a![i * 3] = +m[1]; a![i * 3 + 1] = +m[2]; a![i * 3 + 2] = +m[3]; } }); rgbCache.set(tri, a); }
  return a;
}
export interface OrbitOptions { mesh: Mesh; tri: string[]; colour: boolean; cam: Cam; gridStep: number; gridHalf: number; unit: string; title: string; arrow: boolean }
/** A camera that frames a (y-up) mesh: target is the middle of its box and the ground, distance from its size. */
export function frameCam(m: Mesh, az: number, pitch: number, zoom: number, fixed?: { half: number; centre: [number, number, number] }): Cam {
  const b = bounds(m), c: [number, number, number] = fixed?.centre ?? [(b.min[0] + b.max[0]) / 2, Math.max(0, (b.min[1] + b.max[1]) / 2), (b.min[2] + b.max[2]) / 2];
  const r = fixed?.half ?? Math.max(0.01, Math.hypot(b.size[0], b.size[1], b.size[2]) * 1.1);
  return { az, pitch, dist: (r * 3.2) / zoom, focal: 330, target: c };
}
export function drawOrbit(cv: HTMLCanvasElement, o: OrbitOptions) {
  const ctx = cv.getContext("2d")!, W = cv.width, H = cv.height, P = o.mesh.positions, I = o.mesh.indices!, cam = o.cam;
  ctx.clearRect(0, 0, W, H);
  const pr = (x: number, y: number, z: number) => projectPoint([x, y, z], cam, W, H);
  const line = (a: [number, number, number], b: [number, number, number]) => { const p = pr(...a), q = pr(...b); if (!p || !q) return; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
  ctx.lineWidth = 1; ctx.strokeStyle = "#cfd8d1";
  const h = o.gridHalf, st = o.gridStep;
  for (let g = -h; g <= h + 1e-9; g += st) { line([g, 0, -h], [g, 0, h]); line([-h, 0, g], [h, 0, g]); }
  ctx.strokeStyle = "#0f6b5c"; ctx.lineWidth = 2; line([-h, 0, -h], [h, 0, -h]); line([-h, 0, h], [h, 0, h]); line([-h, 0, -h], [-h, 0, h]); line([h, 0, -h], [h, 0, h]); // the ground edge
  const light = [0.3, 0.8, 0.5], ll = Math.hypot(...light), rgb = rgbOf(o.tri), n = I.length / 3, order: { t: number; d: number; sh: number; a: any; b: any; c: any }[] = [];
  for (let t = 0; t < n; t++) {
    const i0 = I[t * 3] * 3, i1 = I[t * 3 + 1] * 3, i2 = I[t * 3 + 2] * 3;
    const a = pr(P[i0], P[i0 + 1], P[i0 + 2]), b = pr(P[i1], P[i1 + 1], P[i1 + 2]), c = pr(P[i2], P[i2 + 1], P[i2 + 2]);
    if (!a || !b || !c) continue;
    const ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2], vx = P[i2] - P[i0], vy = P[i2 + 1] - P[i0 + 1], vz = P[i2 + 2] - P[i0 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1;
    const sh = 0.55 + 0.45 * Math.abs((nx * light[0] + ny * light[1] + nz * light[2]) / (nl * ll));
    order.push({ t, d: (a.depth + b.depth + c.depth) / 3, sh, a, b, c });
  }
  order.sort((p, q) => q.d - p.d);
  for (const e of order) {
    const k = e.t * 3, r = o.colour ? rgb[k] : 154, g = o.colour ? rgb[k + 1] : 160, bl = o.colour ? rgb[k + 2] : 156;
    ctx.fillStyle = `rgb(${Math.round(r * e.sh)},${Math.round(g * e.sh)},${Math.round(bl * e.sh)})`;
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.lineTo(e.c.x, e.c.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (o.arrow) { // the side camera sits at +z and looks along -z
    const z0 = h * 0.95, z1 = h * 0.35, x = -h * 0.8;
    ctx.strokeStyle = "#d9741a"; ctx.fillStyle = "#d9741a"; ctx.lineWidth = 3;
    line([x, 0.001, z0], [x, 0.001, z1]); line([x, 0.001, z1], [x - h * 0.06, 0.001, z1 + h * 0.12]); line([x, 0.001, z1], [x + h * 0.06, 0.001, z1 + h * 0.12]);
    const lab = pr(x, 0.001, z0); if (lab) { ctx.font = "bold 12px system-ui"; ctx.fillText("side camera looks this way", Math.max(4, Math.min(W - 170, lab.x - 10)), Math.min(H - 6, lab.y + 14)); }
  }
  ctx.fillStyle = "#17201d"; ctx.font = "bold 12px system-ui"; ctx.fillText(o.title, 6, 14);
  ctx.fillStyle = "#52605a"; ctx.font = "11px system-ui"; ctx.fillText(`grid squares: ${o.unit}`, 6, H - 6);
}
