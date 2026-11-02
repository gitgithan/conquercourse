import { describe, expect, it, vi } from 'vitest';
import { createKeydown, type KeydownCtx } from '../src/modes/course/keydown';
import { createCourseState, type CourseState } from '../src/modes/course/state';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';

const mk = (over: Partial<KeydownCtx> = {}, stOver: Partial<CourseState> = {}) => {
  const calls: string[] = [];
  const st = { ...createCourseState({ world: { runner: { x: 3 } } as never, paused: false, retryX: 9, falls: 0, frontOverride: null }), ...stOver };
  const c = {
    st, typing: () => false, course: base as unknown as CourseData,
    restart: (x?: number) => { calls.push(`restart:${x}`); },
    botMode: false, VIEW_KEYS: ['KeyC', 'KeyF', 'KeyG'],
    stopWholeIdeal: () => calls.push('stopWhole'), showWholeIdeal: () => calls.push('whole'), showIdeal: (z: string) => calls.push(`ideal:${z}`),
    zoneAt: () => undefined, openDojo: () => calls.push('dojo'), clearGuides: () => calls.push('clear'), showAgain: () => calls.push('again'),
    nextCam: () => calls.push('cam'), drumLane: { toggle: () => calls.push('drums') },
    toggleDebug: () => calls.push('debug'), ghostCtl: { cycle: () => calls.push('ghost') },
    paintKeys: (o: boolean) => calls.push(`paint:${o}`),
    ...over,
  } as KeydownCtx;
  const press = (code: string, extra: Partial<KeyboardEvent> = {}) => { const e = { code, repeat: false, shiftKey: false, preventDefault: vi.fn(), target: null, ...extra } as unknown as KeyboardEvent; createKeydown(c)(e); return e; };
  return { c, st, calls, press };
};

describe('course keydown handler (CC-133 slice 1)', () => {
  it('Space, Up and W queue a jump and stop the page scrolling', () => {
    for (const k of ['Space', 'ArrowUp', 'KeyW']) { const { st, press } = mk(); expect(press(k).preventDefault).toHaveBeenCalled(); expect(st.jumpQueued, k).toBe(true); }
  });
  it('V, X, Down/S and K queue vault, roll, slide and fire', () => {
    const { st, press } = mk();
    press('KeyV'); press('KeyX'); press('KeyS'); press('KeyK');
    expect([st.vaultQueued, st.rollQueued, st.slideQueued, st.fireQueued]).toEqual([true, true, true, true]);
    const d = mk(); d.press('ArrowDown'); expect(d.st.slideQueued).toBe(true);
  });
  it('a held key (repeat) does nothing; a first key wakes a paused game', () => {
    const { st, press } = mk({}, { paused: true });
    press('Space', { repeat: true });
    expect(st.paused).toBe(true); expect(st.jumpQueued).toBe(false); expect(st.keys.size).toBe(0);
    const p = mk({}, { paused: true }); p.press('ArrowRight'); expect(p.st.paused).toBe(false); expect(p.st.last).toBeGreaterThan(0); expect(p.st.keys.has('ArrowRight')).toBe(true);
  });
  it('typing in a box clears the keys and queues and ignores the key', () => {
    const { st, press } = mk({ typing: () => true });
    st.keys.add('ArrowLeft'); st.jumpQueued = true;
    press('KeyT');
    expect(st.keys.size).toBe(0); expect(st.jumpQueued).toBe(false);
  });
  it('R restarts at the retry point, Shift+R from the very start', () => {
    const a = mk(); a.press('KeyR'); expect(a.calls).toEqual(['restart:undefined']);
    const b = mk(); b.press('KeyR', { shiftKey: true }); expect(b.calls).toEqual([`restart:${(base as unknown as CourseData).startX}`]); expect(b.st.retryX).toBe((base as unknown as CourseData).startX);
  });
  it('I shows the ideal run of the zone, Shift+I the whole course; T opens the Dojo', () => {
    const a = mk(); a.press('KeyI'); expect(a.calls).toEqual(['ideal:gap']);
    const b = mk({ zoneAt: () => ({ id: 'wall' }) }); b.press('KeyI'); expect(b.calls).toEqual(['ideal:wall']);
    const c = mk(); c.press('KeyI', { shiftKey: true }); expect(c.calls).toEqual(['whole']);
    const d = mk(); d.press('KeyT'); expect(d.calls).toEqual(['dojo']);
  });
  it('a move key stops the whole-course ideal run; view keys and I do not', () => {
    const a = mk({}, { idealWhole: true }); a.press('ArrowRight'); expect(a.calls).toEqual(['stopWhole']);
    for (const k of ['KeyC', 'KeyF', 'KeyG', 'KeyI', 'ShiftLeft']) { const m = mk({}, { idealWhole: true }); m.press(k); expect(m.calls, k).not.toContain('stopWhole'); }
    const bot = mk({ botMode: true }, { idealWhole: true }); bot.press('ArrowRight'); expect(bot.calls).toEqual([]);
  });
  it('Escape leaves a replay; C, G, B, N, F, H do their one thing', () => {
    const a = mk({}, { replay: { i: 0, from: 0, to: 1 } }); a.press('Escape'); expect(a.calls).toEqual(['clear', 'again']); expect(a.st.replay).toBeNull();
    const n = mk(); n.press('Escape'); expect(n.calls).toEqual([]);
    const m = mk(); m.press('KeyC'); m.press('KeyG'); m.press('KeyB'); m.press('KeyN'); expect(m.calls).toEqual(['cam', 'drums', 'debug', 'ghost']);
    const f = mk(); expect(f.press('KeyF').preventDefault).toHaveBeenCalled(); expect(f.st.frontOverride).toBe(false); f.press('KeyF'); expect(f.st.frontOverride).toBe(true);
    const h = mk(); h.press('KeyH'); expect([h.st.keysTouched, h.st.keysOpen, h.calls]).toEqual([true, false, ['paint:false']]);
  });
});
