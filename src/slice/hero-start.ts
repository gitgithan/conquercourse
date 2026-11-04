// CC-238: the editor's start scene for the film. ?mode=editor&start=hero:<slug> opens the editor on the real place (its buildings as one piece), the lane the hero course was cut along,
// and (with &box=1) the photo box standing on its deck; the box is a real piece in the editor, so it joins the lane and the check then says it cannot be cleared (CC-238, open), so the side strip shows the real heights. The same hand-off the map page writes ('cc.map.piece'); nothing here is saved.
import { buildingsFrom, extrude } from '../world/osm';
import type { Ground } from './../world/terrain';
import { centred } from './world';
import { uToX, type BackdropFrame } from '../world/backdrop';
import type { CourseData } from '../course/course';

export interface HeroStart {
  name: string; positions: number[]; indices: number[];
  lane: { angle: number; offset: number; level: number; from: string };
  camera: { heading: number; pitch: number; distance: number; target: { x: number; z: number } };
  place?: { lat: number; lon: number };
  objects: { src: string; x: number; z: number; y: number; yaw: number; scale: number; decor: boolean }[];
}

// The editor's world point of a lane point: the inverse of place2game for a point on the lane (v = 0), at course height y.
export function laneToEditor(b: BackdropFrame, courseX: number, courseY: number, across = 0): { x: number; y: number; z: number } {
  let u = courseX - b.shiftX; // start from the rigid guess, then walk to the exact piecewise map
  for (let i = 0; i < 40; i++) u += courseX - uToX(b.uMap, u);
  const vRaw = b.offset + across, c = Math.cos(b.angle), s = Math.sin(b.angle);
  return { x: u * c - vRaw * s, z: u * s + vRaw * c, y: courseY + b.level };
}

export async function heroStart(slug: string, f: typeof fetch = fetch, withBox = false, boxScale = 1, boxAcross = 0): Promise<HeroStart> {
  const [place, b, course] = await Promise.all([
    f(`/assets/places/${slug}.json`).then((r) => r.json()), f(`/assets/demo/hero-${slug}.backdrop.json`).then((r) => r.json()) as Promise<BackdropFrame>,
    f(`/assets/demo/hero-${slug}.course.json`).then((r) => r.json()) as Promise<CourseData>]);
  const bs = buildingsFrom(place.answer, place.lat, place.lon).filter((q) => q.ring.length >= 3 && Math.abs(q.ring.reduce((s, a, i) => { const p = q.ring[(i + 1) % q.ring.length]; return s + a[0] * p[1] - p[0] * a[1]; }, 0)) >= 4);
  const m = extrude(bs, b.k, (place.ground ? { radius: place.radius, ...place.ground } : null) as Ground | null);
  const piece = centred({ positions: m.positions, indices: m.indices });
  const objects = (withBox ? course.scene ?? [] : []).map((o) => { const p = laneToEditor(b, o.x, o.y, boxAcross); return { src: `obj:${(o.url ?? '').split('/').pop()}`, x: +p.x.toFixed(3), z: +p.z.toFixed(3), y: +p.y.toFixed(3), yaw: 0, scale: (o.scale ?? 1) * boxScale, decor: true }; });
  return { name: place.name, place: { lat: place.lat, lon: place.lon }, positions: Array.from(piece.positions as ArrayLike<number>), indices: Array.from(piece.indices as ArrayLike<number>), lane: { angle: b.angle, offset: b.offset, level: b.level, from: 'hero' }, camera: { heading: (b.angle * 180) / Math.PI, pitch: 60, distance: 18, target: (({ x, z }) => ({ x, z }))(laneToEditor(b, 22, 0)) }, objects };
}
