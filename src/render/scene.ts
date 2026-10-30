import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pageQuery } from '../flags';

export type Backend = 'webgpu' | 'webgl2';

export interface Stage {
  backend: Backend;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGPURenderer;
  rookie: THREE.Object3D;
}

// WebGPU where the browser has it; three's renderer falls back to WebGL 2 on its own.
export async function createStage(host: HTMLElement, withRookie = true): Promise<Stage> {
  const wantWebGL2 = pageQuery().get('backend') === 'webgl2';
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: wantWebGL2 });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc5e8);

  const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.set(2.6, 1.5, 4.2);
  camera.lookAt(0, 0.9, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7f5a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x7aa95c }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const rookie = withRookie ? (await new GLTFLoader().loadAsync('/assets/characters/rookie-a.glb')).scene : new THREE.Object3D();
  scene.add(rookie);

  addEventListener('resize', () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  });

  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  return { backend, scene, camera, renderer, rookie };
}
