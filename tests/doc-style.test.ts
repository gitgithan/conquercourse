import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('docs keep one sentence per bullet (run `node scripts/doc-style.mjs --fix`)', () => {
  expect(() => execFileSync('node', ['scripts/doc-style.mjs'], { encoding: 'utf8' })).not.toThrow();
});
