import type { Context, Experiment, Shape } from '../sim/experiments';
import { GRAVITY } from '../sim/units';

// The guided lesson for each obstacle: why it matters, what to try, what shape the relationship has, a rule of
// thumb, the exact formula (earned, last), and what it means on the Course. Plain words; formulas only here.
export interface Lesson {
  why: string;
  tries: string[];
  shapeWords: Partial<Record<Shape, string>>;
  rule: string;
  formula: string;
  formulaWords: string;
  apply: (ctx: Context, v: Record<string, number>) => string;
}

export const LESSONS: Record<Experiment['id'], Lesson> = {
  gap: {
    why: 'A gap is a promise you make at the edge: once your feet leave the ground, nothing you do in the air changes how far you fly. So the jump is won or lost by how fast you run and how hard you push up.',
    tries: ['Set the run-up speed to 4, press Run it, then to 8 and press it again.', 'Now keep the speed and change the take-off push.', 'Guess before each run: drag the dashed line to where you think you will land.'],
    shapeWords: {
      direct: 'a straight line: twice the speed flies twice as far (a direct proportion). The push upward does the same.',
    },
    rule: 'Distance grows with speed multiplied by push. Double either one and you fly twice as far. Gravity pulls the other way: it keeps you from flying far.',
    formula: 'distance = 2 × speed × push ÷ g',
    formulaWords: 'This is exact for a jump that takes off and lands at the same height and ignores air resistance (g = 9.81 m/s²). The 2 comes from the time going up plus the time coming down. Landing on a higher platform, or air resistance, makes the real distance a little shorter.',
    apply: (c, v) => (c.width
      ? `On the Course this gap is ${c.width.toFixed(1)} m wide. Turn the formula around: speed ≥ width × g ÷ (2 × push) = ${((c.width * GRAVITY) / (2 * v.jump)).toFixed(1)} m/s at the edge. Watch the speed meter on the Course and jump only when it is past that.`
      : 'On the Course, the speed meter shows the speed you need for the next gap. Come from a Course fall to practise on a real gap.'),
  },
  wall: {
    why: 'The warped wall cannot lift you: it only spends the speed you bring. Your speed is energy of motion, and climbing turns it into height. A taller wall does not change how high your speed can lift you; it only decides whether your hands can reach the top.',
    tries: ['Set the speed to 4, run it, then 6, then 8.', 'Now change only the wall height. Watch the line you climbed: it does not move.', 'Guess how high your feet get before each run.'],
    shapeWords: { square: 'a curve that bends upward: twice the speed lifts you four times as high (the height grows with the speed multiplied by itself).' },
    rule: 'Height grows with the square of the speed. Friction on the wall takes a little off, but the shape stays the same.',
    formula: 'height = speed² ÷ (2 × g)',
    formulaWords: 'This is exact when no energy is lost: energy of motion (½ × mass × speed²) turning into height energy (mass × g × height); the mass cancels. Friction on the wall costs about 10 % in the game, so the climb is a little lower than the formula says.',
    apply: (c, v) => {
      const H = c.wallHeight ?? v.height;
      const need = H - 3.1;
      return `The Course wall is ${H.toFixed(1)} m high. Your hands reach 3.1 m above your feet, so your feet must climb ${need.toFixed(1)} m: that needs about ${Math.sqrt(2 * GRAVITY * 1.1 * need).toFixed(1)} m/s at the foot of the wall.`;
    },
  },
  rope: {
    why: 'On the rope you swap speed for height and back again. The rope gives back every bit of height you give it. Where you let go decides which way you are flung: too early and you fall short, too late and you fall back.',
    tries: ['Keep the other settings and move the release angle from 20° to 100°.', 'Find the angle that flies furthest.', 'Then try a different rope length.'],
    shapeWords: { hump: 'a hill: the distance rises, peaks, then falls. There is a best moment to let go, and it is while you are still going up.' },
    rule: 'Letting go early sends you far but low; letting go late sends you high but back. The best release is part-way up the swing.',
    formula: 'speed at release² = speed at grab² − 2 × g × height gained',
    formulaWords: 'This is exact for a stiff rope and no air resistance: energy is conserved on the swing. After release you fly like a thrown ball, so the distance follows the same rule as the gap jump.',
    apply: (c, v) => `On the Course the rope is ${(c.ropeLength ?? 9).toFixed(0)} m long. Grab it on the way up, hold on while you are rising, and let go near ${Math.round(v.angle)}° of the swing.`,
  },
  trampoline: {
    why: 'A trampoline is a spring: it stores the energy of your landing and gives it back. The harder you land, the higher it throws you.',
    tries: ['Drop from 1 m, then 2 m, then 4 m.', 'Watch how much of your height you get back each time.'],
    shapeWords: { direct: 'a straight line: drop twice as high and you bounce twice as high (a direct proportion), a little lower than you came because the spring loses some energy.' },
    rule: 'You bounce back to a fixed share of the height you fell from; the spring keeps only the share it loses to heat.',
    formula: 'bounce height ≈ efficiency × drop height',
    formulaWords: 'The efficiency is about 0.8 here (1.0 would be a perfect spring), so this is a good approximation, not an exact law: it depends on how stiff and how lossy the trampoline is.',
    apply: () => 'On the Course you drop 4.3 m onto the trampoline. Press Space at the bottom of the bounce for extra height; you need it to reach the far platform.',
  },
  landing: {
    why: 'Stopping is a push from the ground. The same stop spread over more time is a gentler push, which is why bent knees save you. Past a limit the push is too hard: you stumble, and a big enough fall could break something. On the Course this only matters on big drops; normal jumps are fine.',
    tries: ['Keep the drop and change the time you spend bending your knees from 0.05 s to 0.3 s.', 'Then keep the knees and change the drop.', 'Guess how much it will hurt: 0 is a feather, 10 is broken bones.'],
    shapeWords: { inverse: 'a falling curve: stop over twice the time and it hurts half as much (an inverse proportion).', root: 'a curve that flattens: dropping four times as high only doubles the hurt (it grows with the square root of the height).' },
    rule: 'How much it hurts is the speed you have to lose divided by the time you take to lose it.',
    formula: 'average push = √(2 × g × drop height) ÷ stop time, and ouch ≈ push ÷ 10',
    formulaWords: 'This is exact for an even stop and no air resistance; the "ouch" number is the game\'s own scale (about 6 means you stumble, 8 or more means you could be hurt).',
    apply: () => 'On the Course, hold the down arrow when you land from a big drop (the wall deck, the trampoline). Normal jumps need no knee-bend.',
  },

};
