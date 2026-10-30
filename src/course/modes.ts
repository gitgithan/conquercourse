import type { Mode } from '../sim/world';

// What each movement mode is called on screen, and the facts the views need about it.
// It is a Record over every Mode, so adding a mode to src/sim/world.ts fails the type check here until this row is written:
// that is the one list a new obstacle's mode has to be added to for the debug view (name, whether it is a machine, what the next press is).
export interface ModeInfo {
  name: string; // shown as "Mode" in the debug panel
  machine?: boolean; // the preview arc follows the machine layer, not the jump layer
  next?: string; // what to do next while in this mode; absent: decided from the ground (Jump now / Carry on)
}

export const MODE_INFO: Record<Mode, ModeInfo> = {
  run: { name: 'Running' },
  wall: { name: 'On the wall' },
  swing: { name: 'Swinging' },
  bounce: { name: 'Bouncing' },
  hang: { name: 'Hanging', next: 'Let go now' },
  vault: { name: 'Vaulting' },
  cart: { name: 'In the cart', machine: true, next: 'Cart rolls on' },
  launch: { name: 'In the sling', machine: true, next: 'Let go now' },
  plank: { name: 'plank' }, // never had a nicer name; the old table fell back to the raw mode word
  climb: { name: 'Climbing' },
  band: { name: 'On the band', machine: true, next: 'Turn round now' },
  drone: { name: 'On the drone', machine: true, next: 'Come down now' },
};
