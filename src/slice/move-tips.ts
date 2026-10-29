// Move tips: for an object cut out of a player's photo, Muse Spark Open says which of the game's moves could get past it and gives one short
// idea for how it makes a course interesting. This file is pure (no network): it holds what the model is told and cleans what it says back.
// The game's own list of moves has the last word: a move not on it is dropped, and a broken answer gives no tip at all, never a wrong one.
export const MOVES = ['jump', 'climb', 'vault', 'hang', 'balance', 'duck'] as const; // the same list and names as MOVE_ORDER in piece-info.ts (a test keeps them equal)
export type TipMove = (typeof MOVES)[number];
export interface Tip { moves: TipMove[]; idea: string }

export const MOVE_TIP_PROMPT = [
  'You help a player of a ninja-warrior physics game decide how a real object from their photo could be used in a course.',
  'A runner goes left to right along a 2 m wide lane. Earth physics only.',
  'These are the only moves, with what each one needs:',
  '"jump": a small, compact thing (a post, a barrel, a planter) the runner leaps over or onto, up to about 1 m high;',
  '"vault": a long, solid barrier (a bench, a table, a railing, a low wall), wider than a person and 0.35 to 1.3 m high, crossed with a hand on top at running speed;',
  '"climb": a wall or ledge taller than 1 m, up to about 2.5 m, with an edge to grab and pull up on;',
  '"hang": a bar or beam above head height (2.3 to 3.7 m) that hands can grab, to swing from;',
  '"balance": a long, narrow thing at foot to knee height (a log, a beam, a rail) to walk along;',
  '"duck": a low gap overhead to squat under.',
  'Look at the photo and the name. If the real size is not clear, use the usual size of that kind of object.',
  'Pick one to three moves, best first, only from that list.',
  'Then give one idea, at most 20 plain words a 13-year-old can follow, about what the object does to the runner\'s path in a course: a choice between two ways, a timing, a place that slows or speeds the run.',
  'Say only what is in the photo; do not invent a story, a place or a feeling.',
  'The idea never tells the player how to move their body, never grades anyone, and has no numbers or formulas.',
  'Keep your thinking short. Reply with one short json object and nothing else: {"moves":["vault","jump"],"idea":"..."}.',
].join(' ');

const SAME: Record<string, TipMove> = { swing: 'hang', hanging: 'hang', pullup: 'hang', crouch: 'duck', squat: 'duck', leap: 'jump', hop: 'jump' };
const COACHING = /\b(you should|you must|you need to|keep your|bend your|lean|swing your|push off|tuck|land on your|arms?|legs?|knees?)\b|[=<>^]|\d/i;

export function parseTip(reply: string): Tip | null {
  const found = [...reply.matchAll(/\{[^{}]*"moves"[^{}]*\}/g)];
  if (!found.length) return null;
  let o: { moves?: unknown; idea?: unknown };
  try { o = JSON.parse(found[found.length - 1][0]); } catch { return null; }
  if (!Array.isArray(o.moves)) return null;
  const moves: TipMove[] = [];
  for (const m of o.moves) {
    if (typeof m !== 'string') continue;
    const key = m.trim().toLowerCase();
    const move = (MOVES as readonly string[]).includes(key) ? (key as TipMove) : SAME[key];
    if (move && !moves.includes(move)) moves.push(move);
  }
  if (!moves.length) return null;
  const idea = typeof o.idea === 'string' ? o.idea.replace(/\s+/g, ' ').trim() : '';
  const words = idea.split(' ').filter(Boolean).length;
  return { moves: moves.slice(0, 3), idea: words >= 3 && words <= 30 && idea.length <= 200 && !COACHING.test(idea) ? idea : '' }; // a bad idea is dropped; the moves stay
}
