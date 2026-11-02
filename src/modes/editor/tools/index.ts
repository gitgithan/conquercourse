import { newPiece } from '../../../slice/world';
import { barMesh } from '../../../slice/holds-world';
import { size } from '../../../slice/world';
import type { P } from '../state';
import { barTool, coasterTool, lacheTool, plankTool, ropeTool, stacksTool } from './simple';
import { bandTool, droneTool, recoilTool, trebuchetTool } from './devices';
import type { FixEnv, PieceTool, ToolCtx } from './types';

export type { FixEnv, PieceTool, ToolCtx } from './types';

// The special pieces, in the order their buttons stand on the toolbar. A new piece is one more module in this list.
export function createTools(base: Omit<ToolCtx, 'nextX' | 'nextLaneU' | 'addBarPiece'>) {
  const { ed } = base;
  const nextX = () => ed.pieces.reduce((r, q) => Math.max(r, q.x + (size(q.mesh).w * q.scale) / 2), 0) + 3;
  const nextLaneU = () => { const c = Math.cos(ed.angle), s = Math.sin(ed.angle); return ed.pieces.reduce((r, p) => Math.max(r, p.x * c + p.z * s + (size(p.mesh).w * p.scale) / 2), 0) + 3; };
  const addBarPiece = (x: number, y: number, z = 0): P => { const q: P = { ...newPiece('Bar', barMesh(), { x, z }), src: 'hold:bar', y }; ed.pieces.push(q); ed.selected = q.id; return q; };
  const ctx: ToolCtx = { ...base, nextX, nextLaneU, addBarPiece };
  const list: PieceTool[] = [barTool, coasterTool, lacheTool, ropeTool, trebuchetTool, recoilTool, bandTool, droneTool, stacksTool, plankTool].map((make) => make(ctx));
  const fixers = list.filter((t) => t.fix).sort((a, b) => (a.fixOrder ?? 9) - (b.fixOrder ?? 9));
  return {
    list, addBarPiece,
    mount: () => list.forEach((t) => t.mount()),
    sync: () => list.forEach((t) => t.sync?.()),
    // the first tool that answers for the layout ends Fix it; false means the general search goes on
    fix: (f: FixEnv) => fixers.some((t) => t.fix!(f)),
    panel: (p: P, side: HTMLElement) => list.forEach((t) => t.panel?.(p, side)),
  };
}
export type Tools = ReturnType<typeof createTools>;
