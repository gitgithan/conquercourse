const SIMULATOR = { label: 'Simulator · game physics', kind: 'simulator' } as const;
const SPARK = { label: 'Muse Spark Open · ideas', kind: 'ai' } as const;
const PREVIEW = { label: 'Simulator · Preview check', kind: 'simulator' } as const;

export const BLOCKED_LANE_GUIDANCE = 'The simulator has not found a clear run. Choose Ask AI for ideas, then preview the suggestions with the simulator.';

// Shared action labels for the menu, glossary and underlying buttons.
// AI proposes edits; the simulator checks the preview and searches timings or routes.
export const EDITOR_ACTIONS = {
  easier: { id: 'easier', label: 'Make it easier', engines: [SIMULATOR], when: 'When the course clears but the hardest press is tight.', expect: 'Tries small changes to widen the hardest press window. Preview the result before Apply.', clear: true },
  findroutes: { id: 'findroutes', label: 'Find shortcut routes', engines: [SIMULATOR], when: 'When you want to find ways to skip an obstacle.', expect: 'Simulates alternate routes. This can take about a minute. Review each skip, then close it or keep it.', clear: true },
  what: { id: 'what', label: 'Ask AI for ideas', engines: [SPARK, PREVIEW], when: 'When you want design ideas or help deciding what to change.', expect: 'Muse Spark Open uses your layout and simulator findings to suggest edits. Preview tests the exact changes with game physics.', clear: false },
} as const;
export const actionTitle = (a: typeof EDITOR_ACTIONS[keyof typeof EDITOR_ACTIONS]): string => `${a.engines.map((e) => e.label).join('. ')}. ${a.when} ${a.expect}`;
