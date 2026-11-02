import { el } from '../dom';
import type { P } from '../state';
import { pageQuery } from '../../../flags';
import { box } from '../../../slice/shapes';
import { newPiece, size } from '../../../slice/world';
import { isTrack, trackPiece, trackStartY, TRACK_SHAPES } from '../../../slice/track-world';
import { PATTERNS, stackPiece, stackSrc } from '../../../slice/stack';
import { DEFAULT_PLANK, isPlankPiece, plankPiece, plankSpecOf, planksOf, setPlank, type PlankSpec } from '../../../slice/plank-world';
import { fixPlank, plankHolds, worstCase } from '../../../sim/beam';
import type { PieceTool, ToolCtx } from './types';

// Pieces with no knobs on the toolbar: bars, coaster sections, a rope swing, sport-stacking cups. The plank has knobs, in the piece panel.

// overhead: bars hanging in the air (a game, not real: they need no frame); the side view is where they are dragged
export const barTool = (c: ToolCtx): PieceTool => ({
  id: 'bar',
  mount() {
    const { addBar, changed, nextX, addBarPiece } = c;
    el('strong', addBar, { text: 'Overhead:' });
    el('button', addBar, { text: 'Bar', id: 'addbar' }).onclick = () => { addBarPiece(nextX(), 2.86); changed(); };
  },
});

// coaster sections (CC-244): rails the rider rides; leave a short gap between two sections and the rider flies across it (bars and ropes can catch them)
export const coasterTool = (c: ToolCtx): PieceTool => ({
  id: 'coaster',
  mount() {
    const { ed, addBar, changed } = c;
    const coasterOn = pageQuery().get('coaster') !== '0'; // on by default; ?coaster=0 hides the piece
    const trackShape = el('select', addBar, { id: 'trackshape', title: 'The shape of the next coaster section' }) as HTMLSelectElement;
    for (const t of TRACK_SHAPES) el('option', trackShape, { text: t.name, value: t.id });
    trackShape.style.display = coasterOn ? '' : 'none';
    const coasterBtn = el('button', addBar, { text: 'Coaster', id: 'addcoaster', title: 'A stretch of rail the character rides in a cart. The ride starts at the first section; a gap of about 3 m between sections is a flight.' });
    coasterBtn.onclick = () => {
      const shape = TRACK_SHAPES.find((t) => t.id === trackShape.value) ?? TRACK_SHAPES[0];
      const q = trackPiece(shape.pts, { x: 0, z: 0 });
      const w = size(q.mesh).w;
      const sections = ed.pieces.filter(isTrack);
      q.y = trackStartY(sections.sort((m, n) => m.x - n.x)[sections.length - 1], shape.pts);
      q.x = sections.length ? Math.max(...sections.map((o) => o.x + (size(o.mesh).w * o.scale) / 2)) + 3 + w / 2 : w / 2;
      ed.pieces.push(q); ed.selected = q.id; changed();
    };
    coasterBtn.style.display = coasterOn ? '' : 'none';
  },
});

export const lacheTool = (c: ToolCtx): PieceTool => ({
  id: 'lache',
  mount() {
    const { addBar, changed, nextX, addBarPiece } = c;
    el('button', addBar, { text: 'Lache pair', id: 'addlache', title: 'Two bars to swing between' }).onclick = () => { const x = nextX(); addBarPiece(x, 2.86); addBarPiece(x + 3.5, 2.86); changed(); };
  },
});

// a rope swing: a post whose top is the rope anchor (role rope); put it over a gap and the simulator checks the swing
export const ropeTool = (c: ToolCtx): PieceTool => ({
  id: 'rope',
  mount() {
    const { ed, addBar, changed, nextX } = c;
    el('button', addBar, { text: 'Rope swing', id: 'addrope', title: 'A post with a rope on top: put it over a gap between two pieces of ground and swing across' }).onclick = () => { const q: P = { ...newPiece('Rope anchor', box(0.5, 6.6, 0.5), { x: nextX() + 3, z: 0 }), role: 'rope' }; ed.pieces.push(q); ed.selected = q.id; changed(); };
  },
});

// stacks: sport-stacking cups (mouth down, pyramids) as obstacle shapes; the piece scale makes a 9 cm cup runner-sized
export const stacksTool = (c: ToolCtx): PieceTool => ({
  id: 'stacks',
  mount() {
    const { ed, addBar, changed, nextX } = c;
    el('strong', addBar, { text: 'Stacks:' });
    for (const pt of PATTERNS) {
      el('button', addBar, { text: pt.label, id: `addstack-${pt.id}`, title: `Sport-stacking cups piled ${pt.label}: climb the steps they make` }).onclick = () => {
        const q = stackPiece(stackSrc(pt.id), { x: nextX() + 1, z: 0 })!; ed.pieces.push(q); ed.selected = q.id; changed();
      };
    }
  },
});

