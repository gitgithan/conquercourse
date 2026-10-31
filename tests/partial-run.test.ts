import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { newWorld, stepWorld } from '../src/sim/world';
import { searchIdealRun } from '../src/sim/ideal';
import { openChallenge, makeChallengeUrl } from '../src/share/challenge';
import { recordPlan, inputOfMask, makeChallengeParam, readChallengeParam, startOfX, startXOf, verifyLog } from '../src/sim/replay';
import type { CourseData } from '../src/course/course';

// CC-242: a run that began at a checkpoint is shared with its start; both bodies start standing at the same x and stay on top of each other.
const course = JSON.parse(readFileSync('src/course/default-course.json', 'utf8')) as CourseData;
const cp = (course.checkpoints ?? [])[1].x;

describe('shared partial runs', () => {
  it('names the start by checkpoint and reads it back', async () => {
    expect(startOfX(course, course.startX)).toBe(0);
    expect(startOfX(course, cp)).toBe(2);
    expect(startOfX(course, cp + 3)).toBeNull();
    expect(startXOf(course, 2)).toBe(cp);
    const log: [number, number][] = [[0, 10]];
    const p = await makeChallengeParam(course, log, 'ann', 'fell', 2);
    expect(p.split('.')[0]).toBe('1fs2');
    const r = await readChallengeParam(p);
    expect(r.ok && r.challenge.start).toBe(2);
    const full = await readChallengeParam(await makeChallengeParam(course, log, 'ann', 'done'));
    expect(full.ok && full.challenge.start).toBe(0);
  });

  it('a friend and a ghost started together on the same keys are at the same place every tick', () => {
    const keys: [number, number][] = [[0, 30], [1, 240], [0, 60]];
    const a = verifyLog(course, keys, 5000, cp), b = verifyLog(course, keys, 5000, cp);
    expect(a.track.xs.length).toBe(b.track.xs.length);
    expect(a.track.xs[0]).toBeCloseTo(cp, 6);
    for (let i = 0; i < a.track.xs.length; i++) { expect(a.track.xs[i]).toBe(b.track.xs[i]); expect(a.track.ys[i]).toBe(b.track.ys[i]); }
    // a world stepped by hand from that checkpoint agrees with the replay
    let w = newWorld(course, cp);
    for (const [m, n] of keys) for (let k = 0; k < n && w.outcome === 'running'; k++) w = stepWorld(w, inputOfMask(m), course);
    expect(w.runner.x).toBe(a.world.runner.x);
  });

  it('the same keys from the course start are not the same run', () => {
    const keys: [number, number][] = [[1, 200]];
    expect(verifyLog(course, keys, 5000, cp).track.xs[0]).not.toBe(verifyLog(course, keys).track.xs[0]);
  });

  it('a cleared run from a checkpoint opens as a shared run from there, and never counts as a full clear for the board', async () => {
    const from = { ...course, startX: cp } as CourseData;
    const plan = searchIdealRun(from).plan;
    const log = recordPlan(from, plan).recorder.snapshot();
    expect(verifyLog(course, log, 20000, cp).cleared).toBe(true);
    const url = await makeChallengeUrl('https://x.test', '', course, log, 'ann', 'a', 'done', 2);
    expect(url).not.toBeNull();
    const param = new URL(url!).searchParams.get('challenge')!;
    const o = await openChallenge(course, param);
    expect(o.ok && o.start).toBe(2);
    // the board (functions/api/course-clear.ts) replays every run from the course start with verifyLog: these keys do not clear there
    expect(verifyLog(course, log, 20000).cleared).toBe(false);
    // a link that says it began at the course start is refused: the keys do not finish from there
    const lie = await openChallenge(course, param.replace(/^1s2/, '1'));
    expect(lie.ok).toBe(false);
  });
});
