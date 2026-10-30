import { expect, it } from 'vitest';
// @ts-expect-error plain .mjs helper
import { broken } from '../scripts/check-doc-links.mjs';

it('markdown links point at tracked files', () => {
  expect(broken({ mentions: false })).toEqual([]);
});
