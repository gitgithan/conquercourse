import * as THREE from 'three/webgpu';
import type { gapSpecs } from '../../sim/needs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CourseData } from '../../course/course';
import { hazardOf } from '../../course/hazard';
import { buildFloor } from '../../course/floor';
import { DEFAULT_WALL } from '../../sim/wall';
import { DEFAULT_ROPE } from '../../sim/rope';
import { createTrebuchetView } from '../../ui/trebuchet-view';
import { createRecoilView } from '../../ui/recoil-view';
import { createShotsView } from '../../ui/shots-view';
import { createPoleView } from '../../ui/pole-view';
import { createBandView } from '../../ui/band-view';
import { createDroneView } from '../../ui/drone-view';
import { cupsGroup } from '../../slice/cups';
import { buildTrack, type TrackView } from '../../render/track';
import { buildPlanks } from '../../render/plank';
import { chunked, mergeStatic, type Part } from '../../render/static-merge';
import { rungX } from '../../sim/bars';
import { groundAt } from '../../sim/terrain';
import { courseSkyOn } from '../../render/sky-light';

export const LANE_DEPTH = 2; // m, how thick the blocks and the wall are across the screen: thin enough that a camera ahead of the runner cannot hide them behind the block face

// The things in the scene that the frame loop moves or reads again; everything else is added and forgotten.
export interface CourseScene {
  trackView: TrackView | null;
  plankView: ReturnType<typeof buildPlanks> | null;
  trebView: ReturnType<typeof createTrebuchetView> | null;
  shotsView: ReturnType<typeof createShotsView> | null;
  poleView: ReturnType<typeof createPoleView> | null;
  recoilView: ReturnType<typeof createRecoilView> | null;
  bandView: ReturnType<typeof createBandView> | null;
  droneView: ReturnType<typeof createDroneView> | null;
  hazard: ReturnType<typeof hazardOf>;
  floor: ReturnType<typeof buildFloor>;
  chunks: THREE.Mesh[];
  ropeMesh: THREE.Mesh | null;
  ropeLen: number;
}

