import type { Bed } from './music';
import type { ShotTag } from './tags';

// The 20 s hook as data: every shot is a whole number of beats, so every cut lands on the music.
// The tempo comes from scripts/measure-bpm.py (stored in the data file with the file it was measured on), never typed by hand.
export interface HookShot {
  name: string;
  beats: number;
  tag: ShotTag; note?: string; model?: string;
  src?: string; from?: number; // a clip in the media folder and where in it the shot starts, s
  kind?: 'clip' | 'character' | 'end'; // character = the CC-131 slot, end = the end card
  into?: 'cut' | 'whip' | 'flash'; // how this shot arrives
  push?: number; // slow zoom over the shot, 0.06 = 6%
  caption?: string;
}
export interface HookData {
  title: string; line: string; fps: number; width: number; height: number;
  music: Bed & { start: number; measuredFrom: string; measuredBpm: number };
  characterIntro?: string;
  shots: HookShot[];
}

export const hookBeats = (d: HookData) => d.shots.reduce((n, s) => n + s.beats, 0);
export const hookSeconds = (d: HookData) => hookBeats(d) * (60 / d.music.bpm);

