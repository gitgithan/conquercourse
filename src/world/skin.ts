// Skins for real places (CC-178): colour and a little texture from OpenStreetMap tags, so a place is not grey boxes on a grey plane.
// Cheap on purpose: a few hundred meshes, one tiny canvas texture per look, two instanced meshes for every tree, no downloads.
//   ?skin=none   the old look (grey boxes)
//   ?skin=tags   colours from tags: building kind, roof colour, grass, water, roads, paving
//   ?skin=full   tags + brick/window pattern on walls + trees + soft shadows   (default of the preview page)
// The tag rules are pure functions (tests/skin.test.ts); only buildSkin touches three.js. It lives apart from the editor and map scenes:
// a scene that wants it calls buildSkin(osm, { skin, k }) and adds the returned group (all sizes are multiplied by k, the place's shrink).
import * as THREE from 'three';
import { heightOf } from './osm';
import { buildingSeed, roofBox, roofFits, roofTriangles, shade, styleBuilding, type BuildingStyle } from './building-style';
import { groundAt, lowest, type Ground } from './terrain';
import { pickWall, wallQuad, type FacadeSpec } from './facade';
import { paintGround } from '../slice/ground-colour';

export type SkinMode = 'none' | 'tags' | 'full';
export const skinFromQuery = (q: URLSearchParams, fallback: SkinMode = 'none'): SkinMode => { const s = q.get('skin'); return s === 'none' || s === 'tags' || s === 'full' ? s : fallback; };

export interface SkinTags { [k: string]: string }
export interface SkinElement { type: 'node' | 'way' | 'relation'; id?: number; tags?: SkinTags; lat?: number; lon?: number; geometry?: { lat: number; lon: number }[]; members?: { role: string; geometry?: { lat: number; lon: number }[] }[] }
export interface SkinOsm { lat: number; lon: number; radius: number; elements: SkinElement[] }

// ---- the rules (pure)
const NAMED: Record<string, string> = { white: '#e8e4da', grey: '#9a9a9a', gray: '#9a9a9a', red: '#b5523f', brown: '#8b6a4f', beige: '#d8c8a4', yellow: '#e2c872', orange: '#d98a4e', green: '#7c9a6a', blue: '#7390b0', black: '#4a4a4a', pink: '#d9a3a0', cream: '#efe3c0', tan: '#c8a97e' };
// a colour tag is either a name or #rrggbb; anything else is ignored
export function colourTag(v?: string): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  return NAMED[s] ?? null;
}
const KIND_WALL: Record<string, string> = { house: '#d9b88f', detached: '#d9b88f', terrace: '#b9714f', residential: '#d6c3a3', apartments: '#d8c2a0', dormitory: '#d6c3a3', commercial: '#a9b4be', retail: '#c9a98a', office: '#9fb0bd', industrial: '#a6a39b', warehouse: '#9c6b52', church: '#e0d6bd', cathedral: '#e0d6bd', chapel: '#e0d6bd', civic: '#d7cdb6', public: '#d7cdb6', hospital: '#e4e0d8', school: '#cdb594', university: '#cdb594', hotel: '#d8c6b0', museum: '#dcd2bc', train_station: '#c8c2b2', garage: '#a9a9a1', shed: '#9b8466', roof: '#b9b3a6', greenhouse: '#a9cdbc', yes: '#cfc4b0' };
const MATERIAL_WALL: Record<string, string> = { brick: '#a4553f', stone: '#cfc6b0', concrete: '#a8a8a2', glass: '#8fb2c4', wood: '#9a7650', plaster: '#e3d9c3', metal: '#9aa3a8' };
export interface BuildingLook { wall: string; roof: string; pattern: 'brick' | 'windows' | 'plain' }
export function buildingLook(tags: SkinTags = {}, height = 9): BuildingLook {
  const kind = tags.building ?? 'yes';
  const wall = colourTag(tags['building:colour']) ?? MATERIAL_WALL[tags['building:material'] ?? ''] ?? KIND_WALL[kind] ?? KIND_WALL.yes;
  const roof = colourTag(tags['roof:colour']) ?? (tags['roof:material'] === 'tiles' || tags['roof:shape'] === 'hipped' || tags['roof:shape'] === 'gabled' ? '#a85a40' : kind === 'church' || kind === 'cathedral' ? '#7f8d86' : height > 20 ? '#7d8185' : '#8f8a82');
  const pattern = tags['building:material'] === 'brick' || kind === 'terrace' || kind === 'warehouse' ? 'brick' : kind === 'garage' || kind === 'shed' || kind === 'roof' ? 'plain' : 'windows';
  return { wall, roof, pattern };
}

