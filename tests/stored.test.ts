import { describe, expect, it } from 'vitest';
import { bandOnlySpeed, DEFAULT_BAND } from '../src/sim/band';
import { EXPERIMENTS, classify, sweep } from '../src/sim/experiments';
import { LESSONS } from '../src/modes/lessons';
import { DIAGRAM_IDS, diagram } from '../src/modes/diagrams';

// The Dojo lesson "Stored energy": the answer comes from the band's own energy law.
const stored = EXPERIMENTS.find((e) => e.id === 'stored')!;
describe('the stored-energy lesson', () => {
  it('its answer is the speed the band alone gives', () => {
    const r = stored.run({ stretch: 8, stiffness: 60 });
    expect(r.answer).toBeCloseTo(bandOnlySpeed({ ...DEFAULT_BAND, k: 60 }, 8), 9);
    expect(r.answer).toBeCloseTo(8 * Math.sqrt(60 / DEFAULT_BAND.mass), 6);
  });
  it('speed grows in direct proportion to the stretch and with the square root of the stiffness', () => {
    expect(classify(sweep(stored, { stretch: 8, stiffness: 60 }, 'stretch')).shape).toBe('direct');
    expect(classify(sweep(stored, { stretch: 8, stiffness: 60 }, 'stiffness')).shape).toBe('root');
  });
  it('four times as stiff throws twice as fast', () => {
    expect(stored.run({ stretch: 8, stiffness: 240 }).answer / stored.run({ stretch: 8, stiffness: 60 }).answer).toBeCloseTo(2, 6);
  });
  it('has a lesson with its formula last, a saying, and a diagram of each kind', () => {
    const l = LESSONS.stored;
    expect(l.formula).toMatch(/stretch/);
    expect(l.calc({ stretch: 8, stiffness: 60 }).value).toBeCloseTo(stored.run({ stretch: 8, stiffness: 60 }).answer, 9);
    expect(stored.sayings.length).toBeGreaterThan(0);
    expect(DIAGRAM_IDS).toContain('stored');
    expect(diagram('stored', 'real')).toContain('<svg');
    expect(diagram('stored', 'principle')).toContain('<svg');
  });
  it('shows no formula in the note or the saying (formulas are only the last step of the Dojo lesson)', () => {
    const note = stored.run({ stretch: 8, stiffness: 60 }).note!;
    expect(note).not.toMatch(/[=×√]|\^2|½/);
    for (const s of stored.sayings) expect(s).not.toMatch(/[=×√0-9]/);
  });
});
