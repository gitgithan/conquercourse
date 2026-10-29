// Draws the street furniture of a real place (CC-187), behind ?furniture=1: low-poly instanced meshes at the true positions of Mapillary's detected objects.
// Looks only: no physics, no collision, the lane and the course file are not touched. Credit and licence are shown in the corner of the screen.
import * as THREE from 'three';
import { groundAt } from '../sim/terrain';
import { countByKind, drawScale, LICENCE, place, type FurnitureFile, type Kind } from '../world/furniture';
import { slugOfCourse } from '../ui/place-photos';

// Each kind is a few boxes and cylinders, sizes in real metres (multiplied by the draw scale). off: where the part's base sits relative to the object's foot.
interface Part { shape: 'cyl' | 'box'; colour: string; size: [number, number, number]; off: [number, number, number] }
const PARTS: Record<Exclude<Kind, 'crosswalk'>, Part[]> = {
  light: [{ shape: 'cyl', colour: '#4a5058', size: [0.18, 5.6, 0.18], off: [0, 0, 0] }, { shape: 'box', colour: '#f4dc7a', size: [0.9, 0.22, 0.4], off: [0.35, 5.5, 0] }],
  bench: [{ shape: 'box', colour: '#8a5a33', size: [1.7, 0.1, 0.5], off: [0, 0.42, 0] }, { shape: 'box', colour: '#8a5a33', size: [1.7, 0.45, 0.08], off: [0, 0.55, -0.24] }, { shape: 'box', colour: '#3c4046', size: [1.5, 0.42, 0.4], off: [0, 0, 0] }],
  bin: [{ shape: 'cyl', colour: '#3f6b57', size: [0.45, 0.9, 0.45], off: [0, 0, 0] }],
  sign: [{ shape: 'cyl', colour: '#7b8087', size: [0.08, 2.4, 0.08], off: [0, 0, 0] }, { shape: 'box', colour: '#d8352a', size: [0.7, 0.7, 0.06], off: [0, 2.0, 0.06] }],
  signal: [{ shape: 'cyl', colour: '#3b3f45', size: [0.14, 3.2, 0.14], off: [0, 0, 0] }, { shape: 'box', colour: '#1f2328', size: [0.35, 0.95, 0.3], off: [0, 2.7, 0.05] }],
  pole: [{ shape: 'cyl', colour: '#6b5a48', size: [0.22, 7, 0.22], off: [0, 0, 0] }],
};

export interface FurnitureHandle { group: THREE.Group; counts: Record<string, number>; placed: number; moved: number; destroy(): void }

export function buildFurniture(file: FurnitureFile, laneTop: (x: number) => number): FurnitureHandle {
  const group = new THREE.Group(), s = drawScale(file.frame), { placed, moved } = place(file, laneTop);
  const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0), unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const kind of Object.keys(PARTS) as Exclude<Kind, 'crosswalk'>[]) {
    const items = placed.filter((p) => p.kind === kind);
    if (!items.length) continue;
    for (const part of PARTS[kind]) {
      const mesh = new THREE.InstancedMesh(part.shape === 'cyl' ? unitCyl : unitBox, new THREE.MeshStandardMaterial({ color: part.colour, roughness: 0.8, flatShading: true }), items.length);
      items.forEach((p, i) => {
        pos.set(p.x + part.off[0] * s, p.y + part.off[1] * s, p.z + part.off[2] * s); sc.set(part.size[0] * s, part.size[1] * s, part.size[2] * s);
        m.compose(pos, q.identity(), sc); mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; group.add(mesh);
    }
  }
  // crosswalks: white stripes painted on the ground, at the detected crossings
  const zebras = placed.filter((p) => p.kind === 'crosswalk');
  const paint = new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  if (zebras.length) {
    const stripes = new THREE.InstancedMesh(unitBox, paint, zebras.length * 5);
    zebras.forEach((p, j) => { for (let i = 0; i < 5; i++) { pos.set(p.x, p.y + 0.01, p.z + (i - 2) * 0.9 * s); sc.set(3 * s, 0.03, 0.45 * s); m.compose(pos, q.identity(), sc); stripes.setMatrixAt(j * 5 + i, m); } });
    stripes.instanceMatrix.needsUpdate = true; stripes.frustumCulled = false; group.add(stripes);
  }
  // the start line: a painted crossing across the first deck (a design touch, not a detection; it stays flat, 2 cm thick, and is not in the physics)
  const x0 = file.frame.startX + 1.4, y0 = laneTop(x0), start = new THREE.InstancedMesh(unitBox, paint, 6);
  for (let i = 0; i < 6; i++) { pos.set(x0, (Number.isFinite(y0) ? y0 : 0) + 0.01, (i - 2.5) * 0.32); sc.set(1.6, 0.03, 0.17); m.compose(pos, q.identity(), sc); start.setMatrixAt(i, m); }
  start.instanceMatrix.needsUpdate = true; start.frustumCulled = false; group.add(start);
  const counts = countByKind(placed);
  return { group, counts, placed: placed.length, moved, destroy() { group.removeFromParent(); group.traverse((o) => { const x = o as THREE.Mesh; if (x.isMesh) { x.geometry.dispose(); (x.material as THREE.Material).dispose(); } }); } };
}

function creditLine(file: FurnitureFile): HTMLElement {
  const d = document.createElement('div');
  d.id = 'furniture-credit';
  d.style.cssText = 'position:fixed;left:10px;bottom:6px;z-index:5;font:11px system-ui,sans-serif;color:#17201d;background:#ffffffd9;border-radius:6px;padding:2px 8px;pointer-events:auto';
  const a = document.createElement('a'); a.href = LICENCE.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = LICENCE.name; a.style.color = '#0f6b5c';
  const m = document.createElement('a'); m.href = 'https://www.mapillary.com'; m.target = '_blank'; m.rel = 'noopener'; m.textContent = 'Mapillary contributors'; m.style.color = '#0f6b5c';
  d.append('Street objects: ', m, ', ', a, ' (positions of lamp posts, benches and signs; drawn simply and never part of the run)');
  return d;
}

// Called from the Course when ?furniture=1 and the course is a real place that has a furniture file; does nothing (and says nothing) otherwise.
export async function mountFurniture(scene: THREE.Scene, course: { name: string; terrain: Parameters<typeof groundAt>[0] }, f: typeof fetch = fetch): Promise<FurnitureHandle | null> {
  const slug = slugOfCourse(course.name);
  if (!slug) return null;
  let file: FurnitureFile;
  try { const r = await f(`/assets/places/furniture/${slug}.json`); if (!r.ok) return null; file = (await r.json()) as FurnitureFile; } catch { return null; }
  const h = buildFurniture(file, (x) => groundAt(course.terrain, x));
  scene.add(h.group);
  const credit = creditLine(file); document.body.append(credit);
  const base = h.destroy;
  h.destroy = () => { base(); credit.remove(); };
  document.documentElement.dataset.furniture = String(h.placed);
  return h;
}
