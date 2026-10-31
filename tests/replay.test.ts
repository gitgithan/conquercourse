import { describe, expect, it } from 'vitest';
import { playPlan } from '../src/sim/ideal';
import {
  REPLAY_VERSION, courseHash, decodeLog, encodeLog, gapSeconds, gapWords, makeChallengeParam, readChallengeParam, recordPlan, reachTick, trackFromPlan, verifyLog,
} from '../src/sim/replay';
import { loadCourseFile as load } from './helpers/course';

const byName = (name: string) => `public/assets/demo/${name}`;
const samples = ['lache.course.json', 'climb.course.json', 'drop.course.json', 'coaster.course.json', 'plank.course.json', 'stack.course.json'];

describe('recording keys and playing them again (CC-99)', () => {
  for (const s of samples) {
    it(`${s}: the recorded keys give the same run (same time, same place, same outcome)`, () => {
      const course = load(byName(s));
      const ref = playPlan(course, course.plan!, 120 * 120);
      const { recorder, world } = recordPlan(course, course.plan!, 120 * 120);
      expect(recorder.valid, 'a plan input that is not plain keys cannot be a shared run').toBe(true);
      const v = verifyLog(course, recorder.snapshot());
      expect(v.cleared).toBe(ref.world.outcome === 'cleared');
      expect(v.ticks).toBe(ref.world.runner.tick);
      expect(v.world.runner.x).toBeCloseTo(world.runner.x, 9);
      expect(v.world.runner.y).toBeCloseTo(world.runner.y, 9);
      expect(v.world.energy).toBeCloseTo(world.energy, 9);
    });
  }
  it('a cannon aim is not a plain key press, so that run is not recordable', () => {
    const course = load(byName('cannon.course.json'));
    expect(recordPlan(course, course.plan!, 120 * 120).recorder.valid).toBe(false);
  });
});

describe('the ghost track and the gap', () => {
  const course = load(byName('lache.course.json'));
  const track = trackFromPlan(course, course.plan!);
  it('the ghost track is the ideal run tick by tick and ends cleared', () => {
    expect(track.cleared).toBe(true);
    expect(track.ticks).toBe(playPlan(course, course.plan!, 120 * 120).world.runner.tick);
    expect(track.xs[0]).toBeCloseTo(course.startX, 6);
    expect(track.xs[track.ticks]).toBeGreaterThanOrEqual(course.finishX - 0.01);
  });
  it('reaching a place: the ghost reached x at the first tick it was there', () => {
    const t = reachTick(track, course.startX + 10)!;
    expect(track.xs[t]).toBeGreaterThanOrEqual(course.startX + 10);
    expect(track.maxX[t - 1]).toBeLessThan(course.startX + 10);
    expect(reachTick(track, course.finishX + 100)).toBeNull();
  });
  it('the clocks line up: a player exactly on the ghost has a gap of zero, one second behind is plus one second', () => {
    const t = Math.floor(track.ticks / 2);
    expect(gapSeconds(track, t, track.xs[t])).toBe(0);
    expect(gapSeconds(track, t + 120, track.xs[t])).toBeCloseTo(1, 6);
    expect(gapSeconds(track, t - 60, track.xs[t])).toBeCloseTo(-0.5, 6);
  });
  it('standing still where the ghost also stood still (hanging on a wall) is not a gap', () => {
    const xs = [0, 1, 2, 2, 2, 2, 3, 4], t = { xs: Float32Array.from(xs), ys: new Float32Array(xs.length), cleared: true, ticks: xs.length - 1, maxX: Float32Array.from(xs) };
    expect(gapSeconds(t, 4, 2)).toBe(0);
    expect(gapSeconds(t, 5, 2)).toBe(0);
    expect(gapSeconds(t, 9, 2)).toBeCloseTo(4 / 120, 9);
    expect(gapSeconds(t, 1, 2)).toBeCloseTo(-1 / 120, 9);
  });
  it('the gap in words never grades', () => {
    expect(gapWords(0.84)).toBe('Ghost is 0.8 s ahead');
    expect(gapWords(-0.31)).toBe('You are 0.3 s ahead');
    expect(gapWords(0.01)).toBe('Level with the ghost');
    expect(gapWords(0.5, 'Sam')).toBe('Sam is 0.5 s ahead');
  });
});

describe('a run as a link', () => {
  const course = load(byName('lache.course.json'));
  const { recorder } = recordPlan(course, course.plan!, 120 * 120);
  const log = recorder.snapshot();
  it('text round trip gives the same keys, and is short', async () => {
    const s = await encodeLog(log);
    expect(await decodeLog(s)).toEqual(log);
    expect(s.length).toBeLessThan(2000);
  });
  it('a challenge parameter round trips with a cleaned nickname and no personal data (CC-108: up to 12 characters, case kept)', async () => {
    const p = await makeChallengeParam(course, log, 'sam!!x');
    expect(p.startsWith(`${REPLAY_VERSION}.${courseHash(course)}.samx.`)).toBe(true);
    const r = await readChallengeParam(p);
    expect(r.ok && r.challenge.nick).toBe('samx');
    expect(r.ok && r.challenge.log).toEqual(log);
  });
  it('the time comes from playing the keys, so a link cannot claim a time', async () => {
    const r = await readChallengeParam(await makeChallengeParam(course, log));
    if (!r.ok) throw new Error('unreadable');
    const v = verifyLog(course, r.challenge.log);
    expect(v.cleared).toBe(true);
    expect(v.ticks).toBe(playPlan(course, course.plan!, 120 * 120).world.runner.tick);
  });
  it('a tampered run is rejected or does not clear', async () => {
    expect(await readChallengeParam('1.abc.SAM.d!!!')).toEqual({ ok: false, why: 'broken' });
    expect(await readChallengeParam('1.abc.SAM')).toEqual({ ok: false, why: 'broken' });
    expect(await readChallengeParam('9.abc.SAM.rAQE')).toEqual({ ok: false, why: 'version' });
    await expect(decodeLog('rAAAA')).rejects.toThrow(); // a zero-length stretch of ticks
    const half = log.slice(0, Math.floor(log.length / 2)); // a run cut short does not reach the end
    expect(verifyLog(course, half).cleared).toBe(false);
    const noJump = log.map(([m, n]) => [m & ~4, n] as [number, number]); // the jumps taken out
    expect(verifyLog(course, noJump).cleared).toBe(false);
  });
  it('a run longer than three minutes is cut off', () => {
    const v = verifyLog(course, [[0, 120 * 400]]);
    expect(v.ticks).toBeLessThanOrEqual(120 * 180);
    expect(v.cleared).toBe(false);
  });
  it('a changed course has a different hash, a re-planned one does not', () => {
    const edited = { ...course, finishX: course.finishX + 1 };
    expect(courseHash(edited)).not.toBe(courseHash(course));
    expect(courseHash({ ...course, plan: undefined })).toBe(courseHash(course));
  });
});
