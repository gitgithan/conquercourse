// CC-133 ground colour: the ground of a place scene is painted from the OpenStreetMap tags we already fetch
// (land use, parks, water, paving, road surface) instead of one flat colour. Colour only: no height, no physics, no collision.
// Pure on purpose (no three.js, no DOM): the scene turns the returned pixels into a texture, so tests can pin every rule.
//   tags  ->  a zone (grass, lawn, wood, sand, gravel, water, sports, asphalt, paving, rock, built)
//   zones ->  a small raster, painted low to high rank (water on top of grass on top of nothing)
//   edges ->  blurred over about a metre or two, so a lawn melts into a path instead of ending in jagged cells
//   slope ->  a gentle shade on top where the real ground height is known; no tag, no slope: today's flat colour
// Behind its own switch: ?groundcolour=1 / 0 (on by default in dev and on the preview site, off on the real site).

export type GroundZone = 'base' | 'built' | 'grass' | 'lawn' | 'wood' | 'sand' | 'gravel' | 'water' | 'sports' | 'asphalt' | 'paving' | 'rock';
export type Rgb = [number, number, number];

/** The palette. `base` is today's flat ground colour, kept for every spot no tag covers. */
export const ZONE_HEX: Record<GroundZone, string> = {
  base: '#d2cdbf', built: '#bdb7a8', grass: '#8db86b', lawn: '#9cc477', wood: '#5f9150', sand: '#e6d6a0', gravel: '#cdbf9c',
  water: '#6fa8d6', sports: '#c7765a', asphalt: '#8e8e92', paving: '#d3cdbd', rock: '#a29d94',
};
export const hexToRgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
export const ZONE_RGB: Record<GroundZone, Rgb> = Object.fromEntries(Object.entries(ZONE_HEX).map(([k, v]) => [k, hexToRgb(v)])) as Record<GroundZone, Rgb>;

export interface Tags { [k: string]: string }

/** Painted low to high: a higher rank sits on top of a lower one. */
const RANK: Record<GroundZone, number> = { base: 0, built: 1, rock: 2, paving: 3, sand: 4, gravel: 5, grass: 6, lawn: 7, sports: 8, wood: 9, water: 10, asphalt: 11 };

/** The zone an area (a closed way or a relation) paints, or null when its tags say nothing about the ground. */
export function areaZone(tags: Tags = {}): GroundZone | null {
  if (tags.natural === 'water' || tags.waterway === 'riverbank' || tags.leisure === 'swimming_pool') return 'water';
  if (tags.natural === 'wood' || tags.landuse === 'forest' || tags.natural === 'scrub' || tags.natural === 'wetland') return 'wood';
  if (tags.leisure === 'pitch' || tags.leisure === 'playground' || tags.leisure === 'track' || tags.leisure === 'sports_centre') return tags.surface === 'grass' ? 'grass' : ['asphalt', 'concrete', 'paved', 'paving_stones'].includes(tags.surface ?? '') ? (tags.surface === 'asphalt' ? 'asphalt' : 'paving') : ['gravel', 'fine_gravel', 'woodchips', 'sand'].includes(tags.surface ?? '') ? 'gravel' : 'sports';
  if (tags.natural === 'sand' || tags.natural === 'beach') return 'sand';
  if (tags.natural === 'shingle' || tags.natural === 'scree' || tags.natural === 'mud') return 'gravel';
  if (tags.natural === 'bare_rock' || tags.natural === 'cliff') return 'rock';
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'common' || tags.leisure === 'dog_park' || tags.landuse === 'village_green') return 'lawn';
  if (['grass', 'meadow', 'recreation_ground', 'cemetery', 'orchard', 'vineyard', 'farmland', 'allotments', 'flowerbed'].includes(tags.landuse ?? '') || tags.natural === 'grassland' || tags.natural === 'heath') return 'grass';
  if (tags.amenity === 'parking' || tags.landuse === 'garages') return tags.surface === 'gravel' || tags.surface === 'unpaved' || tags.surface === 'compacted' ? 'gravel' : 'asphalt';
  if (tags['area:highway'] || (tags.highway && tags.area === 'yes') || tags.place === 'square') return tags.surface === 'asphalt' ? 'asphalt' : 'paving';
  if (['residential', 'commercial', 'retail', 'industrial', 'railway', 'construction', 'brownfield'].includes(tags.landuse ?? '')) return 'built';
  return null;
}

