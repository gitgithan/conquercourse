// Predesigned worlds for the World Editor's course list: a passing one to see what a good lane looks like, and a broken one to try Fix it and the design partner on.
export interface PresetPiece { src: string; x: number; z: number; y: number; yaw: number; scale: number }
export interface Preset { id: string; label: string; note: string; pieces: PresetPiece[] }

const at = (file: string, x: number, o: Partial<PresetPiece> = {}): PresetPiece => ({ src: `obj:${file}.glb`, x, z: 0, y: 0, yaw: 0, scale: 1, ...o });

export const PRESETS: Preset[] = [
  {
    id: 'passing', label: 'Park run (clears)', note: 'Five real objects in a row: low box, picnic table, stairs, wall, planter. The simulator can clear it.',
    pieces: [at('box-skate-03', 4.2), at('picnic-table', 10), at('stairs-park-07', 16), at('gabion-wall', 23.4), at('planter-concrete', 29.2)],
  },
  {
    id: 'failing', label: 'Broken park (needs Fix it)', note: 'The same kind of objects, but a gap is too wide and a wall too tall. Press Fix it to see the partner repair it.',
    pieces: [at('box-skate-03', 3), at('picnic-table', 12), at('stairs-park-07', 17), at('gabion-wall', 22, { y: 0.9 }), at('planter-concrete', 31)],
  },
];
