// Turns the simulator's world into what the Rookie actor needs (CC-31). This is the glue the Course adds to its loop.
import type { WorldState } from '../sim/world';
import type { ActorState } from './actor-pose';
import { vaultHand } from '../sim/vault';
import { SLIDE_RECOVERY } from '../sim/slide';
import { DT } from '../sim/units';
import { rungX, pivotOf, type BarRun } from '../sim/bars';
import { DEFAULT_HANG, handOffset } from '../sim/holds';
import { DEFAULT_WALL } from '../sim/wall';
import type { CourseData } from '../course/course';

export const SLIDE_RISE_TICKS = Math.round(0.25 / DT); // the body gets up from a slide over this long (the box is standing again at once)

/** Ticks since the slide ended, while the body is still getting up (the cooldown starts the tick it ends). */
function slideRisingTicks(w: WorldState): number | undefined {
  if (w.slide || w.slideReadyAt === undefined) return undefined;
  const since = w.runner.tick - (w.slideReadyAt - Math.round(SLIDE_RECOVERY * 120));
  return since >= 0 && since < SLIDE_RISE_TICKS ? since : undefined;
}

export function actorStateFor(w: WorldState, squat: boolean, facing: 1 | -1 = 1, barRow?: BarRun): ActorState {
  const r = w.runner;
  return {
    tick: r.tick,
    x: r.x,
    y: r.y,
    vx: r.vx,
    vy: r.vy,
    grounded: r.grounded,
    mode: w.mode === 'hang' || w.mode === 'bars' || w.mode === 'polec' ? 'swing' : w.mode === 'vault' || w.mode === 'plank' || w.mode === 'climb' || w.mode === 'band' || w.mode === 'pole' ? 'run' : w.mode === 'drone' ? 'cart' : w.mode, // a cart seats the rider (pose 'sit'); the trebuchet's sling holds the rider (pose 'sling'); a plank is crossed in the running pose
    tilt: w.cart?.tilt ?? (w.drone ? -w.drone.lean : undefined), // a drone rider sits on the skids and leans with the drone
    // hanging from a bar uses the rope's swing pose, turned about the hands
    squat,
    landedTicksAgo: r.landedAtTick === null ? null : r.tick - r.landedAtTick,
    sliding: !!w.slide || slideRisingTicks(w) !== undefined,
    slideTicks: w.slide ? r.tick - w.slide.start : undefined,
    slideRisingTicks: slideRisingTicks(w),
    rolledAt: w.rolledAt,
    climbProgress: w.mode === 'climb' && w.climb ? w.climb.i / w.climb.n : undefined,
    vaultProgress: w.mode === 'vault' && w.vault ? w.vault.i / w.vault.n : undefined,
    vaultContact: w.mode === 'vault' && w.vault ? vaultHand(w.vault) : undefined,
    wallProgress: w.wall ? w.wall.index / Math.max(1, w.wall.path.length - 1) : undefined,
    swingTheta: w.swing?.theta ?? w.hang?.theta ?? w.bars?.theta ?? (w.polec ? 0 : undefined), // a pole climber hangs like a bar hanger until a climbing pose is made
    swingOmega: w.hang?.omega ?? w.bars?.omega,
    bars: barRow && w.mode === 'bars' && w.bars ? { left: rungX(barRow, w.bars.l), right: rungX(barRow, w.bars.r), y: barRow.y } : undefined, // only when the caller asks for the hands-on-the-rungs pose
    hurt: w.outcome === 'hurt',
    facing,
  };
}

/** The way the body faces: it follows the direction of travel, and keeps its side on a bar. The Course and the ghost both use this rule. */
export function nextFacing(w: WorldState, facing: 1 | -1): 1 | -1 {
  const speed = w.mode === 'cart' && w.cart ? w.cart.v : w.runner.vx;
  return Math.abs(speed) > 0.3 && w.mode !== 'hang' && w.mode !== 'bars' ? (speed < 0 ? -1 : 1) : facing;
}

/** On a rope or bars the actor is placed with its hands on the hold (the feet straight below before the turn); undefined elsewhere. */
export function handsPlace(w: WorldState, course: CourseData): { x: number; y: number } | undefined {
  const barsRow = w.mode === 'bars' && w.bars ? course.bars?.[w.bars.run] : undefined;
  const hold = w.mode === 'hang' && w.hang ? course.holds?.[w.hang.hold] : barsRow && w.bars ? pivotOf(barsRow, w.bars) : undefined;
  const hs = w.mode === 'bars' ? w.bars : w.hang;
  if (!hold || !hs) return undefined;
  const o = handOffset({ hold: 0, theta: 0, omega: 0, ox: hs.ox, oy: hs.oy, et: hs.et }); // the hands ease onto the bar over a few ticks after a catch
  return { x: hold.x + o.x, y: hold.y + o.y - DEFAULT_HANG.handHeight };
}

/** The whole state the Course gives its actor for this world, without the look-ahead hint: the ghost records exactly this per tick (CC-133). */
export function courseActorState(w: WorldState, course: CourseData, squat: boolean, facing: 1 | -1): ActorState {
  const barsRow = w.mode === 'bars' && w.bars ? course.bars?.[w.bars.run] : undefined;
  const at = handsPlace(w, course);
  const ledge = w.mode === 'climb' && w.climb ? { x: w.climb.edge, y: w.climb.top } : course.wall ? { x: course.wall.x0 + (course.wall.radius ?? course.wall.height ?? DEFAULT_WALL.height), y: course.wall.height ?? DEFAULT_WALL.height } : undefined;
  return { ...actorStateFor(w, squat, facing, barsRow), ...(at ?? {}), ledge };
}
