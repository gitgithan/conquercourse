// Predesigned worlds for the World Editor's course list: a passing one to see what a good lane looks like, and a broken one to try Fix it and the design partner on.
export interface PresetPiece { src: string; x: number; z: number; y: number; yaw: number; scale: number }
export interface Preset { id: string; label: string; note: string; pieces: PresetPiece[] }

// the coaster course: a 22 m rail from a high start, a 5 m flight with a bar over it, then a deck (the sources are the ones the editor saves)
const COASTER_START = 'track:0,9;7,5;14,1;22,0.6';
const raw = (src: string, x: number, y = 0): PresetPiece => ({ src, x, z: 0, y, yaw: 0, scale: 1 });

const at = (file: string, x: number, o: Partial<PresetPiece> = {}): PresetPiece => ({ src: `obj:${file}.glb`, x, z: 0, y: 0, yaw: 0, scale: 1, ...o });

export const PRESETS: Preset[] = [
  {
    id: 'passing', label: 'Park run (clears)', note: 'Five real objects in a row: low box, picnic table, stairs, wall, planter. The simulator can clear it.',
    pieces: [at('box-skate-03', 4.2), at('picnic-table', 10), at('stairs-park-07', 16), at('gabion-wall', 23.4), at('planter-concrete', 29.2)],
  },
  {
    id: 'coaster', label: 'Coaster to a bar (clears)', note: 'Ride a rail down from a high start, fly across a gap, catch the bar and land on the deck. Drag the purple dots in the side view to reshape the rail.',
    pieces: [raw(COASTER_START, 11), raw('hold:bar', 24.5, 2.5), raw('box:10:0.4:2', 32, -0.8)],
  },
  {
    id: 'green-bar', label: 'Green hang bar (clears)', note: 'Two decks 9 m apart with the green frame between them. Jump, hold E at the amber rod and swing across.',
    pieces: [raw('box:8:0.5:1.8', 0), raw('box:8:0.5:1.8', 17), at('pullup-green', 8.5, { yaw: Math.PI / 2 }), raw('hold:bar', 8.5, 2.16)],
  },
  {
    id: 'black-bar', label: 'Black hang bar (clears)', note: 'The same gap with the black frame, its bar a little lower (2.05 m). Jump, hold E at the amber rod and swing across.',
    pieces: [raw('box:8:0.5:1.8', 0), raw('box:8:0.5:1.8', 17), at('pullup-black', 8.5, { yaw: Math.PI / 2 }), raw('hold:bar', 8.5, 2.01)],
  },
  {
    id: 'failing', label: 'Broken park (needs Fix it)', note: 'The same kind of objects, but a gap is too wide and a wall too tall. Press Fix it to see the partner repair it.',
    pieces: [at('box-skate-03', 3), at('picnic-table', 12), at('stairs-park-07', 17), at('gabion-wall', 22, { y: 0.9 }), at('planter-concrete', 31)],
  },
];
