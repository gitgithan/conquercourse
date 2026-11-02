import { describe, expect, it } from 'vitest';
import { createSelection } from '../src/modes/editor/selection';
import { createEditorState, type P } from '../src/modes/editor/state';
import { newPiece } from '../src/slice/world';
import { box, deck } from './helpers/pieces';

// Copy, paste, delete and the group, as they worked inside editor.ts before they moved (CC-133).
const make = (multiOn = true) => {
  const ed = createEditorState(); ed.pieces = [deck(0, 4), deck(10, 6), { ...newPiece('Box', box(2, 1, 1), { x: 20, z: 0 }), src: 'x' } as P];
  let changes = 0, redraws = 0;
  const sel = createSelection({ ed, multiOn, changed: () => { changes++; }, redraw: () => { redraws++; } });
  return { ed, sel, count: () => ({ changes, redraws }) };
};

describe('editor selection', () => {
  it('chooses one piece, or the group when it holds the main one', () => {
    const { ed, sel } = make();
    ed.selected = ed.pieces[0].id; expect(sel.chosen()).toEqual([ed.pieces[0].id]);
    sel.chooseMany([ed.pieces[0].id, ed.pieces[1].id]);
    expect(ed.selected).toBe(ed.pieces[1].id); expect(sel.chosen()).toEqual([ed.pieces[0].id, ed.pieces[1].id]);
  });
  it('with the old UI only the main piece counts', () => {
    const { ed, sel } = make(false);
    ed.group = [ed.pieces[0].id, ed.pieces[1].id]; ed.selected = ed.pieces[1].id;
    expect(sel.chosen()).toEqual([ed.pieces[1].id]);
  });
  it('copy and paste puts copies beside the group, further along each time', () => {
    const { ed, sel, count } = make();
    expect(sel.copyChosen()).toBe(false);
    sel.chooseMany([ed.pieces[0].id, ed.pieces[1].id]);
    expect(sel.copyChosen()).toBe(true);
    sel.pasteClip(); sel.pasteClip();
    expect(ed.pieces.map((p) => p.x)).toEqual([0, 10, 20, 15.5, 25.5, 31, 41]);
    expect(ed.group.length).toBe(2); expect(count().changes).toBe(2);
  });
  it('delete takes out every chosen piece and clears the choice', () => {
    const { ed, sel } = make();
    sel.chooseMany([ed.pieces[0].id, ed.pieces[2].id]);
    sel.deleteChosen();
    expect(ed.pieces.map((p) => p.x)).toEqual([10]); expect(ed.selected).toBeNull(); expect(ed.group).toEqual([]);
  });
});
