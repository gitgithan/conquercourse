// Turns the simulator's world into what the Rookie actor needs (CC-31). This is the glue the Course adds to its loop.
import type { WorldState } from '../sim/world';
import type { ActorState } from './actor-pose';
import { vaultHand } from '../sim/vault';

export function actorStateFor(w: WorldState, squat: boolean, facing: 1 | -1 = 1): ActorState {
  const r = w.runner;
  return {
    tick: r.tick,
    x: r.x,
    y: r.y,
    vx: r.vx,
    vy: r.vy,
    grounded: r.grounded,
    mode: w.mode === 'hang' ? 'swing' : w.mode === 'vault' || w.mode === 'plank' || w.mode === 'climb' || w.mode === 'band' ? 'run' : w.mode === 'drone' ? 'cart' : w.mode, // a cart seats the rider (pose 'sit'); the trebuchet's sling holds the rider (pose 'sling'); a plank is crossed in the running pose
    tilt: w.cart?.tilt ?? (w.drone ? -w.drone.lean : undefined), // a drone rider sits on the skids and leans with the drone
    // hanging from a bar uses the rope's swing pose, turned about the hands
    squat,
    landedTicksAgo: r.landedAtTick === null ? null : r.tick - r.landedAtTick,
    rolledAt: w.rolledAt,
    climbProgress: w.mode === 'climb' && w.climb ? w.climb.i / w.climb.n : undefined,
    vaultProgress: w.mode === 'vault' && w.vault ? w.vault.i / w.vault.n : undefined,
    vaultContact: w.mode === 'vault' && w.vault ? vaultHand(w.vault) : undefined,
    wallProgress: w.wall ? w.wall.index / Math.max(1, w.wall.path.length - 1) : undefined,
    swingTheta: w.swing?.theta ?? w.hang?.theta,
    swingOmega: w.hang?.omega,
    hurt: w.outcome === 'hurt',
    facing,
  };
}
