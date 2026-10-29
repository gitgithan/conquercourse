// Optional picture polish for stills and film (CC-188): ?fx=bloom,vignette,dof or ?fx=all. Nothing changes without the switch.
import * as THREE from 'three/webgpu';
import { pass, uniform, screenUV, float, smoothstep, mix, vec3, length } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

export const FX_NAMES = ['bloom', 'vignette', 'dof'] as const;
export type FxName = (typeof FX_NAMES)[number];

export function fxOf(search: string): Set<FxName> {
  const v = new URLSearchParams(search).get('fx');
  if (!v) return new Set();
  if (v === 'all') return new Set(FX_NAMES);
  return new Set(v.split(',').filter((x): x is FxName => (FX_NAMES as readonly string[]).includes(x)));
}

// focus() gives the distance (m) from the camera to what should stay sharp, read every frame
export function createFx(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, on: Set<FxName>, focus: () => number) {
  const scenePass = pass(scene, camera);
  let out: any = scenePass.getTextureNode('output');
  const focusU = uniform(10);
  if (on.has('dof')) out = dof(out, scenePass.getViewZNode(), focusU, float(6), float(2.2));
  if (on.has('bloom')) out = out.add(bloom(out, 0.5, 0.6, 0.85)); // only the brightest parts glow
  if (on.has('vignette')) {
    const edge = smoothstep(0.35, 0.95, length(screenUV.sub(0.5)).mul(1.4));
    out = mix(out, out.mul(vec3(0.35, 0.33, 0.4)), edge.mul(0.8));
  }
  const pipe = new THREE.RenderPipeline(renderer);
  pipe.outputNode = out;
  return { render() { focusU.value = focus(); pipe.render(); } };
}
