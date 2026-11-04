import { LAB_GROUPS, LAB_LIST, PIPELINE_MAP, TIERS, flowOf, labNumberOf, usedIn, usesOf, type LabEntry, type LabGroup, type PipelineStage } from './labs-series';

// CC-133: the Labs as a dependency tree. Pure layout: data in (the Labs series), positions out; nothing here touches the page.
// Columns are the tiers in the order TIERS lists them (Foundations, Pipelines, and any later tier such as a finale); inside a column the order follows the sub-headers, then the barycenter of the neighbours.
// Nothing is hard-coded by Lab: a new Lab or tier in labs-series.ts appears here by itself.
export interface MapSource {
  labs: readonly LabEntry[];
  groups: readonly (Omit<LabGroup, 'tier'> & { tier: string })[];
  tiers: readonly { id: string; title: string }[];
  pipelineMap: Record<string, readonly PipelineStage[]>;
}
export const DEFAULT_SOURCE: MapSource = { labs: LAB_LIST, groups: LAB_GROUPS, tiers: TIERS, pipelineMap: PIPELINE_MAP };

export interface MapNode { mode: string; n: number; name: string; tier: string; group: string; column: number; x: number; y: number; w: number; h: number }
export interface MapEdge { id: string; from: string; to: string; kind: 'uses' | 'flow'; reason: string }
export interface MapColumn { id: string; title: string; x: number; w: number }
export interface LabsMap { nodes: MapNode[]; edges: MapEdge[]; columns: MapColumn[]; width: number; height: number }
export interface MapOptions { width?: number; nodeW?: number; nodeH?: number; gap?: number; groupGap?: number; top?: number }

/** Every connection, from the same data the Lab pages use: "uses" (a Lab relies on another, with the stages that say so) and "flow" (the Lab before, in its pipeline). */
export function mapEdges(src: MapSource = DEFAULT_SOURCE): MapEdge[] {
  const have = new Set(src.labs.map((l) => l.mode)), out = new Map<string, MapEdge>();
  const num = (m: string): number => src.labs.findIndex((l) => l.mode === m) + 1;
  for (const stages of Object.values(src.pipelineMap)) for (const st of stages) {
    if (!st.lab || !have.has(st.lab)) continue;
    for (const u of st.uses) {
      if (!have.has(u) || u === st.lab) continue;
      const id = `uses:${u}>${st.lab}`, e = out.get(id);
      if (e) e.reason += `, ${st.stage}`;
      else out.set(id, { id, from: u, to: st.lab, kind: 'uses', reason: `Lab ${num(st.lab)} uses Lab ${num(u)} for: ${st.stage}` });
    }
  }
  for (const g of src.groups) {
    if (g.tier === src.tiers[0]?.id) continue; // the first tier (Foundations) is not a chain
    g.modes.forEach((m, i) => { const p = g.modes[i - 1]; if (p && have.has(p) && have.has(m)) out.set(`flow:${p}>${m}`, { id: `flow:${p}>${m}`, from: p, to: m, kind: 'flow', reason: `${g.title}: what Lab ${num(p)} makes feeds Lab ${num(m)}` }); });
  }
  return [...out.values()];
}

/** The Labs one step away from a Lab (either direction), and the connections that join them. */
export function neighboursOf(map: LabsMap, mode: string): { modes: Set<string>; edges: Set<string> } {
  const modes = new Set<string>(), edges = new Set<string>();
  for (const e of map.edges) {
    if (e.from === mode) { modes.add(e.to); edges.add(e.id); }
    else if (e.to === mode) { modes.add(e.from); edges.add(e.id); }
  }
  return { modes, edges };
}

/** What to light up while a Lab is in focus: only that Lab and its neighbours stay bright; everything else is dim. With no focus nothing is dim. */
export function focusState(map: LabsMap, focus: string | null): { dimNode(mode: string): boolean; dimEdge(id: string): boolean; hot: Set<string> } {
  if (!focus || !map.nodes.some((n) => n.mode === focus)) return { dimNode: () => false, dimEdge: () => false, hot: new Set() };
  const nb = neighboursOf(map, focus);
  return { dimNode: (m) => m !== focus && !nb.modes.has(m), dimEdge: (id) => !nb.edges.has(id), hot: nb.edges };
}

