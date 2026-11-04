// The summary box at the top of every Lab (owner, 2026-11-04): what you can do here, and the one thing you take away.
// Keyed by Lab mode name, never by number (the numbers change). Plain words; name the real controls on the page.
// A new Lab must add its entry here (tests/labs-summary.test.ts fails without one).
export interface LabSummary { do: string[]; learn: string; try?: string }

export const LAB_SUMMARY: Record<string, LabSummary> = {
  'lab-search': {
    do: ['Move the beam width, the three "value" sliders and the budget.', 'Press Run the search, then Play it back.'],
    learn: 'How you look decides if you find a clear run, and every extra look costs time.',
    try: 'Set the beam width to 1, run, then raise it and run again.',
  },
  'lab-optimization': {
    do: ['Pick a search method and set its grid spacing, restarts and run budget.', 'Press Run the chosen searches and compare the results.'],
    learn: 'A cheap search can stop on a small peak; some methods find the best settings in fewer tries.',
  },
  'lab-ik': {
    do: ['Drag the bar in the picture, or use the arrow keys.', 'Change the damping, the crouch slider and the joint limits.', 'Press Slide the bar out to the breaking point.'],
    learn: 'An arm can only reach so far; past its limits the pose breaks, so the game must check it.',
  },
  'lab-vision': {
    do: ['Move the score cut, the smallest person and the most masked sliders.', 'Mark a setting on the curve and see the photos kept.'],
    learn: 'Every mask setting trades photos kept against people missed; you choose the price.',
  },
  'lab-camera': {
    do: ['Change the field of view, camera height and the second camera angle.', 'Flip limbs of body B and keep a camera in the table.'],
    learn: 'One photo cannot give depth: different bodies can look exactly the same from one camera.',
  },
  'lab-integration': {
    do: ['Pick a step size and how long the cart runs, then press Run the cart.', 'Slide Time to scrub through the run.'],
    learn: 'A big step rule invents energy, and only a fixed step makes a replay match.',
  },
  'lab-timing': {
    do: ['Pick a course, set how shaky the presses are and how many runs to play.', 'Press Play the course N times.'],
    learn: 'Shaky timing lowers how often a run clears, so the game gives each press a safe window.',
  },
  'lab-signal': {
    do: ['Pick a clip, then set the smoothing strength and the wobble added.', 'Switch between After the filter and Before on the character.'],
    learn: 'Smoothing removes jitter but adds lag; you tune the balance and the gate checks it.',
  },
  'lab-gentest': {
    do: ['Choose which pieces and sizes the model may use, and how many repairs.', 'Press Test the proposals and read why some are thrown out.'],
    learn: 'A model can propose anything; only the simulator can prove a course is possible.',
  },
  'lab-detector': {
    do: ['Move the two sliders that decide when the detector made a claim and found a part.', 'Keep a setting in your list.'],
    learn: 'A detector is judged by precision and recall, and the right balance depends on the cost of a miss.',
  },
  'lab-hashing': {
    do: ['Pick a tick and change one key press in the recorded run.', 'Press Run the avalanche to flip every bit, one at a time.'],
    learn: 'A hash turns a run into one short code, and any tiny change shows up in it.',
  },
  'lab-rl': {
    do: ['Write the points, then set learning rate, exploration, tries and seed.', 'Press Train the character, then Play it back.'],
    learn: 'A character learns whatever the points reward, even things you did not mean.',
  },
  'lab-motion': {
    do: ['Pick a clip and step through the pipeline from frames to character.', 'Slide the simulator tick to see the one shared clock.'],
    learn: 'A filmed move goes through several steps, and the plausibility gate stops a bad one before it plays.',
  },
  'lab-lift': {
    do: ['Spin the 3D object, zoom, and pick a raw lift or a baked object.', 'Tick the bake steps on and off and set the typed height.'],
    learn: 'A raw 3D lift is not a game object yet; each bake step fixes one thing that would break the course.',
  },
  'lab-collision': {
    do: ['Go through the steps and change the cell size.', 'Break the lift on purpose, then pick a collider and press Check my pick.'],
    learn: 'A clean collider keeps the run the same even when the 3D lift is noisy.',
  },
  'lab-partner': {
    do: ['Pick a brief and read the partner\'s answer.', 'Edit the course with the Gap, Block and Bar buttons, then press Fix it.'],
    learn: 'A partner can suggest a course, but the simulator checks and repairs it before you play.',
  },
  'lab-systemdesign': {
    do: ['Drop one block into each of the nine cards of our pipeline, then press Run.', 'Open the hints on a red card to find out why another block fits.'],
    learn: 'The best block depends on what you must keep: time, money, privacy or the same run; more than one design can pass.',
  },
  'lab-slicer': {
    do: ['Pick a place and turn the map settings, then watch the lane change.', 'Try the design challenges and check your answers.'],
    learn: 'A pin on a real map becomes a lane only after rules and the simulator prove it can be run.',
  },
  'lab-determinism': {
    do: ['Pick a recorded run and try the fixes: fixed step, ordered walk, rounding.', 'Take the challenge: make three machines agree with the fewest pins.'],
    learn: 'The same keys can give a different run on another machine unless you pin the right things.',
  },
  'lab-spike': {
    do: ['Pick a feature and sort the risk board.', 'Order the plan, then replay a real story.'],
    learn: 'Test the scariest call first; the wrong order makes you pay for work that never worked.',
  },
  'lab-limits': {
    do: ['Sort the failures into give up, cover with a check, or never needed a model.', 'Move the limit of a real gate and pick the cheapest safe design.'],
    learn: 'A model will fail some ways; you plan for it with a check, not with hope.',
  },
  'lab-wait': {
    do: ['Pick a course and a warm-up, and time the real search.', 'Switch the wait tricks on and off and take the challenges.'],
    learn: 'Slow work feels short when it shows progress, never an empty screen.',
  },
};

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The box as HTML (pure: no page needed). Empty when a mode has no entry. */
export function summaryHtml(mode: string): string {
  const s = LAB_SUMMARY[mode];
  if (!s) return '';
  const tryLine = s.try ? ` <b>Try:</b> ${esc(s.try)}` : '';
  return `<div class="lab-summary" id="lab-summary" role="note"><div class="lab-summary-do"><b>You can:</b> ${s.do.map((d) => `<span>${esc(d)}</span>`).join(' ')}</div><div class="lab-summary-learn"><b>You take away:</b> ${esc(s.learn)}${tryLine}</div></div>`;
}
