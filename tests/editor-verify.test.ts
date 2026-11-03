import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVerify } from '../src/modes/editor/verify';
import { createEditorState } from '../src/modes/editor/state';

// Pins the lane check moved out of editor.ts (CC-133): an empty lane gets its verdict after the pause, and an edit cancels the older check.
describe('editor lane check', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('says nothing is in the lane after the pause, and bumps the version on interrupt', async () => {
    vi.useFakeTimers();
    const g = globalThis as unknown as { window?: unknown; document?: unknown };
    const dataset: Record<string, string> = {};
    g.window = { setTimeout: (f: () => void, ms: number) => setTimeout(f, ms) };
    g.document = { documentElement: { dataset } };
    const ed = createEditorState();
    const reset = vi.fn(), stop = vi.fn();
    const v = createVerify({
      ed, lanePanel: { querySelector: () => null } as unknown as HTMLElement, laneCheck: () => ({ reset } as never),
      searchClearable: async () => null, stopSearch: stop, currentProfile: () => [] as never, laneCourse: (() => ({})) as never,
      coursePieces: () => [], machineNow: () => null as never, trebuchetPivot: (() => null) as never, machineWrap: (() => null) as never, barsNow: () => [],
      adviceBox: { textContent: '' } as HTMLDivElement, setSuggest: () => {}, showAdvice: () => {},
    });
    const before = v.verifyVersion();
    v.verify(100);
    expect(v.verifyVersion()).toBe(before + 1);
    await vi.advanceTimersByTimeAsync(150);
    expect(ed.verdict).toBe('Nothing is in the lane: move the lane or the pieces.');
    expect(stop).toHaveBeenCalled();
    expect(dataset.verdict).toBe(ed.verdict);
    v.interruptSearch();
    expect(v.verifyVersion()).toBe(before + 2);
  });
});
