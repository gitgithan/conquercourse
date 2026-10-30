// The picture of each piece for the add browser (CC-96): ?id=<piece id> draws the piece with the editor's own 3D view, so the icon is what the editor shows.
// scripts/make-piece-icons.ts opens this page once per piece and saves the pictures.
import { createView3d, type P3 } from './view3d';
import { LIBRARY, box } from './shapes';
import { barMesh } from './holds-world';
import { deviceMesh } from './device';
import { DEFAULT_PLANK, plankPiece } from './plank-world';
import { stackPiece, stackSrc } from './stack';
import { newPiece, size } from './world';
import { readGlbMesh } from './glb';
import { pageQuery } from '../flags';

const id = pageQuery().get('id') ?? '';
const wrap = document.getElementById('wrap')!;
const at = (x = 0, z = 0) => ({ x, z });
const dev = (name: string, src: string): P3 => ({ ...newPiece(name, deviceMesh(src), at()), src });
const bar = (x: number): P3 => ({ ...newPiece('Bar', barMesh(), at(x)), src: 'hold:bar', y: 2.86 });
const ground = (w: number, x: number): P3 => newPiece('Ground', box(w, 0.7, 1.6), at(x));

async function build(): Promise<P3[]> {
  const lib = LIBRARY.find((l) => l.id === id);
  if (lib) { const q = newPiece(lib.label, lib.mesh(), at()); if (lib.id === 'brick') q.scale = 15; return [q]; }
  if (id === 'bar') return [bar(0)];
  if (id === 'lache') return [bar(-1.75), bar(1.75)];
  if (id === 'rope') return [{ ...newPiece('Rope anchor', box(0.5, 6.6, 0.5), at()), role: 'rope' } as P3];
  if (id === 'trebuchet') return [dev('Trebuchet', 'device:trebuchet:1200')];
  if (id === 'launcher') return [dev('Launcher', 'device:cannon:12:30:2.5')];
  if (id === 'cannon') return [dev('Cannon', 'device:bigcannon:80:45:2.5')];
  if (id === 'drone') return [dev('Drone', 'device:drone:70:50:4')];
  if (id === 'plank') return [ground(3, -4.5), plankPiece(DEFAULT_PLANK, at()) as P3, ground(3, 4.5)];
  if (id.startsWith('stack-')) { const p = stackPiece(stackSrc(id.slice(6)), at()); return p ? [p as P3] : []; }
  if (id.startsWith('real-')) {
    const idx = (await (await fetch('/assets/objects/index.json')).json()) as { objects: { name: string; glb: string }[] };
    const o = idx.objects.find((q) => `real-${q.name}` === id);
    return o ? [{ ...newPiece(o.name, readGlbMesh(await (await fetch(`/assets/objects/${o.glb}`)).arrayBuffer()), at()), src: `obj:${o.glb}` }] : [];
  }
  if (id === 'person') return [{ ...newPiece('Person', readGlbMesh(await (await fetch('/assets/characters/rookie-a.glb')).arrayBuffer()), at()), src: 'obj:../characters/rookie-a.glb' }];
  if (id === 'demo-scene') return [{ ...newPiece('Demo scene', readGlbMesh(await (await fetch('/assets/demo/demo-scene.glb')).arrayBuffer()), at()), src: 'obj:../demo/demo-scene.glb' }];
  return [];
}

