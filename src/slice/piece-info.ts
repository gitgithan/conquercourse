// What every piece of the editor's Add menu is, in plain words (CC-96): the picture, the name, what it does and where it came from.
// The browser (src/ui/piece-browser.ts) shows this beside the grid; no heights or sizes here: the simulator says whether a lane clears.
import { LIBRARY } from './shapes';
import { PATTERNS } from './stack';

export type Section = 'ground' | 'swing' | 'contraptions' | 'real' | 'stacks' | 'tools';
export const SECTION_NAME: Record<Section, string> = { ground: 'Ground', swing: 'Swing', contraptions: 'Contraptions', real: 'Real objects', stacks: 'Stacks', tools: 'Extras' };
export const SECTION_ORDER: Section[] = ['real', 'ground', 'swing', 'contraptions', 'stacks', 'tools']; // Real objects first, and the one that opens (owner 2026-11-01)

// The move that gets a player past a real object (CC-110): the by-move view of the Real objects tab groups by these.
export type Move = 'jump' | 'climb' | 'vault' | 'hang' | 'balance' | 'duck';
export const MOVE_ORDER: Move[] = ['jump', 'climb', 'vault', 'hang', 'balance', 'duck'];
export const MOVE_NAME: Record<Move, string> = { jump: 'Jump over', climb: 'Climb up', vault: 'Vault', hang: 'Swing and hang', balance: 'Balance', duck: 'Duck under' };
export const MOVE_EMPTY: Record<Move, string> = {
  jump: '', climb: '', vault: '', hang: '', balance: '',
  duck: 'No real object for this move yet. Make your own can bring one from a photo of a real object.',
};

export interface PieceInfo {
  id: string; // also the icon file name: public/assets/pieces/<id>.webp and <id>-large.webp
  section: Section;
  name: string;
  does: string; // one or two sentences: the move that crosses it
  from: string; // where it came from
  move?: Move; // real objects only: the move that gets past it
  button: string; // the editor's own button that adds it (a CSS selector inside the add menu)
}

const built = 'A built-in shape, made in code.';
const SHAPES: Record<string, { does: string }> = {
  bench: { does: 'A low seat. Run at it and jump on, or hop over it.' },
  'low-wall': { does: 'A wall in the way. Vault over it, or climb up if it is too tall to vault.' },
  block: { does: 'A plain block: a step up, a platform or a ledge to land on.' },
  steps: { does: 'A staircase. Run up it, or jump off the top.' },
  rail: { does: 'A handrail on legs. Jump on it or go past it.' },
  brick: { does: 'A toy brick. Scale it up to make a block of any size.' },
};

const GROUND: PieceInfo[] = LIBRARY.map((l) => ({ id: l.id, section: 'ground', name: l.label.replace(/ \(3 cm\)$/, ''), does: SHAPES[l.id]?.does ?? 'A shape to run over or jump onto.', from: built, button: `#add-${l.id}` }));

const SWING: PieceInfo[] = [
  { id: 'bar', section: 'swing', name: 'Bar', does: 'One bar in the air. Jump, grab it with E and let go to fly on.', from: 'A built-in piece. Only bars hang overhead.', button: '#addbar' },
  { id: 'lache', section: 'swing', name: 'Lache pair', does: 'Two bars to swing between. Grab the first, pump the swing with the arrows and let go to reach the second.', from: 'A built-in piece, the classic ninja-warrior swing.', button: '#addlache' },
  { id: 'rope', section: 'swing', name: 'Rope swing', does: 'A post with a rope on top. Put it over a gap, catch the rope in the air and swing across.', from: 'A built-in piece. The post is the rope anchor.', button: '#addrope' },
];

const CONTRAPTIONS: PieceInfo[] = [
  { id: 'trebuchet', section: 'contraptions', name: 'Trebuchet', does: 'A throwing arm with a heavy counterweight. Sit in the sling and let go at the right moment to fly.', from: 'A contraption: the arm turns, the heavier weight throws farther.', button: '#addtreb' },
  { id: 'launcher', section: 'contraptions', name: 'Launcher', does: 'An air launcher throws a ball backward and you are pushed forward. Heavy and slow, or light and fast: the same push.', from: 'A contraption that shows momentum.', button: '#addrecoil' },
  { id: 'cannon', section: 'contraptions', name: 'Cannon', does: 'A big wheeled air cannon. Aim it with Up and Down, fire it with K, and fly forward as the ball goes back.', from: 'A contraption that shows momentum, with a big push.', button: '#addcannon' },
  { id: 'band', section: 'contraptions', name: 'Elastic band', does: 'Run away from the post to stretch the band, turn round, and it throws you forward.', from: 'A contraption that shows stored energy.', button: '#addband' },
  { id: 'drone', section: 'contraptions', name: 'Drone', does: 'A pad with a cargo drone. Hold E to board it and fly across a gap.', from: 'A contraption that shows lift and weight.', button: '#adddrone' },
  { id: 'plank', section: 'contraptions', name: 'Plank bridge', does: 'A plank laid across a gap. It sags under the runner and breaks if it is too thin or too long.', from: 'A contraption that shows bending.', button: '#addplank' },
];

