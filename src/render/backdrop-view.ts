// CC-234: the place's buildings (skin colours) and street furniture drawn behind the hero lane. Looks only: never in the physics, off unless ?backdrop=<slug>.
// The frame is written by scripts/make-backdrop-frame.ts; the maths is in src/world/backdrop.ts (tested).
import * as THREE from 'three';
import { behindLane, rigidFrame, type BackdropFrame } from '../world/backdrop';
import { buildSkin, type SkinOsm } from '../world/skin';
import { toGame, type FurnitureFile } from '../world/furniture';
import { buildFurniture } from './furniture-view';
import { FILM_MIN_SCALE, FURNITURE_ENABLED } from '../world/furniture';
import type { Ground } from '../world/terrain';
import { groundAt } from '../sim/terrain';

export interface BackdropHandle { group: THREE.Group; buildings: number; furniture: number; destroy(): void }

const get = async <T>(f: typeof fetch, url: string): Promise<T | null> => { try { const r = await f(url); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } };

export async function mountBackdrop(scene: THREE.Scene, course: { terrain: Parameters<typeof groundAt>[0] }, slug: string, f: typeof fetch = fetch): Promise<BackdropHandle | null> {
  const frame = await get<BackdropFrame>(f, `/assets/demo/hero-${slug}.backdrop.json`);
  const place = await get<{ radius: number; ground?: { step: number; n: number; h: number[] } }>(f, `/assets/places/${slug}.json`);
  const osm = await get<SkinOsm>(f, `/data/eval/cc-178-places/skin/${slug}-osm.json`);
  if (!frame || !place) return null;
  const rf = rigidFrame(frame), root = new THREE.Group(), turned = new THREE.Group(), inner = new THREE.Group();
  root.name = 'backdrop';
  let buildings = 0, furniture = 0;
  if (osm) {
    const ground = (place.ground ? { radius: place.radius, ...place.ground } : null) as Ground | null;
    const skin = buildSkin(behindLane(osm, frame), { skin: 'tags', k: frame.k, ground, noLand: true });
    inner.add(skin.group); buildings = skin.stats.buildings;
  }
  // the building group turns about y by the lane's angle, then moves by (shift, -level, -offset): the same map as toGame
  inner.position.set(-frame.cx, 0, -frame.cz);
  turned.rotation.y = frame.angle; turned.position.set(rf.tx, rf.ty, rf.tz);
  turned.add(inner); root.add(turned);
  const fur = FURNITURE_ENABLED ? await get<FurnitureFile>(f, `/assets/places/furniture/${slug}.json`) : null;
  if (fur) {
    const behind = fur.features.filter((it) => toGame(rf, it.x, it.z, it.h).z < -1.8);
    const h = buildFurniture({ ...fur, frame: rf, features: behind }, (x) => groundAt(course.terrain, x), FILM_MIN_SCALE);
    root.add(h.group); furniture = h.placed;
  }
  scene.add(root);
  document.documentElement.dataset.backdrop = `${buildings}b${furniture}f`;
  return { group: root, buildings, furniture, destroy() { root.removeFromParent(); root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); } }); } };
}
