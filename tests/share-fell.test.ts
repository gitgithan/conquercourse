// CC-181: a link can carry a try that ended in a fall. It plays as a ghost that falls where the player fell, and it can never claim a finish.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { makeChallengeParam, readChallengeParam, recordPlan, verifyLog, type InputLog } from '../src/sim/replay';
import { MAX_PARAM_CHARS, makeChallengeUrl, openChallenge } from '../src/share/challenge';

const course = JSON.parse(readFileSync('public/assets/demo/bench-and-stairs.course.json', 'utf8')) as CourseData;
const done = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const fell: InputLog = [[1, 3000]]; // only run: it runs off the first edge and splashes
const ORIGIN = 'https://conquercourse.pages.dev';
const SEARCH = '?course=/assets/demo/bench-and-stairs.course.json';
const param = (u: string) => new URL(u).searchParams.get('challenge')!;

describe('a link for a try that fell (CC-181)', () => {
  it('the test try really falls and the plan really clears', () => {
    const v = verifyLog(course, fell);
    expect(v.cleared).toBe(false);
    expect(v.world.outcome).not.toBe('running');
    expect(verifyLog(course, done).cleared).toBe(true);
  });
  it('round trips: the ghost ends where the player fell, and it is marked as not finished', async () => {
    const url = await makeChallengeUrl(ORIGIN, SEARCH, course, fell, 'amy', 'a', 'fell');
    expect(url).not.toBeNull();
    expect(url!.length).toBeLessThanOrEqual(MAX_PARAM_CHARS);
    const o = await openChallenge(course, param(url!));
    expect(o.ok).toBe(true);
    if (!o.ok) return;
    expect(o.kind).toBe('fell');
    expect(o.nick).toBe('AMY');
    expect(o.track.cleared).toBe(false);
    expect(o.track.ticks).toBe(verifyLog(course, fell).ticks);
  });
  it('finished links still verify and are marked done', async () => {
    const o = await openChallenge(course, param((await makeChallengeUrl(ORIGIN, SEARCH, course, done))!));
    expect(o.ok && o.kind).toBe('done');
  });
  it('makes no fell link for keys that finish, and no finished link for keys that fall', async () => {
    expect(await makeChallengeUrl(ORIGIN, SEARCH, course, done, '', 'a', 'fell')).toBeNull();
    expect(await makeChallengeUrl(ORIGIN, SEARCH, course, fell)).toBeNull();
  });
  it('refuses a fell link whose keys actually finish (a finish cannot be claimed or hidden this way)', async () => {
    const o = await openChallenge(course, await makeChallengeParam(course, done, '', 'fell'));
    expect(o).toEqual({ ok: false, why: 'broken' });
  });
  it('refuses a fell link whose keys stop before any fall', async () => {
    const o = await openChallenge(course, await makeChallengeParam(course, [[1, 20]], '', 'fell'));
    expect(o).toEqual({ ok: false, why: 'broken' });
  });
  it('refuses a fell try passed off as a finished run', async () => {
    const o = await openChallenge(course, await makeChallengeParam(course, fell, '', 'done'));
    expect(o).toEqual({ ok: false, why: 'not-cleared' });
  });
  it('refuses tampered links: wrong marker, changed course, damaged keys, extra parts', async () => {
    const p = await makeChallengeParam(course, fell, '', 'fell');
    expect(p.startsWith('1f.')).toBe(true);
    for (const bad of [p.replace(/^1f/, '1x'), p.replace(/^1f/, '2f'), p.replace(/^1f/, 'f'), p + '.x', p.replace(/\.[^.]*$/, '.rAAAA'), p.replace(/^1f\.[a-z0-9]+/, '1f.zzzz')]) {
      const o = await openChallenge(course, bad);
      expect(o.ok, bad).toBe(false);
    }
    expect((await readChallengeParam(p)).ok).toBe(true);
  });
  it('an older build, which reads the version as a plain number, would not accept 1f', () => {
    expect(Number('1f')).toBeNaN();
  });
});
