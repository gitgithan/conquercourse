// The Parts gallery list (CC-118 family; docs/parts-gallery.md): every move and every obstacle the game has, one card each.
// Pure data, no page code. tests/parts-gallery.test.ts checks it covers every obstacle kind, every course field that places something,
// every input bit and every world mode, so a new part without a card fails the test.
import { cardOf, OBSTACLES, type ObstacleId, type ObstacleRow } from '../course/obstacles';

export type PartGroup = 'move' | 'obstacle' | 'special';
/** bot: the real Course plays the stored best run by itself. hand: the real Course opens and the viewer plays it with the keys. none: no live scene. */
export type Live = { how: 'bot' | 'hand'; course: string } | { how: 'none'; why: string };

export interface Part {
  id: string;
  group: PartGroup;
  name: string;
  line: string; // one plain line of what it does
  keys: string; // which keys do it
  made?: string; // special parts: what it is made of
  saying?: string; // special parts: the physics saying (docs/sayings.md)
  covers: { bits?: string[]; modes?: string[]; obstacles?: ObstacleId[]; fields?: string[] };
  live: Live;
  clip?: string; // a recorded motion file under public/assets/motion that the runner plays for this move
}

const sayingOf = (id: ObstacleId): string => (OBSTACLES[id] as ObstacleRow).saying ?? '';
const bot = (course: string): Live => ({ how: 'bot', course });
const P = '/assets/parts/', D = '/assets/demo/';

