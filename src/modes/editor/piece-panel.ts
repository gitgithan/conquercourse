import { countText } from '../../ui/selection';
import { creditLine, type Provenance } from '../../slice/provenance';
import { duplicate, realSize, scaleBy, scaleToHeight, size } from '../../slice/world';
import type { View3d } from '../../slice/view3d';
import { isHold } from '../../slice/holds-world';
import { isTrack } from '../../slice/track-world';
import { el } from './dom';
import { isDevice, isSizeReference, type EditorState, type P } from './state';
import type { Tools } from './tools';

export interface PiecePanelEnv {
  ed: EditorState; side: HTMLElement; bar: HTMLElement; planWrap: HTMLElement; plan: HTMLCanvasElement;
  selChip: HTMLElement; selCount: HTMLElement; selHint: HTMLElement | null;
  view3d: View3d; tools: Tools; provOf: Map<string, Provenance>;
  chosen: () => number[]; setView: (plan2d: boolean) => void; syncPersonChip: () => void;
  sx: (x: number) => number; sz: (z: number) => number;
  drawProfile: () => void; changed: () => void;
}

// The panel for the chosen piece (name, size, height), its bar on the picture (turn, scale, copy, crop, delete) and the chip for several chosen.
// Moved out of editor.ts unchanged (CC-133).
export function createPiecePanel(env: PiecePanelEnv) {
  const { ed, side, bar, planWrap, plan, selChip, selCount, selHint, view3d, tools, provOf, chosen, setView, syncPersonChip, sx, sz, drawProfile, changed } = env;
  function syncSelChip() {
    const n = chosen().length;
    selChip.style.display = n > 1 ? 'flex' : 'none';
    selCount.textContent = countText(n);
    document.documentElement.dataset.selected = String(n);
    if (selHint) selHint.style.display = n > 1 || ed.topPlan ? 'none' : 'block';
  }
  // ---- the selected piece's tools, on the picture (CC-94): turn, scale, copy, crop, delete
  function pieceBar(p: P | null) {
    bar.replaceChildren();
    if (!p || isSizeReference(p)) { bar.style.display = 'none'; return; }
    const b = (text: string, id: string | undefined, title: string, fn: () => void) => { const x = el('button', bar, { text, ...(id ? { id } : {}), title }); x.onclick = fn; return x; };
    if (!isDevice(p)) {
      b('↺ 15°', 'turnleft', 'Turn the piece 15 degrees to the left', () => { p.yaw -= Math.PI / 12; changed(); });
      b('↻ 15°', 'turnright', 'Turn the piece 15 degrees to the right', () => { p.yaw += Math.PI / 12; changed(); });
      el('span', bar, { className: 'sep' });
      for (const [t, k] of [['× 0.5', 0.5], ['× 2', 2], ['× 10', 10]] as const) b(t, undefined, `Make the piece ${k} times its size`, () => { Object.assign(p, scaleBy(p, k)); changed(); });
      el('span', bar, { className: 'sep' });
      b('Copy', 'dup', 'Copy and paste the piece next to itself', () => { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; ed.pieces.push(q); ed.selected = q.id; changed(); });
      const cb = b(ed.cropMode ? 'Drag a box on the plan' : 'Crop', 'crop', 'Cut away what you do not need: drag a box on the flat plan', () => { ed.cropMode = !ed.cropMode; if (ed.cropMode && !ed.topPlan) setView(true); drawPanel(); });
      cb.setAttribute('aria-pressed', String(ed.cropMode));
      el('span', bar, { className: 'sep' });
    }
    b('Delete', 'del', 'Delete the piece (Delete key)', () => { ed.pieces = ed.pieces.filter((q) => q !== p); ed.selected = null; changed(); });
    bar.style.display = 'flex'; placeBar();
  }
  // next to the selected piece: above its top on the 3D picture (below it when there is no room), clamped inside the picture
  function placeBar() {
    const p = ed.pieces.find((q) => q.id === ed.selected && !isSizeReference(q));
    if (!p || bar.style.display === 'none') return;
    const W = planWrap.clientWidth, H = planWrap.clientHeight, bw = bar.offsetWidth, bh = bar.offsetHeight;
    const r = realSize(p);
    let cx: number, top: number, bottom: number;
    if (ed.topPlan) { const k = plan.clientWidth / plan.width, half = (Math.max(r.w, r.d) / 2) * ed.view.ppm * k; cx = sx(p.x) * k; top = sz(p.z) * k - half - bh - 8; bottom = sz(p.z) * k + half + 8; }
    else { const a = view3d.project(p.x, p.y + r.h, p.z), g = view3d.project(p.x, p.y, p.z); if (!a || !g) { bar.style.visibility = 'hidden'; return; } cx = a.x; top = a.y - bh - 10; bottom = g.y + 10; }
    bar.style.visibility = 'visible';
    bar.style.left = `${Math.round(Math.min(Math.max(cx - bw / 2, 4), Math.max(4, W - bw - 4)))}px`;
    bar.style.top = `${Math.round(Math.min(Math.max(top >= 4 ? top : bottom, 4), Math.max(4, H - bh - 4)))}px`;
  }
  view3d.onCamera(placeBar);

  // ---- the selected piece
  function drawPanel() {
    syncPersonChip();
    side.replaceChildren();
    syncSelChip();
    if (chosen().length > 1) { el('strong', side, { text: countText(chosen().length) }); el('div', side, { className: 'muted', text: 'Delete removes them all. Ctrl+C then Ctrl+V copies them. Esc clears the choice. Shift+click adds or drops one.' }); pieceBar(null); return; }
    const p = ed.pieces.find((q) => q.id === ed.selected && !isSizeReference(q));
    el('strong', side, { text: p ? p.name : 'No piece chosen' });
    if (!p) { pieceBar(null); el('div', side, { className: 'muted', text: 'Click a piece on the picture to choose it. Drag it to move it. Scroll to zoom, drag the background to pan.' }); return; }
    if (isDevice(p)) {
      const u = p.x * Math.cos(ed.angle) + p.z * Math.sin(ed.angle);
      const sameKind = ed.pieces.filter((q) => p.src?.startsWith('device:trebuchet:') ? q.src?.startsWith('device:trebuchet:') : p.src?.startsWith('device:drone:') ? q.src?.startsWith('device:drone:') : q.src?.startsWith('device:cannon:'));
      const active = sameKind[0]?.id === p.id;
      el('div', side, { className: 'muted', text: `${active ? 'Active in the course simulation' : 'Extra movable copy; the course currently simulates the first device of this type'} at ${u.toFixed(1)} m along the lane. Drag it in the 3D view or top plan. Size and orientation stay fixed.` });
      pieceBar(p);
      return;
    }
    const prov = p.src ? provOf.get(p.src) : undefined;
    if (prov) { const c = el('div', side, { id: 'credit', className: 'muted', text: prov.credit.line || creditLine(prov.credit, prov.source) }); c.title = `Made from a photo (${prov.photo.width} x ${prov.photo.height}) with ${prov.pipeline.model}; box ${prov.box.join(', ')}; photo fingerprint ${prov.photo.sha256.slice(0, 12)}`; }
    tools.panel(p as P, side);
    const r = realSize(p);
    const sizes = el('details', side, { id: 'sizes' }); el('summary', sizes, { text: 'Size and height' }); // the numbers stay here, folded: the simulator says whether the lane clears
    el('div', sizes, { id: 'realsize', className: 'muted', text: `Real size: ${r.w.toFixed(2)} × ${r.d.toFixed(2)} m, ${r.h.toFixed(2)} m high (scale ×${p.scale.toPrecision(3)})` });
    const lab = el('label', sizes, { text: 'Real height (m): make it this tall' });
    const h = el('input', lab, { type: 'number', min: '0.02', max: '60', step: '0.05', value: r.h.toFixed(2), id: 'realheight' });
    h.onchange = () => { const v = Number(h.value); if (v > 0) { Object.assign(p, scaleToHeight(p, v)); changed(); } };
    const lift = el('label', sizes, { text: `Height off the ground: ${p.y.toFixed(2)} m` });
    const ly = el('input', lift, { type: 'range', min: isTrack(p) ? String(Math.max(0, ed.level)) : '0', max: (isHold(p) || p.role === 'bar') ? '8' : '4', step: '0.05', value: String(p.y), id: 'lift' });
    ly.oninput = () => { p.y = Number(ly.value); lift.firstChild!.textContent = `Height off the ground: ${p.y.toFixed(2)} m`; drawProfile(); };
    ly.onchange = () => changed();
    pieceBar(p);
  }
  return { drawPanel, placeBar, syncSelChip, pieceBar };
}
