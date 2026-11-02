import { duplicate, size, type Piece } from '../../slice/world';

type P = Piece & { src?: string };

// What the keyboard shortcuts of the World editor need from the editor closure.
// Values that change later (pieces, selected, group, hi, proposal) are read and written through accessors, never copied.
export interface EditorKeys {
  getPieces: () => P[];
  setPieces: (v: P[]) => void;
  getSelected: () => number | null;
  setSelected: (v: number | null) => void;
  setGroup: (v: number[]) => void;
  getHi: () => number;
  hasProposal: () => boolean;
  hasHandoff: () => boolean;
  goto: (k: number) => void;
  copyChosen: () => boolean;
  pasteClip: () => void;
  closePreview: (message?: string) => void;
  chosen: () => number[];
  drawPanel: () => void;
  draw: () => void;
  drawProfile: () => void;
  deleteChosen: () => void;
  fitAll: () => void;
  goToCourse: () => Promise<void>;
  changed: () => void;
  leave: () => void;
}

export function onEditorKey(e: KeyboardEvent, k: EditorKeys): void {
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); k.goto(e.shiftKey ? k.getHi() + 1 : k.getHi() - 1); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); k.goto(k.getHi() + 1); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { k.copyChosen(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); k.pasteClip(); return; }
  if (e.code === 'Escape' && k.hasProposal()) { k.closePreview('Cancelled: nothing changed.'); return; }
  if (e.code === 'Escape' && k.chosen().length) { k.setGroup([]); k.setSelected(null); k.drawPanel(); k.draw(); k.drawProfile(); return; }
  if ((e.code === 'Delete' || e.code === 'Backspace') && k.chosen().length > 1) { e.preventDefault(); k.deleteChosen(); return; }
  if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) { k.fitAll(); return; }
  if (e.code === 'KeyT') { if (k.hasHandoff()) void k.goToCourse(); else k.leave(); }
  const selected = k.getSelected();
  const p = k.getPieces().find((q) => q.id === selected);
  if (!p) return;
  if (e.code === 'Delete' || e.code === 'Backspace') { k.setPieces(k.getPieces().filter((q) => q !== p)); k.setSelected(null); k.changed(); }
  if (e.code === 'KeyD') { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; k.getPieces().push(q); k.setSelected(q.id); k.changed(); }
}
