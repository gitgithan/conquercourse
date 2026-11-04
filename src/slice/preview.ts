import type { Advice, Change, LaneSetting } from './advice';
import type { Edit } from './designer';
import { realSize, type Piece, type Role } from './world';
import { DEFAULT_TREBUCHET } from '../sim/trebuchet';
import type { Machine } from './launch-lane';

// Preview before apply: every way the editor can change the layout (Fix it, the design partner's changes, one piece of advice) first becomes a
// Proposal, a list of things that would move from where to where. Nothing is applied until the player says so; each change can be switched off.
// Pure: no drawing here, only the numbers (the editor draws the hollow outlines) and plain words for each change.
export interface PieceState { x: number; y: number; z: number; yaw: number; scale: number; role?: Role }
export type Item =
  | { kind: 'piece'; id: number; name: string; from: PieceState; to: PieceState; words: string; on: boolean }
  | { kind: 'lane'; key: keyof LaneSetting; from: number; to: number; words: string; on: boolean }
  | { kind: 'machine'; key: 'counterweight' | 'short' | 'pin'; from: number | null; to: number; words: string; on: boolean }; // a setting of the trebuchet at the start of the lane
export interface Proposal { source: 'fixit' | 'partner' | 'advice' | 'role' | 'shortcut' | 'easier'; title: string; items: Item[]; steps: string[]; known?: boolean } // known: the simulator already proved the all-on result

const stateOf = (p: Piece): PieceState => ({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: p.scale, role: p.role ?? 'ground' });
const same = (a: PieceState, b: PieceState) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.yaw - b.yaw) < 1e-6 && Math.abs(a.scale / b.scale - 1) < 1e-6 && (a.role ?? 'ground') === (b.role ?? 'ground');
const metres = (v: number) => `${+Math.abs(v).toFixed(2)} m`;

// "Bar 1", "Bar 2" when several pieces share a name (in the order along the run); the name alone otherwise.
export function labelsOf(pieces: Piece[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const p of pieces) {
    const twins = pieces.filter((q) => q.name === p.name).sort((a, b) => a.x - b.x);
    out.set(p.id, twins.length > 1 ? `${p.name} ${twins.indexOf(p) + 1}` : p.name);
  }
  return out;
}

export function pieceWordLines(name: string, lane: LaneSetting, from: PieceState, to: PieceState, heightNow: number): string[] {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, ca = Math.cos(lane.angle), sa = Math.sin(lane.angle);
  const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
  const parts: string[] = [];
  if (Math.abs(along) >= 0.02) parts.push(`${metres(along)} ${along > 0 ? 'further along' : 'back toward the start'}`);
  if (Math.abs(across) >= 0.02) parts.push(`${metres(across)} sideways`);
  if (Math.abs(dy) >= 0.02) parts.push(`${metres(dy)} ${dy > 0 ? 'up' : 'down'}`);
  const out: string[] = [];
  if (parts.length) out.push(`Move “${name}” ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}.`);
  const k = to.scale / from.scale;
  if (Math.abs(k - 1) > 0.005) out.push(`Make “${name}” ${k < 1 ? 'smaller' : 'bigger'}: ${Math.round(Math.abs(1 - k) * 100)}% ${k < 1 ? 'less' : 'more'} (about ${metres(heightNow * k)} high).`);
  const turn = ((to.yaw - from.yaw) * 180) / Math.PI;
  if (Math.abs(turn) >= 0.5) out.push(`Turn “${name}” ${Math.round(Math.abs(turn))}°.`);
  if ((from.role ?? 'ground') !== (to.role ?? 'ground')) out.push(`Use “${name}” as ${ROLE_WORDS[to.role ?? 'ground']}.`);
  return out;
}

export const ROLE_WORDS: Record<Role, string> = { ground: 'plain ground', wall: 'the Warped Wall', rope: 'a rope anchor', trampoline: 'a trampoline bed', bar: 'a swing bar' };

function laneWords(key: keyof LaneSetting, from: number, to: number): string {
  if (key === 'angle') return `Turn the lane ${Math.round(Math.abs(((to - from) * 180) / Math.PI))}° about the rod.`;
  if (key === 'offset') return `Move the lane ${metres(to - from)} sideways.`;
  return to > from ? `Raise the water ${metres(to - from)} (the lane starts higher up).` : `Lower the water ${metres(to - from)}.`;
}

function machineWords(key: 'counterweight' | 'short' | 'pin', from: number | null, to: number): string {
  if (key === 'counterweight') return `Use a ${to} kg counterweight${from !== null ? ` (now ${from} kg)` : ''}.`;
  if (key === 'short') return `Change the arm to ${(DEFAULT_TREBUCHET.long / to).toFixed(1)} to 1: the counterweight end ${to.toFixed(2)} m from the pivot${from !== null ? ` (now ${(DEFAULT_TREBUCHET.long / from).toFixed(1)} to 1)` : ''}.`;
  return `Add a pin at ${to}°: the machine lets the rider go by itself.`;
}