export const PARTS: Part[] = [
  // ---- special obstacles first on the page (the owner's inventions and the ones tied to a saying and a lesson)
  { id: 'trebuchet', group: 'special', name: 'Trebuchet', line: 'Sit in the sling. A falling weight swings the arm and throws you onto the tower.', keys: 'Hold →, then Space when the hint says so',
    made: 'an arm on a pivot + a heavy counterweight + a sling + a pin + a landing tower (the hard version adds a bar to catch)', saying: sayingOf('launch'),
    covers: { modes: ['launch'], obstacles: ['launch'], fields: ['trebuchet'] }, live: bot(D + 'launch-bar.course.json') },
  { id: 'recoil', group: 'special', name: 'Recoil launcher', line: 'Step on the pad, fire, and the ball goes back while you go forward.', keys: 'K to fire',
    made: 'a pad + a launcher + a heavy ball that flies backward + the runner who flies forward', saying: sayingOf('recoil'),
    covers: { bits: ['fire'], obstacles: ['recoil'], fields: ['recoil'] }, live: bot(D + 'recoil.course.json') },
  { id: 'cannon', group: 'special', name: 'Cannon', line: 'Tilt the barrel, fire, and the recoil throws you; dots show where you will land.', keys: 'Up or W tilts higher, Down or S flatter, K fires',
    made: 'the recoil pad + a barrel you tilt + a dotted landing path + a rolled landing', saying: sayingOf('cannon'),
    covers: { bits: ['aimUp', 'aimDown'], obstacles: ['cannon'] }, live: bot(D + 'cannon.course.json') },
  { id: 'band', group: 'special', name: 'Elastic band', line: 'Run away to stretch the band, turn round, and it throws you over a gap.', keys: 'Hold ←, then hold →',
    made: 'a post + an elastic band + a gap you could never jump from a run-up', saying: sayingOf('band'),
    covers: { modes: ['band'], obstacles: ['band'], fields: ['band'] }, live: bot(D + 'band.course.json') },
  { id: 'drone', group: 'special', name: 'Drone ferry', line: 'Board a cargo drone on its pad and lean it across a gap.', keys: 'Hold E on the pad, ← → lean, ↑ ↓ climb or descend',
    made: 'a pad + a cargo drone that flies where it leans + a landing deck', saying: 'Lean to go, but a leaning drone must push harder to stay up.',
    covers: { bits: ['up'], modes: ['drone'], obstacles: ['drone'], fields: ['drone'] }, live: bot(D + 'drone.course.json') },
  { id: 'coaster', group: 'special', name: 'Coaster', line: 'A cart rolls on rails with no engine; brake before a hilltop that bends away too fast.', keys: 'Nothing to start, S brakes, Space jumps out',
    made: 'rails (a smooth curve) + a cart + hills + a brake', saying: sayingOf('coaster'),
    covers: { modes: ['cart'], obstacles: ['coaster'], fields: ['track'] }, live: bot(D + 'coaster-two-hills.course.json') },
  { id: 'pole', group: 'special', name: 'Pole vault', line: 'Pick up the pole, plant it, and let go at the top; your speed comes back as height.', keys: 'Hold E to pick up and plant, let go of E at the top',
    made: 'a pole on the ground + a plant box + a bar + a cushion', saying: 'The pole cannot lift you; it hands your speed back as height.',
    covers: { modes: ['pole'], fields: ['pole'] }, live: { how: 'hand', course: '/assets/experiments/pole/pole.course.json' } },
  { id: 'plank', group: 'special', name: 'Plank bridge', line: 'A plank over a gap sags under you; too thin and it breaks.', keys: 'Run across (→)',
    made: 'a gap + a plank that bends + a post in the middle when it is too long', saying: sayingOf('plank'),
    covers: { modes: ['plank'], obstacles: ['plank'], fields: ['planks'] }, live: bot(D + 'plank-two.course.json') },
  { id: 'stack', group: 'special', name: 'Cup stacks', line: 'Sport-stacking cups as stairs: speed climbs them, and carries you off the top.', keys: 'Run (→), Space for each step',
    made: 'cups piled in steps (3-6-3) + a flat top + a drop', saying: sayingOf('stack'),
    covers: { obstacles: ['stack'] }, live: bot(D + 'stack.course.json') },
  { id: 'shots', group: 'special', name: 'Timed balls', line: 'A cannon fires a ball on a fixed clock; learn the beat and cross between two balls.', keys: 'Space to jump a low ball, tap S to slide under a high one',
    made: 'cannons + a shared clock + a jump + a slide + a wall to wait on', saying: 'A moving danger is only a clock: learn its beat, then cross between two beats.',
    covers: { fields: ['shots'] }, live: bot(D + 'cannonballs.course.json') },
  { id: 'lache', group: 'special', name: 'Lache bars', line: 'Swing on one bar, let go and catch the next; push in step with the swing.', keys: 'Hold E to grab, ← → to pump, let go of E to fly',
    made: 'two bars in the air + a body that pumps the swing + a second grab', saying: sayingOf('lache'),
    covers: { modes: ['hang'], obstacles: ['lache'], fields: ['holds'] }, live: bot(P + 'lache.course.json'), clip: 'hang.json' },
  { id: 'forks', group: 'special', name: 'Two ways (forks)', line: 'The course splits once; both ways are proved to work and the better one depends on how you run.', keys: 'The same keys as the parts on each way',
    made: 'a fork + two or three routes made of the other parts + a join', covers: { fields: ['branches'] }, live: bot(D + 'two-ways.course.json') },

  // ---- basic obstacles
  { id: 'gap', group: 'obstacle', name: 'Gap', line: 'Water below. Jump at the edge and land on the deck on the far side.', keys: 'Space at the edge, → held', saying: sayingOf('gap'),
    covers: { obstacles: ['gap', 'landing'] }, live: bot(P + 'gap.course.json') },
  { id: 'step', group: 'obstacle', name: 'Step up', line: 'A step too tall to walk onto: jump up it.', keys: 'Space', covers: { obstacles: ['step'] }, live: bot(P + 'step.course.json') },
  { id: 'vaultbox', group: 'obstacle', name: 'Vault box', line: 'A box about as tall as your waist: put a hand on it and go over.', keys: 'V as you reach it', saying: sayingOf('vault'),
    covers: { obstacles: ['vault'] }, live: bot(P + 'vault.course.json') },
  { id: 'warped', group: 'obstacle', name: 'Warped wall', line: 'A curved wall: run up it and grab the top edge.', keys: 'Run, hold E for the last moment', saying: sayingOf('wall'),
    covers: { obstacles: ['wall'], fields: ['wall'] }, live: bot(P + 'wall.course.json') },
  { id: 'tallwall', group: 'obstacle', name: 'Tall wall', line: 'A straight wall too tall to jump: grab the edge and pull yourself up.', keys: 'Hold E at the wall', saying: sayingOf('climb'),
    covers: { obstacles: ['climb'] }, live: bot(P + 'climb.course.json') },
  { id: 'ropeswing', group: 'obstacle', name: 'Rope swing', line: 'A rope hangs over a gap: catch it, swing, and let go on the way up.', keys: 'Jump, hold E to catch, Space to let go', saying: sayingOf('rope'),
    covers: { obstacles: ['rope'], fields: ['rope'] }, live: bot(P + 'rope.course.json') },
  { id: 'trampoline', group: 'obstacle', name: 'Trampoline', line: 'A springy bed: land hard and it throws you high.', keys: 'Space the moment you land', saying: sayingOf('trampoline'),
    covers: { obstacles: ['trampoline'] }, live: bot(P + 'trampoline.course.json') },
  { id: 'drop', group: 'obstacle', name: 'Big drop', line: 'A ledge high above the floor: bend your knees and roll to land safely.', keys: 'Hold S, press X as you land', saying: sayingOf('drop'),
    covers: { obstacles: ['drop'] }, live: bot(D + 'drop.course.json') },
  { id: 'objects', group: 'obstacle', name: 'Real objects', line: 'Benches, rails and stairs from a real park, placed in the World Editor, become the ground you run on.', keys: 'The same keys as the other parts',
    covers: { fields: ['scene'] }, live: bot(D + 'park-run.course.json') },

  // ---- moves
  { id: 'run', group: 'move', name: 'Run and brake', line: 'Hold a direction to speed up; let go and your feet skid to a stop.', keys: '→ or D to run, ← or A to go back',
    covers: { bits: ['run', 'left'], modes: ['run'] }, live: bot(P + 'run.course.json'), clip: 'run.json' },
  { id: 'jump', group: 'move', name: 'Jump', line: 'Press Space at the edge: once your feet leave the ground, the jump is already decided.', keys: 'Space',
    covers: { bits: ['jump'] }, live: bot(P + 'gap.course.json'), clip: 'leap.json' },
  { id: 'bend', group: 'move', name: 'Bend your knees', line: 'Soft knees, safe landing: the same stop, spread over more time.', keys: 'Hold S or Down while you fall',
    covers: { bits: ['squat'] }, live: bot(D + 'drop.course.json'), clip: 'land.json' },
  { id: 'slide', group: 'move', name: 'Slide', line: 'Go low and slide under a high ball.', keys: 'Tap S or Down while running fast',
    covers: { bits: ['slide'] }, live: { how: 'hand', course: D + 'cannonballs.course.json' }, clip: 'slide.json' },
  { id: 'roll', group: 'move', name: 'Roll', line: 'Turn your fall into a roll and the ground forgives you.', keys: 'X as you land',
    covers: { bits: ['roll'] }, live: bot(D + 'drop.course.json'), clip: 'roll.json' },
  { id: 'vault', group: 'move', name: 'Vault', line: 'Keep your speed and go over a box with one hand on it.', keys: 'V as you reach the box',
    covers: { bits: ['vault'], modes: ['vault'] }, live: bot(P + 'vault.course.json'), clip: 'vault.json' },
  { id: 'climb', group: 'move', name: 'Climb', line: 'Speed gets you to the wall; arms get you over it.', keys: 'Hold E at the wall',
    covers: { bits: ['handL', 'handR'], modes: ['climb'] }, live: bot(P + 'climb.course.json'), clip: 'climb.json' },
  { id: 'hang', group: 'move', name: 'Hang and swing', line: 'Hold a bar with your hands, swing your legs to move your hands, let go to fly.', keys: 'Hold E, ← → to pump, let go of E',
    covers: { modes: ['hang'] }, live: bot(P + 'lache.course.json'), clip: 'hang.json' },
  { id: 'ropegrab', group: 'move', name: 'Catch the rope', line: 'Fall to rise: the rope gives back every bit of height you give it.', keys: 'Hold E to catch, Space to let go',
    covers: { modes: ['swing'] }, live: bot(P + 'rope.course.json'), clip: 'swing.json' },
  { id: 'wallrun', group: 'move', name: 'Run up the wall', line: 'The wall cannot lift you; it only spends the speed you bring.', keys: 'Run, hold E at the lip',
    covers: { modes: ['wall'] }, live: bot(P + 'wall.course.json') },
  { id: 'bounce', group: 'move', name: 'Bounce', line: 'Press at the bottom of the bounce for a little extra height.', keys: 'Space at the bottom',
    covers: { modes: ['bounce'] }, live: bot(P + 'trampoline.course.json') },
  { id: 'ride', group: 'move', name: 'Ride the cart', line: 'The cart carries you along the rails; brake or jump out when you choose.', keys: 'S brakes, Space jumps out',
    covers: { modes: ['cart'] }, live: bot(D + 'coaster-two-hills.course.json') },
];

