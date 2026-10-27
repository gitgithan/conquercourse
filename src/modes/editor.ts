import { startCourse } from './course';
import { readGlbMesh } from '../slice/glb';
import { LIBRARY } from '../slice/shapes';
import { bestSlices, describe as describeLane, laneToCourse, sliceProfile, CELL, HALF_LANE } from '../slice/slice';
import { crop, duplicate, hits, newPiece, realSize, scaleBy, scaleToHeight, size, worldSamples, type Piece } from '../slice/world';
import { searchIdealRun } from '../sim/ideal';

// The World editor (beta): build a world from pieces on a plan view, scale them (a toy brick becomes a block), turn, copy, crop and move them,
// choose the lane the runner takes (turn about the rod, sideways, level), and play it. Everything is in metres.
const KEY = 'cc.world.v1';
interface Saved { pieces: { src: string; x: number; z: number; y: number; yaw: number; scale: number }[]; angle: number; offset: number; level: number }
type P = Piece & { src?: string };

export function startEditor(host: HTMLElement): { backend: 'webgl2' } {
  const style = document.createElement('style');
  style.textContent = `
    .ed{font:15px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:12px;display:grid;gap:10px;grid-template-columns:minmax(0,1fr) 300px;grid-auto-rows:min-content;align-content:start}
    .ed h1{margin:0;font-size:22px}.ed .top{grid-column:1/3;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .ed button,.ed select,.ed input[type=number],.ed a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:5px 10px;cursor:pointer;text-decoration:none}
    .ed .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}.ed button[aria-pressed=true]{background:#17201d;color:#fff}
    .ed canvas{width:100%;height:auto;align-self:start;background:#fff;border:1px solid #cfd6d0;border-radius:10px;touch-action:none}
    .ed .panel{background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:10px;display:grid;gap:8px;align-content:start}
    .ed label{display:grid;gap:2px;font-size:14px}.ed .muted{color:#58635d;font-size:13px}.ed .ok{border-left:4px solid #0f6b5c;padding:4px 8px;background:#f3f7f4;font-weight:600}.ed .bad{border-left:4px solid #c0392b;padding:4px 8px;background:#fbeeee;font-weight:600}
    .ed .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}@media(max-width:900px){.ed{grid-template-columns:1fr}.ed .top{grid-column:1}}`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'ed';
  host.appendChild(root);

  let pieces: P[] = [];
  let selected: number | null = null;
  let angle = 0, offset = 0, level = 0; // the lane: turn about the rod (radians), sideways (m), level (m)
  let view = { cx: 8, cz: 0, ppm: 36 }; // plan view: the world point in the middle, pixels per metre
  let cropMode = false;
  let verdict = '';

  // a new piece goes just past the last one, on the lane's line, so pieces do not pile up
  const freeSpot = (id: string) => { const m = lib(id).mesh(); const w = size(m).w * (id === 'brick' ? 15 : 1); const right = pieces.reduce((r, p) => Math.max(r, p.x + (size(p.mesh).w * p.scale) / 2), 0); return { x: right + 1.5 + w / 2, z: 0 }; };
  const lib = (id: string) => LIBRARY.find((l) => l.id === id)!;
  const add = (id: string, at = { x: 0, z: 0 }): P => { const p: P = { ...newPiece(lib(id).label, lib(id).mesh(), at), src: id }; if (id === 'brick') p.scale = 15; pieces.push(p); selected = p.id; return p; };
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Saved;
      pieces = s.pieces.map((q) => ({ ...newPiece(lib(q.src).label, lib(q.src).mesh(), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale }));
      angle = s.angle; offset = s.offset; level = s.level;
    } catch {
      add('bench', { x: 2, z: 0 }); add('dome', { x: 8, z: 0 }); add('low-wall', { x: 14, z: 0 }); selected = null;
    }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pieces: pieces.filter((p) => p.src).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale })), angle, offset, level } satisfies Saved)); } catch { /* private window */ } };
  load();

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, props: Partial<HTMLElementTagNameMap[K]> & { text?: string } = {}) => { const { text, ...rest } = props as Record<string, unknown> & { text?: string }; const e = Object.assign(document.createElement(tag), rest); if (text) e.textContent = text; parent.appendChild(e); return e as HTMLElementTagNameMap[K]; };

  const top = el('div', root, { className: 'top' });
  el('h1', top, { text: 'World editor (beta)' });
  el('a', top, { text: 'Back to the Course', href: '?', className: 'btn go' });
  const addBar = el('div', root, { className: 'top' });
  el('strong', addBar, { text: 'Add:' });
  for (const l of LIBRARY) el('button', addBar, { text: l.label }).onclick = () => { add(l.id, freeSpot(l.id)); changed(); };
  const file = el('input', addBar, { type: 'file', accept: '.glb' });
  file.hidden = true;
  el('button', addBar, { text: 'Import a .glb…', id: 'import' }).onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try { const p = scaleToHeight(newPiece(f.name.replace(/\.glb$/i, ''), readGlbMesh(await f.arrayBuffer()), { x: view.cx, z: view.cz }), 1); pieces.push(p); p.x = freeSpot('bench').x; selected = p.id; changed(); } catch { verdict = 'That file could not be read as a .glb.'; draw(); }
  };

  const plan = el('canvas', root, { width: 900, height: 520, id: 'plan' });
  const side = el('div', root, { className: 'panel', id: 'panel' });
  const profileCanvas = el('canvas', root, { width: 900, height: 170, id: 'profile' });
  const lanePanel = el('div', root, { className: 'panel' });

  // ---- the selected piece
  function drawPanel() {
    side.replaceChildren();
    const p = pieces.find((q) => q.id === selected);
    el('strong', side, { text: p ? p.name : 'No piece chosen' });
    if (!p) { el('div', side, { className: 'muted', text: 'Click a piece on the picture to choose it. Drag it to move it. Scroll to zoom, drag the background to pan.' }); return; }
    const r = realSize(p);
    el('div', side, { id: 'realsize', className: 'muted', text: `Real size: ${r.w.toFixed(2)} × ${r.d.toFixed(2)} m, ${r.h.toFixed(2)} m high (scale ×${p.scale.toPrecision(3)})` });
    const lab = el('label', side, { text: 'Real height (m): make it this tall' });
    const h = el('input', lab, { type: 'number', min: '0.02', max: '60', step: '0.05', value: r.h.toFixed(2), id: 'realheight' });
    h.onchange = () => { const v = Number(h.value); if (v > 0) { Object.assign(p, scaleToHeight(p, v)); changed(); } };
    const row = el('div', side, { className: 'row' });
    for (const [t, k] of [['× 0.5', 0.5], ['× 2', 2], ['× 10', 10]] as const) el('button', row, { text: t }).onclick = () => { Object.assign(p, scaleBy(p, k)); changed(); };
    const row2 = el('div', side, { className: 'row' });
    el('button', row2, { text: 'Turn −15°' }).onclick = () => { p.yaw -= Math.PI / 12; changed(); };
    el('button', row2, { text: 'Turn +15°' }).onclick = () => { p.yaw += Math.PI / 12; changed(); };
    const lift = el('label', side, { text: `Height off the ground: ${p.y.toFixed(2)} m` });
    const ly = el('input', lift, { type: 'range', min: '0', max: '4', step: '0.05', value: String(p.y), id: 'lift' });
    ly.oninput = () => { p.y = Number(ly.value); lift.firstChild!.textContent = `Height off the ground: ${p.y.toFixed(2)} m`; drawProfile(); };
    ly.onchange = () => changed();
    const row3 = el('div', side, { className: 'row' });
    el('button', row3, { text: 'Copy and paste', id: 'dup' }).onclick = () => { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; pieces.push(q); selected = q.id; changed(); };
    el('button', row3, { text: 'Delete', id: 'del' }).onclick = () => { pieces = pieces.filter((q) => q !== p); selected = null; changed(); };
    const cb = el('button', side, { text: cropMode ? 'Cropping: drag a box on the picture' : 'Crop…', id: 'crop' });
    cb.setAttribute('aria-pressed', String(cropMode));
    cb.onclick = () => { cropMode = !cropMode; drawPanel(); };
  }

  // ---- the lane
  function drawLanePanel() {
    lanePanel.replaceChildren();
    el('strong', lanePanel, { text: 'The lane the runner takes' });
    const slider = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const l = el('label', lanePanel, { text: `${label}: ${fmt(get())}` });
      const i = el('input', l, { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(get()) });
      i.oninput = () => { set(Number(i.value)); l.firstChild!.textContent = `${label}: ${fmt(get())}`; draw(); drawProfile(); };
      i.onchange = () => { save(); verify(); };
    };
    slider('Turn about the rod', 'angle', 0, 180, 5, () => Math.round((angle * 180) / Math.PI), (v) => (angle = (v * Math.PI) / 180), (v) => `${v}°`);
    slider('Sideways', 'offset', -30, 30, 0.5, () => offset, (v) => (offset = v), (v) => `${v.toFixed(1)} m`);
    slider('Where the water starts (level)', 'level', 0, 4, 0.05, () => level, (v) => (level = v), (v) => `${v.toFixed(2)} m`);
    el('button', lanePanel, { text: 'Find the best lane for me', id: 'best' }).onclick = () => {
      const s = worldSamples(pieces);
      const found = bestSlices({ positions: Array.from(s) }, { top: 1, levels: [level] });
      if (!found.length) { verdict = 'No lane the runner can clear was found: try other pieces or levels.'; drawLanePanel(); return; }
      angle = found[0].angle; offset = found[0].offset; level = found[0].level; verdict = '';
      save(); drawLanePanel(); draw(); drawProfile(); verify();
    };
    const play = el('button', lanePanel, { text: 'Play this lane', className: 'go', id: 'play' });
    play.onclick = () => {
      const course = laneToCourse(currentProfile(), 'My world');
      if (!searchIdealRun(course).cleared) { verdict = 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; drawLanePanel(); return; }
      root.remove(); style.remove();
      void startCourse(document.body, course);
    };
    el('div', lanePanel, { id: 'verdict', className: verdict.startsWith('The simulator can') ? 'ok' : verdict ? 'bad' : 'muted', text: verdict });
    el('div', lanePanel, { className: 'muted', text: 'The runner goes left to right along the orange band on the picture; the shapes in it are what you see underneath.' });
  }

  const currentProfile = () => sliceProfile(worldSamples(pieces), { x: 0, z: 0 }, { angle, offset, level });
  let verifyTimer = 0;
  function verify() {
    clearTimeout(verifyTimer);
    verifyTimer = window.setTimeout(() => {
      const p = currentProfile();
      if (p.length < 8) { verdict = 'Nothing is in the lane: move the lane or the pieces.'; }
      else { const r = describeLane(p); verdict = searchIdealRun(laneToCourse(p)).cleared ? `The simulator can clear this lane (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces, ${r.length.toFixed(0)} m).` : 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; }
      const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
      if (v) { v.textContent = verdict; v.className = verdict.startsWith('The simulator can') ? 'ok' : 'bad'; }
      document.documentElement.dataset.verdict = verdict;
    }, 350);
  }

  // ---- drawing
  const sx = (x: number) => plan.width / 2 + (x - view.cx) * view.ppm;
  const sz = (z: number) => plan.height / 2 + (z - view.cz) * view.ppm;
  const wx = (px: number) => (px - plan.width / 2) / view.ppm + view.cx;
  const wz = (py: number) => (py - plan.height / 2) / view.ppm + view.cz;
  const COLORS = ['#c9893b', '#6fa3c9', '#8bb36b', '#b779b0', '#d96a5b', '#7b8f9c'];
  function draw() {
    const c = plan.getContext('2d')!;
    c.clearRect(0, 0, plan.width, plan.height);
    c.strokeStyle = '#e3e8e4'; c.lineWidth = 1; c.fillStyle = '#58635d'; c.font = '11px system-ui';
    const step = view.ppm > 25 ? 1 : view.ppm > 8 ? 5 : 20;
    for (let x = Math.floor(wx(0) / step) * step; x < wx(plan.width); x += step) { c.beginPath(); c.moveTo(sx(x), 0); c.lineTo(sx(x), plan.height); c.stroke(); if (x % (step * 2) === 0) c.fillText(`${x} m`, sx(x) + 2, 12); }
    for (let z = Math.floor(wz(0) / step) * step; z < wz(plan.height); z += step) { c.beginPath(); c.moveTo(0, sz(z)); c.lineTo(plan.width, sz(z)); c.stroke(); }
    // the lane: a band 2 m wide through the rod's turn and sideways step
    c.save(); c.translate(sx(0), sz(0)); c.rotate(angle);
    c.fillStyle = '#f0a02033'; c.fillRect(-400 * view.ppm, (offset - HALF_LANE) * view.ppm, 800 * view.ppm, 2 * HALF_LANE * view.ppm);
    c.strokeStyle = '#f0a020'; c.lineWidth = 2; c.beginPath(); c.moveTo(-400 * view.ppm, offset * view.ppm); c.lineTo(400 * view.ppm, offset * view.ppm); c.stroke();
    c.restore();
    c.fillStyle = '#17201d'; c.beginPath(); c.arc(sx(0), sz(0), 5, 0, 7); c.fill(); c.fillText('rod', sx(0) + 8, sz(0) - 6);
    pieces.forEach((p, i) => {
      const s = size(p.mesh);
      c.save(); c.translate(sx(p.x), sz(p.z)); c.rotate(p.yaw);
      const w = s.w * p.scale * view.ppm, d = s.d * p.scale * view.ppm;
      c.fillStyle = COLORS[i % COLORS.length] + (p.id === selected ? 'dd' : '99'); c.fillRect(-w / 2, -d / 2, w, d);
      c.strokeStyle = p.id === selected ? '#0f6b5c' : '#17201d'; c.lineWidth = p.id === selected ? 3 : 1; c.strokeRect(-w / 2, -d / 2, w, d);
      c.restore();
      c.fillStyle = '#17201d'; c.font = '12px system-ui'; c.fillText(`${p.name} ${(s.h * p.scale + p.y).toFixed(2)} m`, sx(p.x) - 28, sz(p.z) + 4);
    });
    if (rubber) { c.strokeStyle = '#0f6b5c'; c.setLineDash([5, 4]); c.strokeRect(sx(rubber.x0), sz(rubber.z0), (rubber.x1 - rubber.x0) * view.ppm, (rubber.z1 - rubber.z0) * view.ppm); c.setLineDash([]); }
  }
  function drawProfile() {
    const c = profileCanvas.getContext('2d')!;
    const W = profileCanvas.width, H = profileCanvas.height;
    c.clearRect(0, 0, W, H);
    const prof = currentProfile();
    c.fillStyle = '#58635d'; c.font = '12px system-ui';
    c.fillText('What the runner sees: the lane from the side (water at the bottom, grid every metre)', 8, 14);
    const base = H - 20, ppm = Math.min(30, (W - 20) / Math.max(10, prof.length)), ph = 28;
    c.fillStyle = '#cfe3f5'; c.fillRect(0, base, W, 20);
    c.strokeStyle = '#e3e8e4';
    for (let m = 0; m < 5; m++) { c.beginPath(); c.moveTo(0, base - m * ph); c.lineTo(W, base - m * ph); c.stroke(); }
    c.fillStyle = '#17201d'; c.strokeStyle = '#17201d'; c.lineWidth = 2;
    c.beginPath();
    let pen = false;
    prof.cells.forEach((h, i) => { if (h === null) { pen = false; return; } const x = 10 + i * CELL * ppm, y = base - h * ph; if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); });
    c.stroke();
    document.documentElement.dataset.laneLength = String(prof.length.toFixed(1));
  }

  // ---- the mouse on the picture
  let rubber: { x0: number; z0: number; x1: number; z1: number } | null = null;
  let drag: { kind: 'move' | 'pan' | 'rubber'; p?: P; ox: number; oz: number; sx0: number; sz0: number; cx: number; cz: number } | null = null;
  plan.addEventListener('pointerdown', (e) => {
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    plan.setPointerCapture(e.pointerId);
    if (cropMode && selected !== null) { drag = { kind: 'rubber', ox: x, oz: z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    const hit = [...pieces].reverse().find((p) => hits(p, x, z));
    if (hit) { selected = hit.id; drag = { kind: 'move', p: hit, ox: x - hit.x, oz: z - hit.z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; }
    else { selected = null; drag = { kind: 'pan', ox: 0, oz: 0, sx0: px, sz0: py, cx: view.cx, cz: view.cz }; }
    drawPanel(); draw();
  });
  plan.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (drag.kind === 'move' && drag.p) { drag.p.x = Math.round((wx(px) - drag.ox) * 20) / 20; drag.p.z = Math.round((wz(py) - drag.oz) * 20) / 20; draw(); drawProfile(); }
    else if (drag.kind === 'pan') { view.cx = drag.cx - (px - drag.sx0) / view.ppm; view.cz = drag.cz - (py - drag.sz0) / view.ppm; draw(); }
    else if (drag.kind === 'rubber' && rubber) { rubber = { x0: Math.min(drag.ox, wx(px)), z0: Math.min(drag.oz, wz(py)), x1: Math.max(drag.ox, wx(px)), z1: Math.max(drag.oz, wz(py)) }; draw(); }
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'rubber' && rubber && selected !== null) {
      const p = pieces.find((q) => q.id === selected);
      if (p && rubber.x1 - rubber.x0 > 0.05 && rubber.z1 - rubber.z0 > 0.05) {
        // the box in the piece's own units: the four corners turned back, then their bounds
        const c = Math.cos(-p.yaw), s = Math.sin(-p.yaw), xs: number[] = [], zs: number[] = [];
        for (const [x, z] of [[rubber.x0, rubber.z0], [rubber.x1, rubber.z0], [rubber.x1, rubber.z1], [rubber.x0, rubber.z1]]) { const dx = x - p.x, dz = z - p.z; xs.push((dx * c - dz * s) / p.scale); zs.push((dx * s + dz * c) / p.scale); }
        const cut = crop(p, { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) });
        if (cut) { Object.assign(p, cut, { id: p.id }); } else verdict = 'Nothing of the piece is inside that box.';
      }
      rubber = null; cropMode = false; changed(); return;
    }
    changed();
  };
  plan.addEventListener('pointerup', end); plan.addEventListener('pointercancel', end);
  plan.addEventListener('wheel', (e) => { e.preventDefault(); view.ppm = Math.min(120, Math.max(2, view.ppm * Math.exp(-e.deltaY * 0.001))); draw(); }, { passive: false });
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return;
    if (e.code === 'KeyT') location.href = '?';
    const p = pieces.find((q) => q.id === selected);
    if (!p) return;
    if (e.code === 'Delete' || e.code === 'Backspace') { pieces = pieces.filter((q) => q !== p); selected = null; changed(); }
    if (e.code === 'KeyD') { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; pieces.push(q); selected = q.id; changed(); }
  });

  function changed() { save(); drawPanel(); drawLanePanel(); draw(); drawProfile(); verify(); }
  drawPanel(); drawLanePanel(); draw(); drawProfile(); verify();
  document.documentElement.dataset.pieces = String(pieces.length);
  return { backend: 'webgl2' };
}
