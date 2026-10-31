import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';
import { makeChallengeParam, recordPlan, verifyLog, type InputLog } from '../src/sim/replay';
import { challengeWords, openChallenge, shareOn } from '../src/share/challenge';
import { expandedAddress } from './helpers/share-address';
import { CLIP_FPS, MAX_CLIP_FRAMES, TAIL_FRAMES, TICKS_PER_FRAME, clipFits, clipFrames } from '../src/share/clip';
import { loadDemo as load } from './helpers/course';

const samples = ['lache.course.json', 'climb.course.json', 'drop.course.json', 'training.course.json'];
const ORIGIN = 'https://conquercourse.pages.dev';

function logOf(course: CourseData): InputLog {
  const { recorder } = recordPlan(course, course.plan!, 120 * 120);
  expect(recorder.valid).toBe(true);
  return recorder.snapshot();
}
const paramOf = (url: string) => new URL(url).searchParams.get('challenge')!;

describe('the challenge link (CC-128)', () => {
  for (const s of samples) {
    it(`${s}: a link round trips and opens as the same run, with the time from the simulator`, async () => {
      const course = load(s), log = logOf(course);
      const url = await expandedAddress(ORIGIN, `?course=/assets/demo/${s}`, course, log);
      expect(url).not.toBeNull();
      const opened = await openChallenge(course, paramOf(url!));
      if (!opened.ok) throw new Error(opened.why);
      expect(opened.log).toEqual(log);
      expect(opened.ticks).toBe(playPlan(course, course.plan!, 120 * 120).world.runner.tick);
      expect(opened.track.ticks).toBe(opened.ticks);
    });
  }
  it('the same keys give the same time and the same ghost every time', async () => {
    const course = load('lache.course.json'), p = await makeChallengeParam(course, logOf(course));
    const a = await openChallenge(course, p), b = await openChallenge(course, p);
    if (!a.ok || !b.ok) throw new Error('unreadable');
    expect(a.ticks).toBe(b.ticks);
    expect(Array.from(a.track.xs)).toEqual(Array.from(b.track.xs));
  });
  it('the link keeps the course and the seed only: no name, no time, no account', async () => {
    const course = load('lache.course.json');
    const url = await expandedAddress(ORIGIN, '?course=/assets/demo/lache.course.json&seed=7&name=Sam&time=3&tour=1&welcome=0', course, logOf(course));
    const q = new URL(url!).searchParams;
    expect([...q.keys()].sort()).toEqual(['challenge', 'course', 'seed']);
    expect(q.get('challenge')).toMatch(/^1\.[a-z0-9]+\.\.[dr][A-Za-z0-9_-]+$/); // version, course, empty nickname, keys
  });
  it('a run that does not clear is not given a link', async () => {
    const course = load('lache.course.json'), log = logOf(course);
    expect(await expandedAddress(ORIGIN, '', course, log.slice(0, Math.floor(log.length / 2)))).toBeNull();
  });
  it('a tampered, cut short or damaged link is refused, each with its own plain words', async () => {
    const course = load('lache.course.json'), log = logOf(course);
    const p = await makeChallengeParam(course, log);
    const bad = async (param: string) => { const r = await openChallenge(course, param); return r.ok ? 'ok' : r.why; };
    expect(await bad(p.slice(0, p.length - 6))).toMatch(/broken|not-cleared/);
    expect(await bad(`${p}!!`)).toBe('broken');
    expect(await bad(await makeChallengeParam(course, log.slice(0, Math.floor(log.length / 2))))).toBe('not-cleared');
    expect(await bad(await makeChallengeParam(course, log.map(([m, n]) => [m & ~4, n] as [number, number])))).toBe('not-cleared'); // the jumps taken out
    expect(await bad(p.replace(/^1\./, '9.'))).toBe('version');
    const other = load('climb.course.json');
    expect(await bad(p), 'the same link on a different course').toBe('ok');
    const r = await openChallenge(other, p);
    expect(r.ok ? 'ok' : r.why).toBe('changed');
    for (const why of ['version', 'changed', 'broken', 'not-cleared'] as const) expect(challengeWords(why).length).toBeGreaterThan(20);
  });
  it('a log too long for a link is not given one', async () => {
    const course = load('lache.course.json');
    const noisy: InputLog = [];
    for (let i = 0; i < 2000; i++) noisy.push([i % 2 ? 1 : 3, 1 + (i % 5)]);
    expect(await expandedAddress(ORIGIN, '', course, noisy)).toBeNull(); // does not clear, and is long
    expect(verifyLog(course, noisy).cleared).toBe(false);
  });
  it('the switch: on by default, off with ?share=0', () => {
    expect(shareOn(new URLSearchParams(''))).toBe(true);
    expect(shareOn(new URLSearchParams('share=0'))).toBe(false);
    expect(shareOn(new URLSearchParams(''), false)).toBe(false);
  });
});

describe('the clip is on a stepped clock (CC-129)', () => {
  it('a picture for every four ticks, then a held tail; the same run always makes the same number of pictures', () => {
    expect(TICKS_PER_FRAME * CLIP_FPS).toBe(120);
    expect(clipFrames(1200)).toBe(300 + TAIL_FRAMES);
    expect(clipFrames(1201)).toBe(301 + TAIL_FRAMES);
    for (const s of samples) {
      const course = load(s), ticks = playPlan(course, course.plan!, 120 * 120).world.runner.tick;
      expect(clipFrames(ticks)).toBe(clipFrames(ticks));
      expect(clipFrames(ticks)).toBe(Math.ceil(ticks / 4) + TAIL_FRAMES);
    }
  });
  it('a run longer than about 20 seconds is not offered a clip', () => {
    expect(clipFits(120 * 18)).toBe(true);
    expect(clipFits(120 * 21)).toBe(false);
    expect(MAX_CLIP_FRAMES).toBe(CLIP_FPS * 20 + TAIL_FRAMES);
  });
});
