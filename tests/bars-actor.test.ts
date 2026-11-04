import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { BarsPlayer, REACH_TICKS, type BarsView } from '../src/motion/bars-actor';
import { rigFromFrame } from '../src/motion/bars-pose';
import { actorStateFor } from '../src/motion/actor-state';
import { DEFAULT_HANG, handOffset } from '../src/sim/holds';
import { pivotOf } from '../src/sim/bars';
import { inputOfMask, type InputLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';
import { loadClip } from './helpers/clips';

// The hands of the actor land on the rungs of the recorded monkey-bars runs (docs/bars.md, CC-133). The rig is the run clip's own bones.
const clip = loadClip('run');
const rig = rigFromFrame(clip.names, clip.parents, clip.frames[13]);
const ix = (n: string) => rig.names.indexOf(n);
const FOOT_CLEAR = 0.05;

interface Sample { tick: number; left: number[]; right: number[]; rungL: number; rungR: number; y: number; x: number; yFeet: number; short: number; catching: boolean }

function record(name: string): Sample[] {
  const course = JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, 'utf8')) as CourseData;
  const run = JSON.parse(readFileSync(`public/assets/demo/${name}.run.json`, 'utf8')) as { log: InputLog };
  const player = new BarsPlayer(rig);
  const out: Sample[] = [];
  let w = newWorld(course);
  for (const [m, n] of run.log) for (let k = 0; k < n; k++) {
    w = stepWorld(w, inputOfMask(m), course);
    if (w.mode !== 'bars' || !w.bars) continue;
    const row = course.bars![w.bars.run];
    // the same placement as the Course: feet straight under the hands, eased onto the pivot after a catch
    const pv = pivotOf(row, w.bars), off = handOffset({ hold: 0, theta: 0, omega: 0, ox: w.bars.ox, oy: w.bars.oy, et: w.bars.et });
    const at = { x: pv.x + off.x, y: pv.y + off.y - DEFAULT_HANG.handHeight };
    const s = actorStateFor(w, false, 1, row);
    const view: BarsView = { ...s.bars!, theta: s.swingTheta ?? 0, omega: s.swingOmega ?? 0 };
    const p = player.pose(view, at, w.runner.tick, 1, FOOT_CLEAR);
    out.push({ tick: w.runner.tick, left: p.hands.left, right: p.hands.right, rungL: s.bars!.left, rungR: s.bars!.right, y: s.bars!.y, x: at.x, yFeet: at.y, short: p.reachShort, catching: w.bars.et > 0 });
  }
  return out;
}

describe.each(['bars', 'swing-to-bars'])('the actor on the recorded run %s', (name) => {
  const samples = record(name);
  it('has a run on the bars to look at', () => { expect(samples.length).toBeGreaterThan(200); });
  it('puts both hands on the rungs the world says they hold, once the reach has finished', () => {
    // the clip axes: z along the travel, x left; the rung is at the world x, so the hand must be there relative to the body's place
    let settled = 0;
    let lastChange = -1e9, held = '';
    for (const s of samples) {
      const key = `${s.rungL}/${s.rungR}`;
      if (key !== held) { held = key; lastChange = s.tick; }
      if (s.tick - lastChange < REACH_TICKS) continue;
      settled++;
      // the hands are a rung apart, so a swung body slants the arms and the shoulder pulls the hand a little in: within 16 cm, and the arms still reach (short below)
      expect(Math.abs(s.left[2] - (s.rungL - s.x))).toBeLessThan(0.16);
      expect(Math.abs(s.right[2] - (s.rungR - s.x))).toBeLessThan(0.16);
      expect(Math.abs(s.left[1] + FOOT_CLEAR + s.yFeet - s.y)).toBeLessThan(0.16);
      expect(Math.abs(s.right[1] + FOOT_CLEAR + s.yFeet - s.y)).toBeLessThan(0.16);
      expect(s.left[0]).toBeCloseTo(0.18, 2); // left is +x in the clips
      expect(s.right[0]).toBeCloseTo(-0.18, 2);
      expect(s.short).toBeLessThan(0.16); // hands a rung apart on a swung body: the arm falls up to 16 cm short (known gap; was 2 cm with matched hands)
    }
    expect(settled).toBeGreaterThan(100);
  });
  it('asks no arm to stretch more than 16 cm, even in the middle of a reach (the first ticks of a catch, while the body is carried onto the pivot, are the body\'s)', () => {
    for (const s of samples) if (!s.catching) expect(s.short).toBeLessThan(0.16);
  });
});

describe('existing poses are untouched', () => {
  it('a world that is not on the bars gets no bars field, so every other pose takes its old path', () => {
    const course = JSON.parse(readFileSync('public/assets/demo/bars.course.json', 'utf8')) as CourseData;
    const w = newWorld(course);
    expect(actorStateFor(w, false, 1, course.bars![0]).bars).toBeUndefined();
    expect(actorStateFor(w, false).bars).toBeUndefined();
  });
  it('the old hang is the answer when the pose is not asked for (no row passed)', () => {
    const course = JSON.parse(readFileSync('public/assets/demo/bars.course.json', 'utf8')) as CourseData;
    const run = JSON.parse(readFileSync('public/assets/demo/bars.run.json', 'utf8')) as { log: InputLog };
    let w = newWorld(course);
    for (const [m, n] of run.log) for (let k = 0; k < n; k++) { w = stepWorld(w, inputOfMask(m), course); if (w.mode === 'bars') { expect(actorStateFor(w, false, 1).bars).toBeUndefined(); return; } }
    throw new Error('never reached the bars');
  });
  void ix;
});
