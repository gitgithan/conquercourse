import type { Piece } from '../../slice/world';
import { isSharedSrc } from '../../community/flow';
import { HIST_KEY } from '../../slice/roundtrip';
import type { Saved } from './state';

type P = Piece & { src?: string };

// Undo and redo of the World editor: a snapshot after every change (pieces are copied shallowly; a crop makes a new mesh, so old meshes stay valid).
export interface Snap { start?: Saved['start']; pieces: P[]; angle: number; offset: number; level: number }

// What the history needs from the editor closure; values that change later are read and written through accessors.
export interface HistoryDeps {
  getPieces: () => P[];
  setPieces: (v: P[]) => void;
  getLane: () => { angle: number; offset: number; level: number; start?: Saved['start'] };
  setLane: (v: { angle: number; offset: number; level: number; start?: Saved['start'] }) => void;
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
  persist: () => void;
}

export function createHistory(d: HistoryDeps): EditorHistory {
  const h: EditorHistory = {
    hist: [],
    hi: -1,
    snapNow: () => { const { angle, offset, level, start } = d.getLane(); return { ...(start ? { start: { ...start } } : {}), pieces: d.getPieces().map((q) => ({ ...q })), angle, offset, level }; },
    remember: () => { const n = h.snapNow(); if (h.hi >= 0 && same(h.hist[h.hi], n)) return; h.hist.splice(h.hi + 1); h.hist.push(n); if (h.hist.length > 80) h.hist.shift(); h.hi = h.hist.length - 1; d.undoBtn().disabled = h.hi < 1; d.redoBtn().disabled = true; },
    goto: (k) => { const t = h.hist[k]; if (!t) return; h.hi = k; d.setPieces(t.pieces.map((q) => ({ ...q }))); d.setLane({ angle: t.angle, offset: t.offset, level: t.level, ...(t.start ? { start: { ...t.start } } : {}) }); if (!d.getPieces().some((q) => q.id === d.getSelected())) d.setSelected(null); d.undoBtn().disabled = h.hi < 1; d.redoBtn().disabled = h.hi >= h.hist.length - 1; d.changed(false); },
    persist: () => persistHist(h, d.getPieces()),
  };
  return h;
}

const same = (a: Snap, b: Snap) => JSON.stringify(a.start) === JSON.stringify(b.start) && a.angle === b.angle && a.offset === b.offset && a.level === b.level && a.pieces.length === b.pieces.length && a.pieces.every((q, i) => { const r = b.pieces[i]; return q.id === r.id && q.x === r.x && q.z === r.z && q.y === r.y && q.yaw === r.yaw && q.scale === r.scale && q.mesh === r.mesh && q.role === r.role; });

// the undo list goes into the session so it survives a trip to the Course (pieces made from photos or maps are not kept: their meshes are too big)
function persistHist(h: EditorHistory, pieces: P[]) {
  try {
    const heavy = (q: P) => q.src?.startsWith('obj:') || q.src?.startsWith('user:') || isSharedSrc(q.src) || q.src?.startsWith('map:');
    if (pieces.some(heavy) || h.hist.some((s) => s.pieces.some(heavy))) { sessionStorage.removeItem(HIST_KEY); return; }
    const start = Math.max(0, h.hist.length - 25);
    const keep = (s: Snap): Saved => ({ pieces: s.pieces.filter((q) => q.src).map((q) => ({ src: q.src as string, x: q.x, z: q.z, y: q.y, yaw: q.yaw, scale: q.scale, ...(q.role ? { role: q.role } : {}) })), angle: s.angle, offset: s.offset, level: s.level, ...(s.start ? { start: s.start } : {}) });
    sessionStorage.setItem(HIST_KEY, JSON.stringify({ snaps: h.hist.slice(start).map(keep), hi: Math.max(0, h.hi - start) }));
  } catch { /* the undo list starts again */ }
}
