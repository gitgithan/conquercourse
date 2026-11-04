// Building colour and detail from OpenStreetMap tags (CC-133, step 3 of the realism plan). Looks only: a wall colour, a roof colour and shape, window rows and a ground-floor band.
// Pure: no DOM, no three.js, no network. skin.ts draws what these rules decide; the footprints and heights are never changed here.
// Map data: OpenStreetMap contributors, ODbL. No street photos are used for this.
export interface StyleTags { [k: string]: string }
export type RoofShape = 'flat' | 'gabled' | 'hipped';
export type WallPattern = 'brick' | 'windows' | 'plain' | 'glass';
export interface BuildingStyle { wall: string; roof: string; roofShape: RoofShape; pattern: WallPattern; rows: number; band: boolean; palette: Region }
export type Region = 'warm' | 'cool' | 'plain';

// The switch: ?bstyle=1 or 0 decides; with no word it is ON on a dev machine and on the preview site, OFF on the live site.
export function styleDefaultOn(host: string): boolean { return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.startsWith('preview.'); }
export function buildingStyleOn(q: URLSearchParams, host: string): boolean { const v = q.get('bstyle'); return v === '1' ? true : v === '0' ? false : styleDefaultOn(host); }

export const hashString = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0); };
// a stable number for one building: its OpenStreetMap id when the data has it, else its first corner (the same place gives the same number on every load)
export function buildingSeed(id: number | string | undefined, first?: { lat: number; lon: number }): number {
  if (id !== undefined) return hashString(String(id));
  return first ? hashString(`${first.lat.toFixed(6)},${first.lon.toFixed(6)}`) : 1;
}

