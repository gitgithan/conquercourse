// The ready-made questions for the design partner (CC-243): "Suggest Fix" when a lane cannot be cleared, "Suggest More" when it can.
// The prompt names the problem and at most three pieces as examples, so a 30-piece course never floods the box.
export const MAX_PIECES = 30; // the most obstacles the World Editor keeps
export const MAX_EXAMPLES = 3;

export interface PieceBrief { name: string; x: number; heightM: number }

const line = (p: PieceBrief): string => `${p.name} at ${p.x.toFixed(1)} m (${p.heightM.toFixed(1)} m high)`;

export function suggestPrompt(clear: boolean, pieces: PieceBrief[]): string {
  const sample = [...pieces].sort((a, b) => b.heightM - a.heightM).slice(0, MAX_EXAMPLES).map(line).join('; ');
  const on = pieces.length > MAX_EXAMPLES ? `${sample}, and ${pieces.length - MAX_EXAMPLES} more` : sample;
  if (clear) return `The simulator can clear this lane of ${pieces.length} pieces. Suggest one or two ways to make it more fun, for example a swing or a hang to show air control. Pieces so far: ${on || 'none'}. Keep the answer short.`;
  return `The simulator cannot clear this lane of ${pieces.length} pieces. Say what the problem is in one sentence, give the general rule, and suggest which pieces to move, with examples from a few pieces only. Tallest pieces: ${on || 'none'}. Keep the answer short.`;
}
