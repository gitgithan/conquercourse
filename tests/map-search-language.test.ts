import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// The World Slicer asks the map's address service in English, whatever language the browser is set to.
test('every address lookup in the map screen asks for English names', () => {
  const src = readFileSync('src/modes/map.ts', 'utf8');
  const calls = src.match(/nominatim\.openstreetmap\.org\/(search|reverse)\?[^`]*/g) ?? [];
  expect(calls.length).toBeGreaterThanOrEqual(2);
  for (const c of calls) expect(c).toContain('accept-language=en');
});
