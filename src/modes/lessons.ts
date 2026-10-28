import type { Context, Experiment, Shape } from '../sim/experiments';
import type { CourseFacts } from '../course/facts';
import { GRAVITY } from '../sim/units';
import { MATERIALS, RIDER_MASS, secondMoment, worstCase, type PlankData } from '../sim/beam';
import { DEFAULT_WALL } from '../sim/wall';
import { DEFAULT_RECOIL } from '../sim/recoil';

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

const RIDER_KG = 80; // the rider's weight in the lever lesson (the same as the experiment's)
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
  lever: {
    why: 'A lever turns about its pivot, and what turns it is not only the weight but how far from the pivot the weight hangs. That turning effect is called a moment. A trebuchet is a lever with a heavy weight on the short side and you on the long side: while the weight wins, the arm turns, your end swings up and over, and you are thrown.',
    tries: ['Keep the weight\'s distance and drag yours from 2 to 8 m: watch how much weight it takes to balance you.', 'Now drag the weight\'s distance from 0.5 to 3 m: the same balance needs a lighter and lighter weight.', 'Find two settings with a heavy weight close in and a light weight far out that balance you equally.'],
    shapeWords: { inverse: 'a falling curve: put the weight twice as far from the pivot and half the weight balances you (an inverse proportion).', direct: 'a straight line: sit twice as far out and you need twice the weight to balance you (a direct proportion).' },
    rule: 'Each side turns the arm by its weight times its distance from the pivot. When the two are equal the arm is balanced and does not swing; when the weight side is bigger it wins. Weight and distance trade: double one and halve the other for the same turn.',
    formula: 'weight × its distance from the pivot = your weight × your distance from the pivot (moment = force × distance)',
    formulaWords: 'This is exact for a light arm that does not bend: the arm is balanced when the moments are equal. A real trebuchet\'s arm has weight too, which moves the balance a little. Once the weight wins, a longer throwing arm moves its tip faster for the same turn, because the tip travels a bigger circle in the same time.',
    inputs: ['near', 'far'],
    calc: (v) => { const m = (RIDER_KG * v.far) / v.near; return { label: 'weight that balances you', value: m, unit: 'kg', working: `${RIDER_KG} × ${v.far.toFixed(1)} ÷ ${v.near.toFixed(2)} = ${m.toFixed(0)} kg`, note: `Your moment is ${RIDER_KG} × ${v.far.toFixed(1)} = ${(RIDER_KG * v.far).toFixed(0)} kg·m. The weight must match it.` }; },
    apply: () => 'On the Launch course, the weight is 1200 kg at 1.3 m, which is a moment of 1560 kg·m against your 80 kg at 5.5 m, 440 kg·m. The weight wins by a lot, so the arm turns hard. Pull the pin with →, then press Space at the moment the hint says LET GO NOW.',
  },
  recoil: {
    why: 'When the launcher throws a ball backward, the ball does not just leave: it pushes you the other way. The push each side carries is its mass times its speed, and the two are equal and opposite. A heavy ball moves slowly and a lighter runner moves fast, but what they carry is the same.',
    tries: ['Drag the ball speed from 10 to 40 m/s and watch your speed grow.', 'Keep the speed and make the ball twice as heavy: how much more push do you get?', 'Find two settings, one with a heavy slow ball and one with a light fast ball, that push you about the same.'],
    shapeWords: { direct: 'a straight line: a ball twice as fast gives you twice the push (a direct proportion).' },
    rule: 'Whatever push the ball carries away backward, you carry forward. A heavier or a faster ball carries more, so it pushes you harder. The heavy side moves slowly, the light side moves fast.',
    formula: 'ball mass × ball speed = your mass × your speed (momentum = mass × velocity, both measured against the ground)',
    formulaWords: 'This is exact when you and the ball start together and nothing else pushes along the lane (in the air nothing does; on the ground the ground only takes the upward part). The launcher\'s rating is the ball\'s speed against you, so against the ground the ball is a little slower. In the Course you also keep the speed you already had.',
    inputs: ['mass', 'muzzle'],
    calc: (v) => { const m = DEFAULT_RECOIL.charMass, push = (v.mass * v.muzzle) / (m + v.mass); return { label: 'your speed after the shot', value: push, unit: 'm/s', working: `${v.mass.toFixed(0)} × ${v.muzzle.toFixed(0)} ÷ (${m} + ${v.mass.toFixed(0)}) = ${push.toFixed(2)} m/s`, note: `Against the ground the ball goes backward at ${(m * push / v.mass).toFixed(1)} m/s: ${v.mass.toFixed(0)} × ${(m * push / v.mass).toFixed(1)} = ${m} × ${push.toFixed(2)}.` }; },
    apply: () => { const p = DEFAULT_RECOIL, push = (p.ballMass * p.muzzle) / (p.charMass + p.ballMass); return `On the Recoil course the ball is ${p.ballMass} kg and leaves at ${p.muzzle} m/s, so one shot gives you ${push.toFixed(1)} m/s on top of your running speed.\nRun onto the teal pad to clip the launcher on, jump at the edge and press K just after you leave the ground: in the air nothing slows the push, so it carries you through the whole flight.`; },
  },
  cannon: {
    why: 'A cannon throws the ball backward and down, so the push on you goes forward and up. The push has a size, set by the ball, and a direction, set by the barrel. Tilt the barrel steeper and more of the push goes into height and less into distance, so there is a best angle in the middle.',
    tries: ['Drag the angle from 10° to 80° and watch the landing: where is it farthest?', 'Keep the best angle and make the ball twice as heavy: how much farther do you fly?', 'Find two angles on either side of the best one that land you at the same place.'],
    shapeWords: { hump: 'a hill: the distance rises, peaks near the middle angle, and falls again. A flat shot and a steep shot can land in the same place.' },
    rule: 'The push is split into a forward part and an upward part by the angle. The forward part decides how fast you cover ground; the upward part decides how long you stay in the air. Both together make the distance, and the middle angle balances them best.',
    formula: 'distance = (speed × cos angle) × (2 × speed × sin angle ÷ g), where speed = ball mass × ball speed ÷ (your mass + ball mass)',
    formulaWords: 'This is exact for level ground and no air (g = 9.81 m/s²): the forward speed times the time in the air. It is largest at 45° because sin and cos trade evenly there. If you land lower than you started, a slightly flatter angle is better; a steep shot also lands harder, and a landing above about 9.8 m of fall is too hard even with a roll.',
    inputs: ['angle', 'mass', 'muzzle'],
    calc: (v) => { const m = DEFAULT_RECOIL.charMass, sp = (v.mass * v.muzzle) / (m + v.mass), a = (v.angle * Math.PI) / 180, d = (2 * sp * sp * Math.sin(a) * Math.cos(a)) / GRAVITY; return { label: 'distance on level ground', value: d, unit: 'm', working: `(${sp.toFixed(1)} × cos ${v.angle.toFixed(0)}°) × (2 × ${sp.toFixed(1)} × sin ${v.angle.toFixed(0)}° ÷ ${GRAVITY}) = ${d.toFixed(1)} m`, note: `Your speed after the shot is ${v.mass.toFixed(0)} × ${v.muzzle.toFixed(0)} ÷ (${m} + ${v.mass.toFixed(0)}) = ${sp.toFixed(1)} m/s.` }; },
    apply: () => 'On the Cannon course, tilt the barrel with ↑ ↓ until the dotted path ends on the far deck, then press K. The far deck is 4 m lower, so a steep shot lands too hard: tap X just before the ground to roll it out.',
  },
  coaster: {
    why: 'A coaster has no engine. The only energy it has is the height it starts from. Going down, height turns into speed; going up the next hill, speed turns back into height. So the first hill decides how high any later hill can be.',
    tries: ['Drag the first hill from 4 m to 10 m and watch the highest hill the cart can climb.', 'Keep the hill and add a push of 3 m/s: how much more does it climb?', 'Find the smallest first hill that can still climb a hill 7 m high.'],
    shapeWords: { direct: 'a straight line: every extra metre on the first hill gives about one extra metre of climb (a direct proportion), a little less each time because friction takes some.' },
    rule: 'The cart climbs about as high as it started, plus a little for the push. Friction and air take a little, so it always stops a bit lower.',
    formula: 'highest hill = start height + push² ÷ (2 × g)',
    formulaWords: 'This is exact with no friction or air (g = 9.81 m/s²): speed squared over two g is the height that speed can buy. With friction the cart reaches a little less. The shape of the track in between does not matter, only the heights.',
    inputs: ['height', 'push'],
    calc: (v) => { const h = v.height + (v.push * v.push) / (2 * GRAVITY); return { label: 'highest hill the cart can climb', value: h, unit: 'm', working: `${v.height.toFixed(1)} + ${v.push.toFixed(1)}² ÷ (2 × ${GRAVITY}) = ${h.toFixed(2)} m` }; },
    apply: () => 'On a coaster course, keep every later hill lower than the first hill plus a little for the push.\nIf the cart stalls, raise the first hill or lower the hill it stopped on.\nIf it leaves the rails on a hilltop, make that top broader, or hold ↓ to brake before it.',
  },
  bridge: {
    why: 'A plank laid across a gap bends under your weight, most in the middle. How much it bends decides how much the run slows, and past a point the plank snaps. Planks are not strong because they are long, they are strong because they are thick.',
    tries: ['Make the gap 2 m, then 4 m, then 8 m and watch the sag.', 'Keep the gap at 4 m and make the plank twice as thick: what happens to the sag?', 'Put a post under the middle: what does it do to the sag at 8 m?'],
    shapeWords: { cube: 'a curve that bends sharply upward: twice the gap makes the plank sag eight times as much (the sag grows with the length multiplied by itself three times).', 'inverse-cube': 'a curve that falls steeply: a plank twice as thick sags eight times less (the sag falls with the thickness multiplied by itself three times).' },
    rule: 'Twice as long means eight times the sag. Twice as thick means one eighth of the sag. A post in the middle makes two planks of half the length, so each sags eight times less.',
    formula: 'sag = load × length³ ÷ (48 × stiffness × I), with I = width × thickness³ ÷ 12',
    formulaWords: "This is exact for a plank resting on its two ends with the load in the middle, ignoring the plank's own weight (load = your weight in newtons, stiffness = 9 000 000 000 N/m² for pine, width 0.6 m). I measures how well the thickness resists bending. A real plank also has knots, and wood creeps with time.",
    inputs: ['span', 'thickness'],
    calc: (v) => { const pk: PlankData = { x0: 0, x1: v.span, y: 0, thickness: v.thickness / 100, width: 0.6, material: 'wood' }; const F = RIDER_MASS * GRAVITY, E = MATERIALS.wood.E, I = secondMoment(pk); const d = (F * v.span ** 3) / (48 * E * I); return { label: 'extra sag with you in the middle', value: d * 100, unit: 'cm', working: `${F.toFixed(0)} × ${v.span.toFixed(2)}³ ÷ (48 × ${E / 1e9} GPa × ${I.toExponential(2)}) = ${(d * 100).toFixed(1)} cm` }; },
    apply: () => { const pk: PlankData = { x0: 0, x1: 9, y: 0, thickness: 0.035, width: 0.6, material: 'wood' }; const thin = { ...pk, thickness: 0.02 }; return `The Plank bridge course has a 9 m pine plank, 3.5 cm thick. It dips about ${(worstCase(pk).sag * 100).toFixed(0)} cm and holds (${(worstCase(pk).ratio * 100).toFixed(0)}% of what pine can take).\nThe same plank at 2 cm thick is ${worstCase(thin).ratio >= 1 ? 'past what pine can take: it snaps' : 'still holding'}.\nIf your plank breaks: make it thicker, shorten the gap, or put a post under the middle.`; },
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