const STACK_TEXT = 'Sport-stacking cups piled in a pattern. Climb the steps they make and cross the gaps between pyramids.';
const STACKS: PieceInfo[] = PATTERNS.map((p) => ({ id: `stack-${p.id}`, section: 'stacks', name: p.label, does: STACK_TEXT, from: 'Made from the sport-stacking cup patterns.', button: `#addstack-${p.id}` }));

// real objects lifted from photos (public/assets/objects/index.json): the words are written here, the credit comes from the index
export const REAL_INFO: Record<string, { name: string; does: string }> = {
  'rail-skate-01': { name: 'Handrail', does: 'A park handrail with its posts. Jump onto it or go past it.' },
  'box-skate-03': { name: 'Skate platform', does: 'A long low box with a step at one end. Run up it or jump over it.' },
  'bench-concrete': { name: 'Concrete bench', does: 'A park bench made of concrete. Jump on it or vault it.' },
  'stairs-park-07': { name: 'Park stairs', does: 'A flight of real park stairs. Run up, or leap off the top.' },
  'rail-skate-02': { name: 'Stair handrail', does: 'A handrail that follows a flight of stairs. Jump onto it or go past it.' },
  'railing-iron': { name: 'Iron railing', does: 'A long iron railing. Jump onto it or hop over it.' },
  'bollard-iron': { name: 'Iron bollard', does: 'A cast-iron post with a round top, from a street corner. Jump over it or hop on top.' },
  'hydrant-red': { name: 'Fire hydrant', does: 'A red street hydrant. Leap over it, or land on its round top.' },
  'barrel-oak': { name: 'Oak barrel', does: 'A wooden barrel standing on its end, with steel hoops. Jump onto it or over it.' },
  'planter-concrete': { name: 'Concrete planter', does: 'A wide, low bowl of concrete. Jump onto its rim, or run across and over.' },
  'gabion-wall': { name: 'Stone-basket wall', does: 'A stepped wall of stones in wire baskets. Climb it one step at a time.' },
  'pipe-concrete': { name: 'Concrete pipe', does: 'A big concrete pipe standing on its end. Jump up and pull yourself on top.' },
  'picnic-table': { name: 'Picnic table', does: 'A park picnic table with seats on both sides. Vault the table, or step up from a seat.' },
  'bench-curved': { name: 'Curved bench', does: 'A curved concrete bench on a stand. Jump on it or vault it.' },
  'railing-red': { name: 'Canal railing', does: 'A long maroon railing with twisted posts, from a canal path. Vault over it.' },
  'pullup-green': { name: 'Green hang bar', does: 'A green frame with a bar across the top. Jump, grab the bar and swing on.' },
  'pullup-black': { name: 'Black hang bar', does: 'Two black posts with a bar between them. Jump, grab it and swing on.' },
  'log-driftwood': { name: 'Driftwood log', does: 'A bleached tree trunk with its roots. Hop on and keep your balance along it.' },
  'stump-spruce': { name: 'Spruce stump', does: 'A tall split stump with a flared foot. Hop onto the base and balance.' },
};
export const REAL_MOVE: Record<string, Move> = {
  'bollard-iron': 'jump', 'hydrant-red': 'jump', 'barrel-oak': 'jump', 'planter-concrete': 'jump', 'box-skate-03': 'jump',
  'gabion-wall': 'climb', 'pipe-concrete': 'climb', 'stairs-park-07': 'climb',
  'picnic-table': 'vault', 'bench-curved': 'vault', 'railing-red': 'vault', 'bench-concrete': 'vault', 'railing-iron': 'vault',
  'pullup-green': 'hang', 'pullup-black': 'hang',
  'log-driftwood': 'balance', 'stump-spruce': 'balance', 'rail-skate-01': 'balance', 'rail-skate-02': 'balance',
};
export const realInfo = (o: { name: string; label: string; author: string; licence: string }): PieceInfo => ({
  id: `real-${o.name}`, section: 'real', name: REAL_INFO[o.name]?.name ?? o.label, move: REAL_MOVE[o.name], does: REAL_INFO[o.name]?.does ?? 'A real object from a photo.',
  from: `A real photo by ${o.author} (${o.licence}), turned into a 3D object by SAM 3D.`, button: `[data-object="${o.name}"]`,
});

const TOOLS: PieceInfo[] = [
  { id: 'person', section: 'tools', name: 'Person for scale', does: 'A person stands in the world so you can see how big things are. Click again to hide them.', from: 'The Rookie character, made to a normal person size.', button: '[data-object="person"]' },
  { id: 'demo-scene', section: 'tools', name: 'Demo scene', does: 'A whole example scene to look at and build on.', from: 'The demo scene bundled with the game.', button: '[data-object="demo-scene"]' },
  { id: 'import', section: 'tools', name: 'Import a 3D file', does: 'Bring in your own 3D object as a .glb file.', from: 'Your file. It stays in your browser.', button: '#import' },
];

export const STATIC_PIECES: PieceInfo[] = [...GROUND, ...SWING, ...CONTRAPTIONS, ...STACKS, ...TOOLS];
