import { realSize, type Piece } from './world';

// The course-design partner: a Muse Spark Open helper that looks at the world the human is building and the simulator's verdict,
// and suggests a few small moves. The simulator keeps the last word: every edit is a suggestion the human accepts with one click,
// and the editor re-checks it. This file is pure (no network): it builds what the model is told and cleans what it says back.
export interface LaneView { angle: number; offset: number; level: number }
export interface Edit { piece: number; dx?: number; dz?: number; dy?: number; scale?: number; yaw?: number }
export interface Reply { text: string; edits: Edit[] }

const r2 = (v: number) => Math.round(v * 100) / 100;

export const SYSTEM_PROMPT = [
  'You are a course-design partner inside a world editor for a ninja-warrior physics game.',
  'The human builds a course from real objects; a runner goes left to right along a 2 m wide lane and must jump from piece to piece over water.',
  'Earth physics only. Never show formulas. Use plain words a 13-year-old can follow.',
  'You suggest; you never grade a player or coach technique. The simulator decides what is possible and its verified advice is given to you: prefer it over guessing.',
  'Pieces named Bar hang in the air (no frame): hands reach a bar up to 2.7 m standing and 3.7 m with a jump, a swing between two bars crosses up to about 10 m of water, the V key vaults a 0.4 to 1.3 m step fast and saves energy, and a plain jump costs some speed on courses with bars.',
  'Reply with at most 3 short sentences.',
  'Then, if you suggest moving or resizing pieces, add the changes in one fenced ```json block holding an array of {"piece": <id>, "dx": m, "dz": m, "dy": m, "scale": factor, "yaw": radians} items (leave out what does not change).',
  'Use only the piece ids in the world description. Keep each move under 10 m. If nothing needs changing, give no json block.',
].join(' ');

export function worldBrief(pieces: Piece[], lane: LaneView, verdict: string, advice: string[] = [], bars: { u: number; y: number; id?: number }[] = [], routes: string[] = []): string {
  return JSON.stringify({
    pieces: pieces.map((p) => { const s = realSize(p); return { id: p.id, name: p.name, x: r2(p.x), z: r2(p.z), height_off_ground: r2(p.y), turn_deg: Math.round((p.yaw * 180) / Math.PI), size_m: { long: r2(s.w), high: r2(s.h), deep: r2(s.d) } }; }),
    lane: { turn_deg: Math.round((lane.angle * 180) / Math.PI), sideways_m: r2(lane.offset), water_level_m: r2(lane.level) },
    bars_in_the_lane: bars.map((b) => ({ id: b.id, along_m: r2(b.u), height_m: r2(b.y) })),
    simulator_verdict: verdict,
    verified_advice: advice.slice(0, 6),
    routes_the_simulator_found_that_the_designer_did_not_plan: routes.slice(0, 4), // shortcuts: lines that skip an obstacle and are faster
  });
}

const clamp = (v: unknown, lo: number, hi: number): number | undefined => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined; };

export function parseReply(raw: string, validIds: number[]): Reply {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = raw.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim();
  const edits: Edit[] = [];
  if (fence) {
    let arr: unknown;
    try { arr = JSON.parse(fence[1]); } catch { arr = null; }
    if (Array.isArray(arr)) for (const q of arr.slice(0, 8)) {
      const o = q as Record<string, unknown>;
      const id = Number(o?.piece);
      if (!validIds.includes(id)) continue;
      const e: Edit = { piece: id };
      const dx = clamp(o.dx, -10, 10), dz = clamp(o.dz, -10, 10), dy = clamp(o.dy, -10, 10), sc = clamp(o.scale, 0.2, 5), yaw = clamp(o.yaw, -Math.PI * 2, Math.PI * 2);
      if (dx !== undefined) e.dx = r2(dx);
      if (dz !== undefined) e.dz = r2(dz);
      if (dy !== undefined) e.dy = r2(dy);
      if (sc !== undefined) e.scale = r2(sc);
      if (yaw !== undefined) e.yaw = r2(yaw);
      if (Object.keys(e).length > 1) edits.push(e);
    }
  }
  return { text, edits };
}

// Apply accepted edits to the pieces (the editor calls this on one click, then re-checks with the simulator).
export function applyEdits<T extends Piece>(pieces: T[], edits: Edit[]): void {
  for (const e of edits) {
    const p = pieces.find((q) => q.id === e.piece);
    if (!p) continue;
    p.x += e.dx ?? 0; p.z += e.dz ?? 0; p.y = Math.max(0, p.y + (e.dy ?? 0));
    if (e.scale !== undefined) p.scale *= e.scale;
    if (e.yaw !== undefined) p.yaw += e.yaw;
  }
}
