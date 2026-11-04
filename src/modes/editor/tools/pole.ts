import { el } from '../dom';
import { pageQuery } from '../../../flags';
import { DEFAULT_POLE_TOP, isPolePiece, polePiece, poleMesh, poleSrc, poleTopOf, POLE_TOP_MAX, POLE_TOP_MIN } from '../../../slice/pole-world';
import { centred } from '../../../slice/world';
import type { PieceTool, ToolCtx } from './types';

// The climbing pole (CC-133, behind ?fork=1): hold E at its foot to climb; at the top the hands pass on to the first bar after it.
// The check with the simulator then proves the bulb lane (the pole and the bars) beside any floor that runs under the bars (the bench lane).
export const POLE_HINT = 'In the Course: hold E at the foot of the pole to climb. At the top the hands pass on to the first bar after the pole (put a row of bars there, level with the top).';
export const poleTool = (c: ToolCtx): PieceTool => {
  const { ed, addBar, changed, nextX } = c;
  return {
    id: 'pole',
    mount() {
      if (pageQuery().get('fork') !== '1') return; // new feature: off until the link asks for it
      el('button', addBar, { text: 'Climbing pole', id: 'addpole', title: 'A pole you climb with E; its top hands over to the first bar after it' }).onclick = () => {
        const q = polePiece(DEFAULT_POLE_TOP, { x: nextX() + 1, z: 0 }); ed.pieces.push(q); ed.selected = q.id; changed();
      };
      el('button', addBar, { text: 'Pole and bar row', id: 'addpolebars', title: 'A climbing pole with a row of six bars level with its top' }).onclick = () => {
        const x = nextX() + 1, q = polePiece(DEFAULT_POLE_TOP, { x, z: 0 });
        ed.pieces.push(q);
        for (let i = 0; i < 6; i++) c.addBarPiece(x + 0.4 + 2 * i, DEFAULT_POLE_TOP - 0.04);
        ed.selected = q.id; changed();
      };
    },
    panel(p, side) {
      if (!isPolePiece(p)) return;
      const top = poleTopOf(p.src);
      const l = el('label', side, { text: 'Height (m) ' }); const out = el('span', l, { text: top.toFixed(2) });
      const i = el('input', l, { type: 'range', id: 'poletop', min: String(POLE_TOP_MIN), max: String(POLE_TOP_MAX), step: '0.05', value: String(top) }) as HTMLInputElement;
      i.oninput = () => { out.textContent = Number(i.value).toFixed(2); };
      i.onchange = () => { const t = Number(i.value); p.src = poleSrc(t); p.mesh = centred(poleMesh(t)); changed(); };
      el('div', side, { className: 'muted', id: 'polehint', text: POLE_HINT });
    },
  };
};
