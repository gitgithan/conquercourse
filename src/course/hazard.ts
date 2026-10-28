// The floor you must not touch. Every floor ends the run the same way (an instant fail); only the paint, the words and the sound differ.
// The simulator knows one outcome, 'splash'; nothing here changes the physics.
export type Hazard = 'water' | 'lava' | 'mud' | 'spikes' | 'void';
export const HAZARDS: readonly Hazard[] = ['water', 'lava', 'mud', 'spikes', 'void'];

export interface HazardInfo {
  label: string; // in the editor's floor picker
  message: string; // the line at the top of the screen after the fall
  headline: (where: string) => string; // the fall panel's first line
  hint: string; // what would have worked, in plain words (never a grade)
}

export const HAZARD_INFO: Record<Hazard, HazardInfo> = {
  water: { label: 'Water', message: 'Splash! You fell in the water. Press R to try again.', headline: (w) => `You fell in the water at the ${w}.`, hint: 'The water is cold, but it is only water: a longer run-up or an earlier jump keeps you above it.' },
  lava: { label: 'Lava', message: 'Hot! You touched the lava. Press R to try again.', headline: (w) => `You touched the lava at the ${w}.`, hint: 'Lava is only dangerous below you: stay on the ground or in the air above it, and get across with speed.' },
  mud: { label: 'Mud', message: 'Squelch! You sank in the mud. Press R to try again.', headline: (w) => `You sank in the mud at the ${w}.`, hint: 'You cannot run in mud: it holds your feet, so cross it in the air.' },
  spikes: { label: 'Spikes', message: 'Ouch! You landed on the spikes. Press R to try again.', headline: (w) => `You landed on the spikes at the ${w}.`, hint: 'Spikes are only a floor of points: a jump that lands on the far edge clears them.' },
  void: { label: 'Dark drop', message: 'You fell into the dark. Press R to try again.', headline: (w) => `You fell into the dark at the ${w}.`, hint: 'There is no floor to catch you: the far edge has to be reached before you start to fall.' },
};

export const hazardOf = (h: string | null | undefined): Hazard => (HAZARDS as readonly string[]).includes(h ?? '') ? (h as Hazard) : 'water';
