import { describe, expect, it } from 'vitest';
import { cardOf, dojoOf, OBSTACLES, type ObstacleRow } from '../src/course/obstacles';
import { MODE_INFO } from '../src/course/modes';

// Recorded from the branching code before it moved into the rows (CC-133, item 2a): these must not change.
const DOJO_BEFORE: Record<string, string> = { lache: 'bars', launch: 'lever', band: 'stored', plank: 'bridge', gap: 'gap', wall: 'wall', recoil: 'recoil', rope: 'rope', climb: 'climb' };
const CARD_BEFORE: Record<string, string> = { gap: 'gap', step: 'step', vault: 'vaultbox', wall: 'warped', climb: 'tallwall', rope: 'ropeswing', trampoline: 'trampoline', drop: 'drop', lache: 'lache', plank: 'plank', stack: 'stack', coaster: 'coaster', launch: 'trebuchet', band: 'band', drone: 'drone', recoil: 'recoil' };
const MODES_BEFORE: Record<string, [string, boolean, string | undefined]> = {
  run: ['Running', false, undefined], wall: ['On the wall', false, undefined], swing: ['Swinging', false, undefined], bounce: ['Bouncing', false, undefined],
  hang: ['Hanging', false, 'Let go now'], vault: ['Vaulting', false, undefined], cart: ['In the cart', true, 'Cart rolls on'], launch: ['In the sling', true, 'Let go now'],
  plank: ['plank', false, undefined], climb: ['Climbing', false, undefined], band: ['On the band', true, 'Turn round now'], drone: ['On the drone', true, 'Come down now'], pole: ['On the pole', false, 'Let go now'],
};

describe('obstacle table', () => {
  it('gives the Dojo lesson the Train link always used', () => {
    for (const [id, ex] of Object.entries(DOJO_BEFORE)) expect(dojoOf(id), id).toBe(ex);
  });
  it('gives the Parts card every zone id always got, numbered ids too', () => {
    for (const [id, card] of Object.entries(CARD_BEFORE)) { expect(cardOf(id), id).toBe(card); expect(cardOf(id + '-2'), id).toBe(card); }
    expect(cardOf('landing')).toBeUndefined();
    expect(cardOf('fork')).toBeUndefined();
  });
  it('keeps every mode name, machine flag and next press', () => {
    expect(Object.fromEntries(Object.entries(MODE_INFO).map(([m, i]) => [m, [i.name, !!i.machine, i.next]]))).toEqual(MODES_BEFORE);
  });
  it('has an obstacle row for every machine mode', () => {
    const modes = new Set(Object.values(OBSTACLES).map((r) => (r as ObstacleRow).mode));
    for (const [m, i] of Object.entries(MODE_INFO)) if (i.machine) expect(modes.has(m as never), m).toBe(true);
  });
});
