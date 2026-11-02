import { describe, expect, it, vi } from 'vitest';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';
import { onEditorKey, type EditorKeys } from '../src/modes/editor/keys';

// The editor's keyboard shortcuts, driven with a fake editor state (the closure itself needs a WebGL page).
function rig(over: Partial<{ selected: number | null; proposal: boolean; handoff: boolean; chosen: number[]; hi: number }> = {}) {
  const mk = (src: string, x: number) => ({ ...newPiece(src, box(1, 1, 1), { x, z: 0 }), src });
  const first = mk('a', 0);
  const st = { pieces: [first, mk('b', 5)] as never[], selected: over.selected === undefined ? null : over.selected === 1 ? first.id : over.selected, group: [9] as number[] };
  const calls: string[] = [];
  const log = (n: string) => () => { calls.push(n); };
  const k: EditorKeys = {
    getPieces: () => st.pieces as never, setPieces: (v) => { st.pieces = v as never; }, getSelected: () => st.selected, setSelected: (v) => { st.selected = v; }, setGroup: (v) => { st.group = v; },
    getHi: () => over.hi ?? 3, hasProposal: () => !!over.proposal, hasHandoff: () => !!over.handoff,
    goto: (n) => { calls.push('goto' + n); }, copyChosen: () => { calls.push('copy'); return true; }, pasteClip: log('paste'), closePreview: (m) => { calls.push('close:' + m); },
    chosen: () => over.chosen ?? [], drawPanel: log('panel'), draw: log('draw'), drawProfile: log('profile'), deleteChosen: log('deleteChosen'), fitAll: log('fit'),
    goToCourse: async () => { calls.push('course'); }, changed: log('changed'), leave: log('leave'),
  };
  const key = (code: string, o: Partial<KeyboardEventInit> & { tag?: string; type?: string } = {}) => {
    const e = { code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn(), target: o.tag ? { tagName: o.tag, type: o.type } : null, ...o } as unknown as KeyboardEvent;
    onEditorKey(e, k);
    return e;
  };
  return { st, calls, key };
}

describe('editor keyboard shortcuts', () => {
  it('undo, shift-undo and redo move through history', () => {
    const r = rig();
    r.key('KeyZ', { ctrlKey: true }); r.key('KeyZ', { metaKey: true, shiftKey: true }); r.key('KeyY', { ctrlKey: true });
    expect(r.calls).toEqual(['goto2', 'goto4', 'goto4']);
  });
  it('copy does not stop the browser, paste does', () => {
    const r = rig();
    expect(r.key('KeyC', { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
    expect(r.key('KeyV', { ctrlKey: true }).preventDefault).toHaveBeenCalled();
    expect(r.calls).toEqual(['copy', 'paste']);
  });
  it('typing in a field is ignored, except on a range slider', () => {
    const r = rig({ selected: 1 });
    r.key('KeyF', { tag: 'INPUT', type: 'text' });
    expect(r.calls).toEqual([]);
    r.key('KeyF', { tag: 'INPUT', type: 'range' });
    expect(r.calls).toEqual(['fit']);
  });
  it('Escape closes a preview first, otherwise clears the choice', () => {
    const a = rig({ proposal: true, chosen: [1] });
    a.key('Escape'); expect(a.calls).toEqual(['close:Cancelled: nothing changed.']);
    const b = rig({ chosen: [1], selected: 1 });
    b.key('Escape'); expect(b.calls).toEqual(['panel', 'draw', 'profile']); expect(b.st.selected).toBeNull(); expect(b.st.group).toEqual([]);
  });
  it('Delete removes a group, or the one selected piece', () => {
    const g = rig({ chosen: [1, 2] });
    g.key('Delete'); expect(g.calls).toEqual(['deleteChosen']);
    const s = rig({ selected: 1 });
    s.key('Backspace'); expect(s.st.pieces.map((q: { src?: string }) => q.src)).toEqual(['b']); expect(s.st.selected).toBeNull(); expect(s.calls).toEqual(['changed']);
  });
  it('F fits, but not with Ctrl or Alt', () => {
    const r = rig();
    r.key('KeyF'); r.key('KeyF', { ctrlKey: true }); r.key('KeyF', { altKey: true });
    expect(r.calls).toEqual(['fit']);
  });
  it('T goes to the Course with a handoff, else leaves, and falls through with no piece', () => {
    const a = rig({ handoff: true }); a.key('KeyT'); expect(a.calls).toEqual(['course']);
    const b = rig(); b.key('KeyT'); expect(b.calls).toEqual(['leave']);
  });
  it('D copies the selected piece beside itself and selects the copy', () => {
    const r = rig({ selected: 1 });
    r.key('KeyD');
    expect(r.st.pieces).toHaveLength(3);
    const q = r.st.pieces[2] as { id: number; src: string };
    expect(q.src).toBe('a'); expect(r.st.selected).toBe(q.id); expect(r.calls).toEqual(['changed']);
    const none = rig(); none.key('KeyD'); expect(none.calls).toEqual([]);
  });
});
