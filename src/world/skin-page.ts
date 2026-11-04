// Preview page for place skins (CC-178): /place-skin.html?place=<slug>&skin=none|tags|full&az=35&el=32&dist=220
// Reads the OpenStreetMap extras saved by scripts/skin-fetch.ts. Dev-server page only (like piece-icons.html); drag to turn, wheel to zoom.
import * as THREE from 'three';
import { buildSkin, skinFromQuery, SKY_COLOUR, type SkinOsm } from './skin';
import { pageQuery } from '../flags';
import { buildingStyleOn } from './building-style';
import { FACADES, facadeOn } from './facade';
import { groundColourOn } from '../slice/ground-colour';

const q = pageQuery(), gc = groundColourOn(q, location.hostname), slug = q.get('place') ?? 'montmartre-paris', skin = skinFromQuery(q, 'full');
let az = Number(q.get('az') ?? 35), el = Number(q.get('el') ?? 32), dist = Number(q.get('dist') ?? 230);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.shadowMap.enabled = skin === 'full'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_COLOUR); scene.fog = new THREE.Fog(SKY_COLOUR, dist * 2.2, dist * 5);
const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 4000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8678, skin === 'none' ? 1.6 : 1.1));
const sun = new THREE.DirectionalLight(0xfff2dd, skin === 'none' ? 1.2 : 2.2); sun.position.set(-120, 200, 90);
sun.castShadow = skin === 'full'; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 700 }); sun.shadow.bias = -0.0005;
scene.add(sun);
const place = (window as unknown as { __skin: unknown }).__skin = { ready: false, stats: null as unknown, ms: 0 };
function frame() { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; cam.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist); cam.lookAt(0, 8, 0); renderer.render(scene, cam); }
(async () => {
  // CC-133: with the ground colour on, the file with the extra ground tags is used when there is one; off, the saved CC-178 file as always (the shipped copy, Bryant Park, is under assets/places/skin)
  const first = gc ? 'cc-133-ground-colour' : 'cc-178-places', second = gc ? 'cc-178-places' : 'cc-133-ground-colour';
  const ok = (r: Response) => r.ok && (r.headers.get('content-type') ?? '').includes('json');
  let res = await fetch(`/data/eval/${first}/skin/${slug}-osm.json`);
  if (!ok(res)) res = await fetch(`/data/eval/${second}/skin/${slug}-osm.json`);
  if (!ok(res)) res = await fetch(`/assets/places/skin/${slug}-osm.json`);
  let osm: SkinOsm;
  if (ok(res)) osm = (await res.json()) as SkinOsm;
  else { // a ready place with no saved extras: its stored map answer still has every building with its tags, so the colours work for all of them
    const pl = await (await fetch(`/assets/places/${slug}.json`)).json();
    osm = { lat: pl.lat, lon: pl.lon, radius: pl.radius, elements: pl.answer.elements };
  }
  // the ground heights only shade the slope (colour); the page's scene stays flat as before
  let ground: { radius: number; step: number; n: number; h: number[] } | null = null;
  if (gc) { try { const pl = await (await fetch(`/assets/places/${slug}.json`)).json(); if (pl.ground) ground = { radius: pl.radius, ...pl.ground }; } catch { /* no heights: no slope shade */ } }
  // CC-133: the real photo facade (switch facade: on in dev and on the preview site, off on production; ?facade=1 or 0 forces it)
  const facades = facadeOn(q.get('facade'), location.hostname) ? await Promise.all(FACADES.filter((f) => f.place === slug).map(async (spec) => ({ spec, texture: (() => { const t = new THREE.TextureLoader().load(spec.image, () => frame()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })() }))) : [];
  const t0 = performance.now(), { group, stats } = buildSkin(osm, { skin, facades, style: buildingStyleOn(q, location.hostname), groundColour: gc, slopeGround: gc ? ground : null });
  scene.add(group); frame();
  Object.assign(place, { ready: true, groundColour: gc, stats, ms: Math.round(performance.now() - t0) });
  (document.getElementById('note') as HTMLElement).textContent = `${slug} · skin=${skin} · ${stats.buildings} buildings, ${stats.land} land shapes, ${stats.roads} roads, ${stats.trees} trees · built in ${Math.round(performance.now() - t0)} ms · ground colour ${gc ? 'on' : 'off'} · © OpenStreetMap contributors${stats.facades ? ' · library facade photo: Bestbudbrian, CC BY-SA 3.0, Wikimedia Commons' : ''}`;
  if (q.has('hidenote')) (document.getElementById('note') as HTMLElement).style.display = 'none';
})();
let drag: { x: number; y: number } | null = null;
addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (!drag) return; az -= (e.clientX - drag.x) * 0.4; el = Math.max(8, Math.min(85, el + (e.clientY - drag.y) * 0.3)); drag = { x: e.clientX, y: e.clientY }; frame(); });
addEventListener('wheel', (e) => { dist = Math.max(40, Math.min(900, dist * (1 + Math.sign(e.deltaY) * 0.1))); frame(); });
