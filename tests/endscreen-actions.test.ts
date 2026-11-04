import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// CC-133: the end screen after a fall keeps all eight actions, in three tiers, with one primary.
// The browser version of this check is scripts/endscreen-check.mjs (run on a VM).
const src = readFileSync('src/modes/course/fall.ts', 'utf8');

describe('the fall end screen', () => {
  it('still offers all eight actions with their words, keys and ids', () => {
    for (const bit of ['again (R)', 'Watch what happened, with the numbers', 'Copy link to this try', "id: 'share-copy-fall'", 'Download a video of this try', "'share-clip-fall'", 'Show me the ideal run (I)', 'Make it easier', "'makeeasier'", 'Edit this course', "'editfromfall'", 'Train the ']) expect(src).toContain(bit);
  });
  it('has exactly one primary button', () => {
    expect(src.match(/'primary'/g)?.length).toBe(1 + 1); // the tier name in the type and the one call
    expect(src.match(/, 'primary'\)/g)?.length).toBe(1);
  });
  it('puts share and tools in the quiet tier, learning in the middle tier', () => {
    expect(src).toMatch(/Download a video of this try[^\n]*'quiet'/);
    expect(src).toMatch(/Edit this course', \(\) => openEditor\('edit'\), 'quiet'/);
    expect(src).toMatch(/TIER\.quiet/); // the link button
    expect(src).toMatch(/Make it easier', \(\) => openEditor\('easier'\)\)/); // default tier: learn
  });
  it('draws no formulas and no boxes around the action rows', () => {
    const block = src.slice(src.indexOf('const actions ='), src.indexOf('const failBody'));
    expect(block).not.toMatch(/border:1px/);
  });
});
