import { expect, it } from 'vitest';
import { previewCheckView } from '../src/modes/editor/preview-check';

it('explains the initial search and keeps the bar indeterminate until measured progress exists', () => {
  const start = previewCheckView(null, 1200);
  expect(start.stage).toMatch(/movement timings.*these edits/);
  expect(start.elapsed).toBe('1 second elapsed'); expect(start.fraction).toBeNull();
  const first = previewCheckView({ label: 'edge at 6 m', step: 0, of: 3 }, 4500);
  expect(first.stage).toMatch(/Obstacle 1 of 3.*jump and grab.*6 m/);
  expect(first.fraction).toBeNull();
});
it('names the actual obstacle and counts completed obstacles within the current pass', () => {
  const bars = previewCheckView({ label: 'edge at 17 m (monkey bars)', step: 2, of: 5 }, 12345);
  expect(bars.stage).toMatch(/Obstacle 3 of 5.*swing and reach.*17 m/);
  expect(bars.elapsed).toBe('12 seconds elapsed'); expect(bars.fraction).toBe(0.4);
  expect(previewCheckView({ label: 'step at 12 m', step: 1, of: 4 }, 0).stage).toMatch(/vault and climb.*12 m/);
  expect(previewCheckView({ label: 'the trebuchet release', step: 0, of: 1 }, 0).stage).toMatch(/trebuchet release/);
});
it('never claims the full search is complete from a stage message alone', () => {
  const final = previewCheckView({ label: 'the whole course', step: 5, of: 5 }, 20000);
  expect(final.stage).toMatch(/Replaying a complete run/); expect(final.fraction).toBeNull();
  expect(previewCheckView({ label: 'edge at 6 m', step: 5, of: 5 }, 0).fraction).toBeLessThan(1);
  expect(previewCheckView({ label: 'timings', step: NaN, of: NaN }, -10).fraction).toBeNull();
});
