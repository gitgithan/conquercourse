import { describe, expect, it } from 'vitest';
import { boxEdgeContact, edgeNote, NOTE_PAD, padBox, padGeometry, padRetryOn, touchesEdge } from '../src/slice/photo-edge';

describe('CC-170 photo edge', () => {
  it('a box inside the photo touches no edge; a box on one side touches that side only', () => {
    expect(touchesEdge(boxEdgeContact([100, 100, 400, 300], 1000, 800))).toBe(false);
    expect(boxEdgeContact([0, 100, 400, 300], 1000, 800)).toEqual({ left: true, top: false, right: false, bottom: false });
    expect(boxEdgeContact([600, 100, 1000, 800], 1000, 800)).toEqual({ left: false, top: false, right: true, bottom: true });
  });
  it('the padded canvas is 1.5 times as large and the object keeps its size and its place on the photo', () => {
    const g = padGeometry(1000, 800);
    expect(g.w / 1000).toBeCloseTo(1.5, 5);
    expect(g.h / 800).toBeCloseTo(1.5, 5);
    const b = padBox([0, 100, 400, 300], 1000, 800);
    expect(b[2] - b[0]).toBe(400);
    expect(b[3] - b[1]).toBe(200);
    expect(b[0]).toBe(g.dx);
    expect(touchesEdge(boxEdgeContact(b, g.w, g.h))).toBe(false); // after padding the box is clear of the edge
  });
  it('the switch: on by default, off with ?padretry=0, and the message follows it', () => {
    expect(padRetryOn('')).toBe(true);
    expect(padRetryOn('?padretry=0')).toBe(false);
    expect(edgeNote([[0, 0, 500, 300]], 1000, 800)).toBe(NOTE_PAD);
    expect(edgeNote([[0, 0, 500, 300]], 1000, 800, '?padretry=0')).toBe('');
    expect(edgeNote([[100, 100, 500, 300]], 1000, 800)).toBe('');
  });
});
