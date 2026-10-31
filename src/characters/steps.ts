// The stage names of a character job and the words a player reads (CC-108). Same order as pipelines/charmaker/contracts.py STAGES (a test keeps them equal).
import type { Step } from '../slice/stages';

export const CHARACTER_STEPS: Step[] = [
  { id: 'picture', words: 'Drawing your character' },
  { id: 'cutout', words: 'Cutting it out' },
  { id: 'mesh', words: 'Building the 3D shape' },
  { id: 'rig', words: "Fitting it to the runner's bones" },
  { id: 'package', words: 'Checking the size and packing it' },
  { id: 'done', words: 'Done' },
];

/** One creation as the list shows it. `thumb` is a data: URL of a small WebP; the glb is never in the list. */
export interface CharacterCard { id: string; kind: 'character' | 'object'; name: string; prompt: string; provider: string; route: string; bytes: number; faces: number; picks: number; keeper: boolean; ts: string; mine: boolean; thumb: string }
export const KEEPER_PICKS = 10;
export const PANEL_SIZE = 24;
export const EXPIRY_DAYS = 14;
