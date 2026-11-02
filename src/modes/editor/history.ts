import type { Piece } from '../../slice/world';

type P = Piece & { src?: string };

// Undo and redo of the World editor: a snapshot after every change (pieces are copied shallowly; a crop makes a new mesh, so old meshes stay valid).
export interface Snap { pieces: P[]; angle: number; offset: number; level: number }

// What the history needs from the editor closure; values that change later are read and written through accessors.
export interface HistoryDeps {
  getPieces: () => P[];
  setPieces: (v: P[]) => void;
  getLane: () => { angle: number; offset: number; level: number };
  setLane: (v: { angle: number; offset: number; level: number }) => void;
  getSelected: () => number | null;
  setSelected: (v: number | null) => void;
  undoBtn: () => HTMLButtonElement;
  redoBtn: () => HTMLButtonElement;
  changed: (record?: boolean) => void;
}

export interface EditorHistory {
  hist: Snap[];
  hi: number;
  snapNow: () => Snap;
  remember: () => void;
  goto: (k: number) => void;
}

export function createHistory(d: HistoryDeps): EditorHistory {
  const h: EditorHistory = {
    hist: [],
    hi: -1,
    snapNow: () => { const { angle, offset, level } = d.getLane(); return { pieces: d.getPieces().map((q) => ({ ...q })), angle, offset, level }; },
    remember: () => { const n = h.snapNow(); if (h.hi >= 0 && same(h.hist[h.hi], n)) return; h.hist.splice(h.hi + 1); h.hist.push(n); if (h.hist.length > 80) h.hist.shift(); h.hi = h.hist.length - 1; d.undoBtn().disabled = h.hi < 1; d.redoBtn().disabled = true; },
    goto: (k) => { const t = h.hist[k]; if (!t) return; h.hi = k; d.setPieces(t.pieces.map((q) => ({ ...q }))); d.setLane({ angle: t.angle, offset: t.offset, level: t.level }); if (!d.getPieces().some((q) => q.id === d.getSelected())) d.setSelected(null); d.undoBtn().disabled = h.hi < 1; d.redoBtn().disabled = h.hi >= h.hist.length - 1; d.changed(false); },
  };
  return h;
}

const same = (a: Snap, b: Snap) => a.angle === b.angle && a.offset === b.offset && a.level === b.level && a.pieces.length === b.pieces.length && a.pieces.every((q, i) => { const r = b.pieces[i]; return q.id === r.id && q.x === r.x && q.z === r.z && q.y === r.y && q.yaw === r.yaw && q.scale === r.scale && q.mesh === r.mesh && q.role === r.role; });