export type LandKind = 'grass' | 'wood' | 'water' | 'sand' | 'paving' | 'rock';
export function landKind(tags: SkinTags = {}): LandKind | null {
  if (tags.natural === 'water' || tags.waterway === 'riverbank') return 'water';
  if (tags.natural === 'wood' || tags.landuse === 'forest' || tags.natural === 'scrub') return 'wood';
  if (tags.natural === 'sand' || tags.natural === 'beach') return 'sand';
  if (tags.natural === 'bare_rock') return 'rock';
  if (['park', 'garden', 'common', 'playground'].includes(tags.leisure ?? '') || ['grass', 'meadow', 'village_green', 'recreation_ground', 'cemetery'].includes(tags.landuse ?? '') || tags.natural === 'grassland') return 'grass';
  if (tags.leisure === 'pitch') return 'grass';
  if (tags['area:highway'] || (tags.highway && tags.area === 'yes')) return 'paving';
  return null;
}
export const LAND_COLOUR: Record<LandKind, string> = { grass: '#8db86b', wood: '#5f9150', water: '#6fa8d6', sand: '#e6d6a0', paving: '#c9c3b4', rock: '#a29d94' };
export const GROUND_COLOUR = '#d2cdbf';
export const SKY_COLOUR = '#cfe3f2';

export interface RoadLook { width: number; colour: string }
export function roadLook(tags: SkinTags = {}): RoadLook | null {
  const h = tags.highway; if (!h) return null;
  const w = Number(tags.width);
  const pick = (width: number, colour: string): RoadLook => ({ width: Number.isFinite(w) && w > 0 && w < 40 ? w : width, colour });
  if (['motorway', 'trunk', 'primary'].includes(h)) return pick(11, '#8d8d90');
  if (['secondary', 'tertiary'].includes(h)) return pick(9, '#97979a');
  if (['residential', 'unclassified', 'service', 'living_street'].includes(h)) return pick(6, '#a3a3a4');
  if (h === 'steps') return pick(2.2, '#efe9d6');
  if (['footway', 'pedestrian', 'path', 'cycleway', 'track', 'bridleway'].includes(h)) return pick(tags.surface === 'grass' ? 1.4 : 2.4, h === 'cycleway' ? '#c78d86' : tags.surface === 'gravel' || tags.surface === 'fine_gravel' || tags.surface === 'compacted' ? '#d9c9a0' : '#d8d2c0');
  return null;
}

// a small seeded random so every load of a place looks the same
export function seeded(seed: number): () => number { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
const hash = (a: number, b: number) => ((Math.imul(Math.round(a * 10), 73856093) ^ Math.imul(Math.round(b * 10), 19349663)) >>> 0);

// ---- three.js
const M_LAT = 111320;
interface XY { x: number; z: number } // metres east, metres south of the pin
const project = (o: SkinOsm) => { const mLon = M_LAT * Math.cos((o.lat * Math.PI) / 180); return (p: { lat: number; lon: number }): XY => ({ x: (p.lon - o.lon) * mLon, z: -(p.lat - o.lat) * M_LAT }); };
const closed = (r: XY[]) => r.length > 3 && r[0].x === r[r.length - 1].x && r[0].z === r[r.length - 1].z;
const area = (r: XY[]) => r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a.x * b.z - b.x * a.z; }, 0) / 2;

