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
    mode: w.mode === 'hang' ? 'swing' : w.mode === 'vault' || w.mode === 'launch' ? 'run' : w.mode, // a cart seats the rider (clip 'sit'); a launch is flown in the running pose
    tilt: w.cart?.tilt,
    // hanging from a bar uses the rope's swing pose, turned about the hands
    squat,
    landedTicksAgo: r.landedAtTick === null ? null : r.tick - r.landedAtTick,
    rolledAt: w.rolledAt,
    vaultProgress: w.mode === 'vault' && w.vault ? w.vault.i / w.vault.n : undefined,
    vaultContact: w.mode === 'vault' && w.vault ? vaultHand(w.vault) : undefined,
    wallProgress: w.wall ? w.wall.index / Math.max(1, w.wall.path.length - 1) : undefined,
    swingTheta: w.swing?.theta ?? w.hang?.theta,
    facing,
  };
}