// Southern Europe, the Mediterranean and Latin America lean warm; the north and the English-speaking cities lean cool.
export function regionOf(lat: number, lon: number): Region {
  if (lat >= 30 && lat <= 45.5 && lon >= -10 && lon <= 45) return 'warm';
  if (lat < 30 && lat > -35 && lon > -120 && lon < -30) return 'warm';
  return 'cool';
}
export const PALETTES: Record<Region, string[]> = {
  warm: ['#e3c9a0', '#d9a679', '#e8d8b4', '#cf8f6b', '#ecdcc4', '#c9b08a', '#dfb990', '#d7c3a6'],
  cool: ['#c9bfae', '#b7a48e', '#a9b0b3', '#d3cbbb', '#b9967c', '#a39c92', '#c7b79d', '#9fa8ad'],
  plain: ['#d6c3a3', '#cfc4b0', '#c9b79a', '#d9cdb8'],
};
const PLAIN_KINDS = new Set(['yes', 'house', 'detached', 'semidetached_house', 'residential', 'apartments', 'terrace', 'dormitory']);
const LOW_KINDS = new Set(['house', 'detached', 'semidetached_house', 'garage', 'shed', 'roof', 'greenhouse', 'church', 'cathedral', 'chapel']);
const ROOF_WARM = ['#b9603f', '#a85a40', '#c26b46'], ROOF_COOL = ['#6f7478', '#7b6d64', '#5f666b'];

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
const num = (s?: string) => { const v = parseFloat((s ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };

export function roofShapeOf(tags: StyleTags = {}): RoofShape {
  const s = (tags['roof:shape'] ?? '').toLowerCase();
  if (s === 'gabled' || s === 'gable' || s === 'gambrel' || s === 'saltbox' || s === 'half-hipped') return 'gabled';
  if (s === 'hipped' || s === 'pyramidal' || s === 'hip') return 'hipped';
  return 'flat';
}
// floors: the levels tag, else the height over 3 m, at least 1 and at most 27 (a taller wall repeats its last row)
export function floorRows(tags: StyleTags = {}, height = 9): number {
  const l = num(tags['building:levels']);
  return Math.max(1, Math.min(27, l !== null && l > 0 ? Math.round(l) : Math.round(height / 3)));
}

export function styleBuilding(tags: StyleTags, seed: number, height: number, base: { wall: string; roof: string; pattern: 'brick' | 'windows' | 'plain' }, lat = 0, lon = 0): BuildingStyle {
  const kind = tags.building ?? 'yes', region = regionOf(lat, lon), pal = PALETTES[region];
  const rows = floorRows(tags, height), roofShape = roofShapeOf(tags);
  const jitter = 0.94 + (seed % 13) / 100; // 0.94 .. 1.06
  let wall = base.wall;
  if (tags['building:colour']) wall = base.wall; // a written colour is kept exactly
  else if (tags['building:material']) wall = shade(base.wall, jitter);
  else if (PLAIN_KINDS.has(kind)) wall = pal[(seed >>> 3) % pal.length];
  else wall = shade(base.wall, jitter);
  let roof = base.roof;
  if (!tags['roof:colour'] && !tags['roof:material']) {
    const pitched = roofShape !== 'flat', list = region === 'warm' ? ROOF_WARM : ROOF_COOL;
    roof = pitched ? list[(seed >>> 5) % list.length] : shade(base.roof, jitter);
  }
  const glass = tags['building:material'] === 'glass' || (kind === 'office' && rows >= 6);
  const pattern: WallPattern = glass ? 'glass' : base.pattern;
  const band = pattern !== 'plain' && rows >= 2 && !LOW_KINDS.has(kind);
  return { wall, roof, roofShape, pattern, rows, band, palette: region };
}

// ---- roofs: a gabled or hipped cap over a near-rectangular footprint (anything else keeps its flat roof)
export interface RoofBox { cx: number; cz: number; ux: number; uz: number; len: number; wid: number; fill: number }
// the smallest turned rectangle round the footprint, found from its own edge directions; fill is the footprint area over the rectangle area
export function roofBox(ring: { x: number; z: number }[]): RoofBox | null {
  if (ring.length < 3) return null;
  let best: RoofBox | null = null, bestA = Infinity;
  const a = ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p.x * q.z - q.x * p.z; }, 0) / 2;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz); if (l < 1e-6) continue;
    const ux = dx / l, uz = dz / l; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const r of ring) { const u = r.x * ux + r.z * uz, v = -r.x * uz + r.z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (area < bestA) { bestA = area; const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; best = { cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, len: u1 - u0, wid: v1 - v0, fill: Math.abs(a) / area }; }
  }
  if (!best) return null;
  if (best.wid > best.len) { const { ux, uz } = best; best = { ...best, ux: -uz, uz: ux, len: best.wid, wid: best.len }; }
  return best;
}
export const roofFits = (b: RoofBox | null): b is RoofBox => !!b && b.fill >= 0.8 && b.wid >= 3 && b.len / b.wid < 6;

// triangles (flat list of x,y,z) of the roof over the box, standing on y0; rise is how high the ridge stands above y0
export function roofTriangles(b: RoofBox, shape: 'gabled' | 'hipped', y0: number, rise: number): number[] {
  const vx = -b.uz, vz = b.ux, hl = b.len / 2, hw = b.wid / 2;
  const at = (u: number, v: number, y: number): [number, number, number] => [b.cx + u * b.ux + v * vx, y, b.cz + u * b.uz + v * vz];
  const c1 = at(-hl, -hw, y0), c2 = at(hl, -hw, y0), c3 = at(hl, hw, y0), c4 = at(-hl, hw, y0), top = y0 + rise;
  const inset = shape === 'hipped' ? Math.min(hw, hl - 1e-3) : 0;
  const r1 = at(-hl + inset, 0, top), r2 = at(hl - inset, 0, top);
  const t: [number, number, number][][] = [[c1, c2, r2], [c1, r2, r1], [c3, c4, r1], [c3, r1, r2]];
  t.push([c4, c1, r1], [c2, c3, r2]);
  return t.flat(2);
}
