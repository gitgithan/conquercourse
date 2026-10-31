import { barMesh, type P } from './holds-world';
import type { Mesh } from './slice';
import { newPiece } from './world';

// Course layout drafts (the Course Agent's format; the photo-to-course feature was dropped 2026-10-31, scope is photo to object only).
// This file is pure (no network): it cleans what a model says back, builds editor pieces from it and scores it
// against a hand-made answer key. The simulator keeps the last word: a draft is only a draft until the proof (and Fix it) has seen it.
export type Item =
  | { kind: 'ground'; length: number }
  | { kind: 'gap'; width: number }
  | { kind: 'block'; length: number; height: number }
  | { kind: 'bar'; height: number };
export interface Layout { items: Item[] }

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown, lo: number, hi: number): number | undefined => { const n = Number(v); return Number.isFinite(n) ? r2(Math.min(hi, Math.max(lo, n))) : undefined; };

export interface Parsed { layout: Layout | null; text: string; problems: string[] }

export function parseLayout(raw: string): Parsed {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = raw.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim();
  const body = fence ? fence[1] : /\{[\s\S]*\}/.exec(raw)?.[0] ?? '';
  let obj: unknown;
  try { obj = JSON.parse(body); } catch { return { layout: null, text, problems: ['no readable json'] }; }
  const arr = (obj as { items?: unknown })?.items;
  if (!Array.isArray(arr)) return { layout: null, text, problems: ['no items list'] };
  const items: Item[] = [], problems: string[] = [];
  for (const q of arr.slice(0, 12)) {
    const o = q as Record<string, unknown>;
    if (o?.kind === 'ground') { const length = num(o.length, 0.5, 40); if (length) items.push({ kind: 'ground', length }); else problems.push('ground without a length'); }
    else if (o?.kind === 'gap') { const width = num(o.width, 0.5, 14); if (width) items.push({ kind: 'gap', width }); else problems.push('gap without a width'); }
    else if (o?.kind === 'block') { const length = num(o.length, 0.1, 12), height = num(o.height, 0.1, 4.3); if (length && height) items.push({ kind: 'block', length, height }); else problems.push('block without sizes'); }
    else if (o?.kind === 'bar') { const height = num(o.height, 1.5, 4.5); if (height) items.push({ kind: 'bar', height }); else problems.push('bar without a height'); }
    else problems.push(`unknown kind ${String(o?.kind)}`);
  }
  if (!items.some((i) => i.kind !== 'ground')) return { layout: null, text, problems: [...problems, 'nothing to clear in it'] };
  if (items[0].kind !== 'ground') items.unshift({ kind: 'ground', length: 4 });
  if (items[items.length - 1].kind !== 'ground') items.push({ kind: 'ground', length: 4 });
  return { layout: { items }, text, problems };
}

// A box standing on y = 0: w along the run, h up, d across the lane.
export function boxMesh(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
export const boxSrc = (w: number, h: number, d: number) => `box:${r2(w)}:${r2(h)}:${r2(d)}`;
// Pieces saved in the editor keep their size in their `src`, so a draft survives a reload.
export function pieceFromSrc(src: string, at: { x: number; z: number }): P | null {
  const m = /^box:([\d.]+):([\d.]+):([\d.]+)$/.exec(src);
  if (!m) return null;
  return { ...newPiece(Number(m[2]) <= 0.05 ? 'Ground' : 'Block', boxMesh(Number(m[1]), Number(m[2]), Number(m[3])), at), src };
}

export const LANE_WIDTH = 2;
export const GROUND_TOP = 0.02; // m: ground is a thin slab, so the lane has a surface to read

// Pieces for the editor, centred on x = 0. Blocks and ground sit on y = 0; bars hang at their height.
export function layoutToPieces(layout: Layout): P[] {
  const out: P[] = [];
  let x = 0;
  for (const it of layout.items) {
    if (it.kind === 'gap') x += it.width;
    else if (it.kind === 'bar') out.push({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y: it.height });
    else {
      const h = it.kind === 'ground' ? GROUND_TOP : it.height;
      const q = pieceFromSrc(boxSrc(it.length, h, LANE_WIDTH), { x: x + it.length / 2, z: 0 })!;
      out.push(q);
      x += it.length;
    }
  }
  for (const p of out) p.x -= x / 2;
  return out;
}

// ---- scoring against a hand-made answer key: do the same obstacles show up, in the same order, and how far off are their sizes?
export interface Score { keyCount: number; modelCount: number; matched: number; extra: number; meanRelError: number | null; meanAbsError: number | null }

const sizes = (i: Item): number[] => (i.kind === 'block' ? [i.height, i.length] : i.kind === 'bar' ? [i.height] : i.kind === 'gap' ? [i.width] : []);

export function scoreLayout(model: Layout | null, key: Layout): Score {
  const isObs = (i: Item) => i.kind !== 'ground';
  const k = key.items.filter(isObs), m = (model?.items ?? []).filter(isObs);
  const used = new Set<number>();
  const rel: number[] = [], abs: number[] = [];
  let matched = 0, from = 0;
  for (const want of k) {
    const at = m.findIndex((q, idx) => idx >= from && !used.has(idx) && q.kind === want.kind);
    if (at < 0) continue;
    used.add(at); from = at + 1; matched++;
    const a = sizes(want), b = sizes(m[at]);
    a.forEach((v, j) => { rel.push(Math.abs(b[j] - v) / v); abs.push(Math.abs(b[j] - v)); });
  }
  const mean = (a: number[]) => (a.length ? r2(a.reduce((s, v) => s + v, 0) / a.length) : null);
  return { keyCount: k.length, modelCount: m.length, matched, extra: m.length - matched, meanRelError: mean(rel), meanAbsError: mean(abs) };
}