// a plank bridge: lay it across a gap between two pieces of ground; it sags and can break (the knobs are in the piece panel)
export const plankTool = (c: ToolCtx): PieceTool => {
  const { ed, lane, addBar, changed, nextX } = c;
  // a plank that would snap: the smallest change is a thicker plank or a post
  function fixNow(): { steps: string[]; apply: () => void } | null {
    const course = lane.courseNow(), laid = planksOf(ed.pieces as P[], { angle: ed.angle, offset: ed.offset, level: ed.level });
    const fixes: { piece: P; spec: PlankSpec; fix: ReturnType<typeof fixPlank> }[] = [];
    (course.planks ?? []).forEach((pk, i) => { const pc = laid[i] ? (ed.pieces.find((q) => q.id === laid[i].id) as P | undefined) : undefined; if (pc && !plankHolds(pk)) fixes.push({ piece: pc, spec: plankSpecOf(pc.src)!, fix: fixPlank(pk) }); });
    if (!fixes.length) return null;
    return { steps: fixes.flatMap((f) => f.fix.steps), apply: () => fixes.forEach((f) => { if (f.fix.ok) setPlank(f.piece, { ...f.spec, thickness: f.fix.plank.thickness, support: !!f.fix.plank.support }); }) };
  }
  return {
    id: 'plank',
    fixOrder: 0,
    mount() {
      el('button', addBar, { text: 'Plank', id: 'addplank', title: 'A plank bridge laid across a gap: it sags under the runner and breaks if it is too thin or too long' }).onclick = () => { const q = plankPiece(DEFAULT_PLANK, { x: nextX() + 1, z: 0 }); ed.pieces.push(q); ed.selected = q.id; changed(); };
    },
    fix({ reply, changed: done }) {
      const pf = fixNow();
      if (!pf) return false;
      reply.className = 'reply bad'; reply.textContent = 'The plank would snap. ' + pf.steps.join(' ') + ' ';
      const mk = el('button', reply, { text: 'Make it so', className: 'go', id: 'plankfix' });
      mk.onclick = () => { pf.apply(); done(); reply.className = 'reply ok'; reply.textContent = 'Done: the plank is stronger now.'; };
      document.documentElement.dataset.fixed = '0';
      return true;
    },
    panel(p, side) {
      if (!isPlankPiece(p)) return;
      const spec = plankSpecOf(p.src)!;
      const set = (patch: Partial<PlankSpec>) => { setPlank(p, { ...spec, ...patch }); changed(); };
      const mat = el('label', side, { text: 'Material ' });
      const sel = el('select', mat, { id: 'plankmat' }) as HTMLSelectElement;
      for (const [v, t] of [['wood', 'Pine plank'], ['steel', 'Steel plate']] as const) { const o = el('option', sel, { text: t }); o.value = v; if (v === spec.material) o.selected = true; }
      sel.onchange = () => set({ material: sel.value === 'steel' ? 'steel' : 'wood' });
      const num = (label: string, id: string, v: number, min: number, max: number, step: number, apply: (n: number) => Partial<PlankSpec>) => {
        const l = el('label', side, { text: label }); const i = el('input', l, { type: 'number', id, min: String(min), max: String(max), step: String(step), value: String(v) });
        i.onchange = () => { const n = Number(i.value); if (n >= min && n <= max) set(apply(n)); };
      };
      num('Thickness (cm) ', 'plankthick', Math.round(spec.thickness * 1000) / 10, 0.5, 20, 0.5, (n) => ({ thickness: n / 100 }));
      num('Width (cm) ', 'plankwidth', Math.round(spec.width * 100), 20, 200, 5, (n) => ({ width: n / 100 }));
      num('Length (m, drawing only: the gap decides) ', 'plankspan', spec.span, 1, 20, 0.5, (n) => ({ span: n }));
      const post = el('label', side, { text: 'Post under the middle ' }); const cb = el('input', post, { type: 'checkbox', id: 'plankpost' }) as HTMLInputElement; cb.checked = spec.support; cb.onchange = () => set({ support: cb.checked });
      const span = spec.span * p.scale, w = worstCase({ x0: 0, x1: span, y: 0, thickness: spec.thickness, width: spec.width, material: spec.material, ...(spec.support ? { support: true } : {}) });
      el('div', side, { id: 'plankinfo', className: w.ratio >= 1 ? 'bad' : 'muted', text: w.ratio >= 1 ? `Over ${span.toFixed(1)} m it would snap (${(w.sag * 100).toFixed(0)} cm of sag at the worst place).` : `Over ${span.toFixed(1)} m it holds: ${(w.sag * 100).toFixed(0)} cm of sag at the worst place, ${(w.ratio * 100).toFixed(0)}% of what it can take.` });
    },
  };
};
