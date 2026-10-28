import * as THREE from 'three/webgpu';
import type { Hazard } from './hazard';

// The painted floor under the gaps. Plain meshes and materials only (no custom shaders), so it draws the same in WebGPU and WebGL2.
export interface Floor { object: THREE.Object3D; update(seconds: number): void }

export function buildFloor(hazard: Hazard, y: number, finishX: number): Floor {
  const g = new THREE.Group();
  const cx = finishX / 2;
  const slab = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}, height = 0.1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(400, height, 30), new THREE.MeshStandardMaterial({ color, ...extra }));
    m.position.set(cx, y, 0);
    g.add(m);
    return m;
  };
  let update = (_t: number) => { /* still */ };
  if (hazard === 'water') slab(0x2f7fc1, { transparent: true, opacity: 0.8 });
  else if (hazard === 'lava') {
    const lava = slab(0xc93a0c, { emissive: 0xff4a0a, emissiveIntensity: 1.1, roughness: 0.6 });
    const crust = new THREE.Mesh(new THREE.BoxGeometry(400, 0.12, 30), new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 1, transparent: true, opacity: 0.55 }));
    crust.position.set(cx, y + 0.01, 0); crust.scale.set(1, 1, 1); g.add(crust);
    // dark crust cracked by a few bright seams: thin glowing strips across the floor
    const seam = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.15 + (i % 5) * 0.12, 0.02, 1.2 + (i % 7) * 0.5), seam);
      s.position.set(-20 + i * ((finishX + 60) / 90), y + 0.09, ((i * 37) % 21) - 10);
      s.rotation.y = (i % 9) * 0.35;
      g.add(s);
    }
    const mat = lava.material as THREE.MeshStandardMaterial;
    update = (t) => { mat.emissiveIntensity = 0.95 + 0.25 * Math.sin(t * 2.2); };
  } else if (hazard === 'mud') {
    slab(0x4a3322, { roughness: 1 }, 0.14);
    const bubble = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.5 });
    for (let i = 0; i < 160; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 4) * 0.07, 10, 6), bubble);
      b.scale.y = 0.4;
      b.position.set(-20 + i * ((finishX + 60) / 160), y + 0.07, ((i * 53) % 25) - 12);
      g.add(b);
    }
  } else if (hazard === 'spikes') {
    slab(0x24282b, { roughness: 0.9 });
    const cone = new THREE.ConeGeometry(0.16, 0.9, 6), steel = new THREE.MeshStandardMaterial({ color: 0xb9c0c6, metalness: 0.6, roughness: 0.35 });
    const cols = Math.ceil((finishX + 60) / 0.5), rows = 14, spikes = new THREE.InstancedMesh(cone, steel, cols * rows), m = new THREE.Matrix4();
    let n = 0;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      m.makeTranslation(-20 + c * 0.5 + (r % 2) * 0.25, y + 0.5, -5 + r * 0.75);
      spikes.setMatrixAt(n++, m);
    }
    g.add(spikes);
  } else {
    // the dark drop: no floor to see, a gradient that falls away into black
    const geo = new THREE.PlaneGeometry(400, 30, 1, 8), pos = geo.attributes.position, col: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getY(i) + 15) / 30; // 0 at the back, 1 at the front
      const c = new THREE.Color().setHSL(0.68, 0.45, 0.04 + 0.16 * k * k);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    plane.rotation.x = -Math.PI / 2; plane.position.set(cx, y - 1.2, 0);
    g.add(plane);
  }
  return { object: g, update };
}
