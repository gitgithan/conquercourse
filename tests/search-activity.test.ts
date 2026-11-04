import { expect, it } from 'vitest';
import { searchActivity } from '../src/slice/search-activity';

it('locates the reported take-off edge, including the origin and negative positions', () => {
  expect(searchActivity({ label: 'edge at 0 m', step: 0, of: 2 }).x).toBe(0);
  expect(searchActivity({ label: 'step at -2.5 m', step: 1, of: 2 }).x).toBe(-2.5);
  expect(searchActivity({ label: 'edge at 17 m (monkey bars)', step: 2, of: 4 }).x).toBe(17);
});
it('does not invent an obstacle location or report completion from a batch', () => {
  expect(searchActivity(null).x).toBeNull();
  expect(searchActivity({ label: 'the trebuchet release', step: 0, of: 1 }).x).toBeNull();
  const replay = searchActivity({ label: 'the whole course', step: 4, of: 4 });
  expect(replay.x).toBeNull(); expect(replay.fraction).toBeNull(); expect(replay.stage).toMatch(/Replaying/);
});
