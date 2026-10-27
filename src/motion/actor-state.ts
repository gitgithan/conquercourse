// Turns the simulator's world into what the Rookie actor needs (CC-31). This is the glue the Course adds to its loop.
import type { WorldState } from '../sim/world';
import type { ActorState } from './actor-pose';

export function actorStateFor(w: WorldState, squat: boolean, facing: 1 | -1 = 1): ActorState {
  const r = w.runner;
  return {
    tick: r.tick,
    x: r.x,
    y: r.y,
    vx: r.vx,
    vy: r.vy,
    grounded: r.grounded,
    mode: w.mode === 'hang' ? 'swing' : w.mode, // hanging from a bar uses the rope's swing pose, turned about the hands
    squat,
    landedTicksAgo: r.landedAtTick === null ? null : r.tick - r.landedAtTick,
    wallProgress: w.wall ? w.wall.index / Math.max(1, w.wall.path.length - 1) : undefined,
    swingTheta: w.swing?.theta ?? w.hang?.theta,
    facing,
  };
}
