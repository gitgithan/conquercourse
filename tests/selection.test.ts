import { describe, expect, it } from 'vitest';
import { applyMarquee, chosenIds, countText, isMarquee, pickInRect, rectFrom, toggleId, withoutIds } from '../src/ui/selection';

describe('choosing several pieces (CC-200)', () => {
  it('a rectangle can be dragged in any direction', () => {
    expect(rectFrom(10, 20, 2, 5)).toEqual({ x0: 2, y0: 5, x1: 10, y1: 20 });
  });
  it('a tiny drag is a click, not a marquee', () => {
    expect(isMarquee(rectFrom(5, 5, 7, 6))).toBe(false);
    expect(isMarquee(rectFrom(5, 5, 40, 6))).toBe(true);
  });
  it('picks the pieces inside the box and counts an edge that touches it', () => {
    const items = [{ id: 1, x: 5, y: 5 }, { id: 2, x: 50, y: 5 }, { id: 3, x: 12, y: 5, r: 3 }, { id: 4, x: 5, y: 80 }];
    expect(pickInRect(items, rectFrom(0, 0, 10, 10))).toEqual([1, 3]);
    expect(pickInRect(items, rectFrom(0, 0, 100, 100))).toEqual([1, 2, 3, 4]);
    expect(pickInRect(items, rectFrom(200, 200, 300, 300))).toEqual([]);
  });
  it('Shift+click adds a piece, and takes it out when it is already chosen', () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleId([1, 2, 3], 2)).toEqual([1, 3]);
    expect(toggleId([], 4)).toEqual([4]);
  });
  it('a marquee replaces the choice, or adds to it with Shift, with no repeats', () => {
    expect(applyMarquee([1], [2, 3], false)).toEqual([2, 3]);
    expect(applyMarquee([1, 2], [2, 3], true)).toEqual([1, 2, 3]);
  });
  it('the group counts only while the main choice is in it and the pieces still exist', () => {
    const live = (id: number) => id !== 9;
    expect(chosenIds([1, 2, 3], 3, live)).toEqual([1, 2, 3]);
    expect(chosenIds([1, 2, 3], 7, live)).toEqual([7]); // something else was chosen since: the group is stale
    expect(chosenIds([1, 9, 3], 3, live)).toEqual([1, 3]);
    expect(chosenIds([], null, live)).toEqual([]);
    expect(chosenIds([1], 1, live)).toEqual([1]);
  });
  it('says how many are chosen', () => {
    expect(countText(3)).toBe('3 selected');
    expect(countText(1)).toBe('1 selected');
  });
  it('deleting removes every chosen piece and keeps the others in order', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(withoutIds(list, [2, 4])).toEqual([{ id: 1 }, { id: 3 }]);
    expect(withoutIds(list, [])).toEqual(list);
  });
});
