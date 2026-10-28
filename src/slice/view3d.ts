import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HALF_LANE } from './slice';
import { size as meshSize, type Piece } from './world';
import { patternOf } from './stack';
import { cupsGroup } from './cups';

// The editor's 3D view: the pieces are drawn as the real baked objects (their own meshes and photo textures), on a textured ground,
// with the lane drawn as a gold strip. Drag a piece to move it along the ground; drag the empty space to turn the view
// (right-drag pans, the wheel zooms). It only draws; the editor owns the pieces.
export type P3 = Piece & { src?: string };
export interface Host {
  pieces(): P3[];
  selected(): number | null;
  lane(): { angle: number; offset: number; level: number };
  select(id: number | null): void;
  moved(p: P3, x: number, z: number): void; // while dragging
  dropped(): void; // when the drag ends
  ghosts?(): Ghosts | null; // a preview of a change: hollow outlines where pieces would be, arrows from where they are
}
export interface GhostState { x: number; y: number; z: number; yaw: number; scale: number }
export interface Ghosts { items: { id: number; from: GhostState; to: GhostState }[]; lane: { angle: number; offset: number } | null }
export interface View3d { sync(): void; show(on: boolean): void; readonly el: HTMLCanvasElement; resize(): void }

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();
const loadObject = (url: string) => { let p = cache.get(url); if (!p) { p = loader.loadAsync(url).then((g) => g.scene); cache.set(url, p); } return p; };

