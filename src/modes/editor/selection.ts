import { chosenIds, moveGroup, withoutIds } from '../../ui/selection';
import { duplicate, size } from '../../slice/world';
import { isSizeReference, type EditorState, type P } from './state';

export interface SelectionEnv { ed: EditorState; multiOn: boolean; changed: () => void; redraw: () => void }

// CC-200: several pieces chosen at once (Shift+click, a box dragged on the picture), and the clipboard that works on them.
// `selected` stays the main one; the group counts while it is in it. Moved out of editor.ts unchanged (CC-133).
export function createSelection(env: SelectionEnv) {
  const { ed, multiOn, changed, redraw } = env;
  const chosen = (): number[] => (multiOn ? chosenIds(ed.group, ed.selected, (id) => ed.pieces.some((q) => q.id === id && !isSizeReference(q))) : ed.selected !== null ? [ed.selected] : []);
  const chooseMany = (ids: number[]) => { ed.group = ids; ed.selected = ids.length ? ids[ids.length - 1] : null; redraw(); };
  // dragging one piece of a chosen group moves the whole group by the same step
  const moveWith = (p: P, x: number, z: number) => moveGroup(ed.pieces, chosen(), p, x, z);
  // Ctrl+C keeps the chosen pieces, Ctrl+V puts copies beside them (a group stays a group); pasting again goes one step further along
  let clip: P[] = [], pastes = 0;
  const copyChosen = () => { const ids = chosen(); if (!ids.length) return false; clip = ed.pieces.filter((q) => ids.includes(q.id)).map((q) => ({ ...q })); pastes = 0; return true; };
  const pasteClip = () => {
    if (!clip.length) return;
    pastes++;
    const w = Math.max(...clip.map((q) => q.x + (size(q.mesh).w * q.scale) / 2)) - Math.min(...clip.map((q) => q.x - (size(q.mesh).w * q.scale) / 2)), dx = (w + 0.5) * pastes;
    const made = clip.map((q) => duplicate(q, dx, 0) as P);
    ed.pieces.push(...made); ed.selected = made[made.length - 1].id; ed.group = made.length > 1 ? made.map((q) => q.id) : [];
    changed();
  };
  const deleteChosen = () => { const ids = chosen(); if (!ids.length) return; ed.pieces = withoutIds(ed.pieces, ids); ed.selected = null; ed.group = []; changed(); };
  return { chosen, chooseMany, moveWith, copyChosen, pasteClip, deleteChosen };
}
