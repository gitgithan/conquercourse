import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE, edgePath, focusState, layoutLabsMap, mapEdges, neighboursOf, type MapSource } from '../src/ui/labs-map-layout';
import { LAB_LIST, flowOf, usedIn, usesOf } from '../src/ui/labs-series';

// CC-133: the dependency tree of the Labs. The layout is a pure function of the series data, so these tests need no page.
const map = layoutLabsMap(DEFAULT_SOURCE, { groupGap: 20 });

// a made-up 25-Lab series with a finale tier: the layout must not care about names, numbers or tiers
const fake = (n: number): MapSource => {
  const labs = Array.from({ length: n }, (_, i) => ({ mode: `lab-x${i}`, name: `Lab name number ${i}`, pipeline: 'methods' as const, stage: 's' }));
  const f = labs.slice(0, 16).map((l) => l.mode), p = labs.slice(16, 22).map((l) => l.mode), z = labs.slice(22).map((l) => l.mode);
  return {
    labs,
    tiers: [{ id: 'foundations', title: 'Foundations' }, { id: 'pipelines', title: 'Pipelines' }, { id: 'finale', title: 'Finale' }],
    groups: [
      { id: 'a', tier: 'foundations', title: 'A', modes: f.slice(0, 8) }, { id: 'b', tier: 'foundations', title: 'B', modes: f.slice(8) },
      { id: 'c', tier: 'pipelines', title: 'C', modes: p.slice(0, 3) }, { id: 'd', tier: 'pipelines', title: 'D', modes: p.slice(3) },
      { id: 'e', tier: 'finale', title: 'E', modes: z },
    ],
    pipelineMap: {
      one: p.map((m, i) => ({ stage: `st${i}`, uses: [f[(i * 5) % 16], f[(i * 3 + 1) % 16], f[(i * 7 + 2) % 16]], lab: m })),
      two: z.map((m, i) => ({ stage: `fin${i}`, uses: [p[i], f[15 - i]], lab: m })),
    },
  };
};

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('labs map layout', () => {
  for (const [label, m] of [['the real series', map], ['25 made-up Labs in three tiers', layoutLabsMap(fake(25))]] as const) {
    it(`${label}: every Lab is a node, none overlap, all inside the drawing`, () => {
      for (let i = 0; i < m.nodes.length; i++) {
        const a = m.nodes[i];
        expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x + a.w).toBeLessThanOrEqual(m.width); expect(a.y + a.h).toBeLessThanOrEqual(m.height);
        for (let j = i + 1; j < m.nodes.length; j++) expect(overlap(a, m.nodes[j]), `${a.mode} / ${m.nodes[j].mode}`).toBe(false);
      }
    });
  }
  it('has one node per Lab in the series, numbered by its place in the list', () => {
    expect(map.nodes.map((n) => n.mode)).toEqual(LAB_LIST.map((l) => l.mode));
    map.nodes.forEach((n, i) => expect(n.n).toBe(i + 1));
  });
  it('puts tiers left to right in the order the series lists them', () => {
    const real = new Map(map.columns.map((c, i) => [c.id, i]));
    expect(map.columns.map((c) => c.id)).toEqual(['foundations', 'pipelines']);
    for (const n of map.nodes) expect(n.column).toBe(real.get(n.tier));
    const x = layoutLabsMap(fake(25));
    expect(x.columns.map((c) => c.id)).toEqual(['foundations', 'pipelines', 'finale']);
    expect(x.nodes.filter((n) => n.tier === 'finale')).toHaveLength(3);
    for (const e of x.edges) expect(x.nodes.find((n) => n.mode === e.to)!.column, e.id).toBeGreaterThanOrEqual(x.nodes.find((n) => n.mode === e.from)!.column);
  });
  it('draws every edge: each uses-relation and each flow step in the data, with a reason', () => {
    for (const l of LAB_LIST) for (const u of usesOf(l.mode)) expect(map.edges.some((e) => e.kind === 'uses' && e.from === u && e.to === l.mode && e.reason.length > 5), `${u}>${l.mode}`).toBe(true);
    for (const l of LAB_LIST) { const f = flowOf(l.mode); if (f?.from) expect(map.edges.some((e) => e.kind === 'flow' && e.from === f.from && e.to === l.mode)).toBe(true); }
    expect(new Set(map.edges.map((e) => e.id)).size).toBe(map.edges.length);
    const byId = new Map(map.nodes.map((n) => [n.mode, n]));
    for (const e of map.edges) expect(edgePath(byId.get(e.from)!, byId.get(e.to)!)).toMatch(/^M[\d.]+,[\d.]+ C/);
  });
  it('lists the neighbours of a Lab as exactly what it uses, where it is used, and its place in the pipeline', () => {
    for (const l of LAB_LIST) {
      const want = new Set<string>([...usesOf(l.mode), ...usedIn(l.mode).flatMap((u) => (u.lab && u.lab !== l.mode ? [u.lab] : []))]);
      const f = flowOf(l.mode); if (f?.from) want.add(f.from); if (f?.next) want.add(f.next);
      expect([...neighboursOf(map, l.mode).modes].sort(), l.mode).toEqual([...want].sort());
    }
  });
  it('dims everything except the focused Lab, its neighbours and the lines between them', () => {
    const st = focusState(map, 'lab-collision'), nb = neighboursOf(map, 'lab-collision');
    for (const n of map.nodes) expect(st.dimNode(n.mode), n.mode).toBe(n.mode !== 'lab-collision' && !nb.modes.has(n.mode));
    for (const e of map.edges) expect(st.dimEdge(e.id)).toBe(!(e.from === 'lab-collision' || e.to === 'lab-collision'));
    expect(st.dimNode('lab-collision')).toBe(false); expect(st.dimNode('lab-gentest')).toBe(false); expect(st.dimNode('lab-search')).toBe(true);
    const none = focusState(map, null);
    expect(map.nodes.every((n) => !none.dimNode(n.mode))).toBe(true); expect(map.edges.every((e) => !none.dimEdge(e.id))).toBe(true);
    expect(focusState(map, 'not-a-lab').dimNode('lab-search')).toBe(false);
  });
  it('is the same on every call and picks up a new Lab by itself', () => {
    expect(layoutLabsMap(DEFAULT_SOURCE, { groupGap: 20 })).toEqual(map);
    const src = fake(25), big = layoutLabsMap(src);
    expect(big.nodes).toHaveLength(25);
    expect(mapEdges(src).length).toBeGreaterThanOrEqual(30);
  });
  it('keeps the labels short enough for 1280 px: the drawing is no wider than the page column', () => { expect(map.width).toBeLessThanOrEqual(1232); });
});