// pieces that have no 3D shape of their own are drawn flat
function drawn(kind: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; c.id = 'flat';
  const g = c.getContext('2d')!;
  g.fillStyle = '#dfe9e4'; g.fillRect(0, 0, 640, 360); g.fillStyle = '#9aa9a1'; g.fillRect(0, 300, 640, 60);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'band') { // a post on the left, a band stretched to a runner
    g.fillStyle = '#5b6b64'; g.fillRect(70, 160, 26, 150);
    g.strokeStyle = '#e07a1f'; g.lineWidth = 12; g.beginPath(); g.moveTo(96, 190); g.quadraticCurveTo(250, 260, 420, 215); g.stroke();
    g.strokeStyle = '#17201d'; g.lineWidth = 10; g.beginPath(); g.arc(450, 175, 16, 0, 7); g.moveTo(450, 191); g.lineTo(450, 255); g.moveTo(450, 205); g.lineTo(425, 232); g.moveTo(450, 255); g.lineTo(430, 300); g.moveTo(450, 255); g.lineTo(478, 300); g.stroke();
  } else if (kind === 'bar' || kind === 'lache') { // bars hang in the air: one with a person hanging, or two with a person between
    g.strokeStyle = '#37474f'; g.lineWidth = 12;
    const xs = kind === 'bar' ? [320] : [190, 450];
    for (const x of xs) { g.beginPath(); g.moveTo(x - 60, 70); g.lineTo(x + 60, 70); g.stroke(); g.fillStyle = '#37474f'; g.fillRect(x - 64, 66, 8, 12); g.fillRect(x + 56, 66, 8, 12); }
    const px = kind === 'bar' ? 320 : 320; g.strokeStyle = '#17201d'; g.lineWidth = 10; g.beginPath();
    if (kind === 'bar') { g.arc(px, 125, 16, 0, 7); g.moveTo(px, 141); g.lineTo(px, 215); g.moveTo(px - 18, 72); g.lineTo(px, 160); g.lineTo(px + 18, 72); g.moveTo(px, 215); g.lineTo(px - 18, 270); g.moveTo(px, 215); g.lineTo(px + 18, 270); }
    else { g.arc(px, 175, 16, 0, 7); g.moveTo(px, 191); g.lineTo(px + 40, 245); g.moveTo(px, 205); g.lineTo(px - 125, 74); g.moveTo(px, 205); g.lineTo(px + 130, 74); g.moveTo(px + 40, 245); g.lineTo(px + 5, 290); g.moveTo(px + 40, 245); g.lineTo(px + 62, 290); }
    g.stroke();
  } else if (kind === 'rope') { // a post, a rope hanging from its top, a person on the rope
    g.fillStyle = '#5b6b64'; g.fillRect(150, 60, 24, 240); g.strokeStyle = '#8d6e3f'; g.lineWidth = 8; g.beginPath(); g.moveTo(174, 66); g.quadraticCurveTo(330, 96, 420, 210); g.stroke();
    g.strokeStyle = '#17201d'; g.lineWidth = 10; g.beginPath(); g.arc(430, 190, 16, 0, 7); g.moveTo(430, 206); g.lineTo(445, 262); g.moveTo(437, 225); g.lineTo(418, 212); g.moveTo(445, 262); g.lineTo(425, 300); g.moveTo(445, 262); g.lineTo(470, 298); g.stroke();
  } else if (kind === 'photo') { // a picture frame with a mountain and a sun
    g.fillStyle = '#fff'; g.fillRect(170, 70, 300, 220); g.strokeStyle = '#17201d'; g.lineWidth = 8; g.strokeRect(170, 70, 300, 220);
    g.fillStyle = '#7fb08f'; g.beginPath(); g.moveTo(190, 270); g.lineTo(290, 150); g.lineTo(360, 230); g.lineTo(410, 180); g.lineTo(450, 270); g.fill();
    g.fillStyle = '#f2b632'; g.beginPath(); g.arc(410, 120, 20, 0, 7); g.fill();
  } else if (kind === 'import') { // a cube and an arrow into it
    g.fillStyle = '#c9d4ce'; g.strokeStyle = '#17201d'; g.lineWidth = 8; g.beginPath(); g.moveTo(260, 140); g.lineTo(380, 140); g.lineTo(430, 100); g.lineTo(310, 100); g.closePath(); g.fill(); g.stroke();
    g.fillRect(260, 140, 120, 120); g.strokeRect(260, 140, 120, 120); g.beginPath(); g.moveTo(380, 140); g.lineTo(430, 100); g.lineTo(430, 220); g.lineTo(380, 260); g.fill(); g.stroke();
  }
  return c;
}

if (['band', 'photo', 'import', 'bar', 'lache', 'rope'].includes(id)) { wrap.append(drawn(id)); document.documentElement.dataset.ready = '1'; }
else void build().then((pieces) => {
  const v = createView3d(wrap, { pieces: () => pieces, selected: () => null, lane: () => ({ angle: 0, offset: 0, level: 0 }), select: () => {}, moved: () => {}, dropped: () => {}, icon: true });
  v.resize(); v.sync();
  if (!pieces.length) { document.documentElement.dataset.ready = 'empty'; return; }
  const box3 = pieces.map((p) => { const s = size(p.mesh); return { w: s.w * p.scale, h: s.h * p.scale, d: s.d * p.scale }; }), w = Math.max(...box3.map((s) => s.w)), h = Math.max(...pieces.map((p, i) => box3[i].h + (p.y ?? 0))), d = Math.max(...box3.map((s) => s.d));
  const span = id === 'plank' ? 12 : Math.max(w, h * 1.4, d);
  const person = id === 'person' || id === 'demo-scene';
  v.look(person ? 20 : 32, 62, { x: 0, z: 0 }, Math.max(2.6, span * 1.35 + 1.2));
  // give the 3D pieces (loaded files, textures) a moment to arrive before the picture is taken
  setTimeout(() => { document.documentElement.dataset.ready = '1'; }, 2500);
});