// The still part of the world: the lights, the bars, the coaster, the decks, the editor's pieces, the floor, the wall and the rope. The order of the adds is the order of the picture.
export function buildCourseScene(scene: THREE.Scene, course: CourseData, params: URLSearchParams): CourseScene {
  if (!courseSkyOn(params)) { // CC-133: with the sky-light switch on, src/render/sky-light.ts lights the scene instead
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7f5a, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(20, 40, 30);
    scene.add(sun);
  }

  // ground: platforms are boxes, water fills the gaps
  const stone = new THREE.MeshStandardMaterial({ color: 0xb9b2a3 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x7aa95c });
  const bed = new THREE.MeshStandardMaterial({ color: 0xd9453a });
  // bars hanging in the air (holds): a thin metal bar across the lane with a soft glow so they read from far away
  for (const h of course.holds ?? []) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, LANE_DEPTH + 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0x6b3a00, metalness: 0.3, roughness: 0.4 })); // an amber rod, so the bar to grab can be found at a glance
    bar.rotation.x = Math.PI / 2; bar.position.set(h.x, h.y, 0);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9 }));
    halo.position.set(h.x, h.y, LANE_DEPTH / 2 + 0.32);
    scene.add(bar, halo);
  }
  // monkey bars (course.bars, docs/bars.md): one amber rung per grab point across the lane, and a post at each end down to the ground, so the row reads as a frame
  // a row with a photo skin (a scene item called bars-skin, CC-133) is drawn by the photo; the amber collider shows only with ?collider=1
  const skinned = !!course.scene?.some((it) => it.id === 'bars-skin') && params.get('collider') !== '1';
  for (const row of skinned ? [] : course.bars ?? []) {
    const rungMat = new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0x6b3a00, metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < row.n; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, LANE_DEPTH + 0.6, 10), rungMat);
      rung.rotation.x = Math.PI / 2; rung.position.set(rungX(row, i), row.y, 0);
      scene.add(rung);
    }
    const post = (x: number) => {
      const h = Math.max(0.5, row.y - groundAt(course.terrain, x));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 10), new THREE.MeshStandardMaterial({ color: 0x3b4650, metalness: 0.4, roughness: 0.5 }));
      m.position.set(x, row.y - h / 2, 0);
      scene.add(m);
    };
    post(rungX(row, 0) - row.gap * 0.5); post(rungX(row, row.n - 1) + row.gap * 0.5);
  }
  // a coaster: rails, ties, posts and the cart (src/render/track.ts); the Rookie sits in it
  let trackView: TrackView | null = null;
  if (course.track) { trackView = buildTrack(course); scene.add(trackView.group); }
  const plankView = course.planks?.length ? buildPlanks(course) : null; // plank bridges: they bend under the runner (src/sim/beam.ts)
  if (plankView) scene.add(plankView.group);
  const trebView = course.trebuchet ? createTrebuchetView(scene, course) : null;
  const shotsView = course.shots?.length ? createShotsView(scene, course) : null;
  const poleView = course.pole ? createPoleView(scene, course) : null;
  const recoilView = course.recoil ? createRecoilView(scene, course) : null;
  const bandView = course.band ? createBandView(scene, course) : null;
  const droneView = course.drone ? createDroneView(scene, course) : null;
  // a course from the editor draws its real objects instead of blocks: only the start and finish decks stay as ground
  const realObjects = !!course.scene?.length && !course.keepDecks && params.get('decks') !== '1';
  const lastPlatform = course.terrain.platforms.length - 1;
  // the decks are merged into one mesh per material (grass, stone, bed): a course with a dozen decks is three draws, not twelve
  const deckParts: Part[] = [];
  course.terrain.platforms.forEach((p, pi) => {
    if (p.coasterRail) return; // the rails are already drawn by TrackView; this profile exists only for landing collision
    if (realObjects && pi > 0 && pi < lastPlatform) return;
    const bottom = course.terrain.waterY - 2;
    const h = p.top - bottom;
    let geo: THREE.BufferGeometry = new THREE.BoxGeometry(p.x1 - p.x0, h, LANE_DEPTH);
    let at: [number, number, number] = [(p.x0 + p.x1) / 2, bottom + h / 2, 0];
    if (p.profile) {
      // a curved top: the side view's outline, pushed out across the lane
      const shape = new THREE.Shape();
      shape.moveTo(p.x0, bottom);
      for (const [px, py] of p.profile) shape.lineTo(px, py);
      shape.lineTo(p.x1, bottom);
      shape.closePath();
      geo = new THREE.ExtrudeGeometry(shape, { depth: LANE_DEPTH, bevelEnabled: false });
      at = [0, 0, -LANE_DEPTH / 2];
    }
    geo.translate(...at);
    deckParts.push({ geo, mat: p.bouncy ? bed : p.top === 0 ? grass : stone });
  });
  for (const m of mergeStatic(deckParts)) scene.add(m);
  // the editor's pieces: raw meshes are merged into one mesh (cut into chunks when big, so the renderer skips what it cannot see); cups stay
  // instanced; the same photo object used several times is loaded once and drawn as one instanced mesh per part
  const chunks: THREE.Mesh[] = [];
  if (course.scene) {
    const gl = new GLTFLoader(), loads = new Map<string, Promise<{ scene: THREE.Group }>>();
    const loadOnce = (url: string) => { let p = loads.get(url); if (!p) { p = gl.loadAsync(url); loads.set(url, p); } return p; }; // one download and parse per file, however many pieces use it
    const INSTANCE_CELL = 8; // m along the run
    const matte = new THREE.MeshStandardMaterial({ color: 0xa9a392, roughness: 0.95, flatShading: true });
    const itemMatrix = (it: NonNullable<typeof course.scene>[number]) => new THREE.Matrix4().compose(
      new THREE.Vector3(it.x, it.y, it.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY), new THREE.Vector3(it.scale, it.scale, it.scale));
    const meshParts: Part[] = [];
    const byUrl = new Map<string, NonNullable<typeof course.scene>>();
    for (const it of course.scene) {
      if (it.url && (it.url.startsWith('/assets/') || it.url.startsWith('/api/community-items?'))) { const key = `${it.url}|${Math.floor(it.x / INSTANCE_CELL)}`; const l = byUrl.get(key) ?? []; l.push(it); byUrl.set(key, l); } // the same object, near each other, is one instanced mesh; far apart stays culled apart
      else if (it.stack) {
        const g = new THREE.Group();
        g.position.set(it.x, it.y, it.z); g.rotation.y = it.rotY; g.scale.setScalar(it.scale);
        g.add(cupsGroup(it.stack)); scene.add(g);
      } else if (it.mesh) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(it.mesh.positions, 3));
        geo.setIndex(it.mesh.indices); geo.computeVertexNormals();
        geo.applyMatrix4(itemMatrix(it));
        meshParts.push({ geo, mat: matte });
      }
    }
    for (const m of chunked(mergeStatic(meshParts))) { scene.add(m); chunks.push(m); }
    for (const [key, items] of byUrl) {
      const url = key.slice(0, key.lastIndexOf('|'));
      const plainShape = () => { for (const it of items) if (it.mesh) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(it.mesh.positions, 3)); geo.setIndex(it.mesh.indices); geo.computeVertexNormals(); geo.applyMatrix4(itemMatrix(it)); const m = new THREE.Mesh(geo, matte); scene.add(m); } }; // a shared piece that cannot be fetched still stands there as its plain shape
      void loadOnce(url).catch(() => { plainShape(); return null; }).then((got) => {
        if (!got) return;
        const obj = got.scene.clone(true), box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
        obj.position.set(-c.x, -box.min.y, -c.z);
        if (items.length < 2) { // one use: as before
          const it = items[0], g = new THREE.Group();
          g.position.set(it.x, it.y, it.z); g.rotation.y = it.rotY; g.scale.setScalar(it.scale);
          g.add(obj); scene.add(g);
          return;
        }
        obj.updateMatrixWorld(true);
        obj.traverse((o) => {
          const part = o as THREE.Mesh;
          if (!part.isMesh) return;
          const inst = new THREE.InstancedMesh(part.geometry, part.material, items.length);
          items.forEach((it, i) => inst.setMatrixAt(i, itemMatrix(it).multiply(part.matrixWorld)));
          inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
          scene.add(inst);
        });
      }).catch(() => { /* no picture for this one; its collision still works */ });
    }
  }
  const hazard = hazardOf(params.get('hazard') ?? course.hazard); // ?hazard=lava tries a floor without editing the course
  const floor = buildFloor(hazard, course.terrain.waterY, course.finishX);
  scene.add(floor.object);

  // the warped wall: a quarter circle, flat at the bottom and upright at the top
  if (course.wall) {
    const H = course.wall.height ?? DEFAULT_WALL.height;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * (Math.PI / 2);
      shape.lineTo(H * Math.sin(th), H * (1 - Math.cos(th)));
    }
    shape.lineTo(H, 0);
    shape.lineTo(0, 0);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: LANE_DEPTH, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xc9893b }));
    wall.position.set(course.wall.x0, 0, -LANE_DEPTH / 2);
    scene.add(wall);
  }

  // the rope hangs from its anchor; it is drawn straight down (it only swings with the runner)
  const ropeLen = course.rope?.length ?? DEFAULT_ROPE.length;
  let ropeMesh: THREE.Mesh | null = null;
  if (course.rope) {
    ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ropeLen, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    ropeMesh.position.set(course.rope.anchorX, course.rope.anchorY - ropeLen / 2, 0);
    scene.add(ropeMesh);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, LANE_DEPTH), stone);
    beam.position.set(course.rope.anchorX, course.rope.anchorY + 0.2, 0);
    scene.add(beam);
  }
  return { trackView, plankView, trebView, shotsView, poleView, recoilView, bandView, droneView, hazard, floor, chunks, ropeMesh, ropeLen };
}

