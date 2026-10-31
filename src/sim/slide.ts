import type { RunnerState } from './runner';
import type { Terrain } from './terrain';
import { groundAt } from './terrain';
import { DT, GRAVITY } from './units';

// The slide (Down or S while running on the ground): the runner drops onto the hip and slides along the ground, low enough for a ball that flies at head height.
// Plain physics: the speed it starts with is only worn away by the ground's friction (a = mu x g), so it is never more than the run speed and never grows.
export const SLIDE_MU = 0.45; // sliding friction of shoes and hip on a dry deck
export const SLIDE_DECEL = SLIDE_MU * GRAVITY; // m/s^2, about 4.4
export const SLIDE_MIN_SPEED = 4; // m/s: slower than a jog just sits down, so no slide
export const SLIDE_MAX_TIME = 0.9; // s: the longest a slide lasts before the body stands up again
export const SLIDE_STOP_SPEED = 1.5; // m/s: a slide worn down to this speed ends
export const SLIDE_RECOVERY = 0.5; // s after standing before the next slide can start (a cooldown, so it cannot be spammed)
export const SLIDE_COST = 0.02; // share of a full energy store (a ground roll is the same)
export const SLIDE_BODY_HIGH = 0.6; // m: how high the body reaches while sliding (standing it reaches 1.55 m); a ball flying higher passes over
export const SLIDE_BODY_LOW = 0.1; // m: the hip is nearly on the ground

export interface Slide {
  start: number; // tick the slide began
  v0: number; // m/s along its direction at the start
  dir: 1 | -1;
}

/** Can a slide start now? On the ground, fast enough, off cooldown. */
export function canSlide(s: RunnerState, tick: number, readyAt: number): boolean {
  return s.grounded && Math.abs(s.vx) >= SLIDE_MIN_SPEED && tick + 1 >= readyAt;
}

export function startSlide(s: RunnerState): Slide {
  return { start: s.tick + 1, v0: Math.abs(s.vx), dir: s.vx < 0 ? -1 : 1 };
}

/** The speed t seconds into a slide: friction takes the same amount off each second, and it never goes below zero. */
export const slideSpeed = (g: Slide, t: number): number => Math.max(0, g.v0 - SLIDE_DECEL * t);

/** One tick of a slide. It ends when the time is up, the speed is worn down, or the ground ends or rises in front (the runner then stops where it is). */
export function stepSlide(s: RunnerState, g: Slide, t: Terrain): { runner: RunnerState; ended: boolean } {
  const tick = s.tick + 1, since = (tick - g.start) * DT;
  const v = slideSpeed(g, since);
  const x = s.x + g.dir * v * DT, floor = groundAt(t, x);
  if (floor < s.y - 1e-6 || floor > s.y + 0.05) return { runner: { ...s, tick, vx: 0, vy: 0 }, ended: true };
  const done = since >= SLIDE_MAX_TIME || v <= SLIDE_STOP_SPEED;
  return { runner: { ...s, tick, x, y: floor, vx: g.dir * v, vy: 0, grounded: true }, ended: done };
}
