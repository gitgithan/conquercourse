import { describe, expect, it } from 'vitest';
import { DEMO_LOADERS, MODE_LOADERS } from '../src/main-loaders';

// The words src/main.ts answered before the tables existed (recorded from main, CC-133 item 5). A screen that is added shows up here on purpose.
const MODES_BEFORE = ['diagrams', 'parts', 'rookie', 'lineup', 'dojo', 'editor', 'map', 'coaster', 'lab-search', 'lab-vision', 'lab-gentest', 'lab-signal', 'lab-ik', 'lab-rl', 'lab-optimization', 'lab-integration', 'lab-camera', 'lab-hashing', 'lab-detector', 'lab-timing', 'lab-lift', 'lab-motion', 'lab-collision', 'lab-partner', 'lab-systemdesign', 'lab-slicer', 'communities', 'gallery', 'park', 'labs-map'];
const DEMOS_BEFORE = ['captured-vault', 'welcome-tile', 'rookie', 'group', 'groupmoves', 'poses', 'hurt-ab', 'roll-ab', 'lineup', 'actor'];

describe('screen tables', () => {
  it('answer to exactly the mode words main.ts always knew', () => { expect(Object.keys(MODE_LOADERS).sort()).toEqual([...MODES_BEFORE].sort()); });
  it('answer to exactly the demo words main.ts always knew', () => { expect(Object.keys(DEMO_LOADERS).sort()).toEqual([...DEMOS_BEFORE].sort()); });
  it('do not claim the default Course', () => { expect(MODE_LOADERS.course).toBeUndefined(); });
});
