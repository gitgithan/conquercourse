// The Training course's layout (CC-175, CC-182): where each beat sits along the run. One place, so the course maker and the line search agree.
// Run-ups are the short ones the simulator needs: a standing start reaches 95 % of the top speed (8.85 m/s) after about 14.5 m.
export const BOX_H = 1.25; // the first vault box; the vault limit is 1.3 m (src/sim/vault.ts), so a doubled 2 m box cannot be vaulted
export const START_X = 8; // the run-up to the first edge is 14.5 m
export const GAP_EDGE = 24; // the deck before the 5 m gap ends here (the landing deck starts 5 m on)
export const BOX_X = 44; // the box to vault
export const WALL_X = 70; // where the warped wall starts (4 m run over 4 m)
export const CLIMB_X = 92; // the 2 m wall to climb
export const PLANK_X0 = 94; // the plank bridge (9 m)
export const PLANK_X1 = 103;
export const RUNUP_BAR = 18; // from the end of the plank to the first bar's take-off edge
export const DX = PLANK_X1 + RUNUP_BAR - 62; // the CC-161 block (old x 56 to 200) moves along by DX, and up by DY
export const DY = 6; // the height of the climb deck: the 4 m warped wall and the 2 m climb wall (CC-196: the half-metre step before the wall is gone, a second V that taught nothing)
export const TRAMP_CUT = 14; // flat run between the rope landing and the trampoline: the old 34 m is cut by this much (everything after the rope moves back)
