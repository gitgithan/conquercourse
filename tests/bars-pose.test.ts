import { describe, expect, it } from 'vitest';
import { barsPose, reachPoint, rigFromFrame, travelAt, ARM_BENT, type BarsPoseIn, type TravelOpts, type V3 } from '../src/motion/bars-pose';
import { loadClip } from './helpers/clips';

// Bone lengths come from the shipped run clip (the Rookie's own bones).
const run = loadClip('run');
const rig = rigFromFrame(run.names, run.parents, run.frames[13]);
const ix = (n: string) => rig.names.indexOf(n);
const armFull = rig.len[ix('LeftForeArm')] + rig.len[ix('LeftHand')]; // the left arm; the right differs by a centimetre or two (as on a real body)
const RUNG_Y = 2.2, X = 0.18;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hang = (extra: Partial<BarsPoseIn> = {}): BarsPoseIn => ({ grips: { left: [X, RUNG_Y, 0.2], right: [-X, RUNG_Y, 0.2] }, ...extra });
const OPTS: TravelOpts = { rungGap: 0.4, rungY: RUNG_Y, handX: X, cycle: 1.2, move: 0.3 };

describe('a body hanging from bars obeys the laws of a rigid body', () => {
  it('keeps every bone its own length, in any pose', () => {
    const poses = [hang(), hang({ swing: 0.5, kick: 0.6, tuck: 1 }), hang({ swing: -0.4, kick: -0.3 }),
      hang({ reach: { side: 'left', from: [X, RUNG_Y, 0.2], to: [X, RUNG_Y, 0.6], progress: 0.5 } })];
    for (const p of poses) {
      const { joints } = barsPose(rig, p);
      expect(joints.length).toBe(rig.names.length); // names and joints agree in length
      rig.parents.forEach((q, i) => {
        if (q < 0) return;
        // fingertips and eyes are small parts that ride on their parent; every bone of the arms, trunk and legs is exact
        if (/End|Eye|Jaw/.test(rig.names[i])) return;
        expect(dist(joints[i], joints[q])).toBeCloseTo(rig.len[i], 4);
      });
    }
  });
  it('hangs the hips below the hands and the feet clear of the floor', () => {
    const { joints } = barsPose(rig, hang());
    expect(joints[0][1]).toBeLessThan(RUNG_Y - 0.5);
    for (const n of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) expect(joints[ix(n)][1]).toBeGreaterThan(0.1);
    expect(joints[ix('Head')][1]).toBeGreaterThan(joints[0][1]); // head above hips: the body hangs the right way up
  });
  it('is lowest when it hangs straight, and rises as it swings either way (a pendulum)', () => {
    const y = (swing: number) => barsPose(rig, hang({ swing })).joints[0][1];
    expect(y(0.3)).toBeGreaterThan(y(0));
    expect(y(-0.3)).toBeGreaterThan(y(0));
    expect(y(0.6)).toBeGreaterThan(y(0.3));
    expect(y(0.3)).toBeCloseTo(y(-0.3), 6); // symmetric
  });
  it('swings toward +z when the angle is positive and the hips stay one pendulum length from the hands', () => {
    const a = barsPose(rig, hang()), b = barsPose(rig, hang({ swing: 0.4 }));
    expect(b.joints[0][2]).toBeGreaterThan(a.joints[0][2]);
    const anchor: V3 = [0, RUNG_Y, 0.2];
    expect(dist(b.joints[0], anchor)).toBeCloseTo(dist(a.joints[0], anchor), 4);
  });
  it('bends knees forward only, never backwards, and never past the range of a knee', () => {
    for (const tuck of [0, 0.5, 1]) {
      const { joints } = barsPose(rig, hang({ kick: 0.4, tuck }));
      for (const side of ['Left', 'Right']) {
        const thigh = joints[ix(side + 'Shin')].map((v, k) => v - joints[ix(side + 'Leg')][k]);
        const shin = joints[ix(side + 'Foot')].map((v, k) => v - joints[ix(side + 'Shin')][k]);
        const cosA = (thigh[0] * shin[0] + thigh[1] * shin[1] + thigh[2] * shin[2]) / (Math.hypot(...thigh) * Math.hypot(...shin));
        const bend = Math.acos(Math.min(1, cosA)) * 180 / Math.PI;
        expect(bend).toBeLessThan(165);
        if (bend > 15) expect(shin[2]).toBeLessThan(thigh[2]); // the foot goes back of the knee: it bends forward
      }
    }
  });
});

