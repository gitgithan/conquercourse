import { el } from '../dom';
import type { P } from '../state';
import { pageQuery } from '../../../flags';
import { roleColliderOn } from '../../../slice/role-collider';
const roleFirst = (): boolean => roleColliderOn(pageQuery(), typeof location === 'undefined' ? '' : location.hostname);
import { barsAfterBar, barsPiece, barsSpecOf, DEFAULT_BARS_SPEC, fitBars, isBarsPiece, RUNG_THICK, RUNGS_MAX, RUNGS_MIN, setBars, type BarsSpec } from '../../../slice/bars-world';
import { isHold } from '../../../slice/holds-world';
import { GAP_MAX, GAP_MIN } from '../../../sim/bars';
import { isDevice, isSizeReference } from '../state';
import type { PieceTool, ToolCtx } from './types';

// Monkey bars (CC-133, docs/bars.md), behind ?bars=1: a row of rungs overhead that is crossed hand over hand in the Course.
// Rotating a piece (the swing bar included) is the 15 degree turn in the piece bar, so a bars row or a swing bar turns the same way.
export const BARS_HINT = 'In the Course: hold E near the first rung, then Q reaches the left hand and T the right hand, one after the other, as you swing forward. The arrows kip the swing.';
const isObject = (p: P): boolean => !isBarsPiece(p) && !isHold(p) && !isDevice(p) && !isSizeReference(p) && p.role !== 'rope' && p.role !== 'bar';

export const barsTool = (c: ToolCtx): PieceTool => {
  const { ed, addBar, changed, nextX } = c;
  return {
    id: 'bars',
    mount() {
      if (pageQuery().get('bars') !== '1') return; // new feature: off until the link asks for it
      el('button', addBar, { text: 'Monkey bars', id: 'addbars', title: 'A row of rungs overhead: hang, then reach hand over hand with Q and T' }).onclick = () => { const q = barsPiece(DEFAULT_BARS_SPEC, { x: nextX() + 3, z: 0 }); ed.pieces.push(q); ed.selected = q.id; changed(); };
      el('button', addBar, { text: 'Bar then bars', id: 'addbarbars', title: 'A pull-up bar and a row of monkey bars after it: swing, let go, catch the first rung' }).onclick = () => {
        const bar = c.addBarPiece(nextX() + 1, 2.56); const q = barsAfterBar(bar); ed.pieces.push(q); ed.selected = q.id; changed();
      };
      el('button', addBar, { text: 'Fit to selected', id: 'fitbars', title: 'Lay a row of monkey bars along the top of the chosen piece (a box, or an object lifted from a photo)' }).onclick = () => {
        const obj = ed.pieces.find((p) => p.id === ed.selected) as P | undefined;
        if (!obj || !isObject(obj)) return;
        const q = barsPiece(DEFAULT_BARS_SPEC, { x: obj.x, z: obj.z }); fitBars(q, obj, roleFirst()); ed.pieces.push(q); ed.selected = q.id; changed();
      };
    },
    panel(p, side) {
      if (!isBarsPiece(p)) return;
      const spec = barsSpecOf(p.src)!;
      const set = (patch: Partial<BarsSpec>) => { setBars(p, { ...spec, ...patch }); changed(); };
      const slider = (label: string, id: string, v: number, min: number, max: number, step: number, apply: (n: number) => void, show: (n: number) => string) => {
        const l = el('label', side, { text: label + ' ' }); const out = el('span', l, { text: show(v) });
        const i = el('input', l, { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(v) }) as HTMLInputElement;
        i.oninput = () => { out.textContent = show(Number(i.value)); }; i.onchange = () => apply(Number(i.value));
      };
      slider('Rungs', 'barsn', spec.n, RUNGS_MIN, RUNGS_MAX, 1, (n) => set({ n }), (n) => String(n));
      slider('Spacing (m)', 'barsgap', spec.gap, GAP_MIN, GAP_MAX, 0.05, (n) => set({ gap: n }), (n) => n.toFixed(2));
      slider('Height (m)', 'barsy', Math.round((p.y + RUNG_THICK / 2) * 20) / 20, 1.8, 4.5, 0.05, (n) => { p.y = n - RUNG_THICK / 2; changed(); }, (n) => n.toFixed(2));
      const fit = el('button', side, { text: 'Fit to the piece under it', id: 'fitbarsunder', title: 'Lay the row along the top of the nearest piece' });
      fit.onclick = () => {
        const near = (ed.pieces as P[]).filter(isObject).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        if (near) { fitBars(p, near, roleFirst()); changed(); }
      };
      el('div', side, { className: 'muted', id: 'barshint', text: BARS_HINT });
    },
  };
};
