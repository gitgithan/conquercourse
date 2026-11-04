import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { fieldsOk } from '../src/course/schema';
import { searchIdealRun } from '../src/sim/ideal';
import { inputOfMask, verifyLog, type InputLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';
import { readGlbMesh } from '../src/slice/glb';
import { roleCollider } from '../src/slice/role-collider';

// The monkey-bars course made from the Saienji CC0 photo lift (CC-133): the photo is the skin, the collider is the measured row.
const course = JSON.parse(readFileSync('public/assets/demo/bars-lift.course.json', 'utf8')) as CourseData;
const run = JSON.parse(readFileSync('public/assets/demo/bars-lift.run.json', 'utf8')) as { log: InputLog; ticks: number };

describe('the monkey bars made from a photo lift', () => {
  it('passes the course schema, and the skin is a scene item that carries no physics', () => {
    expect(fieldsOk(course as unknown as Record<string, unknown>)).toBe(true);
    expect(course.scene?.[0].id).toBe('bars-skin');
  });
  it('the collider row is what the role-first clean-up measures from the GLB (so the file and the course cannot drift apart)', () => {
    const b = readFileSync('public/assets/objects/monkey-bars-saienji-cc0.glb');
    const m = roleCollider(readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), 'bar', { knownHeight: 2.2 }).bars!;
    expect(course.bars![0]).toEqual({ x: 12, y: m.height, n: m.rungs, gap: m.gap });
  });
  it('law: the rungs are evenly spaced, 0.3 to 1.0 m apart, at a height the hands can swing from', () => {
    const r = course.bars![0];
    expect(r.gap).toBeGreaterThanOrEqual(0.3); expect(r.gap).toBeLessThanOrEqual(1.0);
    expect(r.y).toBeGreaterThanOrEqual(1.8); expect(r.y).toBeLessThanOrEqual(4.5);
    expect(r.n).toBeGreaterThanOrEqual(6);
  });
  it('the recorded keys grab the rungs in sequence and clear the bars, in the ticks they were recorded with', () => {
    const v = verifyLog(course, run.log);
    expect(v.cleared).toBe(true);
    expect(v.ticks).toBe(run.ticks);
    let w = newWorld(course);
    const rungs: number[] = [], hands: number[] = [];
    for (const [mask, n] of run.log) for (let k = 0; k < n; k++) {
      w = stepWorld(w, inputOfMask(mask), course);
      for (const e of w.events) if (e.type === 'bars-reach') { rungs.push(e.detail!.rung as number); hands.push(e.detail!.hand as number); }
    }
    const steps = course.bars![0].n - 1;
    expect(rungs.length).toBe(steps + 1); // one reach per rung (the hands leapfrog); the last closes the back hand on the last rung
    hands.forEach((h, i) => expect(h).toBe(i % 2 === 0 ? 1 : 2));
    expect(Math.max(...rungs)).toBe(steps);
  });
  it('the ideal-run search solves it too', () => { expect(searchIdealRun(course).cleared).toBe(true); });
  it('without the bars the same keys fall in the water', () => { expect(verifyLog({ ...course, bars: undefined }, run.log).cleared).toBe(false); });
});
