// Honesty tags from docs/research/demo-video.md: every shot says what it is.
export type ShotTag = 'REAL' | 'META' | 'GFX';
export const TAG_TEXT: Record<ShotTag, string> = {
  REAL: 'Real capture of the running game',
  META: 'Made with a Meta model',
  GFX: 'Title or graphic',
};
