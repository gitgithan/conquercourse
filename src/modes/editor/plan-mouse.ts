import { applyMarquee, isMarquee, pickInRect, rectFrom, toggleId } from '../../ui/selection';
import { crop, hits, realSize } from '../../slice/world';
import { isSizeReference, type EditorState, type P } from './state';

type Rect = { x0: number; z0: number; x1: number; z1: number };
export interface PlanMouseEnv {
  ed: EditorState; plan: HTMLCanvasElement; multiOn: boolean;
  wx: (px: number) => number; wz: (py: number) => number;
  chosen: () => number[]; chooseMany: (ids: number[]) => void; moveWith: (p: P, x: number, z: number) => void;
  draw: () => void; drawProfile: () => void; drawPanel: () => void; changed: () => void;
}

// The mouse on the flat plan: click to choose, drag to move or pan, a box to crop or to choose several, the wheel to zoom.
// Moved out of editor.ts unchanged (CC-133); `rubber` is read by the plan drawing, so it comes back through `rubber()`.
export function attachPlanMouse(env: PlanMouseEnv) {
  const { ed, plan, multiOn, wx, wz, chosen, chooseMany, moveWith, draw, drawProfile, drawPanel, changed } = env;
  let rubber: Rect | null = null;
  let drag: { kind: 'move' | 'pan' | 'rubber' | 'marq'; p?: P; ox: number; oz: number; sx0: number; sz0: number; cx: number; cz: number } | null = null;
  plan.addEventListener('pointerdown', (e) => {
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    plan.setPointerCapture(e.pointerId);
    if (ed.cropMode && ed.selected !== null) { drag = { kind: 'rubber', ox: x, oz: z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    const hit = [...ed.pieces].reverse().find((p) => !isSizeReference(p) && hits(p, x, z));
    if (multiOn && e.shiftKey && hit) { chooseMany(toggleId(chosen(), hit.id)); drag = null; return; }
    if (multiOn && !hit && e.button === 0 && !e.altKey) { drag = { kind: 'marq', ox: x, oz: z, sx0: px, sz0: py, cx: e.shiftKey ? 1 : 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    if (hit) { if (!(multiOn && chosen().length > 1 && chosen().includes(hit.id))) ed.group = []; ed.selected = hit.id; drag = { kind: 'move', p: hit, ox: x - hit.x, oz: z - hit.z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; }
    else { ed.selected = null; ed.group = []; drag = { kind: 'pan', ox: 0, oz: 0, sx0: px, sz0: py, cx: ed.view.cx, cz: ed.view.cz }; }
    drawPanel(); draw();
  });
  plan.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (drag.kind === 'move' && drag.p) { moveWith(drag.p, Math.round((wx(px) - drag.ox) * 20) / 20, Math.round((wz(py) - drag.oz) * 20) / 20); draw(); drawProfile(); }
    else if (drag.kind === 'pan') { ed.view.cx = drag.cx - (px - drag.sx0) / ed.view.ppm; ed.view.cz = drag.cz - (py - drag.sz0) / ed.view.ppm; draw(); }
    else if ((drag.kind === 'rubber' || drag.kind === 'marq') && rubber) { rubber = { x0: Math.min(drag.ox, wx(px)), z0: Math.min(drag.oz, wz(py)), x1: Math.max(drag.ox, wx(px)), z1: Math.max(drag.oz, wz(py)) }; draw(); }
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'marq') {
      const rb = rubber; rubber = null;
      const px = rb ? (rb.x1 - rb.x0) * ed.view.ppm : 0, py = rb ? (rb.z1 - rb.z0) * ed.view.ppm : 0;
      if (rb && isMarquee(rectFrom(0, 0, px, py))) {
        const items = ed.pieces.filter((q) => !isSizeReference(q)).map((q) => ({ id: q.id, x: q.x, y: q.z, r: Math.max(realSize(q).w, realSize(q).d) / 2 }));
        chooseMany(applyMarquee(chosen(), pickInRect(items, { x0: rb.x0, y0: rb.z0, x1: rb.x1, y1: rb.z1 }), d.cx === 1));
      } else if (!d.cx) { ed.selected = null; ed.group = []; drawPanel(); }
      draw(); return;
    }
    if (d.kind === 'rubber' && rubber && ed.selected !== null) {
      const p = ed.pieces.find((q) => q.id === ed.selected);
      if (p && rubber.x1 - rubber.x0 > 0.05 && rubber.z1 - rubber.z0 > 0.05) {
        // the box in the piece's own units: the four corners turned back, then their bounds
        const c = Math.cos(-p.yaw), s = Math.sin(-p.yaw), xs: number[] = [], zs: number[] = [];
        for (const [x, z] of [[rubber.x0, rubber.z0], [rubber.x1, rubber.z0], [rubber.x1, rubber.z1], [rubber.x0, rubber.z1]]) { const dx = x - p.x, dz = z - p.z; xs.push((dx * c - dz * s) / p.scale); zs.push((dx * s + dz * c) / p.scale); }
        const cut = crop(p, { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) });
        if (cut) { Object.assign(p, cut, { id: p.id }); } else ed.verdict = 'Nothing of the piece is inside that box.';
      }
      rubber = null; ed.cropMode = false; changed(); return;
    }
    changed();
  };
  plan.addEventListener('pointerup', end); plan.addEventListener('pointercancel', end);
  // the flat plan zooms toward the cursor (the point under it stays under it), with room to zoom far out and in
  plan.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = plan.getBoundingClientRect(), k = plan.width / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    ed.view.ppm = Math.min(400, Math.max(0.5, ed.view.ppm * Math.exp(-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 240) * 0.002)));
    ed.view.cx = x - (px - plan.width / 2) / ed.view.ppm; ed.view.cz = z - (py - plan.height / 2) / ed.view.ppm; draw();
  }, { passive: false });
  return { rubber: (): Rect | null => rubber };
}
