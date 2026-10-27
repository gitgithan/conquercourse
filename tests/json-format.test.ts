import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('every tracked JSON file is pretty-printed (run `npm run format:json`)', () => {
  expect(() => execFileSync('node', ['scripts/format-json.mjs', '--check'], { encoding: 'utf8' })).not.toThrow();
});
