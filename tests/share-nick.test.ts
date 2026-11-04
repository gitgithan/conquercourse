import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { recordPlan } from '../src/sim/replay';
import { makeChallengeParam } from '../src/sim/replay';
import { openChallenge } from '../src/share/challenge';
import { expandedAddress } from './helpers/share-address';
import { nickOk, shownNick } from '../src/share/nick';

const course = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const ORIGIN = 'https://conquercourse.pages.dev';
const param = (u: string) => new URL(u).searchParams.get('challenge')!;

describe('the nickname in a challenge link (CC-134)', () => {
  it('is empty by default and the link carries no nickname', async () => {
    const url = await expandedAddress(ORIGIN, '?course=/assets/demo/lache.course.json', course, log);
    const o = await openChallenge(course, param(url!));
    expect(o.ok && o.nick).toBe('');
  });
  it('round trips a name with letters, digits and symbols, in the case it was typed', async () => {
    const url = await expandedAddress(ORIGIN, '?course=/assets/demo/lache.course.json', course, log, 'Ni.a/Amy-9%');
    const o = await openChallenge(course, param(url!));
    expect(o.ok && o.nick).toBe('Ni.a/Amy-9%');
  });
  it('cuts to sixteen and drops spaces, keeps symbols', () => {
    expect(shownNick(' a-m y!z ')).toBe('a-my!z');
    expect(shownNick('abcdefghijklmnopqrst')).toBe('abcdefghijklmnop');
  });
  it('refuses a blocked word, also with digits for letters', () => {
    for (const bad of ['ass', 'ASS', 'a55', 'f4g', 'S3X', 'fuk']) expect(nickOk(bad), bad).toBe(false);
    for (const bad of ['Big_Fuck', 'xXs h1tXx'.replace(' ', ''), 'N4zi_Kid', 'p0rn-star']) expect(nickOk(bad), bad).toBe(false);
    for (const good of ['', 'amy', 'bo', 'K9', 'jan', 'x7', 'Classy', 'Ninja_Amy', 'Hancock']) expect(nickOk(good), good).toBe(true);
  });
  it('makes no link for a blocked nickname', async () => {
    expect(await expandedAddress(ORIGIN, '', course, log, 'ass')).toBeNull();
  });
  it('shows nothing for a blocked nickname in a link someone else made, but still plays the run', async () => {
    const hand = await makeChallengeParam(course, log, 'ASS');
    const o = await openChallenge(course, hand);
    expect(o.ok).toBe(true);
    expect(o.ok && o.nick).toBe('');
  });
});