export const GROUP_TITLES: Record<PartGroup, string> = { special: 'Special obstacles', obstacle: 'Obstacles', move: 'Moves' };
export const partById = (id: string): Part | undefined => PARTS.find((p) => p.id === id);

/** Obstacle kinds the gallery covers on a page other than a card: the whole-course row (the "How a course is made" view). */
export const COVERED_BY_VIEW: ObstacleId[] = ['course'];
/** Course fields that only set up or label a course: not a part. */
export const PLAIN_FIELDS = ['version', 'name', 'startX', 'finishX', 'jumpSpeed', 'terrain', 'checkpoints', 'zones', 'jumpKeep', 'grabReach', 'keepDecks', 'hazard'];

/** The parts a course is made of, in the order they come along the run (zones first, then machines the zones do not name). */
export function partsOfCourse(c: {
  zones?: { id: string; x0: number }[]; wall?: { x0: number }; rope?: { anchorX: number }; holds?: { x: number }[]; track?: unknown;
  trebuchet?: { x: number }; recoil?: { x0: number; kind?: string }; planks?: { x0: number }[]; band?: { x: number }; drone?: { x0: number }; pole?: { pickX: number };
  branches?: { forkX: number }[]; shots?: { x: number }[]; scene?: unknown[]; terrain: { platforms: { top: number; bouncy?: boolean; x0: number }[] };
}): string[] {
  const at: [number, string][] = [];
  for (const z of c.zones ?? []) { const k = z.id.replace(/-\d+$/, '') === 'fork' ? 'forks' : cardOf(z.id); if (k) at.push([z.x0, k]); }
  if (c.recoil?.kind === 'bigcannon') for (const a of at) if (a[1] === 'recoil') a[1] = 'cannon';
  const has = (k: string) => at.some(([, a]) => a === k);
  const add = (k: string, x: number) => { if (!has(k)) at.push([x, k]); };
  if (c.trebuchet) add('trebuchet', c.trebuchet.x);
  if (c.band) add('band', c.band.x);
  if (c.drone) add('drone', c.drone.x0);
  if (c.recoil) add(c.recoil.kind === 'bigcannon' ? 'cannon' : 'recoil', c.recoil.x0);
  if (c.track) add('coaster', 0);
  if (c.pole) add('pole', c.pole.pickX);
  if (c.planks?.length) add('plank', c.planks[0].x0);
  if (c.wall) add('warped', c.wall.x0);
  if (c.rope) add('ropeswing', c.rope.anchorX);
  if (c.holds?.length) add('lache', c.holds[0].x);
  if (c.branches?.length) add('forks', c.branches[0].forkX);
  if (c.shots?.length) add('shots', c.shots[0].x);
  const bounce = c.terrain.platforms.find((p) => p.bouncy);
  if (bounce) add('trampoline', bounce.x0);
  if (c.scene?.length) add('objects', 0);
  return at.sort((a, b) => a[0] - b[0]).map(([, k]) => k).filter((k, i, all) => all.indexOf(k) === i);
}
