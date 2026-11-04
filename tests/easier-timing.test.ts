import { expect, it } from 'vitest';
import { timingComparison, timingName } from '../src/slice/easier-timing';

it('names the actual measured movement, including release and reach windows', () => {
  expect(timingName('edge at 17 m')).toBe('Jump take-off at 17 m');
  expect(timingName('vault at step at -2 m')).toBe('Vault press at -2 m');
  expect(timingName('hang on bar 2')).toBe('Release from Bar 2');
  expect(timingName('bars: narrowest reach')).toBe('Hardest monkey-bar reach');
});
it('keeps different bottlenecks visible rather than pretending they are one timing', () => {
  const w = { best: 0, lo: 0, hi: 1 };
  expect(timingComparison({ ...w, obstacle: 'edge at 17 m', widthMs: 314 }, { ...w, obstacle: 'hang on bar 2', widthMs: 400 })).toEqual([
    'Before: Jump take-off at 17 m — 314 ms.',
    'After: Release from Bar 2 — 400 ms.',
    'The hardest press has 86 ms more room.',
  ]);
});