// The machine settings that differ between two machines become items.
export function machineItems(from: Machine | null | undefined, to: Machine | null | undefined): Item[] {
  if (!from || !to) return [];
  const items: Item[] = [];
  if (from.counterweight !== to.counterweight) items.push({ kind: 'machine', key: 'counterweight', from: from.counterweight, to: to.counterweight, words: machineWords('counterweight', from.counterweight, to.counterweight), on: true });
  const sf = from.short ?? DEFAULT_TREBUCHET.short, st = to.short ?? DEFAULT_TREBUCHET.short;
  if (Math.abs(sf - st) > 1e-9) items.push({ kind: 'machine', key: 'short', from: sf, to: st, words: machineWords('short', sf, st), on: true });
  if (to.pin !== undefined && to.pin !== from.pin) items.push({ kind: 'machine', key: 'pin', from: from.pin ?? null, to: to.pin, words: machineWords('pin', from.pin ?? null, to.pin), on: true });
  return items;
}

// Everything that differs between two layouts becomes one item (a piece with all its changes, or one lane setting).
export function diffProposal(source: Proposal['source'], title: string, pieces: Piece[], lane: LaneSetting, nextPieces: Piece[], nextLane: LaneSetting, steps: string[] = [], known?: boolean, machine?: Machine | null, nextMachine?: Machine | null): Proposal {
  const names = labelsOf(pieces), items: Item[] = [];
  for (const p of pieces) {
    const q = nextPieces.find((x) => x.id === p.id);
    if (!q || same(stateOf(p), stateOf(q))) continue;
    items.push({ kind: 'piece', id: p.id, name: names.get(p.id)!, from: stateOf(p), to: stateOf(q), words: pieceWordLines(names.get(p.id)!, lane, stateOf(p), stateOf(q), realSize(p).h).join(' '), on: true });
  }
  for (const key of ['angle', 'offset', 'level'] as const) if (Math.abs(lane[key] - nextLane[key]) > 1e-6) items.push({ kind: 'lane', key, from: lane[key], to: nextLane[key], words: laneWords(key, lane[key], nextLane[key]), on: true });
  items.push(...machineItems(machine, nextMachine));
  return { source, title, items, steps, known };
}

// One piece of advice (the same meaning as the editor's old "Do it").
export function applyChange<T extends Piece>(pieces: T[], lane: LaneSetting, id: number | undefined, c: Change): { pieces: T[]; lane: LaneSetting } {
  return {
    pieces: pieces.map((p) => (p.id === id ? { ...p, x: p.x + (c.dx ?? 0), z: p.z + (c.dz ?? 0), y: Math.max(0, p.y + (c.dy ?? 0)), scale: c.scale ?? p.scale, yaw: p.yaw + (c.yaw ?? 0) } : p)),
    lane: { angle: c.angle ?? lane.angle, offset: c.offset ?? lane.offset, level: c.level ?? lane.level },
  };
}
export function fromAdvice<T extends Piece>(pieces: T[], lane: LaneSetting, a: Advice, machine?: Machine | null): Proposal {
  const next = applyChange(pieces, lane, a.piece, a.change);
  return diffProposal('advice', 'A suggested change', pieces, lane, next.pieces, next.lane, [a.text], a.verified || undefined, machine, a.machine ? a.machine : machine);
}

// The design partner's edits (deltas, a scale factor, a turn), applied in order to copies.
export function fromEdits<T extends Piece>(pieces: T[], lane: LaneSetting, edits: Edit[]): Proposal {
  const next = pieces.map((p) => ({ ...p }));
  for (const e of edits) {
    const p = next.find((q) => q.id === e.piece);
    if (!p) continue;
    p.x += e.dx ?? 0; p.z += e.dz ?? 0; p.y = Math.max(0, p.y + (e.dy ?? 0));
    if (e.scale !== undefined) p.scale *= e.scale;
    if (e.yaw !== undefined) p.yaw += e.yaw;
  }
  return diffProposal('partner', 'Your design partner suggests', pieces, lane, next, lane);
}

// The layout after the switched-on changes. The pieces are copies; the originals are never touched.
export function resultOf<T extends Piece>(pieces: T[], lane: LaneSetting, proposal: Proposal, machine?: Machine | null): { pieces: T[]; lane: LaneSetting; machine: Machine | null } {
  const next = pieces.map((p) => ({ ...p })), l = { ...lane };
  let m: Machine | null = machine ? { ...machine } : null;
  for (const it of proposal.items) {
    if (!it.on) continue;
    if (it.kind === 'lane') { l[it.key] = it.to; continue; }
    if (it.kind === 'machine') { if (m) m = { ...m, [it.key]: it.to }; continue; }
    const p = next.find((q) => q.id === it.id);
    if (p) { p.x = it.to.x; p.y = it.to.y; p.z = it.to.z; p.yaw = it.to.yaw; p.scale = it.to.scale; p.role = it.to.role === 'ground' ? undefined : it.to.role; }
  }
  return { pieces: next, lane: l, machine: m };
}

export const enabledCount = (p: Proposal) => p.items.filter((i) => i.on).length;