export function layoutLabsMap(src: MapSource = DEFAULT_SOURCE, o: MapOptions = {}): LabsMap {
  const width = o.width ?? 1200, nodeW = o.nodeW ?? 236, nodeH = o.nodeH ?? 28, gap = o.gap ?? 8, groupGap = o.groupGap ?? 14, top = o.top ?? 34;
  const edges = mapEdges(src);
  const tierIds = src.tiers.map((t) => t.id);
  const tierOf = (m: string): string => src.groups.find((g) => g.modes.includes(m))?.tier ?? tierIds[0];
  const groupOf = (m: string): string => src.groups.find((g) => g.modes.includes(m))?.id ?? '';
  const used = tierIds.filter((t) => src.labs.some((l) => tierOf(l.mode) === t));
  const col = (m: string): number => used.indexOf(tierOf(m));
  const gOrder = (m: string): number => src.groups.findIndex((g) => g.modes.includes(m));
  const pitch = nodeH + gap, y = new Map<string, number>(), nodes: MapNode[] = [];
  const adj = (m: string): string[] => edges.flatMap((e) => (e.from === m ? [e.to] : e.to === m ? [e.from] : []));
  // first column: the sub-header order, a gap between sub-headers; later columns: barycenter of the neighbours already placed, then pushed apart so nothing overlaps
  const place = (list: string[], wanted: (m: string) => number | null, grouped: boolean): void => {
    const order = list.map((m, i) => ({ m, i, want: wanted(m) })).sort((a, b) => (grouped ? gOrder(a.m) - gOrder(b.m) : 0) || (a.want ?? Infinity) - (b.want ?? Infinity) || a.i - b.i);
    let cur = top;
    order.forEach((it, k) => {
      const prev = order[k - 1];
      const min = prev ? y.get(prev.m)! + pitch + (grouped && groupOf(prev.m) !== groupOf(it.m) ? groupGap : 0) : top;
      cur = Math.max(it.want === null ? min : it.want, min);
      y.set(it.m, cur);
    });
  };
  used.forEach((t, c) => {
    const list = src.labs.filter((l) => tierOf(l.mode) === t).map((l) => l.mode);
    if (c === 0) place(list, () => null, true);
    else place(list, (m) => { const ys = adj(m).filter((a) => y.has(a)).map((a) => y.get(a)!); return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : null; }, false);
  });
  // first column's inner order follows the neighbours (barycenter) inside each sub-header once the later columns exist, so lines cross less
  if (used.length > 1) {
    const first = src.labs.filter((l) => tierOf(l.mode) === used[0]).map((l) => l.mode);
    const bary = new Map<string, number>();
    for (const m of first) { const ys = adj(m).filter((a) => y.has(a) && col(a) > 0).map((a) => y.get(a)!); if (ys.length) bary.set(m, ys.reduce((s, v) => s + v, 0) / ys.length); }
    const inGroup = new Map<string, string[]>();
    for (const m of first) inGroup.set(groupOf(m), [...(inGroup.get(groupOf(m)) ?? []), m]);
    let cur = top, last = '';
    for (const g of src.groups) {
      const ms = (inGroup.get(g.id) ?? []).slice().sort((a, b) => (bary.get(a) ?? Infinity) - (bary.get(b) ?? Infinity) || first.indexOf(a) - first.indexOf(b));
      if (!ms.length) continue;
      if (last) cur += groupGap;
      for (const m of ms) { y.set(m, cur); cur += pitch; }
      last = g.id;
    }
    // later columns again, now against the new order
    used.forEach((t, c) => { if (c > 0) place(src.labs.filter((l) => tierOf(l.mode) === t).map((l) => l.mode), (m) => { const ys = adj(m).filter((a) => y.has(a) && col(a) < c).map((a) => y.get(a)!); return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : null; }, false); });
  }
  const colGap = used.length > 1 ? (width - nodeW) / (used.length - 1) : 0;
  const columns: MapColumn[] = used.map((t, c) => ({ id: t, title: src.tiers.find((x) => x.id === t)!.title, x: used.length > 1 ? c * colGap : (width - nodeW) / 2, w: nodeW }));
  for (const l of src.labs) nodes.push({ mode: l.mode, n: src.labs.indexOf(l) + 1, name: l.name, tier: tierOf(l.mode), group: groupOf(l.mode), column: col(l.mode), x: columns[col(l.mode)].x, y: y.get(l.mode)!, w: nodeW, h: nodeH });
  const height = Math.max(...nodes.map((n) => n.y + n.h)) + 16;
  return { nodes, edges, columns, width, height };
}

/** The line between two nodes: right edge to left edge when the target is in a later column, a loop on the right side otherwise. */
export function edgePath(a: MapNode, b: MapNode): string {
  const ay = a.y + a.h / 2, by = b.y + b.h / 2;
  if (b.column > a.column) { const x1 = a.x + a.w, x2 = b.x, dx = (x2 - x1) / 2; return `M${x1},${ay} C${x1 + dx},${ay} ${x2 - dx},${by} ${x2},${by}`; }
  if (b.column < a.column) { const x1 = a.x, x2 = b.x + b.w, dx = (x1 - x2) / 2; return `M${x1},${ay} C${x1 - dx},${ay} ${x2 + dx},${by} ${x2},${by}`; }
  const x1 = a.x + a.w, bulge = 28 + Math.min(40, Math.abs(by - ay) / 4);
  return `M${x1},${ay} C${x1 + bulge},${ay} ${x1 + bulge},${by} ${x1},${by}`;
}

// re-exports so the view and the tests read the neighbour rule from one place
export { flowOf, labNumberOf, usedIn, usesOf };
