import { describe, expect, it } from 'vitest';
import { clearQueued, createCourseState } from '../src/modes/course/state';

// The shared state of a Course session; no page is needed.
describe('course state', () => {
  const init = { world: { runner: { x: 0 } } as never, paused: false, retryX: 4, falls: 2, frontOverride: null };
  it('starts with the values the page hands in and nothing queued', () => {
    const st = createCourseState({ ...init, paused: true, frontOverride: false });
    expect([st.paused, st.retryX, st.falls, st.frontOverride]).toEqual([true, 4, 2, false]);
    expect([st.jumpQueued, st.vaultQueued, st.rollQueued, st.slideQueued, st.fireQueued]).toEqual([false, false, false, false, false]);
    expect([st.plan, st.demo, st.replay, st.idealWhole, st.idealNote]).toEqual([null, null, null, false, '']);
    expect([st.keysOpen, st.keysTouched]).toEqual([true, false]);
  });
  it('two states never share a key set', () => {
    const a = createCourseState(init), b = createCourseState(init);
    a.keys.add('KeyR');
    expect(b.keys.size).toBe(0);
  });
  it('clearQueued drops every waiting press and leaves the held keys alone', () => {
    const st = createCourseState(init);
    st.jumpQueued = st.vaultQueued = st.rollQueued = st.slideQueued = st.fireQueued = true; st.keys.add('ArrowRight');
    clearQueued(st);
    expect([st.jumpQueued, st.vaultQueued, st.rollQueued, st.slideQueued, st.fireQueued]).toEqual([false, false, false, false, false]);
    expect(st.keys.has('ArrowRight')).toBe(true);
  });
});
