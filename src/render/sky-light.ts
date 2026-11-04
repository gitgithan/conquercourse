// CC-133: a sky, a sun, fog and soft shadows for the 3D scenery built from real places. Looks only: never read by the sim.
// One function installs it into any three.js scene (the editor's WebGL view and the Course's WebGPU view both use it), so the two look alike.
// The sky is a gradient dome painted with vertex colours (no shader, no picture), so it also works on the WebGPU renderer. The sun disc is one small circle.
import type * as THREE_TYPES from 'three';
import { DEFAULT_DAY, DEFAULT_PRESET, lookFor, presetOf, sunPosition, sunVector, TIME_PRESETS, type Look, type SunPos } from './sun';

type T = typeof THREE_TYPES;
export const PRODUCTION_HOST = 'conquercourse.pages.dev';

// The switch: ?skylight=1 forces it on, ?skylight=0 forces it off; with no word it is on everywhere except the production address.
export function skyLightOn(params: URLSearchParams, hostname: string | null = typeof location === 'undefined' ? null : location.hostname): boolean {
  const w = params.get('skylight');
  if (w === '1' || w === 'on') return true;
  if (w === '0' || w === 'off') return false;
  return hostname !== PRODUCTION_HOST;
}
// the Course keeps its own sky colour for pictures made over other backgrounds (?bg=)
export const courseSkyOn = (params: URLSearchParams): boolean => skyLightOn(params) && !params.get('bg');
export const shadowsOn = (params: URLSearchParams): boolean => params.get('shadows') !== '0';

export interface SkyOptions {
  lat: number; lon?: number;
  preset?: string | null; day?: number;
  shadows?: boolean; renderer?: { shadowMap: { enabled: boolean; type: number; autoUpdate?: boolean; needsUpdate?: boolean }; capabilities?: { isWebGL2?: boolean } };
  far: number; // the camera's far distance: the dome and the fog are sized from it
  mirrorSouth?: boolean; // the Course looks north: in the southern half of the world the noon sun would sit behind the lane, so the picture is mirrored
  yaw?: number; // turn of the scene against the compass (radians)
}
export interface SkyLight {
  sun: THREE_TYPES.DirectionalLight; hemi: THREE_TYPES.HemisphereLight; dome: THREE_TYPES.Mesh;
  pos: SunPos; look: Look; presetId: string; shadows: boolean;
  setPreset(id: string): void;
  setPlace(lat: number): void; // the place became known after the first picture: move the sun to its latitude
  setShadows(on: boolean): void;
  follow(camera: THREE_TYPES.Vector3): void; // keep the dome around the camera
  fitShadow(center: THREE_TYPES.Vector3, radius: number): void; // aim the shadow box at what is on screen
  mark(root: THREE_TYPES.Object3D): void; // switch shadows on for every lit mesh under root
  dispose(): void;
}

