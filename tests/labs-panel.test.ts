import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { layoutPanel, lineBetween, type Rect } from '../src/ui/labs-panel-layout';
import { panelMap, panelNext } from '../src/ui/labs-panel';
import { DEFAULT_SOURCE, focusState, neighboursOf } from '../src/ui/labs-map-layout';
import { LAB_GROUPS, LAB_LIST, TIERS } from '../src/ui/labs-series';

// CC-133: the Labs panel. Positions are pure data, so these tests need no page.
const L = layoutPanel();
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const onEdge = (p: { x: number; y: number }, r: Rect): boolean => {
  const inX = p.x >= r.x - 1e-6 && p.x <= r.x + r.w + 1e-6, inY = p.y >= r.y - 1e-6 && p.y <= r.y + r.h + 1e-6;
  return (inY && (Math.abs(p.x - r.x) < 1e-6 || Math.abs(p.x - r.x - r.w) < 1e-6)) || (inX && (Math.abs(p.y - r.y) < 1e-6 || Math.abs(p.y - r.y - r.h) < 1e-6));
};

describe('labs panel layout', () => {
  it('each category is one grouped box containing exactly its Labs, in the order of the series', () => {
    expect(L.boxes.map((b) => b.id)).toEqual(LAB_GROUPS.filter((g) => g.modes.length).map((g) => g.id));
    for (const g of LAB_GROUPS) {
      const b = L.boxes.find((x) => x.id === g.id)!;
      expect(b.title).toBe(g.title);
      expect(b.tiles.map((t) => t.mode).sort(), g.id).toEqual([...g.modes].sort());
      for (const t of b.tiles) expect(t.x >= b.x && t.y >= b.y && t.x + t.w <= b.x + b.w && t.y + t.h <= b.y + b.h, t.mode).toBe(true); // inside its own box
    }
    expect(L.tiles.map((t) => t.mode).sort()).toEqual(LAB_LIST.map((l) => l.mode).sort());
  });
  it('puts the tiers in columns left to right in series order, so most lines run left to right', () => {
    expect(L.columns.map((c) => c.id)).toEqual(TIERS.map((t) => t.id));
    for (let i = 1; i < L.columns.length; i++) expect(L.columns[i].x).toBeGreaterThanOrEqual(L.columns[i - 1].x + L.columns[i - 1].w);
    const col = new Map(L.boxes.map((b) => [b.id, L.columns.findIndex((c) => c.id === b.tier)]));
    for (const b of L.boxes) expect(b.x).toBe(L.columns[col.get(b.id)!].x);
    const rightward = L.lines.filter((l) => l.x2 > l.x1).length;
    expect(rightward / L.lines.length).toBeGreaterThan(0.6);
  });
  it('no two boxes overlap, no two tiles overlap, and everything is inside the drawing', () => {
    for (let i = 0; i < L.boxes.length; i++) for (let j = i + 1; j < L.boxes.length; j++) expect(overlap(L.boxes[i], L.boxes[j]), `${L.boxes[i].id}/${L.boxes[j].id}`).toBe(false);
    for (let i = 0; i < L.tiles.length; i++) for (let j = i + 1; j < L.tiles.length; j++) expect(overlap(L.tiles[i], L.tiles[j])).toBe(false);
    for (const b of L.boxes) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= L.width && b.y + b.h <= L.height).toBe(true);
  });
  it('fits 1280 px across without scrolling', () => expect(L.width + 40).toBeLessThanOrEqual(1280));
  it('every line starts and ends on an edge of the tiles it joins (tiles and lines share one layout)', () => {
    const by = new Map(L.tiles.map((t) => [t.mode, t]));
    expect(L.lines.length).toBeGreaterThan(12);
    for (const l of L.lines) {
      expect(onEdge({ x: l.x1, y: l.y1 }, by.get(l.from)!), `${l.id} start`).toBe(true);
      expect(onEdge({ x: l.x2, y: l.y2 }, by.get(l.to)!), `${l.id} end`).toBe(true);
      expect(l.d.startsWith(`M${l.x1},${l.y1} C`)).toBe(true);
      expect(l.d.endsWith(` ${l.x2},${l.y2}`)).toBe(true);
    }
  });
  it('joins vertically stacked tiles bottom to top', () => {
    const a = { x: 0, y: 0, w: 96, h: 84 }, b = { x: 10, y: 200, w: 96, h: 84 };
    const l = lineBetween(a, b);
    expect([l.y1, l.y2]).toEqual([84, 200]);
  });
  it('is the same on every call and one line exists for every connection in the data', () => {
    expect(layoutPanel()).toEqual(L);
    const n = new Set(L.lines.map((l) => l.id));
    expect(n.size).toBe(L.lines.length);
    expect(layoutPanel(DEFAULT_SOURCE).lines.map((l) => l.id)).toEqual(L.lines.map((l) => l.id));
  });
});

describe('labs panel behaviour', () => {
  it('opens, toggles and closes with the button, Esc, the close button or picking a Lab', () => {
    expect(panelNext(false, 'open')).toBe(true);
    expect(panelNext(false, 'toggle')).toBe(true);
    expect(panelNext(true, 'toggle')).toBe(false);
    for (const ev of ['escape', 'close', 'pick'] as const) expect(panelNext(true, ev), ev).toBe(false);
    expect(panelNext(false, 'escape')).toBe(false);
  });
  it('dims everything but a Lab and its immediate neighbours', () => {
    const map = panelMap(), st = focusState(map, 'lab-collision'), nb = neighboursOf(map, 'lab-collision');
    expect(nb.modes.size).toBeGreaterThan(0);
    for (const l of LAB_LIST) expect(st.dimNode(l.mode), l.mode).toBe(l.mode !== 'lab-collision' && !nb.modes.has(l.mode));
    for (const e of map.edges) expect(st.dimEdge(e.id)).toBe(!(e.from === 'lab-collision' || e.to === 'lab-collision'));
    expect(map.nodes).toHaveLength(LAB_LIST.length);
  });
  it('wires the panel: slide-down animation, Esc, close button, no wrapping, scroll instead of reflow', () => {
    const src = readFileSync('src/ui/labs-panel.ts', 'utf8');
    expect(src).toContain('translateY(-102%)');
    expect(src).toContain('max-height:100vh');
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain('labs-panel-close');
    expect(src).toContain('overflow:auto');
    expect(src).not.toContain('flex-wrap');
    expect(src).toContain("addEventListener('click', () => set(panelNext(isOpen, 'pick')))");
  });
  it('keeps the old ?mode=labs-map links working by opening the panel over the first Lab', () => {
    const m = readFileSync('src/modes/labs-map.ts', 'utf8');
    expect(m).toContain('panel=1');
    expect(readFileSync('src/ui/labs-nav.ts', 'utf8')).toContain('panel=1');
    expect(readFileSync('src/main-loaders.ts', 'utf8')).toContain("'labs-map'");
  });
});