// Numbers painted on the course so the player can see how wide a gap is and how high the wall is.
export function addLabels(course: CourseData, specs: ReturnType<typeof gapSpecs>, zoneOf: (x: number) => { id: string } | undefined, ropeLen: number) {
  function label(text: string, x: number, y: number) {
    const c = document.createElement('canvas'); c.width = 400; c.height = 96;
    const g = c.getContext('2d')!; g.fillStyle = '#fffffff0'; g.fillRect(0, 0, 400, 96); g.fillStyle = '#10141c'; g.font = '700 50px system-ui'; g.textAlign = 'center'; g.fillText(text, 200, 66);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
    sp.scale.set(4.6, 1.1, 1); sp.position.set(x, y, -0.6); // behind the runner and the ghost, never over them scene.add(sp);
  }
  for (const g of specs) { const z = zoneOf(g.x); if (z && (z.id === 'gap' || z.id === 'landing')) label(`${g.width.toFixed(1)} m`, g.x + g.width / 2, Math.max(0, g.rise) + 3); }
  if (course.wall) label(`${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high`, course.wall.x0 + 2, (course.wall.height ?? DEFAULT_WALL.height) + 1.2);
  if (course.rope) label(`rope ${ropeLen.toFixed(0)} m`, course.rope.anchorX, course.rope.anchorY + 1.6);
}