const UNPAVED = ['gravel', 'fine_gravel', 'compacted', 'unpaved', 'ground', 'dirt', 'earth', 'sand', 'pebblestone', 'grass'];
/** The zone and width (metres) of a way drawn as a line (a street or a path), or null. */
export function lineZone(tags: Tags = {}): { zone: GroundZone; width: number } | null {
  const h = tags.highway; if (!h) return null;
  const w = Number(tags.width), pick = (zone: GroundZone, width: number) => ({ zone, width: Number.isFinite(w) && w > 0 && w < 40 ? w : width });
  const unpaved = UNPAVED.includes(tags.surface ?? '');
  if (['motorway', 'trunk', 'primary'].includes(h)) return pick('asphalt', 11);
  if (['secondary', 'tertiary'].includes(h)) return pick('asphalt', 9);
  if (['residential', 'unclassified', 'service', 'living_street'].includes(h)) return pick(unpaved ? 'gravel' : tags.surface === 'paving_stones' || tags.surface === 'sett' || tags.surface === 'cobblestone' ? 'paving' : 'asphalt', 6);
  if (['footway', 'pedestrian', 'steps', 'cycleway'].includes(h)) return pick(unpaved ? 'gravel' : 'paving', h === 'steps' ? 2.2 : 2.6);
  if (['path', 'track', 'bridleway'].includes(h)) return pick(tags.surface && !unpaved ? 'paving' : 'gravel', tags.highway === 'track' ? 3 : 1.8);
  return null;
}

// ---- slope (colour only)
/** A gentle shade for steep ground: darker and a little earthier. Flat or unknown (0 degrees) gives the same colour back. */
export function slopeShade(c: Rgb, deg: number): Rgb {
  const t = Math.max(0, Math.min(1, deg / 30)), dark = 1 - 0.2 * t, earth = hexToRgb('#8c7f68'), mix = 0.22 * t;
  return [0, 1, 2].map((i) => Math.round((c[i] * (1 - mix) + earth[i] * mix) * dark)) as Rgb;
}
/** Slope in degrees at a point from a height grid like src/world/terrain.ts Ground (kept structural so this file stays pure). */
export interface HeightGrid { radius: number; step: number; n: number; h: number[] }
export function slopeDeg(g: HeightGrid | null | undefined, x: number, z: number, e = 6): number {
  if (!g) return 0;
  const at = (px: number, pz: number) => {
    const fi = Math.min(g.n - 1.001, Math.max(0, (px + g.radius) / g.step)), fj = Math.min(g.n - 1.001, Math.max(0, (pz + g.radius) / g.step));
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, H = (ii: number, jj: number) => g.h[jj * g.n + ii];
    return H(i, j) * (1 - a) * (1 - b) + H(i + 1, j) * a * (1 - b) + H(i, j + 1) * (1 - a) * b + H(i + 1, j + 1) * a * b;
  };
  const dx = (at(x + e, z) - at(x - e, z)) / (2 * e), dz = (at(x, z + e) - at(x, z - e)) / (2 * e);
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
}

// ---- the raster
export interface XZ { x: number; z: number } // metres east, metres south of the pin
export interface PaintElement { type: 'node' | 'way' | 'relation'; tags?: Tags; lat?: number; lon?: number; geometry?: { lat: number; lon: number }[]; members?: { role: string; geometry?: { lat: number; lon: number }[] }[] }
export interface PaintOptions {
  half: number; // the raster covers -half..half metres around the pin, both ways
  cell?: number; // metres per pixel
  blurM?: number; // how wide an edge melts, metres
  project: (p: { lat: number; lon: number }) => XZ;
  ground?: HeightGrid | null;
}
export interface Painted { rgba: Uint8ClampedArray; size: number; cell: number; half: number; counts: Partial<Record<GroundZone, number>> }

function ringsOf(e: PaintElement, project: PaintOptions['project']): XZ[][] {
  const close = (g: { lat: number; lon: number }[]) => g.map(project);
  if (e.type === 'way' && e.geometry && e.geometry.length > 3) { const r = close(e.geometry), a = r[0], b = r[r.length - 1]; return a.x === b.x && a.z === b.z ? [r.slice(0, -1)] : []; }
  if (e.type === 'relation') return (e.members ?? []).filter((m) => m.role === 'outer' && m.geometry && m.geometry.length > 3).map((m) => { const r = close(m.geometry!); const a = r[0], b = r[r.length - 1]; return a.x === b.x && a.z === b.z ? r.slice(0, -1) : r; });
  return [];
}

