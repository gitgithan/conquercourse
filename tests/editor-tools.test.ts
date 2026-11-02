import { describe, expect, it } from 'vitest';
import { createEditorState } from '../src/modes/editor/state';
import { createLane } from '../src/modes/editor/lane';
import { createTools } from '../src/modes/editor/tools';

// The piece tools of the World editor: their order on the toolbar and the order Fix it asks them in.
function rig() {
  const ed = createEditorState(), lane = createLane(ed);
  const tools = createTools({ ed, lane, addBar: {} as HTMLElement, changed: () => {}, focusOn: () => {} });
  return { ed, tools };
}

describe('editor piece tools', () => {
  it('the toolbar order is the page order, with stacks before the plank', () => {
    expect(rig().tools.list.map((t) => t.id)).toEqual(['bar', 'coaster', 'lache', 'rope', 'trebuchet', 'recoil', 'band', 'drone', 'stacks', 'plank']);
  });
  it('Fix it asks plank, drone, launcher, then band', () => {
    const t = rig().tools.list.filter((x) => x.fix).sort((a, b) => (a.fixOrder ?? 9) - (b.fixOrder ?? 9)).map((x) => x.id);
    expect(t).toEqual(['plank', 'drone', 'recoil', 'band']);
  });
  it('with nothing on the deck, no tool answers for Fix it', () => {
    const { tools } = rig();
    expect(tools.fix({ reply: {} as HTMLElement, changed: () => {} })).toBe(false);
  });
  it('a new bar goes after the last piece and is chosen', () => {
    const { ed, tools } = rig();
    const q = tools.addBarPiece(3, 2.86);
    expect(ed.pieces).toContain(q); expect(ed.selected).toBe(q.id); expect(q.y).toBe(2.86);
  });
});