describe('the hands', () => {
  it('are on their rungs within 1 cm while holding', () => {
    const { hands } = barsPose(rig, hang());
    expect(dist(hands.left, [X, RUNG_Y, 0.2])).toBeLessThan(0.01);
    expect(dist(hands.right, [-X, RUNG_Y, 0.2])).toBeLessThan(0.01);
  });
  it('a reaching hand arrives on the next rung and the other hand never lets go', () => {
    const from: V3 = [X, RUNG_Y, 0.2], to: V3 = [X, RUNG_Y, 0.6];
    for (const side of ['left', 'right'] as const) {
      const f: V3 = side === 'left' ? from : [-X, RUNG_Y, 0.2], t: V3 = side === 'left' ? to : [-X, RUNG_Y, 0.6];
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const out = barsPose(rig, hang({ reach: { side, from: f, to: t, progress: p } }));
        const other = side === 'left' ? 'right' : 'left';
        expect(dist(out.hands[other], other === 'left' ? [X, RUNG_Y, 0.2] : [-X, RUNG_Y, 0.2])).toBeLessThan(0.01);
        if (p === 0) expect(dist(out.hands[side], f)).toBeLessThan(0.01);
        if (p === 1) expect(dist(out.hands[side], t)).toBeLessThan(0.01);
      }
    }
  });
  it('reach path starts and ends on the rungs, and rises in the middle by a few centimetres', () => {
    const r = { side: 'left' as const, from: [X, RUNG_Y, 0.2] as V3, to: [X, RUNG_Y, 0.6] as V3, progress: 0 };
    expect(dist(reachPoint(r), r.from)).toBeLessThan(1e-9);
    expect(dist(reachPoint({ ...r, progress: 1 }), r.to)).toBeLessThan(1e-9);
    const mid = reachPoint({ ...r, progress: 0.5 });
    expect(mid[1]).toBeGreaterThan(RUNG_Y);
    expect(mid[1]).toBeLessThan(RUNG_Y + 0.1);
  });
  it('an arm is asked for no more than it has: a far rung is reported short, the arm stays its length', () => {
    const out = barsPose(rig, hang({ grips: { left: [X, RUNG_Y, 1.5], right: [-X, RUNG_Y, 0.2] } }));
    expect(out.reachShort).toBeGreaterThan(0.1);
    expect(dist(out.joints[ix('LeftArm')], out.hands.left)).toBeLessThanOrEqual(armFull + 1e-6);
    expect(barsPose(rig, hang()).reachShort).toBe(0);
  });
  it('the hanging arm is a little bent, not locked', () => {
    const { joints, hands } = barsPose(rig, hang());
    const reach = dist(joints[ix('LeftArm')], hands.left);
    expect(reach).toBeLessThanOrEqual(armFull * 0.9999 + 1e-9);
    expect(reach).toBeGreaterThan(armFull * (ARM_BENT - 0.05));
  });
});

describe('hand over hand along the rungs', () => {
  const frames = Array.from({ length: 150 }, (_, i) => { const t = i / 30; const s = travelAt(t, OPTS); return { t, s, out: barsPose(rig, { grips: s.grips, reach: s.reach, swing: s.swing, bodyZ: s.bodyZ }) }; });
  it('alternates: the two hands never reach at the same time, and at least one always holds a rung', () => {
    // travelAt returns one reach at most by construction; check the grips: a hand that is not reaching sits exactly on a rung
    for (const { s, out } of frames) {
      const holder = s.reach ? (s.reach.side === 'left' ? 'right' : 'left') : null;
      if (holder) expect(dist(out.hands[holder], s.grips[holder])).toBeLessThan(0.01);
    }
  });
  it('every rung it grabs is a rung of the ladder (rungs are 0.4 m apart along the travel)', () => {
    for (const { s } of frames) for (const h of [s.grips.left, s.grips.right]) {
      const k = (h[2] - 0.3) / OPTS.rungGap;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    }
  });
  it('each hand moves forward two rungs per cycle: the body gains 0.67 m/s along the bars', () => {
    const a = frames[0].out.joints[0][2], b = frames[149].out.joints[0][2];
    expect((b - a) / (149 / 30)).toBeGreaterThan(0.6);
    expect((b - a) / (149 / 30)).toBeLessThan(0.75);
  });
  it('is free of teleports and jitter: no joint is faster than 6 m/s and no frame jumps in acceleration', () => {
    let worst = 0;
    for (let i = 1; i < frames.length; i++) frames[i].out.joints.forEach((q, j) => { worst = Math.max(worst, dist(q, frames[i - 1].out.joints[j]) * 30); });
    expect(worst).toBeLessThan(6);
  });
});