function rings(e: SkinElement, pr: (p: { lat: number; lon: number }) => XY): XY[][] {
  if (e.type === 'way' && e.geometry) { const r = e.geometry.map(pr); return closed(r) ? [r.slice(0, -1)] : []; }
  if (e.type === 'relation') return (e.members ?? []).filter((m) => m.role === 'outer' && m.geometry && m.geometry.length > 3).map((m) => { const r = m.geometry!.map(pr); return closed(r) ? r.slice(0, -1) : r; });
  return [];
}

function wallTexture(look: BuildingLook): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = look.wall; g.fillRect(0, 0, 64, 64);
  if (look.pattern === 'brick') {
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let row = 0; row < 8; row++) { g.fillRect(0, row * 8, 64, 1); for (let col = 0; col < 4; col++) g.fillRect(((col * 16 + (row % 2) * 8) % 64), row * 8, 1, 8); }
  } else if (look.pattern === 'windows') {
    // a floor is 3 m: one 64 px tile is 3 m wide and 3 m tall, with a window in it
    g.fillStyle = 'rgba(30,45,60,0.55)'; g.fillRect(18, 14, 28, 30);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(18, 14, 28, 3); g.fillRect(31, 14, 2, 30);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 60, 64, 4);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

// CC-133: a tall wall tile for one look: one 3 m floor per 64 px row, the ground floor at the bottom (a shop band when asked), so floors line up from the ground
function styledWallTexture(st: BuildingStyle): THREE.CanvasTexture {
  const rows = st.rows, c = document.createElement('canvas'); c.width = 64; c.height = 64 * rows;
  const g = c.getContext('2d')!;
  g.fillStyle = st.wall; g.fillRect(0, 0, 64, c.height);
  for (let i = 0; i < rows; i++) {
    const y = c.height - 64 * (i + 1); // row 0 is the ground floor, at the bottom of the picture
    if (i === 0 && st.band) {
      g.fillStyle = shade(st.wall, 0.86); g.fillRect(0, y, 64, 64);
      g.fillStyle = 'rgba(30,45,60,0.6)'; g.fillRect(8, y + 22, 48, 30); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(8, y + 22, 48, 3);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, y, 64, 3);
      continue;
    }
    if (st.pattern === 'brick') {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let row = 0; row < 8; row++) { g.fillRect(0, y + row * 8, 64, 1); for (let col = 0; col < 4; col++) g.fillRect((col * 16 + (row % 2) * 8) % 64, y + row * 8, 1, 8); }
      g.fillStyle = 'rgba(30,45,60,0.55)'; g.fillRect(22, y + 16, 20, 26); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(22, y + 16, 20, 3);
    } else if (st.pattern === 'glass') {
      g.fillStyle = 'rgba(40,70,95,0.62)'; g.fillRect(0, y + 6, 64, 46); g.fillStyle = 'rgba(255,255,255,0.28)';
      for (let x = 0; x < 64; x += 16) g.fillRect(x, y + 6, 2, 46);
      g.fillRect(0, y + 6, 64, 2);
    } else if (st.pattern === 'windows') {
      g.fillStyle = 'rgba(30,45,60,0.55)'; g.fillRect(18, y + 14, 28, 30);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(18, y + 14, 28, 3); g.fillRect(31, y + 14, 2, 30);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y + 60, 64, 4);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

