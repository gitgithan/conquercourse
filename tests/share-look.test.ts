import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { recordPlan } from '../src/sim/replay';
import { makeChallengeUrl, openChallenge } from '../src/share/challenge';
import { lookOfParam } from '../src/ui/ghost-look';

const course = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const ORIGIN = 'https://conquercourse.pages.dev', SEARCH = '?course=/assets/demo/lache.course.json';

describe('the ghost look in a challenge link (CC-167)', () => {
  it('the first Rookie adds no bytes, so old links and new links are the same', async () => {
    const plain = await makeChallengeUrl(ORIGIN, SEARCH, course, log), a = await makeChallengeUrl(ORIGIN, SEARCH, course, log, '', 'a');
    expect(a).toBe(plain);
    expect(lookOfParam(new URL(plain!).searchParams.get('rk'))).toBe('a');
  });
  it('the second Rookie adds exactly "&rk=b" (5 characters) and the link still opens', async () => {
    const plain = (await makeChallengeUrl(ORIGIN, SEARCH, course, log))!, b = (await makeChallengeUrl(ORIGIN, SEARCH, course, log, '', 'b'))!;
    expect(b.length - plain.length).toBe(5);
    expect(lookOfParam(new URL(b).searchParams.get('rk'))).toBe('b');
    const o = await openChallenge(course, new URL(b).searchParams.get('challenge')!);
    expect(o.ok).toBe(true);
  });
  it('anything else in the address means the first Rookie', () => {
    for (const v of [null, '', 'a', 'x', 'custom']) expect(lookOfParam(v)).toBe('a');
  });
});
