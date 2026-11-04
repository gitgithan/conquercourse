// Predesigned worlds for the World Editor's course list: a passing one to see what a good lane looks like, and a broken one to try Make it easier and the design partner on.
export interface PresetPiece { src: string; x: number; z: number; y: number; yaw: number; scale: number; decor?: boolean; stay?: boolean } // decor: seen but not ground; stay: the editor leaves it exactly where it is
export interface Preset { id: string; label: string; note: string; pieces: PresetPiece[] }

// the coaster course: a 22 m rail from a high start, a 5 m flight with a bar over it, then a deck (the sources are the ones the editor saves)
const COASTER_START = 'track:0,9;7,5;14,1;22,0.6';
const raw = (src: string, x: number, y = 0): PresetPiece => ({ src, x, z: 0, y, yaw: 0, scale: 1 });

const at = (file: string, x: number, o: Partial<PresetPiece> = {}): PresetPiece => ({ src: `obj:${file}.glb`, x, z: 0, y: 0, yaw: 0, scale: 1, ...o });

// the fork course's photo objects live with the demo course, so the editor reaches them by a path out of its object folder
const fork = (file: string, x: number, y: number): PresetPiece => ({ src: `obj:../demo/fork-objects/${file}.glb`, x, z: 0, y, yaw: 0, scale: 1, decor: true, stay: true });
// the fork course's ground, the same decks and bench tops as the saved course (the photo objects above are only what you see)
// a shorter start deck (13.5 m, was 20): the runner picks up enough speed on it; 12 m is too short for the simulator (owner, 2026-11-05)
const forkDecks = [raw('box:13.8:0.5:1.8', 3.40, -0.5), raw('box:20:0.5:1.8', 36, -0.5)];
// the bulb lane: a climbing pole and the bar row it hands over to (the same numbers as the saved fork course)
const forkBars = Array.from({ length: 8 }, (_, i) => raw('hold:bar', 10.4 + 2 * i, 4.26));
const forkBenches = [13.7, 18.3, 22.9].map((x) => raw('box:2.4:0.45:1.8', x, 0));

export const PRESETS: Preset[] = [
  {
    id: 'swing', label: 'Hang bar and Lache (clears)', note: 'Three decks. Jump, hold E at the amber rod of the real hang bar to swing across, then do it again on the two Lache bars.',
    pieces: [raw('box:8:0.5:1.8', 0), at('pullup-green', 8.5, { yaw: Math.PI / 2 }), raw('hold:bar', 8.5, 2.16), raw('box:8:0.5:1.8', 17), raw('hold:bar', 23.5, 2.86), raw('hold:bar', 27, 2.86), raw('box:8:0.5:1.8', 34)],
  },
  {
    id: 'passing', label: 'Park run (clears)', note: 'Five real objects in a row: low box, picnic table, stairs, wall, planter. The simulator can clear it.',
    pieces: [at('box-skate-03', 4.2), at('picnic-table', 10), at('stairs-park-07', 16), at('gabion-wall', 23.4), at('planter-concrete', 29.2)],
  },
  {
    id: 'coaster', label: 'Coaster to a deck (clears)', note: 'Ride a rail down from a high start, jump off whenever you like, fly across the gap and land on the deck. Click the rail to add a dot, drag a dot to move it.',
    pieces: [raw(COASTER_START, 11), raw('box:10:0.4:2', 32, -0.8)],
  },
  {
    id: 'fork', label: 'Bench lane, with the bulb lane in view (clears)', note: 'The simulator runs and vaults the three park benches. The pole and the bulb bars above them are the other way across: the check proves that lane too, and the ghost can run either.',
    pieces: [...forkDecks, ...forkBenches, fork('fork-bench', 13.7, -3), fork('fork-bench', 18.3, -3), fork('fork-bench', 22.9, -3), raw('pole:4.3', 10, 0), ...forkBars, fork('fork-bulbs', 17.4, 3.286)],
  },
  {
    id: 'failing', label: 'Broken park (needs a repair)', note: 'The same kind of objects, but a gap is too wide and a wall too tall. Choose Find a repair to let the simulator search for changes.',
    pieces: [at('box-skate-03', 3), at('picnic-table', 12), at('stairs-park-07', 17), at('gabion-wall', 22, { y: 0.9 }), at('planter-concrete', 31)],
  },
];
