import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { playPlan } from '../src/sim/ideal';
it('the Two ways stored plan clears', () => {
  const c = JSON.parse(readFileSync('public/assets/demo/two-ways.course.json', 'utf8'));
  expect(playPlan(c, c.plan, 120 * 120).world.outcome).toBe('cleared');
});
it('cannonballs plan clears with the balls', () => {
  const c = JSON.parse(readFileSync('public/assets/demo/cannonballs.course.json', 'utf8'));
  expect(c.shots.length).toBe(4);
  expect(playPlan(c, c.plan, 120 * 120).world.outcome).toBe('cleared');
});