export function installSkyLight(THREE: T, scene: THREE_TYPES.Scene, o: SkyOptions): SkyLight {
  const day = o.day ?? DEFAULT_DAY;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.scale.setScalar(o.far * 0.9); dome.renderOrder = -10; dome.frustumCulled = false; dome.name = 'sky-dome'; dome.userData.noShadow = true;
  const nv = dome.geometry.attributes.position.count;
  dome.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false, toneMapped: false }));
  disc.frustumCulled = false; disc.renderOrder = -9; disc.name = 'sun-disc'; disc.userData.noShadow = true;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x808070, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.target.name = 'sun-target';
  scene.add(dome, disc, hemi, sun, sun.target);

  const api: SkyLight = {
    sun, hemi, dome, pos: { elevation: 30, azimuth: 180 }, look: lookFor(30), presetId: 'noon', shadows: false,
    setPreset(id) {
      const p = presetOf(id);
      api.presetId = p.id;
      api.pos = sunPosition(o.lat, day, p.hour);
      const look = api.look = lookFor(api.pos.elevation);
      const v = sunVector(api.pos, o.yaw ?? 0); if (o.mirrorSouth && o.lat < 0) v[2] = -v[2];
      sunDir.set(v[0], v[1], v[2]);
      // the sun below the horizon would light the scene from underneath: keep the light just above the ground and let its brightness fall to nothing
      lightDir.copy(sunDir); if (lightDir.y < 0.06) { lightDir.y = 0.06; lightDir.normalize(); }
      sun.color.setHex(look.sunColor); sun.intensity = look.sunIntensity;
      hemi.color.setHex(look.hemiSky); hemi.groundColor.setHex(look.hemiGround); hemi.intensity = look.hemiIntensity;
      scene.background = new THREE.Color(look.skyHorizon);
      scene.fog = new THREE.Fog(look.skyHorizon, o.far * look.fogNear, o.far * look.fogFar);
      paintDome(); placeDisc();
      sun.position.copy(center).addScaledVector(lightDir, shadowDist);
      sun.target.position.copy(center);
    },
    setPlace(lat) { o.lat = lat; api.setPreset(api.presetId); },
    setShadows(on) {
      const r = o.renderer;
      const ok = !!r && r.capabilities?.isWebGL2 !== false; // no WebGL 2: no shadows, the rest still draws
      api.shadows = on && ok;
      if (r) { r.shadowMap.enabled = api.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap; }
      sun.castShadow = api.shadows;
      if (api.shadows) { sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.radius = 2.5; }
    },
    follow(p) { dome.position.copy(p); disc.position.copy(p).addScaledVector(sunDir, o.far * 0.86); disc.lookAt(p); },
    fitShadow(c, radius) {
      const d = lightDir;
      // snap the box to whole shadow-map pixels so the shadows do not crawl while the camera moves
      const up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(up, d).normalize(), u = new THREE.Vector3().crossVectors(d, right).normalize();
      const texel = (2 * radius) / sun.shadow.mapSize.x;
      const sr = Math.round(c.dot(right) / texel) * texel, su = Math.round(c.dot(u) / texel) * texel, sd = c.dot(d);
      center.copy(right).multiplyScalar(sr).addScaledVector(u, su).addScaledVector(d, sd);
      shadowDist = radius * 3;
      sun.position.copy(center).addScaledVector(d, shadowDist); sun.target.position.copy(center);
      const cam = sun.shadow.camera;
      if (cam.right !== radius) { cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius; cam.near = 1; cam.far = shadowDist + radius * 2; cam.updateProjectionMatrix(); }
      sun.shadow.normalBias = texel * 2.2; // push the surface test along its normal by a couple of pixels: this is what keeps the grainy "acne" away
      sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    },
    mark(root) {
      root.traverse((x) => {
        const m = x as THREE_TYPES.Mesh;
        if (!m.isMesh || m.userData.noShadow) return;
        const mat = m.material as THREE_TYPES.Material;
        if ((mat as THREE_TYPES.MeshBasicMaterial).isMeshBasicMaterial) return; // markers and glows are not lit objects
        const flat = m.geometry?.type === 'PlaneGeometry' || m.geometry?.type === 'RingGeometry';
        m.receiveShadow = true; m.castShadow = !flat && !mat.transparent;
      });
    },
    dispose() { scene.remove(dome, disc, hemi, sun, sun.target); dome.geometry.dispose(); (dome.material as THREE_TYPES.Material).dispose(); disc.geometry.dispose(); (disc.material as THREE_TYPES.Material).dispose(); },
  };
  const sunDir = new THREE.Vector3(0, 1, 0), lightDir = new THREE.Vector3(0, 1, 0), center = new THREE.Vector3();
  let shadowDist = 120;

  function paintDome() {
    const pos = dome.geometry.attributes.position, col = dome.geometry.attributes.color as THREE_TYPES.BufferAttribute;
    const top = new THREE.Color(api.look.skyTop), hor = new THREE.Color(api.look.skyHorizon), glow = new THREE.Color(api.look.sunColor), c = new THREE.Color(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const t = Math.pow(Math.max(0, n.y), 0.5);
      c.copy(hor).lerp(top, t);
      const d = Math.max(0, n.dot(sunDir)), g = Math.min(1, Math.pow(d, 32) * 0.7 + Math.pow(d, 5) * 0.22) * Math.min(1, api.look.sunIntensity / 0.8);
      c.lerp(glow, g);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }
  function placeDisc() {
    const R = o.far * 0.86, size = R * Math.tan((1.6 * Math.PI) / 180);
    disc.scale.setScalar(size);
    (disc.material as THREE_TYPES.MeshBasicMaterial).color.setHex(0xfff6e0).lerp(new THREE.Color(0xffa860), Math.max(0, 1 - api.pos.elevation / 20));
    disc.visible = api.pos.elevation > -2;
  }
  api.setPreset(o.preset ?? DEFAULT_PRESET);
  api.setShadows(o.shadows ?? true);
  return api;
}

import { presetOf as presetOf2 } from './sun';
// A small picker for the time of day, in plain words; it remembers the choice in this browser only.
export function timeOfDayPicker(sky: SkyLight, changed: () => void, at: string): HTMLElement {
  const box = document.createElement('label'); box.id = 'timeofday';
  box.style.cssText = 'position:absolute;' + at + ';z-index:5;background:#fffffff0;border:1px solid #b9c2bb;border-radius:8px;padding:4px 8px;font:600 13px system-ui,sans-serif;color:#24302a;display:flex;gap:6px;align-items:center';
  const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Time of day');
  for (const p of TIME_PRESETS) { const op = document.createElement('option'); op.value = p.id; op.textContent = p.label; sel.appendChild(op); }
  sel.value = sky.presetId;
  sel.addEventListener('change', () => { sky.setPreset(sel.value); try { localStorage.setItem('cc.sunat', presetOf2(sel.value).id); } catch { /* private window */ } changed(); });
  box.append('Time of day', sel);
  return box;
}