export interface SkinStats { buildings: number; land: number; roads: number; trees: number; textures: number; facades?: number }
export function buildSkin(osm: SkinOsm, opts: { skin: SkinMode; k?: number; seed?: number; ground?: Ground | null; noLand?: boolean; groundColour?: boolean; slopeGround?: Ground | null; style?: boolean; facades?: { spec: FacadeSpec; texture: THREE.Texture }[] } = { skin: 'full' }): { group: THREE.Group; stats: SkinStats } {
  const k = opts.k ?? 1, skin = opts.skin, full = skin === 'full', pr = project(osm), group = new THREE.Group();
  const stats: SkinStats = { buildings: 0, land: 0, roads: 0, trees: 0, textures: 0 };
  const plain = new THREE.MeshStandardMaterial({ color: '#a9a392', roughness: 0.85, flatShading: true });
  const mats = new Map<string, THREE.Material[]>(), roofs = new Map<string, number[]>(), styled = !!opts.style && skin !== 'none';
  const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

  // ground
  // CC-133 (?groundcolour): one painted ground from the tags (src/slice/ground-colour.ts) replaces the flat plane, the flat land shapes and the road ribbons; colour only, same height
  const paintedGround = skin !== 'none' && !opts.noLand && opts.groundColour === true;
  if (paintedGround) {
    const half = osm.radius + 60, p = paintGround(osm.elements, { half, project: pr, ground: opts.slopeGround ?? opts.ground ?? null });
    // texture row 0 is the south edge of the plane (the plane is turned flat), the painted rows run north to south: flip them
    const flipped = new Uint8Array(p.rgba.length); for (let j = 0; j < p.size; j++) flipped.set(p.rgba.subarray(j * p.size * 4, (j + 1) * p.size * 4), (p.size - 1 - j) * p.size * 4);
    const tex = new THREE.DataTexture(flipped, p.size, p.size, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(2000 * k, 2000 * k), std(GROUND_COLOUR)); base.rotation.x = -Math.PI / 2; base.position.y = -0.02 * k; base.receiveShadow = full; group.add(base);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(2 * half * k, 2 * half * k), std('#ffffff', { map: tex })); top.rotation.x = -Math.PI / 2; top.position.y = -0.005 * k; top.receiveShadow = full; group.add(top);
    stats.land = 1;
  } else if (skin !== 'none' && !opts.noLand) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000 * k, 2000 * k), std(GROUND_COLOUR)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02 * k; ground.receiveShadow = full; group.add(ground);
  }

  // land: parks, water, wood, paving, in the order grass, wood, sand, paving, water so water sits on top
  const order: LandKind[] = ['rock', 'paving', 'sand', 'grass', 'wood', 'water'];
  const woods: XY[][] = [];
  if (skin !== 'none' && !opts.noLand && !paintedGround) {
    for (const kind of order) {
      let n = 0;
      for (const e of osm.elements) {
        if (e.type === 'node' || landKind(e.tags) !== kind) continue;
        for (const r of rings(e, pr)) {
          if (r.length < 3) continue;
          const shape = new THREE.Shape(r.map((p) => new THREE.Vector2(p.x * k, -p.z * k)));
          const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), std(LAND_COLOUR[kind], kind === 'water' ? { roughness: 0.25, metalness: 0.1 } : {}));
          m.rotation.x = -Math.PI / 2; m.position.y = (0.01 + order.indexOf(kind) * 0.012) * k; m.receiveShadow = full; group.add(m); stats.land++; n++;
          if (kind === 'wood') woods.push(r);
        }
      }
      void n;
    }
  }

  // roads and paths: a flat ribbon along each way
  if (skin !== 'none' && !opts.noLand && !paintedGround) {
    const byColour = new Map<string, { pos: number[]; idx: number[] }>();
    for (const e of osm.elements) {
      if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
      const look = roadLook(e.tags); if (!look || landKind(e.tags) === 'paving') continue;
      const pts = e.geometry.map(pr), buf = byColour.get(look.colour) ?? { pos: [], idx: [] }; byColour.set(look.colour, buf);
      const hw = (look.width * k) / 2, y = (e.tags?.highway === 'steps' ? 0.07 : 0.05) * k;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b.x - a.x, dz = b.z - a.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
        const o = buf.pos.length / 3;
        buf.pos.push((pts[i].x - dz * (look.width / 2)) * k, y, (pts[i].z + dx * (look.width / 2)) * k, (pts[i].x + dz * (look.width / 2)) * k, y, (pts[i].z - dx * (look.width / 2)) * k);
        if (i > 0) buf.idx.push(o - 2, o - 1, o, o - 1, o + 1, o);
      }
      void hw; stats.roads++;
    }
    for (const [colour, b] of byColour) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setIndex(b.idx); g.computeVertexNormals();
      const mat = std(colour, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = new THREE.Mesh(g, mat); m.receiveShadow = full; group.add(m);
    }
  }

  // buildings
  for (const e of osm.elements) {
    if (!e.tags?.building) continue;
    const { h } = heightOf(e.tags);
    for (const r of rings(e, pr)) {
      if (r.length < 3 || Math.abs(area(r)) < 4) continue;
      const shape = new THREE.Shape(r.map((p) => new THREE.Vector2(p.x * k, -p.z * k)));
      // CC-234: with a ground, a building stands on its hill and its walls run down to y = 0, like the lane's own blocks (src/world/osm.ts extrude)
      const base = opts.ground ? (groundAt(opts.ground, r.reduce((t, p) => t + p.x, 0) / r.length, r.reduce((t, p) => t + p.z, 0) / r.length) - lowest(opts.ground)) * k : 0;
      // CC-133: one hero building wears a real photo facade on one wall; its prism is raised to the picture's height so the picture fits (looks only, off unless the caller passes facades)
      const fac = opts.facades?.find((f) => f.spec.building === e.tags?.name), wallHit = fac ? pickWall(r, fac.spec.width, fac.spec.facing) : null;
      const facH = fac && wallHit ? fac.spec.width / fac.spec.aspect : 0;
      const height = Math.min(Math.max(h, facH), 80) * k;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height + base, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
      let material: THREE.Material | THREE.Material[] = plain;
      if (styled) {
        // CC-133: tag colour or a palette pick, floors from the levels, a roof colour and shape; the walls and footprint are exactly the same extrusion
        const look = buildingLook(e.tags, h), st = styleBuilding(e.tags ?? {}, buildingSeed(e.id, e.geometry?.[0]), h, look, osm.lat, osm.lon), key = `S|${st.wall}|${st.roof}|${st.pattern}|${st.rows}|${st.band}`;
        let pair = mats.get(key);
        if (!pair) {
          const wall = new THREE.MeshStandardMaterial({ map: styledWallTexture(st), roughness: 0.9 });
          // an extruded wall's V runs from the top of the picture down as the wall rises, so a negative repeat turns the floors the right way up
          const rep = 1 / (3 * k), vr = 1 / (3 * k * st.rows); wall.map!.repeat.set(rep, -vr); wall.map!.offset.set(0, vr);
          stats.textures++; pair = [std(st.roof), wall]; mats.set(key, pair);
        }
        material = pair;
        if (st.roofShape !== 'flat') {
          const box = roofBox(r.map((p) => ({ x: p.x * k, z: p.z * k })));
          if (roofFits(box)) { const arr = roofs.get(st.roof) ?? []; roofs.set(st.roof, arr); arr.push(...roofTriangles(box, st.roofShape, height + base, box.wid * 0.28)); }
        }
      } else if (skin !== 'none') {
        const look = buildingLook(e.tags, h), key = `${look.wall}|${look.roof}|${look.pattern}|${full}`;
        let pair = mats.get(key);
        if (!pair) {
          const wall = full ? new THREE.MeshStandardMaterial({ map: wallTexture(look), roughness: 0.9 }) : std(look.wall);
          if (full && wall instanceof THREE.MeshStandardMaterial && wall.map) { wall.map.repeat.set(1 / (3 * k), 1 / (3 * k)); stats.textures++; }
          pair = [std(look.roof), wall]; mats.set(key, pair);
        }
        material = pair;
      }
      const m = new THREE.Mesh(geo, material); m.castShadow = full; m.receiveShadow = full; group.add(m); stats.buildings++;
      if (fac && wallHit) {
        const a = r[wallHit.i], b = r[(wallHit.i + 1) % r.length], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        const cw = r.reduce((t, p, i) => { const q = r[(i + 1) % r.length]; return t + p.x * q.z - q.x * p.z; }, 0) > 0 ? 1 : -1;
        const w = wallQuad(a, b, [(cw * dz) / len, (-cw * dx) / len], facH, { base: opts.ground ? base / k : 0, k });
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(w.positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(w.uvs, 2)); g.setIndex(w.indices); g.computeVertexNormals();
        const fm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: fac.texture, roughness: 0.9 })); fm.name = 'facade'; fm.castShadow = false; fm.receiveShadow = full; group.add(fm); stats.facades = (stats.facades ?? 0) + 1;
      }
    }
  }

  for (const [colour, tri] of roofs) { // CC-133: pitched roofs, one mesh per roof colour
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, std(colour, { side: THREE.DoubleSide, flatShading: true })); m.castShadow = full; m.receiveShadow = full; group.add(m);
  }

  // trees: from the map's tree points (and tree rows); woods get a few at random (labelled as invented in the README)
  if (full) {
    const spots: { x: number; z: number; s: number }[] = [];
    for (const e of osm.elements) {
      if (e.type === 'node' && e.tags?.natural === 'tree' && e.lat !== undefined && e.lon !== undefined) { const p = pr({ lat: e.lat, lon: e.lon }); spots.push({ x: p.x, z: p.z, s: 0.8 + (hash(p.x, p.z) % 50) / 100 }); }
      else if (e.type === 'way' && e.tags?.natural === 'tree_row' && e.geometry) {
        const pts = e.geometry.map(pr);
        for (let i = 0; i + 1 < pts.length; i++) { const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z), n = Math.max(1, Math.floor(d / 7)); for (let j = 0; j < n; j++) { const t = j / n; spots.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t, s: 0.9 }); } }
      }
    }
    const rnd = seeded(opts.seed ?? 7);
    for (const w of woods) {
      const xs = w.map((p) => p.x), zs = w.map((p) => p.z), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const want = Math.min(250, Math.floor(Math.abs(area(w)) / 120));
      for (let tries = 0, got = 0; got < want && tries < want * 12; tries++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        let inside = false; for (let i = 0, j = w.length - 1; i < w.length; j = i++) if (w[i].z > z !== w[j].z > z && x < ((w[j].x - w[i].x) * (z - w[i].z)) / (w[j].z - w[i].z) + w[i].x) inside = !inside;
        if (inside) { spots.push({ x, z, s: 0.8 + rnd() * 0.6 }); got++; }
      }
    }
    if (spots.length) {
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 6).translate(0, 1.2, 0), std('#6e5238'), spots.length);
      const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 0).translate(0, 4.2, 0), std('#ffffff', { flatShading: true }), spots.length);
      const dummy = new THREE.Object3D(), tint = new THREE.Color();
      spots.forEach((s, i) => {
        dummy.position.set(s.x * k, 0, s.z * k); dummy.scale.setScalar(s.s * k); dummy.rotation.y = (hash(s.x, s.z) % 628) / 100; dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix); crown.setMatrixAt(i, dummy.matrix);
        crown.setColorAt(i, tint.setHSL(0.27 + ((hash(s.z, s.x) % 100) / 100) * 0.06, 0.45, 0.3 + ((hash(s.x, s.x) % 100) / 100) * 0.12));
      });
      trunk.castShadow = crown.castShadow = true; group.add(trunk, crown); stats.trees = spots.length;
    }
  }
  return { group, stats };
}
