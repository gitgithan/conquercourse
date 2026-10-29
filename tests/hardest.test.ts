import { describe, expect, it } from 'vitest';
import { goldOld, hardestLabel, hardestOf } from '../src/ui/hardest';

describe('hardest obstacle (CC-183)', () => {
  it('no falls: no gold', () => expect(hardestOf([])).toBeNull());
  it('most falls wins', () => expect(hardestOf(['gap', 'rope', 'rope', 'gap', 'rope'])).toEqual({ id: 'rope', falls: 3 }));
  it('a tie goes to the latest fall', () => {
    expect(hardestOf(['gap', 'rope', 'gap', 'rope'])).toEqual({ id: 'rope', falls: 2 });
    expect(hardestOf(['rope', 'gap'])).toEqual({ id: 'gap', falls: 1 });
  });
  it('label is plain words', () => {
    expect(hardestLabel('Rope', 3)).toBe('Hardest for you: Rope (3 falls)');
    expect(hardestLabel('Gap', 1)).toBe('Hardest for you: Gap (1 fall)');
  });
  it('the name starts with a capital', () => expect(hardestLabel('gap', 2)).toBe('Hardest for you: Gap (2 falls)'));
  it('?gold=old is the switch', () => { expect(goldOld('?gold=old')).toBe(true); expect(goldOld('?x=1')).toBe(false); });
});
