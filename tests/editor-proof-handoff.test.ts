import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseData } from '../src/course/course';
import { createSearch } from '../src/modes/editor/search';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import type { PresetPlan } from '../src/slice/preset-plans';

const course: CourseData = { version: 1, name: 'proof handoff fixture', startX: 0, finishX: 12, jumpSpeed: 4.5, terrain: { waterY: -3, platforms: [{ x0: -10, x1: 20, top: 0 }] } };
class TestWorker {
  static all: TestWorker[] = [];
  request!: { id: number; course: CourseData };
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { TestWorker.all.push(this); }
  postMessage(request: typeof this.request) { this.request = request; }
  answer(result: object) { this.onmessage?.({ data: { id: this.request.id, ...result } }); }
}

describe('a preview proof handed to the editor and Play', () => {
  beforeEach(() => { TestWorker.all = []; vi.stubGlobal('Worker', TestWorker); vi.stubGlobal('document', { documentElement: { dataset: {} } }); });
  afterEach(() => vi.unstubAllGlobals());
  const services = () => {
    const results = new Map<string, PresetPlan>();
    return { results, preview: createSearch({ progress: () => {}, results, preview: true }), editor: createSearch({ progress: () => {}, results }) };
  };
  it('reuses the exact successful run after Apply, including its timing windows, without another worker', async () => {
    const { preview, editor } = services(), actual = searchIdealRun(course);
    expect(actual.cleared).toBe(true);
    const pending = preview.searchResult(course);
    TestWorker.all[0].answer(actual);
    const proof = await pending;
    const applied = { ...course, hazard: 'lava', source: { kind: 'editor', pieces: [], angle: 0, offset: 0, level: 0 } } as CourseData;
    expect(await editor.searchResult(applied)).toBe(proof);
    expect(TestWorker.all).toHaveLength(1);
    const playable = editor.withProof(applied);
    expect(playable.plan).toBe(proof!.plan);
    expect(playable.windows).toBe(proof!.windows);
    expect(playPlan(playable, playable.plan!).world.outcome).toBe('cleared');
    expect(document.documentElement.dataset.laneProof).toBe('cached');
  });
  it('accepts a winning candidate proof and reuses it through Preview and Play', async () => {
    const { preview, editor } = services(), actual = searchIdealRun(course);
    const timing = { obstacle: 'hang on bar 1', best: 10, lo: 9, hi: 11, widthMs: 170 };
    preview.rememberProof(course, { ...actual, windows: [...actual.windows, timing] });
    expect(preview.proofFor(course)?.timingWindows).toContainEqual(timing);
    expect(preview.proofFor(course)?.windows).not.toContainEqual(timing);
    expect(await preview.searchResult(course)).toBe(editor.proofFor(course));
    expect(playPlan(editor.withProof(course), actual.plan).world.outcome).toBe('cleared');
    expect(TestWorker.all).toHaveLength(0);
    expect(preview.rememberProof({ ...course, jumpSpeed: 6 }, { cleared: true })).toBeNull();
  });
  it('does not reuse a proof after a physics input or device setting changes', async () => {
    const { preview, editor } = services();
    const pending = preview.searchResult(course); TestWorker.all[0].answer({ cleared: false }); await pending;
    const changed = { ...course, jumpSpeed: 5 };
    expect(editor.proofFor(changed)).toBeNull();
    const another = editor.searchResult(changed);
    expect(TestWorker.all).toHaveLength(2);
    TestWorker.all[1].answer({ cleared: false }); await another;
    expect(editor.proofFor({ ...course, band: { x: 0, k: 70, rest: 1, snap: 22 } })).toBeNull();
  });
  it('shares a negative result without inventing a successful run', async () => {
    const { preview, editor } = services();
    const p = preview.searchResult(course); TestWorker.all[0].answer({ cleared: false }); await p;
    expect(await editor.searchClearable(course)).toBe(false);
    expect(editor.withProof(course).plan).toBeUndefined();
    expect(TestWorker.all).toHaveLength(1);
  });
  it('ignores a cancelled preview answer and never caches a positive answer without a plan', async () => {
    const { preview, editor } = services();
    const old = preview.searchResult(course), first = TestWorker.all[0]; preview.stopSearch();
    expect(await old).toBeNull();
    const fresh = preview.searchResult(course);
    first.answer({ cleared: false }); expect(editor.proofFor(course)).toBeNull();
    TestWorker.all[1].answer({ cleared: true });
    expect(await fresh).toBeNull(); expect(editor.proofFor(course)).toBeNull();
    expect(editor.withProof(course).plan).toBeUndefined();
  });
});
