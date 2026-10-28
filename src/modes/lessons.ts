import type { Context, Experiment, Shape } from '../sim/experiments';
import type { CourseFacts } from '../course/facts';
import { GRAVITY } from '../sim/units';
import { DEFAULT_WALL } from '../sim/wall';

// The guided lesson for each obstacle: why it matters, what to try, what shape the relationship has, a rule of
// thumb, the exact formula (earned, last), and what it means on the Course. Plain words; formulas only here.
export interface Lesson {
  why: string;
  tries: string[];
  shapeWords: Partial<Record<Shape, string>>;
  rule: string;
  formula: string;
  formulaWords: string;
  inputs: string[]; // the knobs the formula uses; the formula page gives each a slider
  calc: (v: Record<string, number>) => { label: string; value: number; unit: string; working: string; note?: string }; // the formula with the sliders' numbers in it
  apply: (f: CourseFacts, ctx: Context, v: Record<string, number>) => string; // lines separated by \n; numbers come from the course in play
}

export const LESSONS: Record<Experiment['id'], Lesson> = {
  gap: {
    why: 'A gap is a promise you make at the edge: once your feet leave the ground, nothing you do in the air changes how far you fly. So the jump is won or lost by how fast you run and how hard you push up.',
    tries: ['Drag the run-up speed to 4, then to 8, and watch where you land.', 'Now keep the speed and change the take-off push.'],
    shapeWords: {
      direct: 'a straight line: twice the speed flies twice as far (a direct proportion). The push upward does the same.',
    },
    rule: 'Distance grows with speed multiplied by push. Double either one and you fly twice as far. Gravity pulls the other way: it keeps you from flying far.',
    formula: 'distance = 2 × speed × push ÷ g',
    formulaWords: 'This is exact for a jump that takes off and lands at the same height and ignores air resistance (g = 9.81 m/s²). The 2 comes from the time going up plus the time coming down. Landing on a higher platform, or air resistance, makes the real distance a little shorter.',
    inputs: ['speed', 'jump'],
    calc: (v) => { const d = (2 * v.speed * v.jump) / GRAVITY; return { label: 'distance', value: d, unit: 'm', working: `2 × ${v.speed.toFixed(1)} × ${v.jump.toFixed(1)} ÷ ${GRAVITY} = ${d.toFixed(1)} m` }; },
    apply: (f, c, v) => {
      if (!f.gaps.length) return 'This course has no gaps. Draw one in the Park to practise here.';
      const lines = f.gaps.map((g, k) => `Gap ${k + 1}: ${g.width.toFixed(1)} m wide${g.rise > 0.05 ? `, landing ${g.rise.toFixed(1)} m higher` : ''}. You need at least ${g.needed.toFixed(1)} m/s at the edge.`);
      lines.push(c.width ? `The gap you came from is ${c.width.toFixed(1)} m wide: with your push of ${v.jump.toFixed(1)} m/s the formula says ${((c.width * GRAVITY) / (2 * v.jump)).toFixed(1)} m/s.` : 'Watch the speed meter on the Course and jump only when it is past the number.');
      return lines.join('\n');
    },
  },
  wall: {
    why: 'The warped wall cannot lift you: it only spends the speed you bring. Your speed is energy of motion, and climbing turns it into height. A taller wall does not change how high your speed can lift you; it only decides whether your hands can reach the top.',
    tries: ['Drag the speed to 4, then 6, then 8, and watch the line grow.', 'Now change only the wall height. Watch the line you climbed: it does not move.'],
    shapeWords: { square: 'a curve that bends upward: twice the speed lifts you four times as high (the height grows with the speed multiplied by itself).' },
    rule: 'Height grows with the square of the speed. Friction on the wall takes a little off, but the shape stays the same.',
    formula: 'height = speed² ÷ (2 × g)',
    formulaWords: 'This is exact when no energy is lost: energy of motion (½ × mass × speed²) turning into height energy (mass × g × height); the mass cancels. Friction on the wall costs about 10 % in the game, so the climb is a little lower than the formula says.',
    inputs: ['speed', 'height'],
    calc: (v) => { const h = (v.speed * v.speed) / (2 * GRAVITY); return { label: 'height your feet climb', value: h, unit: 'm', working: `${v.speed.toFixed(1)}² ÷ (2 × ${GRAVITY}) = ${h.toFixed(2)} m`, note: 'The wall height is not in the formula: change it and the answer does not move.' }; },
    apply: (f, c) => {
      const w = f.wall;
      if (!w) return 'This course has no warped wall.';
      const H = c.wallHeight ?? w.height;
      return `The wall in this course is ${H.toFixed(1)} m high. Your hands reach ${(DEFAULT_WALL.hipHeight + DEFAULT_WALL.reach).toFixed(1)} m above your feet, so your feet must climb ${(H - DEFAULT_WALL.hipHeight - DEFAULT_WALL.reach).toFixed(1)} m.\nYou need at least ${w.needSpeed.toFixed(1)} m/s at the foot of the wall (the speed meter shows it as you approach).`;
    },
  },
  rope: {
    why: 'On the rope you swap speed for height and back again. The rope gives back every bit of height you give it. Where you let go decides which way you are flung: too early and you fall short, too late and you fall back.',
    tries: ['Keep the other settings and move the release angle from 20° to 100°.', 'Find the angle that flies furthest.', 'Then try a different rope length.'],
    shapeWords: { hump: 'a hill: the distance rises, peaks, then falls. There is a best moment to let go, and it is while you are still going up.' },
    rule: 'Letting go early sends you far but low; letting go late sends you high but back. The best release is part-way up the swing.',
    formula: 'speed at release² = speed at grab² − 2 × g × height gained',
    formulaWords: 'This is exact for a stiff rope and no air resistance: energy is conserved on the swing. After release you fly like a thrown ball, so the distance follows the same rule as the gap jump.',
    inputs: ['speed', 'length', 'angle'],
    calc: (v) => {
      const gain = v.length * (1 - Math.cos((v.angle * Math.PI) / 180)), sq = v.speed * v.speed - 2 * GRAVITY * gain;
      return sq < 0
        ? { label: 'speed when you let go', value: 0, unit: 'm/s', working: `${v.speed.toFixed(1)}² − 2 × ${GRAVITY} × ${gain.toFixed(2)} is below zero`, note: 'You run out of speed before that angle: the swing turns around first.' }
        : { label: 'speed when you let go', value: Math.sqrt(sq), unit: 'm/s', working: `√(${v.speed.toFixed(1)}² − 2 × ${GRAVITY} × ${gain.toFixed(2)}) = ${Math.sqrt(sq).toFixed(2)} m/s`, note: `The height gained is length × (1 − cos angle) = ${gain.toFixed(2)} m.` };
    },
    apply: (f, c, v) => (f.rope ? `The rope in this course is ${(c.ropeLength ?? f.rope.length).toFixed(0)} m long and hangs from ${f.rope.anchorHeight.toFixed(1)} m up. Grab it on the way up, hold on while you are rising, and let go near ${Math.round(v.angle)}° of the swing.` : 'This course has no rope.'),
  },
  bars: {
    why: 'On a bar you hang like a pendulum. How long one swing takes depends on the length of your swing and nothing else. But the size of the swing is yours to change: push in step with it and it grows, push against it and it fades.',
    tries: ['Drag the length from 1 to 3 m and watch how the time of one swing grows.', 'Keep the length and push with the swing for 6 seconds, then push against it.', 'Find how long you need to push to swing high enough to reach the next bar.'],
    shapeWords: { root: 'a curve that flattens: four times the length makes the swing take only twice as long (the time grows with the square root of the length).' },
    rule: 'A longer swing is slower. Pushing in step with the swing adds energy every time, so it grows; pushing out of step takes energy away.',
    formula: 'time of one swing = 2π × √(length ÷ g)',
    formulaWords: 'This is exact for a small swing of a point on a stiff arm and no air resistance (g = 9.81 m/s²). A big swing takes a little longer. The body is a rod, so the length is two thirds of the way from hands to feet. The size of the swing does not appear: that is why you can grow it without changing its beat.',
    inputs: ['length'],
    calc: (v) => { const T = 2 * Math.PI * Math.sqrt(v.length / GRAVITY); return { label: 'time of one swing', value: T, unit: 's', working: `2π × √(${v.length.toFixed(2)} ÷ ${GRAVITY}) = ${T.toFixed(2)} s` }; },
    apply: () => 'On the lache pair, hold E on the bar and push the arrow the way you swing: the swing grows each time. Let go when the hint says LET GO NOW.',
  },
  trampoline: {
    why: 'A trampoline is a spring: it stores the energy of your landing and gives it back. The harder you land, the higher it throws you. And you can add to it: pressing Space at the bottom of the bounce adds speed on top of what the spring returns.',
    tries: ['Drop from 1 m, then 2 m, then 4 m, with no extra push.', 'Watch how much of your height you get back each time.', 'Now add an extra push at the bottom and see how much higher you go.'],
    shapeWords: { direct: 'a straight line: drop twice as high and you bounce twice as high (a direct proportion), a little lower than you came because the spring loses some energy.' },
    rule: 'The spring gives back a fixed share of your height. A press adds speed to the speed the spring gives, and height grows with the square of the total speed, so a small push at the right moment buys a lot of height.',
    formula: 'bounce height ≈ (spring speed + extra push)² ÷ (2 × g), where spring speed ≈ √(2 × g × efficiency × drop height)',
    formulaWords: 'The efficiency is about 0.8 here (1.0 would be a perfect spring), so this is a good approximation, not an exact law. The extra push is 0 to 2 m/s in the Course, depending on how well you time the press.',
    inputs: ['drop', 'press'],
    calc: (v) => { const sp = Math.sqrt(2 * GRAVITY * 0.8 * v.drop), h = ((sp + v.press) ** 2) / (2 * GRAVITY); return { label: 'bounce height', value: h, unit: 'm', working: `(${sp.toFixed(2)} + ${v.press.toFixed(1)})² ÷ (2 × ${GRAVITY}) = ${h.toFixed(2)} m`, note: `The spring speed is √(2 × ${GRAVITY} × 0.8 × ${v.drop.toFixed(1)}) = ${sp.toFixed(2)} m/s.` }; },
    apply: (f) => {
      const t = f.trampoline;
      if (!t) return 'This course has no trampoline.';
      return `You drop ${t.drop.toFixed(1)} m onto the trampoline. The spring alone throws you ${t.springHeight.toFixed(1)} m high, and the far platform is ${t.farRise.toFixed(1)} m up.
You need an extra ${t.extraNeeded.toFixed(1)} m/s of push (a perfect press gives ${t.pump.toFixed(1)} m/s): press Space while you press into the trampoline.`;
    },
  },
  landing: {
    why: 'Stopping is a push from the ground. The same stop spread over more time is a gentler push, which is why bent knees save you. Past a limit the push is too hard and you stumble. On the Course this only matters on big drops; normal jumps are fine.',
    tries: ['Keep the drop and drag the knee-bend time from 0.05 s to 0.5 s: the block gets wider and shorter, but its area never changes.', 'Then keep the knees and change the drop: the area grows, because there is more speed to lose.'],
    shapeWords: { inverse: 'a falling curve: stop over twice the time and the push is half as big (an inverse proportion).', root: 'a curve that flattens: dropping four times as high only doubles the push (it grows with the square root of the height).' },
    rule: 'The push is the speed you have to lose divided by the time you take to lose it. On the graph, the block\'s area is the speed you lose; a wider block must be shorter.',
    formula: 'push = √(2 × g × drop height) ÷ stop time',
    formulaWords: 'This is exact for an even stop and no air resistance. The push is measured in metres per second per second; dividing by g = 9.81 tells you how many times gravity it is. In the Course, a push above 60 m/s² makes you stumble.',
    inputs: ['drop', 'bend'],
    calc: (v) => { const sp = Math.sqrt(2 * GRAVITY * v.drop), F = sp / v.bend; return { label: 'push on you', value: F, unit: 'm/s²', working: `√(2 × ${GRAVITY} × ${v.drop.toFixed(1)}) ÷ ${v.bend.toFixed(2)} = ${sp.toFixed(2)} ÷ ${v.bend.toFixed(2)} = ${F.toFixed(0)} m/s²`, note: `That is ${(F / GRAVITY).toFixed(1)} times gravity. The Course makes you stumble above 60 m/s².` }; },
    apply: (f) => {
      const d = f.biggestDrop;
      if (!d) return 'This course has no drops. Hold the down arrow when you land from a big drop in your own courses.';
      return `The biggest drop in this course is ${d.height.toFixed(1)} m: stiff-legged the ground pushes you with ${d.pushStiff.toFixed(0)} m/s², with bent knees ${d.pushBent.toFixed(0)} m/s². Above 60 m/s² you stumble.\nHold the down arrow when you land from a big drop; normal jumps need no knee-bend.`;
    },
  },

};
