import type { Bed } from './music';
import type { ShotTag } from './tags';

// The owner's cut (CC-209) as data: every shot is a whole number of beats at 100 bpm, so every cut lands on the music (docs/film-craft.md, "The owner's cut").
// UI recordings are real-time screen captures with waits in them; `parts` picks the good windows (seconds into the clip) and plays them back to back.
export interface DemoPart { from: number; dur: number }
export interface DemoShot {
  name: string;
  beats: number;
  tag: ShotTag; note?: string;
  src?: string; from?: number; // a clip in the media folder and where in it the shot starts, s
  kind?: 'clip' | 'lache' | 'playnow' | 'credits'; // clip = plain footage; lache = footage that dims into the logo; playnow/credits = built cards
  parts?: DemoPart[];
  left?: string; right?: string; // playnow only: the two rookie clips
}
export interface DemoFilmData {
  title: string; line: string; fps: number; width: number; height: number;
  music: Bed & { start: number; measuredFrom: string; measuredBpm: number };
  credits: string[];
  shots: DemoShot[];
}

export const demoBeats = (d: DemoFilmData) => d.shots.reduce((n, s) => n + s.beats, 0);
export const demoSeconds = (d: DemoFilmData) => demoBeats(d) * (60 / d.music.bpm);
