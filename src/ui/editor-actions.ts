// Shared action labels for the menu, glossary and underlying buttons.
// Repair searches for changes; verification checks a preview of those changes.
export const EDITOR_ACTIONS = {
  fixit: { id: 'fixit', label: 'Find a repair', engine: 'Simulator · game physics', kind: 'simulator', when: 'When the simulator has not found a clear run.', expect: 'Searches for layout or device changes and tests them with the game physics. Review any result before Apply.', clear: false },
  easier: { id: 'easier', label: 'Make it easier', engine: 'Simulator · game physics', kind: 'simulator', when: 'When the course clears but the hardest press is tight.', expect: 'Tries small changes to widen the hardest press window. Preview the result before Apply.', clear: true },
  findroutes: { id: 'findroutes', label: 'Find shortcut routes', engine: 'Simulator · game physics', kind: 'simulator', when: 'When you want to find ways to skip an obstacle.', expect: 'Simulates alternate routes. This can take about a minute. Review each skip, then close it or keep it.', clear: true },
  what: { id: 'what', label: 'Ask AI for ideas', engine: 'AI · Muse Spark Open', kind: 'ai', when: 'When you want design ideas or help deciding what to change.', expect: 'Suggests object moves from your course and question. The simulator checks the suggestions when you preview them.', clear: false },
} as const;
export const actionTitle = (a: typeof EDITOR_ACTIONS[keyof typeof EDITOR_ACTIONS]): string => `${a.engine}. ${a.when} ${a.expect}`;
