// A small picture of a saved 3D piece (CC-200: "Planter" and "My railing" had an emoji where the other pieces have a picture).
// It is drawn once in the browser from the piece's own file, in the same light grey-green room as the other cards, and kept for the visit.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sharedGlbUrl } from '../community/flow';

// where each piece's file comes from, by card id ("mine-<id>", "shared-<id>"); the editor fills it in
const sources = new Map<string, () => Promise<ArrayBuffer>>();
export const registerThumbSource = (id: string, get: () => Promise<ArrayBuffer>): void => { sources.set(id, get); };

const done = new Map<string, Promise<string | null>>();
let renderer: THREE.WebGLRenderer | null = null;

async function draw(bytes: ArrayBuffer, w: number, h: number): Promise<string | null> {
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe6ede9);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a92, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 5, 4); scene.add(sun);
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z, 0.2) * 0.5 * Math.SQRT2;
  const cam = new THREE.PerspectiveCamera(32, w / h, 0.05, 500);
  const dist = r / Math.tan((cam.fov * Math.PI) / 360) * 0.95;
  cam.position.set(mid.x + dist * 0.55, mid.y + dist * 0.45, mid.z + dist * 0.7); cam.lookAt(mid);
  renderer ??= new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h, false); renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/webp', 0.85);
}

// the picture as an address for an <img>, or null when the file will not draw (the card then keeps its emoji)
export function thumbOf(id: string): Promise<string | null> {
  let p = done.get(id);
  if (!p) {
    const get = sources.get(id) ?? (id.startsWith('shared-') ? () => fetch(sharedGlbUrl(id.slice(7))).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('gone')))) : undefined); // a shared piece found by search has no button yet
    p = get ? get().then((b) => draw(b, 320, 180)).catch(() => null) : Promise.resolve(null);
    done.set(id, p);
  }
  return p;
}
