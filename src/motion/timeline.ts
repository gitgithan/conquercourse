import { Vector3 } from 'three/webgpu';
import { DEFAULT_PARAMS, NO_INPUT, startState, step, type RunnerState } from '../sim/runner';
import { TICKS_PER_SECOND } from '../sim/units';
import { LOOPS, sampleClip, secondsForDistance, type Clip, type Phase } from './clip';
import { clipToWorld } from './pose';

export type Clips = Record<Phase, Clip>;

export interface Path {
  (tick: number): { x: number; y: number };
}

interface Segment {
  phase: Phase;
  start: number; // tick
  end: number; // tick, exclusive; the last segment never ends
  seconds: (tick: number) => number; // clip time at a tick
  hipsY?: (tick: number, joints: number[][]) => number; // hips height when the simulator, not the clip, sets it (in the air)
}

const BLEND_TICKS = 12;
const JUMP_TICK = 420;
const JUMP_SPEED = 3;
const LAND_HOLD_TICKS = 60;
const AIR_FLOOR_MARGIN = 0.08;

// Winter's segment masses, as the plausibility gate uses them: [proximal, distal, mass, centre fraction].
const SEGMENTS: [string, string, number, number][] = [['Neck1', 'Head', 0.081, 1], ['Hips', 'Neck1', 0.497, 0.5]];
for (const s of ['Left', 'Right']) {
  SEGMENTS.push([`${s}Arm`, `${s}ForeArm`, 0.028, 0.436], [`${s}ForeArm`, `${s}Hand`, 0.016, 0.43], [`${s}Hand`, `${s}HandMiddleEnd`, 0.006, 0.506]);
  SEGMENTS.push([`${s}Leg`, `${s}Shin`, 0.1, 0.433], [`${s}Shin`, `${s}Foot`, 0.0465, 0.433], [`${s}Foot`, `${s}ToeBase`, 0.0145, 0.5]);
}

// Height of the centre of mass above the hips for a pose (clip joints, metres).
export function comAboveHips(names: string[], joints: number[][]): number {
  let y = 0;
  for (const [a, b, m, f] of SEGMENTS) {
    const ya = joints[names.indexOf(a)][1];
    const yb = joints[names.indexOf(b)][1];
    y += m * (ya + f * (yb - ya));
  }
  return y - joints[0][1];
}

export const legLength = (names: string[], p: (i: number) => Vector3): number => {
  const i = (n: string) => names.indexOf(n);
  return p(i('LeftLeg')).distanceTo(p(i('LeftShin'))) + p(i('LeftShin')).distanceTo(p(i('LeftFoot')));
};

// A straight run that leaps once and runs on. The path is the simulator's; the clips only dress it.
// `scale` shrinks or stretches the clip bodies to the Rookie (its leg length over the clip's).
export class DemoMotion {
  readonly period: number;
  private states: RunnerState[] = [];
  private segments: Segment[] = [];

  constructor(private clips: Clips, private scale: number, period = 720) {
    this.period = period;
    let s = startState();
    this.states.push(s);
    for (let t = 0; t < period; t++) {
      const jump = t === JUMP_TICK;
      s = step(s, { ...NO_INPUT, run: true, jump, jumpSpeed: jump ? JUMP_SPEED : 0 }, { ...DEFAULT_PARAMS, topSpeed: 4 });
      this.states.push(s);
    }
    const land = this.states.find((x) => x.landedAtTick !== null)!;
    const landTick = land.landedAtTick!;
    const { run, leap, land: landClip } = clips;
    const takeoff = leap.takeoff! / leap.fps;
    const touch = leap.landing! / leap.fps;
    const landFrom = landClip.landing! / landClip.fps;
    this.segments = [
      { phase: 'run', start: 0, end: JUMP_TICK, seconds: (t) => secondsForDistance(run, this.at(t).x / this.scale) },
      {
        phase: 'leap',
        start: JUMP_TICK,
        end: Math.ceil(landTick),
        seconds: (t) => takeoff + ((t - JUMP_TICK) / (landTick - JUMP_TICK)) * (touch - takeoff),
        // in the air the whole body, not the hips, follows the arc, so the centre of mass stays ballistic
        hipsY: (t, joints) => this.takeoffCom() + this.at(t).y - this.scale * comAboveHips(leap.names, joints),
      },
      {
        phase: 'land',
        start: Math.ceil(landTick),
        end: Math.ceil(landTick) + LAND_HOLD_TICKS,
        seconds: (t) => landFrom + (t - landTick) / TICKS_PER_SECOND,
      },
      { phase: 'run', start: Math.ceil(landTick) + LAND_HOLD_TICKS, end: Infinity, seconds: (t) => secondsForDistance(run, this.at(t).x / this.scale) },
    ];
  }

  private at(tick: number): RunnerState {
    return this.states[Math.min(Math.max(Math.floor(tick), 0), this.states.length - 1)];
  }

  // Height of the centre of mass in the last tick on the ground, so the arc starts where the body was.
  private takeoffCom(): number {
    const { joints, y } = this.sample(this.segments[0], JUMP_TICK - 1);
    return y + this.scale * comAboveHips(this.clips.run.names, joints);
  }

  private sample(seg: Segment, tick: number): { joints: number[][]; y: number } {
    const joints = sampleClip(this.clips[seg.phase], seg.seconds(tick), LOOPS[seg.phase]);
    return { joints, y: seg.hipsY ? seg.hipsY(tick, joints) : this.scale * joints[0][1] };
  }

  phaseAt(tick: number): Phase {
    return this.segments.find((s) => tick >= s.start && tick < s.end)!.phase;
  }

  // The simulator's path: x along the track and y of the hips, both in metres.
  path: Path = (tick) => this.pose(tick).hips;

  // World positions of the 30 joints at a tick (game time is the tick count only).
  pose(rawTick: number): { hips: { x: number; y: number }; joints: Vector3[]; phase: Phase } {
    const tick = ((rawTick % this.period) + this.period) % this.period;
    const i = this.segments.findIndex((s) => tick >= s.start && tick < s.end);
    const seg = this.segments[i];
    let { joints, y } = this.sample(seg, tick);
    const into = tick - seg.start;
    let blend = 1; // 0 at the start of a phase, 1 once it has taken over
    if (i > 0 && into < BLEND_TICKS) {
      const w = (blend = (into + 1) / (BLEND_TICKS + 1));
      const prev = this.sample(this.segments[i - 1], tick);
      // blend in hips-relative space so the hips stay on the path
      joints = joints.map((p, j) => p.map((v, k) => prev.joints[j][k] + (v - prev.joints[j][k]) * w));
      y = seg.hipsY ? seg.hipsY(tick, joints) : prev.y + (y - prev.y) * w;
    }
    const hipsClip = joints[0];
    // never let a foot go through the floor (the simulator's arc ends where the body, not the clip, touches down);
    // in the air the margin covers the Rookie's longer feet, which the aimed bones cannot see
    const lowest = y + this.scale * (Math.min(...joints.map((p) => p[1])) - hipsClip[1]);
    const margin = AIR_FLOOR_MARGIN * (seg.phase === 'leap' ? 1 : 1 - blend);
    if (lowest < margin) y += margin - lowest;
    const x = this.at(tick).x;
    const world = joints.map((p) => {
      const rel = clipToWorld([p[0] - hipsClip[0], p[1] - hipsClip[1], p[2] - hipsClip[2]]).multiplyScalar(this.scale);
      return rel.add(new Vector3(x, y, 0));
    });
    return { hips: { x, y }, joints: world, phase: seg.phase };
  }
}
