// A place becomes a lane, and the lane says which building footprints became which obstacle (CC-78, "explain" strip in the map mode).
// The same search as scripts/osm-lane.ts and the editor: shrink the place until the simulator can clear a lane cut through it.
// Pure maths (no page, no network), so a Web Worker, the build script and the tests all run it.
import { bestSlices, HALF_LANE, laneSamples, sliceProfile, surfaceSamples } from '../slice/slice';
import { centred } from '../slice/world';
import { buildingsFrom, extrude, MAX_SHRUNK_HEIGHT, medianHeight, type Building, type OverpassAnswer } from './osm';
import { groundAt, lowest, type Ground } from './terrain';
import type { PlaceLane } from './places';

const area2 = (p: [number, number][]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
function inside(poly: [number, number][], x: number, z: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// how far a point is from the outline (the lane also feels a wall it brushes along its edge)
function edgeDistance(poly: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

export const shrinkLadder = (bs: Building[]): number[] => {
  const start = Math.min(1, Math.max(0.02, 5 / medianHeight(bs)));
  return Array.from({ length: 5 }, (_, i) => Math.round(start * 0.6 ** i * 1000) / 1000);
};

export interface LaneOptions { ladder?: number[]; onStep?: (message: string) => void; now?: () => number }
interface Cut { angle: number; offset: number; level: number; u0: number; uEnd: number } // the lane, in the centred, shrunk metres
type Kept = { b: Building; i: number }[];

const keepBuildings = (answer: OverpassAnswer, lat: number, lon: number): Kept =>
  buildingsFrom(answer, lat, lon).map((b, i) => ({ b, i })).filter(({ b }) => b.ring.length >= 3 && Math.abs(area2(b.ring)) >= 4); // footprint numbers in the roles are indexes into the unfiltered list

// where `centred` moves the x and z middle (the buildings' own corners decide it)
function middle(positions: number[]): [number, number] {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) { x0 = Math.min(x0, positions[i]); x1 = Math.max(x1, positions[i]); z0 = Math.min(z0, positions[i + 2]); z1 = Math.max(z1, positions[i + 2]); }
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

// Which footprints does the lane run over, and what did each become?
function footprintRoles(kept: Kept, k: number, ground: Ground | null, ox: number, oz: number, cut: Cut): PlaceLane['roles'] {
  const du = Math.cos(cut.angle), dz = Math.sin(cut.angle), nu = -dz, nz = du; // along the run, and sideways
  const used: { i: number; uMid: number; top: number; uLo: number; uHi: number }[] = [];
  for (const { b, i } of kept) {
    let ring: [number, number][] = b.ring.map(([x, z]) => [x * k - ox, z * k - oz]);
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
    if (ring.length < 3) continue;
    const cx = b.ring.reduce((t, p) => t + p[0], 0) / b.ring.length, cz = b.ring.reduce((t, p) => t + p[1], 0) / b.ring.length;
    const top = (ground ? (groundAt(ground, cx, cz) - lowest(ground)) * k : 0) + Math.min(b.h * k, MAX_SHRUNK_HEIGHT) - cut.level;
    let lo = Infinity, hi = -Infinity;
    for (let u = cut.u0; u <= cut.uEnd; u += 0.1) for (const side of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const v = cut.offset + side * HALF_LANE, x = u * du + v * nu, z = u * dz + v * nz;
      if (inside(ring, x, z) || edgeDistance(ring, x, z) < 0.15) { lo = Math.min(lo, u); hi = Math.max(hi, u); }
    }
    if (lo <= hi) used.push({ i, uMid: (lo + hi) / 2, top, uLo: lo, uHi: hi });
  }
  used.sort((p, q) => p.uMid - q.uMid);
  const roles: PlaceLane['roles'] = [];
  let prevTop = used.length ? used[0].top : 0, prevHi = -Infinity; // the first footprint is the starting deck
  for (const b of used) {
    const gap = b.uLo - prevHi > 1.2 && prevHi > -Infinity;
    const diff = b.top - prevTop;
    // a gap marks both its edges: the roof the runner leaves and the roof it lands on
    if (gap && roles.length && roles[roles.length - 1].role === 'deck') roles[roles.length - 1].role = 'gap-edge';
    const role = gap ? 'gap-edge' : Math.abs(diff) >= 1.2 ? 'wall' : Math.abs(diff) >= 0.25 ? 'step' : 'deck';
    roles.push({ footprint: b.i, role });
    prevTop = b.top; prevHi = b.uHi;
  }
  return roles;
}

// The roles again for a lane that was found before (the build script uses this to relabel the ready places without searching again).
// The summary keeps the turn to a degree (the search tries 10 degree steps), the sideways step to 0.1 m and the level to 1 cm: enough to find the same buildings.
export function rolesFromSummary(answer: OverpassAnswer, lat: number, lon: number, ground: Ground | null, lane: PlaceLane): PlaceLane['roles'] {
  if (!lane.cleared) return [];
  const kept = keepBuildings(answer, lat, lon), k = lane.shrink;
  const m = extrude(kept.map((x) => x.b), k, ground), [ox, oz] = middle(m.positions);
  const angle = (lane.turnDeg * Math.PI) / 180, du = Math.cos(angle), dz = Math.sin(angle);
  const u0 = (lane.line[0] * k - ox) * du + (lane.line[1] * k - oz) * dz; // the first end of the line, along the run
  return footprintRoles(kept, k, ground, ox, oz, { angle, offset: lane.sidewaysM, level: lane.levelM, u0, uEnd: u0 + lane.lengthM });
}

// Returns null when there are no buildings; `cleared: false` summary when no shrink in the ladder gave a lane.
export function laneForPlace(answer: OverpassAnswer, lat: number, lon: number, ground: Ground | null, opts: LaneOptions = {}): PlaceLane | null {
  const now = opts.now ?? (() => Date.now());
  const t0 = now();
  const kept = keepBuildings(answer, lat, lon), bs = kept.map((x) => x.b);
  if (!bs.length) return null;
  const ladder = opts.ladder ?? shrinkLadder(bs);
  for (const k of ladder) {
    opts.onStep?.(`Cutting a lane at ${k} of real size...`);
    const m = extrude(bs, k, ground);
    if (!m.indices.length) continue;
    const piece = centred({ positions: m.positions, indices: m.indices });
    const [ox, oz] = middle(m.positions);
    const samples = surfaceSamples(piece, 80);
    const cands = bestSlices({ positions: samples }, { top: 3, centre: { x: 0, z: 0 }, reprofile: (c) => sliceProfile(laneSamples(piece, c), { x: 0, z: 0 }, c) }); // the proof reads the lane the way the editor will (CC-91)
    if (!cands.length) continue;
    const best = cands[0], rep = best.report, a = best.angle;
    const u0 = best.profile.origin ?? 0, uEnd = u0 + best.profile.length;
    const roles = footprintRoles(kept, k, ground, ox, oz, { angle: a, offset: best.offset, level: best.level, u0, uEnd });
    // the lane's two ends in real metres east (x) and south (z) of the pin, for drawing it on the map
    const du = Math.cos(a), dz = Math.sin(a), nu = -dz, nz = du;
    const real = (u: number): [number, number] => [(u * du + best.offset * nu + ox) / k, (u * dz + best.offset * nz + oz) / k];
    const p0 = real(u0), p1 = real(uEnd);
    return {
      shrink: k, lengthM: Math.round(rep.length * 10) / 10, levelM: Math.round(best.level * 100) / 100, turnDeg: Math.round((a * 180) / Math.PI), sidewaysM: Math.round(best.offset * 10) / 10,
      steps: rep.steps, faces: rep.faces, gaps: rep.gaps, curves: rep.curves, maxDropM: Math.round(rep.maxDrop * 10) / 10, cleared: true, secondsTaken: Math.round((now() - t0) / 100) / 10,
      line: [Math.round(p0[0] * 10) / 10, Math.round(p0[1] * 10) / 10, Math.round(p1[0] * 10) / 10, Math.round(p1[1] * 10) / 10], widthM: Math.round((2 / k) * 10) / 10, roles,
    };
  }
  return { shrink: ladder[ladder.length - 1], lengthM: 0, levelM: 0, turnDeg: 0, sidewaysM: 0, steps: 0, faces: 0, gaps: 0, curves: 0, maxDropM: 0, cleared: false, secondsTaken: Math.round((now() - t0) / 100) / 10, line: [0, 0, 0, 0], widthM: 0, roles: [] };
}
