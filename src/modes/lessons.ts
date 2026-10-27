import type { Context, Experiment, Shape } from '../sim/experiments';
import type { CourseFacts } from '../course/facts';
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
  apply: (f: CourseFacts, ctx: Context, v: Record<string, number>) => string; // lines separated by \n; numbers come from the course in play
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
    apply: (f, c, v) => {
      if (!f.gaps.length) return 'This course has no gaps. Draw one in the Park to practise here.';
      const lines = f.gaps.map((g, k) => `Gap ${k + 1}: ${g.width.toFixed(1)} m wide${g.rise > 0.05 ? `, landing ${g.rise.toFixed(1)} m higher` : ''}. You need at least ${g.needed.toFixed(1)} m/s at the edge.`);
      lines.push(c.width ? `The gap you came from is ${c.width.toFixed(1)} m wide: with your push of ${v.jump.toFixed(1)} m/s the formula says ${((c.width * GRAVITY) / (2 * v.jump)).toFixed(1)} m/s.` : 'Watch the speed meter on the Course and jump only when it is past the number.');
      return lines.join('\n');
    },
  },
  wall: {
    why: 'The warped wall cannot lift you: it only spends the speed you bring. Your speed is energy of motion, and climbing turns it into height. A taller wall does not change how high your speed can lift you; it only decides whether your hands can reach the top.',
    tries: ['Set the speed to 4, run it, then 6, then 8.', 'Now change only the wall height. Watch the line you climbed: it does not move.', 'Guess how high your feet get before each run.'],
    shapeWords: { square: 'a curve that bends upward: twice the speed lifts you four times as high (the height grows with the speed multiplied by itself).' },
    rule: 'Height grows with the square of the speed. Friction on the wall takes a little off, but the shape stays the same.',
    formula: 'height = speed² ÷ (2 × g)',
    formulaWords: 'This is exact when no energy is lost: energy of motion (½ × mass × speed²) turning into height energy (mass × g × height); the mass cancels. Friction on the wall costs about 10 % in the game, so the climb is a little lower than the formula says.',
    apply: (f, c) => {
      const w = f.wall;
      if (!w) return 'This course has no warped wall.';
      const H = c.wallHeight ?? w.height;
      return `The wall in this course is ${H.toFixed(1)} m high. Your hands reach 3.1 m above your feet, so your feet must climb ${(H - 3.1).toFixed(1)} m.\nYou need at least ${w.needSpeed.toFixed(1)} m/s at the foot of the wall (the speed meter shows it as you approach).`;
    },
  },
  rope: {
    why: 'On the rope you swap speed for height and back again. The rope gives back every bit of height you give it. Where you let go decides which way you are flung: too early and you fall short, too late and you fall back.',
    tries: ['Keep the other settings and move the release angle from 20° to 100°.', 'Find the angle that flies furthest.', 'Then try a different rope length.'],
    shapeWords: { hump: 'a hill: the distance rises, peaks, then falls. There is a best moment to let go, and it is while you are still going up.' },
    rule: 'Letting go early sends you far but low; letting go late sends you high but back. The best release is part-way up the swing.',
    formula: 'speed at release² = speed at grab² − 2 × g × height gained',
    formulaWords: 'This is exact for a stiff rope and no air resistance: energy is conserved on the swing. After release you fly like a thrown ball, so the distance follows the same rule as the gap jump.',
    apply: (f, c, v) => (f.rope ? `The rope in this course is ${(c.ropeLength ?? f.rope.length).toFixed(0)} m long and hangs from ${f.rope.anchorHeight.toFixed(1)} m up. Grab it on the way up, hold on while you are rising, and let go near ${Math.round(v.angle)}° of the swing.` : 'This course has no rope.'),
  },
  trampoline: {
    why: 'A trampoline is a spring: it stores the energy of your landing and gives it back. The harder you land, the higher it throws you. And you can add to it: pressing Space at the bottom of the bounce adds speed on top of what the spring returns.',
    tries: ['Drop from 1 m, then 2 m, then 4 m, with no extra push.', 'Watch how much of your height you get back each time.', 'Now add an extra push at the bottom and see how much higher you go.'],
    shapeWords: { direct: 'a straight line: drop twice as high and you bounce twice as high (a direct proportion), a little lower than you came because the spring loses some energy.' },
    rule: 'The spring gives back a fixed share of your height. A press adds speed to the speed the spring gives, and height grows with the square of the total speed, so a small push at the right moment buys a lot of height.',
    formula: 'bounce height ≈ (spring speed + extra push)² ÷ (2 × g), where spring speed ≈ √(2 × g × efficiency × drop height)',
    formulaWords: 'The efficiency is about 0.8 here (1.0 would be a perfect spring), so this is a good approximation, not an exact law. The extra push is 0 to 2 m/s in the Course, depending on how well you time the press.',
    apply: (f) => {
      const t = f.trampoline;
      if (!t) return 'This course has no trampoline.';
      return `You drop ${t.drop.toFixed(1)} m onto the trampoline. The spring alone throws you ${t.springHeight.toFixed(1)} m high, and the far platform is ${t.farRise.toFixed(1)} m up.
You need an extra ${t.extraNeeded.toFixed(1)} m/s of push (a perfect press gives ${t.pump.toFixed(1)} m/s): press Space while you press into the trampoline.`;
    },
  },
  landing: {
    why: 'Stopping is a push from the ground. The same stop spread over more time is a gentler push, which is why bent knees save you. Past a limit the push is too hard: you stumble, and a big enough fall could break something. On the Course this only matters on big drops; normal jumps are fine.',
    tries: ['Keep the drop and change the time you spend bending your knees from 0.05 s to 0.3 s.', 'Then keep the knees and change the drop.', 'Guess how much it will hurt: 0 is a feather, 10 is broken bones.'],
    shapeWords: { inverse: 'a falling curve: stop over twice the time and it hurts half as much (an inverse proportion).', root: 'a curve that flattens: dropping four times as high only doubles the hurt (it grows with the square root of the height).' },
    rule: 'How much it hurts is the speed you have to lose divided by the time you take to lose it.',
    formula: 'average push = √(2 × g × drop height) ÷ stop time, and ouch ≈ push ÷ 10',
    formulaWords: 'This is exact for an even stop and no air resistance; the "ouch" number is the game\'s own scale (about 6 means you stumble, 8 or more means you could be hurt).',
    apply: (f) => {
      const d = f.biggestDrop;
      if (!d) return 'This course has no drops. Hold the down arrow when you land from a big drop in your own courses.';
      return `The biggest drop in this course is ${d.height.toFixed(1)} m: stiff-legged it hurts ${d.ouchStiff.toFixed(1)} out of 10, with bent knees ${d.ouchBent.toFixed(1)}.
Hold the down arrow when you land from a big drop; normal jumps need no knee-bend.`;
    },
  },

};
