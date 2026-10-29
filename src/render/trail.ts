// A light trail behind the runner for film shots (CC-209): ?trail=1. A ribbon in the lane plane that thins and fades toward its tail.
import * as THREE from 'three/webgpu';

export function createTrail(scene: THREE.Scene, keep = 26, width = 0.05) {
  const pts: [number, number][] = [];
  const pos = new Float32Array(keep * 2 * 3), col = new Float32Array(keep * 2 * 3), idx: number[] = [];
  for (let i = 0; i < keep - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  scene.add(mesh);
  return {
    // call every drawn frame with where the light should be (metres)
    push(x: number, y: number) {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(x - last[0], y - last[1]) > 0.06) pts.push([x, y]);
      if (pts.length > keep) pts.shift();
      const n = pts.length;
      for (let i = 0; i < keep; i++) {
        const p = pts[Math.min(i, n - 1)] ?? [x, y];
        const f = n > 1 ? Math.min(i, n - 1) / (n - 1) : 1; // 0 at the tail, 1 at the runner
        const q = pts[Math.min(i + 1, n - 1)] ?? p, ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
        const head = Math.min(1, (1 - f) * 7), w = width * f * head, dx = Math.cos(ang) * w, dy = Math.sin(ang) * w;
        const g = f * f * 0.9 * head; // thin and dim: bloom gives the glow, the body stays readable
        pos.set([p[0] + dx, p[1] + dy, 0.3, p[0] - dx, p[1] - dy, 0.3], i * 6);
        col.set([0.45 * g, 0.85 * g, 1.0 * g, 0.45 * g, 0.85 * g, 1.0 * g], i * 6);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}
