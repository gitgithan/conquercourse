import { describe, expect, it, vi } from 'vitest';
import { createKeydown, type KeydownCtx } from '../src/modes/course/keydown';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';

const mk = (over: Partial<KeydownCtx> = {}) => {
  const calls: string[] = [];
  const c = {
    typing: () => false, keys: new Set<string>(),
    jumpQueued: false, vaultQueued: false, rollQueued: false, slideQueued: false, fireQueued: false,
    paused: false, last: 0, course: base as unknown as CourseData, world: { runner: { x: 3 } } as never,
    retryX: 9, restart: (x?: number) => { calls.push(`restart:${x}`); },
    idealWhole: false, botMode: false, VIEW_KEYS: ['KeyC', 'KeyF', 'KeyG'],
    stopWholeIdeal: () => calls.push('stopWhole'), showWholeIdeal: () => calls.push('whole'), showIdeal: (z: string) => calls.push(`ideal:${z}`),
    zoneAt: () => undefined, openDojo: () => calls.push('dojo'), replay: null as unknown, clearGuides: () => calls.push('clear'), showAgain: () => calls.push('again'),
    nextCam: () => calls.push('cam'), drumLane: { toggle: () => calls.push('drums') }, frontOverride: null as boolean | null,
    toggleDebug: () => calls.push('debug'), ghostCtl: { cycle: () => calls.push('ghost') },
    keysTouched: false, keysOpen: true, paintKeys: (o: boolean) => calls.push(`paint:${o}`),
    ...over,
  } as KeydownCtx;
  const press = (code: string, extra: Partial<KeyboardEvent> = {}) => { const e = { code, repeat: false, shiftKey: false, preventDefault: vi.fn(), target: null, ...extra } as unknown as KeyboardEvent; createKeydown(c)(e); return e; };
  return { c, calls, press };
};

describe('course keydown handler (CC-133 slice 1)', () => {
  it('Space, Up and W queue a jump and stop the page scrolling', () => {
    for (const k of ['Space', 'ArrowUp', 'KeyW']) { const { c, press } = mk(); expect(press(k).preventDefault).toHaveBeenCalled(); expect(c.jumpQueued, k).toBe(true); }
  });
  it('V, X, Down/S and K queue vault, roll, slide and fire', () => {
    const { c, press } = mk();
    press('KeyV'); press('KeyX'); press('KeyS'); press('KeyK');
    expect([c.vaultQueued, c.rollQueued, c.slideQueued, c.fireQueued]).toEqual([true, true, true, true]);
    const d = mk(); d.press('ArrowDown'); expect(d.c.slideQueued).toBe(true);
  });
  it('a held key (repeat) does nothing; a first key wakes a paused game', () => {
    const { c, press } = mk({ paused: true });
    press('Space', { repeat: true });
    expect(c.paused).toBe(true); expect(c.jumpQueued).toBe(false); expect(c.keys.size).toBe(0);
    const p = mk({ paused: true }); p.press('ArrowRight'); expect(p.c.paused).toBe(false); expect(p.c.last).toBeGreaterThan(0); expect(p.c.keys.has('ArrowRight')).toBe(true);
  });
  it('typing in a box clears the keys and queues and ignores the key', () => {
    const { c, press } = mk({ typing: () => true });
    c.keys.add('ArrowLeft'); c.jumpQueued = true;
    press('KeyT');
    expect(c.keys.size).toBe(0); expect(c.jumpQueued).toBe(false);
  });
  it('R restarts at the retry point, Shift+R from the very start', () => {
    const a = mk(); a.press('KeyR'); expect(a.calls).toEqual(['restart:undefined']);
    const b = mk(); b.press('KeyR', { shiftKey: true }); expect(b.calls).toEqual([`restart:${(base as unknown as CourseData).startX}`]); expect(b.c.retryX).toBe((base as unknown as CourseData).startX);
  });
  it('I shows the ideal run of the zone, Shift+I the whole course; T opens the Dojo', () => {
    const a = mk(); a.press('KeyI'); expect(a.calls).toEqual(['ideal:gap']);
    const b = mk({ zoneAt: () => ({ id: 'wall' }) }); b.press('KeyI'); expect(b.calls).toEqual(['ideal:wall']);
    const c = mk(); c.press('KeyI', { shiftKey: true }); expect(c.calls).toEqual(['whole']);
    const d = mk(); d.press('KeyT'); expect(d.calls).toEqual(['dojo']);
  });
  it('a move key stops the whole-course ideal run; view keys and I do not', () => {
    const a = mk({ idealWhole: true }); a.press('ArrowRight'); expect(a.calls).toEqual(['stopWhole']);
    for (const k of ['KeyC', 'KeyF', 'KeyG', 'KeyI', 'ShiftLeft']) { const m = mk({ idealWhole: true }); m.press(k); expect(m.calls, k).not.toContain('stopWhole'); }
    const bot = mk({ idealWhole: true, botMode: true }); bot.press('ArrowRight'); expect(bot.calls).toEqual([]);
  });
  it('Escape leaves a replay; C, G, B, N, F, H do their one thing', () => {
    const a = mk({ replay: {} }); a.press('Escape'); expect(a.calls).toEqual(['clear', 'again']); expect(a.c.replay).toBeNull();
    const n = mk(); n.press('Escape'); expect(n.calls).toEqual([]);
    const m = mk(); m.press('KeyC'); m.press('KeyG'); m.press('KeyB'); m.press('KeyN'); expect(m.calls).toEqual(['cam', 'drums', 'debug', 'ghost']);
    const f = mk(); expect(f.press('KeyF').preventDefault).toHaveBeenCalled(); expect(f.c.frontOverride).toBe(false); f.press('KeyF'); expect(f.c.frontOverride).toBe(true);
    const h = mk(); h.press('KeyH'); expect([h.c.keysTouched, h.c.keysOpen, h.calls]).toEqual([true, false, ['paint:false']]);
  });
});
