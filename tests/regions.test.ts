import { describe, expect, it } from 'vitest';
import { Regions } from '../src/ui/regions';

// CC-248: copy, paste, delete and undo on the picked regions.
describe('regions on a photo', () => {
  it('Ctrl+C then Ctrl+V drops a copy a little to the side, and the copy is the one chosen', () => {
    const r = new Regions(1000, 800);
    const a = r.add([100, 100, 300, 250], 'bench');
    expect(r.key({ key: 'c', ctrlKey: true })).toBe(true);
    r.key({ key: 'v', ctrlKey: true });
    expect(r.list).toHaveLength(2);
    expect(r.list[1].label).toBe('bench');
    expect(r.list[1].box[0]).toBeGreaterThan(a.box[0]);
    expect([...r.selected]).toEqual([r.list[1].id]);
    r.key({ key: 'v', ctrlKey: true });
    expect(r.list[2].box[0]).toBeGreaterThan(r.list[1].box[0]);
  });
  it('a pasted copy stays inside the photo', () => {
    const r = new Regions(300, 300);
    r.add([200, 200, 300, 300]); r.copy(); r.paste();
    for (const x of r.list) expect(x.box[2]).toBeLessThanOrEqual(300);
  });
  it('Delete removes the chosen regions and Ctrl+Z brings them back', () => {
    const r = new Regions(1000, 800);
    r.add([10, 10, 100, 100]); r.add([200, 200, 300, 300]); r.selectAll();
    r.key({ key: 'Delete' });
    expect(r.list).toHaveLength(0);
    r.key({ key: 'z', ctrlKey: true });
    expect(r.list).toHaveLength(2);
  });
  it('arrow keys nudge, shift nudges further, and nothing leaves the photo', () => {
    const r = new Regions(100, 100);
    const a = r.add([0, 0, 40, 40]);
    r.key({ key: 'ArrowRight' }); expect(a.box[0]).toBe(2);
    r.key({ key: 'ArrowLeft', shiftKey: true }); expect(a.box[0]).toBe(0);
  });
  it('clicking a suggestion picks it, shift-click adds more, clicking again drops it', () => {
    const r = new Regions(100, 100);
    const a = r.add([0, 0, 10, 10], '', 'suggested'), b = r.add([20, 20, 30, 30], '', 'suggested');
    r.toggle(a.id); r.toggle(b.id, true);
    expect(r.selected.size).toBe(2);
    r.toggle(b.id, true);
    expect([...r.selected]).toEqual([a.id]);
  });
});
