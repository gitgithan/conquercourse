import * as THREE from "three/webgpu";
import type { CourseData } from "../course/course";
import { BEND_POINTS, drawnTopAt, easeBend, materialOf, restBend, spanOf, type PlankData } from "../sim/beam";
import type { WorldState } from "../sim/world";

// The plank bridges the Course draws: a strip along the plank that bends the way the simulator says (src/sim/beam.ts), a post if there is one.
// Looks only: the feet are on the same curve (topAt), so the picture and the physics agree. A real 2 cm plank is hair-thin on screen, so it is drawn at least 6 cm thick.
const SEGMENTS = BEND_POINTS;
const DRAW_MIN_THICKNESS = 0.06;

export interface PlankView {
  group: THREE.Group;
  place(w: WorldState, dt?: number): void; // bends each plank under the runner who stands on it (the picture follows the bend with a short lag; dt is the game time since the last call); a broken plank is hidden
  surfaceAt(w: WorldState): number | null; // the drawn surface under the runner while on a plank, so the feet and the picture agree
}

function stripGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((SEGMENTS + 1) * 4 * 3);
  const idx: number[] = [];
  const V = (i: number, k: number) => i * 4 + k; // k: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right
  for (let i = 0; i < SEGMENTS; i++) {
    const a = V(i, 0), b = V(i, 1), c = V(i, 2), d = V(i, 3), a2 = V(i + 1, 0), b2 = V(i + 1, 1), c2 = V(i + 1, 2), d2 = V(i + 1, 3);
    idx.push(a, b, b2, a, b2, a2); // top
    idx.push(c, d2, d, c, c2, d2); // bottom
    idx.push(a, a2, c2, a, c2, c); // side (left)
    idx.push(b, d2, b2, b, d, d2); // side (right)
  }
  idx.push(V(0, 0), V(0, 2), V(0, 3), V(0, 0), V(0, 3), V(0, 1)); // end caps
  idx.push(V(SEGMENTS, 0), V(SEGMENTS, 1), V(SEGMENTS, 3), V(SEGMENTS, 0), V(SEGMENTS, 3), V(SEGMENTS, 2));
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function buildPlanks(course: CourseData): PlankView {
  const group = new THREE.Group();
  const items = (course.planks ?? []).map((pk: PlankData) => {
    const mat = new THREE.MeshStandardMaterial({ color: (pk.material ?? "wood") === "wood" ? 0xb98b52 : 0x9aa3ab, roughness: 0.7, side: THREE.DoubleSide });
    const geo = stripGeometry();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    let post: THREE.Mesh | null = null;
    if (pk.support) {
      const h = pk.y - course.terrain.waterY;
      post = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, Math.min(1, pk.width + 0.2)), new THREE.MeshStandardMaterial({ color: 0x8d949c }));
      post.position.set((pk.x0 + pk.x1) / 2, course.terrain.waterY + h / 2 - DRAW_MIN_THICKNESS, 0);
      group.add(post);
    }
    return { pk, mesh, geo, post, drawn: restBend(pk), dirty: true };
  });
  void spanOf; void materialOf;
  function shape(it: (typeof items)[number]) {
    const { pk, geo, drawn } = it;
    const th = Math.max(pk.thickness, DRAW_MIN_THICKNESS), hw = pk.width / 2;
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i <= SEGMENTS; i++) {
      const x = pk.x0 + ((pk.x1 - pk.x0) * i) / SEGMENTS, top = pk.y - drawn[i], bot = top - th;
      p.setXYZ(i * 4, x, top, -hw); p.setXYZ(i * 4 + 1, x, top, hw); p.setXYZ(i * 4 + 2, x, bot, -hw); p.setXYZ(i * 4 + 3, x, bot, hw);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    it.dirty = false;
  }
  items.forEach((it) => shape(it));
  return {
    group,
    surfaceAt(w: WorldState) {
      const i = w.mode === "plank" ? w.plank?.i : undefined;
      if (i === undefined || w.broken?.includes(i)) return null;
      const it = items[i];
      return it ? drawnTopAt(it.pk, it.drawn, w.runner.x - it.pk.x0) : null;
    },
    place(w: WorldState, dt = 1 / 60) {
      items.forEach((it, i) => {
        const broken = !!w.broken?.includes(i);
        it.mesh.visible = !broken;
        if (it.post) it.post.visible = !broken;
        if (broken) return;
        const a = w.mode === "plank" && w.plank?.i === i ? w.runner.x - it.pk.x0 : -1;
        const next = easeBend(it.drawn, it.pk, a, dt);
        if (it.dirty || next.some((v, k) => Math.abs(v - it.drawn[k]) > 1e-5)) { it.drawn = next; shape(it); }
      });
    },
  };
}
