import { HALF_LANE } from './slice';
import type { LanePlank, Mesh } from './slice';
import { centred, newPiece, type Piece } from './world';
import type { Material, PlankData } from '../sim/beam';

// A plank bridge in the editor: a piece whose src is "plank:<material>:<span>:<thickness>:<width>:<post 0 or 1>" (the knobs live in the src,
// so saving, copying and undo need no extra fields). It is not ground (the slice ignores it); where it lies across a gap between two runs of ground
// it becomes a plank in the course. The piece's own length is a drawing aid: the real span is the gap it bridges.
export type P = Piece & { src?: string };
export const PLANK_PREFIX = 'plank:';
export interface PlankSpec { material: Material; span: number; thickness: number; width: number; support: boolean }
export const DEFAULT_PLANK: PlankSpec = { material: 'wood', span: 6, thickness: 0.04, width: 0.6, support: false };
export const DRAW_THICKNESS = 0.08; // m: a 2 cm plank is hair-thin in the picture, so the piece is drawn at least this thick

export const plankSrc = (s: PlankSpec): string => `${PLANK_PREFIX}${s.material}:${s.span}:${s.thickness}:${s.width}:${s.support ? 1 : 0}`;
export function plankSpecOf(src: string | undefined): PlankSpec | undefined {
  if (!src?.startsWith(PLANK_PREFIX)) return undefined;
  const [material, span, thickness, width, support] = src.slice(PLANK_PREFIX.length).split(':');
  const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);
  return {
    material: material === 'steel' ? 'steel' : 'wood',
    span: Math.max(1, Math.min(20, num(span, DEFAULT_PLANK.span))),
    thickness: Math.max(0.005, Math.min(0.2, num(thickness, DEFAULT_PLANK.thickness))),
    width: Math.max(0.2, Math.min(2, num(width, DEFAULT_PLANK.width))),
    support: support === '1',
  };
}
export const isPlankPiece = (p: { src?: string }): boolean => !!plankSpecOf(p.src);

export function plankMesh(s: PlankSpec): Mesh {
  const [w, h, d] = [s.span, Math.max(s.thickness, DRAW_THICKNESS), s.width];
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}

export function plankPiece(spec: PlankSpec, at: { x: number; z: number }): P {
  const p: P = { ...newPiece(spec.material === 'wood' ? 'Plank bridge' : 'Steel plate bridge', centred(plankMesh(spec)), at), src: plankSrc(spec) };
  p.noGround = true;
  return p;
}

// Change a plank piece's knobs in place (mesh and src follow).
export function setPlank(p: P, spec: PlankSpec): void {
  p.src = plankSrc(spec);
  p.mesh = centred(plankMesh(spec));
  p.name = spec.material === 'wood' ? 'Plank bridge' : 'Steel plate bridge';
  p.noGround = true;
}

// The planks that lie along the lane: where they start and end along the run, and their knobs. A plank turned across the lane is ignored.
export function planksOf(pieces: P[], lane: { angle: number; offset: number; level: number }): { u0: number; u1: number; spec: PlankSpec; id: number }[] {
  const c = Math.cos(lane.angle), s = Math.sin(lane.angle);
  const out: { u0: number; u1: number; spec: PlankSpec; id: number }[] = [];
  for (const p of pieces) {
    const spec = plankSpecOf(p.src);
    if (!spec) continue;
    const along = Math.cos(p.yaw - lane.angle);
    if (Math.abs(along) < 0.7) continue;
    const u = p.x * c + p.z * s, v = -p.x * s + p.z * c - lane.offset;
    if (Math.abs(v) > HALF_LANE + 0.5) continue;
    const half = (spec.span * p.scale * Math.abs(along)) / 2;
    out.push({ u0: u - half, u1: u + half, spec: { ...spec, span: spec.span * p.scale }, id: p.id });
  }
  return out.sort((a, b) => a.u0 - b.u0);
}

export const toPlankData = (spec: PlankSpec, x0: number, x1: number, y: number): PlankData => ({ x0, x1, y, thickness: spec.thickness, width: spec.width, material: spec.material, ...(spec.support ? { support: true } : {}) });

// The planks along the lane in the shape the lane builder takes.
export const lanePlanks = (pieces: P[], lane: { angle: number; offset: number; level: number }): LanePlank[] => planksOf(pieces, lane).map((pl) => ({ u0: pl.u0, u1: pl.u1, thickness: pl.spec.thickness, width: pl.spec.width, material: pl.spec.material, support: pl.spec.support }));