function groundTexture(): THREE.CanvasTexture {
  // speckled warm paving with faint slab joints, tiled across the ground
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b9b3a6'; g.fillRect(0, 0, 256, 256);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { const v = 150 + rnd() * 70; g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.35)`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }

  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 140); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createView3d(wrap: HTMLElement, host: Host): View3d {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.id = 'view3d';
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3f2);
  scene.fog = new THREE.Fog(0xcfe3f2, 60, 220);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a78, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2); sun.position.set(-20, 40, 25); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  camera.position.set(3, 9, 17);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(9, 0.5, 0); controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 1.5; controls.maxDistance = 120; controls.update();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; scene.add(ground);
  const grid = new THREE.GridHelper(200, 200, 0x7d7868, 0x9a9484); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.25; grid.position.y = 0.001; scene.add(grid);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x3f8fd6, transparent: true, opacity: 0.45, roughness: 0.2 }));
  water.rotation.x = -Math.PI / 2; scene.add(water);
  const laneG = new THREE.Group();
  const band = new THREE.Mesh(new THREE.PlaneGeometry(800, 2 * HALF_LANE), new THREE.MeshBasicMaterial({ color: 0xf0a020, transparent: true, opacity: 0.28, depthWrite: false }));
  band.rotation.x = -Math.PI / 2; band.position.y = 0.02;
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(800, 0.06), new THREE.MeshBasicMaterial({ color: 0xf0a020 }));
  mid.rotation.x = -Math.PI / 2; mid.position.y = 0.025;
  laneG.add(band, mid); scene.add(laneG);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 12), new THREE.MeshStandardMaterial({ color: 0x17201d })); rod.position.y = 1.25; scene.add(rod);

  // the preview of a change: a hollow outline at the new place (teal), a faint one where the piece is now (grey), an arrow between, a dashed new lane line
  const ghostG = new THREE.Group(); scene.add(ghostG);
  let ghostSig = '';
  const TEAL = 0x0f9d84, GREY = 0x7d8a84;
  function syncGhosts() {
    const gh = host.ghosts?.() ?? null;
    const sig = gh ? JSON.stringify(gh) : '';
    if (sig === ghostSig) return;
    ghostSig = sig;
    for (const c of [...ghostG.children]) { ghostG.remove(c); c.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); }); }
    if (!gh) return;
    const outline = (w: number, h: number, d: number, st: GhostState, color: number, fill: boolean) => {
      const box = new THREE.BoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d));
      const g = new THREE.Group();
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color, transparent: true, opacity: fill ? 1 : 0.55, depthTest: false })));
      if (fill) g.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false })));
      g.position.set(st.x, st.y + h / 2, st.z); g.rotation.y = -st.yaw; g.renderOrder = 10;
      return g;
    };
    for (const it of gh.items) {
      const p = host.pieces().find((q) => q.id === it.id);
      if (!p) continue;
      const s = meshSize(p.mesh), dims = (st: GhostState) => [s.w * st.scale, s.h * st.scale, s.d * st.scale] as const;
      const [fw, fh, fd] = dims(it.from), [tw, th, td] = dims(it.to);
      ghostG.add(outline(fw, fh, fd, it.from, GREY, false), outline(tw, th, td, it.to, TEAL, true));
      const a = new THREE.Vector3(it.from.x, it.from.y + fh / 2, it.from.z), b = new THREE.Vector3(it.to.x, it.to.y + th / 2, it.to.z), dir = b.clone().sub(a), len = dir.length();
      if (len > 0.05) { const arrow = new THREE.ArrowHelper(dir.normalize(), a, len, TEAL, Math.min(0.6, len * 0.35), Math.min(0.3, len * 0.18)); arrow.renderOrder = 11; (arrow.line.material as THREE.Material).depthTest = false; (arrow.cone.material as THREE.Material).depthTest = false; ghostG.add(arrow); }
    }
    if (gh.lane) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-400, 0.06, 0), new THREE.Vector3(400, 0.06, 0)]), new THREE.LineDashedMaterial({ color: TEAL, dashSize: 0.6, gapSize: 0.4 }));
      line.computeLineDistances(); line.position.z = gh.lane.offset;
      const holder = new THREE.Group(); holder.rotation.y = -gh.lane.angle; holder.add(line); ghostG.add(holder);
    }
  }

  const nodes = new Map<number, { g: THREE.Group; sig: string; box?: THREE.BoxHelper }>();
  let dirty = true, on = true;
  const redraw = () => { dirty = true; };
  controls.addEventListener('change', redraw);
  const loop = () => { requestAnimationFrame(loop); if (!on || !dirty) return; dirty = false; renderer.render(scene, camera); };
  requestAnimationFrame(loop);

  const plain = (p: P3): THREE.Mesh => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(p.mesh.positions as ArrayLike<number>), 3));
    geo.setIndex(Array.from((p.mesh.indices ?? []) as ArrayLike<number>)); geo.computeVertexNormals();
    return new THREE.Mesh(geo, p.src === 'hold:bar' ? new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.7, roughness: 0.3 }) : new THREE.MeshStandardMaterial({ color: 0xa9a392, roughness: 0.95, flatShading: true }));
  };
  const meshSig = (p: P3) => `${p.src ?? ''}|${p.mesh.positions.length}|${p.mesh.indices?.length ?? 0}|${(p.mesh.positions as ArrayLike<number>)[1] ?? 0}`;

  function build(p: P3): THREE.Group {
    const g = new THREE.Group();
    g.userData.pieceId = p.id;
    const stand = plain(p);
    if (patternOf(p.src)) { const cups = cupsGroup(p.src!); cups.userData.cups = true; g.add(cups); } else g.add(stand);
    // a photo object is drawn as the real baked object (with its texture) while the mesh is still the original; a cropped one falls back to plain geometry
    if (p.src?.startsWith('obj:')) {
      const url = `/assets/objects/${p.src.slice(4)}`;
      const triangles = p.mesh.indices?.length ?? 0;
      void loadObject(url).then((src) => {
        let tri = 0; src.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) tri += (m.geometry.index?.count ?? m.geometry.attributes.position.count); });
        if (tri !== triangles || nodes.get(p.id)?.g !== g) return;
        const obj = src.clone(true);
        const box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        obj.position.set(-c.x, -box.min.y, -c.z);
        g.remove(stand); g.add(obj); redraw();
      }).catch(() => { /* keep the plain mesh */ });
    }
    scene.add(g);
    return g;
  }

  function sync() {
    const ps = host.pieces(), sel = host.selected(), seen = new Set<number>();
    for (const p of ps) {
      seen.add(p.id);
      const sig = meshSig(p);
      let n = nodes.get(p.id);
      if (n && n.sig !== sig) { scene.remove(n.g); if (n.box) scene.remove(n.box); nodes.delete(p.id); n = undefined; }
      if (!n) { n = { g: build(p), sig }; nodes.set(p.id, n); }
      n.g.position.set(p.x, p.y, p.z); n.g.rotation.y = -p.yaw; n.g.scale.setScalar(p.scale);
      if (p.id === sel) {
        if (!n.box) { n.box = new THREE.BoxHelper(n.g, 0x0f6b5c); scene.add(n.box); }
        n.g.updateMatrixWorld(true); n.box.setFromObject(n.g); n.box.update();
      } else if (n.box) { scene.remove(n.box); n.box = undefined; }
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { scene.remove(n.g); if (n.box) scene.remove(n.box); nodes.delete(id); }
    const { angle, offset, level } = host.lane();
    laneG.rotation.y = -angle; band.position.z = offset; mid.position.z = offset;
    water.visible = level > 0.001; water.position.y = level;
    syncGhosts();
    redraw();
  }

  // pick and drag pieces on the ground; everything else is the orbit controls
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aim = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  let drag: { p: P3; dx: number; dz: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    aim(e);
    const hit = ray.intersectObjects([...nodes.values()].map((n) => n.g), true)[0];
    let id: number | null = null;
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) if (o.userData.pieceId !== undefined) { id = o.userData.pieceId as number; break; }
    host.select(id);
    const p = host.pieces().find((q) => q.id === id);
    if (!p) return;
    const at = new THREE.Vector3(); ray.ray.intersectPlane(floor, at);
    drag = { p, dx: at.x - p.x, dz: at.z - p.z }; controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag) return;
    aim(e); const at = new THREE.Vector3();
    if (ray.ray.intersectPlane(floor, at)) host.moved(drag.p, Math.round((at.x - drag.dx) * 20) / 20, Math.round((at.z - drag.dz) * 20) / 20);
  });
  const up = () => { if (!drag) return; drag = null; controls.enabled = true; host.dropped(); };
  renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up);

  const resize = () => {
    const w = Math.max(100, wrap.clientWidth), h = Math.max(80, wrap.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); redraw();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();
  return { sync, resize, el: renderer.domElement, show(v) { on = v; renderer.domElement.style.display = v ? 'block' : 'none'; if (v) { resize(); redraw(); } } };
}
