import { expect, it } from 'vitest';
// @ts-expect-error plain .mjs script
import { findings } from '../scripts/check-personal.mjs';

it('no tracked file holds a real email address, a home folder path or a public IP (run `node scripts/check-personal.mjs`)', () => {
  expect(findings()).toEqual([]);
});
