import { describe, expect, it } from 'vitest';
import { diagram, DIAGRAM_IDS } from '../src/modes/diagrams';

describe('dojo diagrams', () => {
  for (const id of DIAGRAM_IDS) {
    for (const kind of ['real', 'principle'] as const) {
      it(`${id} ${kind} is an SVG with a viewBox and no formula signs`, () => {
        const s = diagram(id, kind);
        expect(s.startsWith('<svg')).toBe(true);
        expect(s).toContain('viewBox="0 0 760 440"');
        expect(s.replace(/<[^>]*>/g, '')).not.toMatch(/[=×÷+]/);
      });
    }
  }
});