/** Paint the ground of a place. Cells no tag covers keep the `base` colour (today's flat ground). */
export function paintGround(elements: PaintElement[], o: PaintOptions): Painted {
  const half = o.half, cell = Math.max(o.cell ?? 0.5, (2 * half) / 1024), size = Math.ceil((2 * half) / cell), zone = new Uint8Array(size * size);
  const ZONES = Object.keys(RANK) as GroundZone[], idx = (z: GroundZone) => ZONES.indexOf(z);
  const cx = (i: number) => -half + (i + 0.5) * cell; // world x or z of a pixel centre
  const fillRing = (r: XZ[], z: number) => {
    let z0 = Infinity, z1 = -Infinity; for (const p of r) { z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const j0 = Math.max(0, Math.floor((z0 + half) / cell - 0.5)), j1 = Math.min(size - 1, Math.ceil((z1 + half) / cell - 0.5));
    for (let j = j0; j <= j1; j++) {
      const pz = cx(j), xs: number[] = [];
      for (let a = 0, b = r.length - 1; a < r.length; b = a++) if (r[a].z > pz !== r[b].z > pz) xs.push(r[a].x + ((pz - r[a].z) / (r[b].z - r[a].z)) * (r[b].x - r[a].x));
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] + half) / cell - 0.5)), i1 = Math.min(size - 1, Math.floor((xs[k + 1] + half) / cell - 0.5));
        for (let i = i0; i <= i1; i++) { const at = j * size + i; if (RANK[ZONES[zone[at]]] <= RANK[ZONES[z]]) zone[at] = z; }
      }
    }
  };
  // areas first, low rank to high, so water ends up on top of a park
  const areas: { z: GroundZone; rings: XZ[][] }[] = [];
  for (const e of elements) { if (e.type === 'node') continue; const z = areaZone(e.tags); if (z) areas.push({ z, rings: ringsOf(e, o.project) }); }
  areas.sort((a, b) => RANK[a.z] - RANK[b.z]);
  for (const a of areas) for (const r of a.rings) if (r.length >= 3) fillRing(r, idx(a.z));
  // then streets and paths, not over water (a bridge is drawn as water here: the tags we keep do not say bridge)
  const lines: { z: GroundZone; w: number; pts: XZ[]; rank: number }[] = [];
  for (const e of elements) {
    if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
    const l = lineZone(e.tags); if (!l || areaZone(e.tags) === 'paving') continue;
    lines.push({ z: l.zone, w: l.width, pts: e.geometry.map(o.project), rank: RANK[l.zone] });
  }
  lines.sort((a, b) => (a.w === b.w ? a.rank - b.rank : b.w - a.w)); // wide streets first, narrow paths over them
  const water = idx('water');
  for (const l of lines) for (let s = 0; s + 1 < l.pts.length; s++) {
    const a = l.pts[s], b = l.pts[s + 1], hw = l.w / 2, dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1;
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - hw + half) / cell)), i1 = Math.min(size - 1, Math.ceil((Math.max(a.x, b.x) + hw + half) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - hw + half) / cell)), j1 = Math.min(size - 1, Math.ceil((Math.max(a.z, b.z) + hw + half) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = cx(i), pz = cx(j), t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2)), d = Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
      if (d <= hw && zone[j * size + i] !== water) zone[j * size + i] = idx(l.z);
    }
  }
  // zone -> colour (floats), then blur so an edge melts over about blurM
  const f = new Float32Array(size * size * 3), counts: Partial<Record<GroundZone, number>> = {};
  for (let p = 0; p < size * size; p++) { const z = ZONES[zone[p]], c = ZONE_RGB[z]; f[p * 3] = c[0]; f[p * 3 + 1] = c[1]; f[p * 3 + 2] = c[2]; counts[z] = (counts[z] ?? 0) + 1; }
  const r = Math.max(0, Math.round((o.blurM ?? 1.2) / cell / 2));
  if (r > 0) { boxBlur(f, size, r); boxBlur(f, size, r); }
  // slope shade on top, then pixels
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const p = j * size + i, deg = o.ground ? slopeDeg(o.ground, cx(i), cx(j)) : 0;
    const c = deg > 0 ? slopeShade([f[p * 3], f[p * 3 + 1], f[p * 3 + 2]], deg) : [f[p * 3], f[p * 3 + 1], f[p * 3 + 2]];
    rgba[p * 4] = c[0]; rgba[p * 4 + 1] = c[1]; rgba[p * 4 + 2] = c[2]; rgba[p * 4 + 3] = 255;
  }
  return { rgba, size, cell, half, counts };
}

/** A box blur of radius r (pixels) along x then z, in place. */
function boxBlur(f: Float32Array, size: number, r: number): void {
  const tmp = new Float32Array(size), w = 2 * r + 1;
  for (let c = 0; c < 3; c++) {
    for (let j = 0; j < size; j++) { // along x
      let acc = 0; for (let k = -r; k <= r; k++) acc += f[(j * size + Math.max(0, Math.min(size - 1, k))) * 3 + c];
      for (let i = 0; i < size; i++) { tmp[i] = acc / w; acc += f[(j * size + Math.min(size - 1, i + r + 1)) * 3 + c] - f[(j * size + Math.max(0, i - r)) * 3 + c]; }
      for (let i = 0; i < size; i++) f[(j * size + i) * 3 + c] = tmp[i];
    }
    for (let i = 0; i < size; i++) { // along z
      let acc = 0; for (let k = -r; k <= r; k++) acc += f[(Math.max(0, Math.min(size - 1, k)) * size + i) * 3 + c];
      for (let j = 0; j < size; j++) { tmp[j] = acc / w; acc += f[(Math.min(size - 1, j + r + 1) * size + i) * 3 + c] - f[(Math.max(0, j - r) * size + i) * 3 + c]; }
      for (let j = 0; j < size; j++) f[(j * size + i) * 3 + c] = tmp[j];
    }
  }
}

// ---- the switch
/** ?groundcolour=1 or 0 decides; with no word it is on in dev (localhost) and on the preview site, off everywhere else (the real site, tests). */
export function groundColourOn(q: URLSearchParams, host = ''): boolean {
  const v = q.get('groundcolour');
  if (v === '1' || v === 'on') return true;
  if (v === '0' || v === 'off') return false;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('preview.') || host.endsWith('.localhost');
}
