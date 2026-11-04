import { DEFAULT_SOURCE, mapEdges, type MapEdge, type MapSource } from './labs-map-layout';
import { FINALE_USES } from './labs-series';

// CC-133: the fixed arrangement of the Labs panel. Pure: series data in, rectangles and line endpoints out; the page draws exactly these numbers.
// Tiers are columns, left to right (Foundations, Pipelines, Finale); each category is one grouped box inside its column; a box holds exactly its Labs as tiles.
// Nothing wraps or reflows: a narrow window scrolls the panel, so a line never leaves its tile.
export interface Rect { x: number; y: number; w: number; h: number }
export interface PanelTile extends Rect { mode: string; name: string }
export interface PanelBoxRect extends Rect { id: string; title: string; tier: string; tiles: PanelTile[] }
export interface PanelColumn { id: string; title: string; x: number; w: number; perRow: number }
export interface PanelLine { id: string; kind: MapEdge['kind']; from: string; to: string; x1: number; y1: number; x2: number; y2: number; d: string; reason: string }
export interface PanelLayout { columns: PanelColumn[]; boxes: PanelBoxRect[]; tiles: PanelTile[]; lines: PanelLine[]; width: number; height: number }
export interface PanelOptions { tileW?: number; tileH?: number; gap?: number; pad?: number; head?: number; boxGap?: number; colGap?: number; top?: number; maxPerRow?: number; iconY?: number; minColW?: number }

export function layoutPanel(src: MapSource = DEFAULT_SOURCE, o: PanelOptions = {}): PanelLayout {
  const tileW = o.tileW ?? 96, tileH = o.tileH ?? 84, gap = o.gap ?? 10, pad = o.pad ?? 10, head = o.head ?? 28, boxGap = o.boxGap ?? 14, colGap = o.colGap ?? 110, top = o.top ?? 30, maxPer = o.maxPerRow ?? 5, iconY = o.iconY ?? 32, minColW = o.minColW ?? 170;
  const nameOf = (m: string): string => src.labs.find((l) => l.mode === m)?.name ?? m;
  const tiers = src.tiers.filter((t) => src.groups.some((g) => g.tier === t.id && g.modes.length));
  const columns: PanelColumn[] = [], boxes: PanelBoxRect[] = [];
  let x = 0, height = 0;
  const stacks: { box: PanelBoxRect[]; h: number }[] = [];
  for (const t of tiers) {
    const groups = src.groups.filter((g) => g.tier === t.id && g.modes.length);
    const perRow = Math.min(maxPer, Math.max(...groups.map((g) => g.modes.length)));
    const w = Math.max(minColW, perRow * tileW + (perRow - 1) * gap + 2 * pad);
    columns.push({ id: t.id, title: t.title, x, w, perRow });
    let y = top;
    const stack: PanelBoxRect[] = [];
    for (const g of groups) {
      const rows = Math.ceil(g.modes.length / perRow), h = head + rows * tileH + (rows - 1) * gap + pad;
      const box: PanelBoxRect = { id: g.id, title: g.title, tier: t.id, x, y, w, h, tiles: [] };
      g.modes.forEach((m, i) => box.tiles.push({ mode: m, name: nameOf(m), x: x + pad + (i % perRow) * (tileW + gap), y: y + head + Math.floor(i / perRow) * (tileH + gap), w: tileW, h: tileH }));
      stack.push(box); y += h + boxGap;
    }
    const h = y - boxGap;
    stacks.push({ box: stack, h }); height = Math.max(height, h);
    x += w + colGap;
  }
  stacks.forEach((s, i) => { const dy = Math.round((height - s.h) / 2); if (i > 0 && dy > 0 && s.box.length === 1) for (const b of s.box) { b.y += dy; b.tiles.forEach((t) => { t.y += dy; }); } boxes.push(...s.box); }); // a lone box (the finale) sits in the middle of its column
  const tiles = boxes.flatMap((b) => b.tiles), byMode = new Map(tiles.map((t) => [t.mode, t]));
  const lines: PanelLine[] = [];
  for (const e of panelEdges(src)) {
    const a = byMode.get(e.from), b = byMode.get(e.to); if (!a || !b) continue;
    lines.push({ id: e.id, kind: e.kind, from: e.from, to: e.to, reason: e.reason, ...lineBetween(a, b, iconY) });
  }
  return { columns, boxes, tiles, lines, width: x - colGap, height: height + 4 };
}

/** The line joins tile edges: right side to left side when the target is further right, left to right when further left, else bottom to top (or top to bottom). Ends sit at the icon's height. */
export function lineBetween(a: Rect, b: Rect, iconY = 32): { x1: number; y1: number; x2: number; y2: number; d: string } {
  if (a.x + a.w <= b.x) { const x1 = a.x + a.w, y1 = a.y + iconY, x2 = b.x, y2 = b.y + iconY, dx = Math.max(24, (x2 - x1) / 2); return { x1, y1, x2, y2, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` }; }
  if (b.x + b.w <= a.x) { const x1 = a.x, y1 = a.y + iconY, x2 = b.x + b.w, y2 = b.y + iconY, dx = Math.max(24, (x1 - x2) / 2); return { x1, y1, x2, y2, d: `M${x1},${y1} C${x1 - dx},${y1} ${x2 + dx},${y2} ${x2},${y2}` }; }
  const down = b.y > a.y, x1 = a.x + a.w / 2, x2 = b.x + b.w / 2, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h, dy = Math.max(20, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
  return { x1, y1, x2, y2, d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}` };
}

/** The connections of the map plus the finale's own: the last tier sums up the Labs in FINALE_USES, so each of them gets a line to it. */
export function panelEdges(src: MapSource = DEFAULT_SOURCE): MapEdge[] {
  const out = mapEdges(src), have = new Set(src.labs.map((l) => l.mode)), last = src.tiers[src.tiers.length - 1]?.id;
  if (src !== DEFAULT_SOURCE || last !== 'finale') return out;
  const num = (m: string): number => src.labs.findIndex((l) => l.mode === m) + 1;
  for (const g of src.groups.filter((x) => x.tier === last)) for (const m of g.modes) for (const u of FINALE_USES) {
    if (!have.has(u) || u === m) continue;
    out.push({ id: `uses:${u}>${m}`, from: u, to: m, kind: 'uses', reason: `Lab ${num(m)} sums up Lab ${num(u)}` });
  }
  return out;
}
