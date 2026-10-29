import type { Bed, Duck } from './lib/music';
import type { ShotTag } from './lib/tags';

export interface Caption { from: number; to: number; text: string }
export interface ClipShot { src: string; seconds: number; tag: ShotTag; model?: string; note?: string; label?: string } // src is inside the media folder
export interface IntroData {
  title: string; line: string; fps: number; width: number; height: number;
  clips: ClipShot[]; // played back to back, each one cross-fades into the next
  crossfade: number; // seconds
  captions: Caption[];
  music: Bed & { start: number }; // start = where in the track the film begins
  duck: Duck[];
  endSeconds: number; // the title/end overlay at the very end
  characterIntro?: string; // SLOT: the ninja-warrior entry clip, when another agent has made it
}
