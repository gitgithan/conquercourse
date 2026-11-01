import { describe, expect, it } from 'vitest';
import { FILM_SHOTS, MATRIX_YAW, HERO_DISSOLVE, HERO_PHOTO_HOLD, SHOT_SECONDS, filmPose, filmShotOf, heroPhotoOpacity, type FilmCtx } from '../src/film/camera';

const ctx: FilmCtx = { finishX: 46.8, focusX: 12, focusY: 0.7, runnerX: 10, runnerY: 0, airborne: 0 };
const dist = (p: { pos: number[]; look: number[] }) => Math.hypot(p.pos[0] - p.look[0], p.pos[1] - p.look[1], p.pos[2] - p.look[2]);

describe('film camera', () => {
  it('gives the same pose for the same time, every shot', () => {
    for (const s of FILM_SHOTS) for (const t of [0, 1.3, 4.7, SHOT_SECONDS[s]]) expect(filmPose(s, t, ctx)).toEqual(filmPose(s, t, { ...ctx }));
  });
  it('keeps the camera above ground and finite at any time', () => {
    for (const s of FILM_SHOTS) for (let t = -1; t <= SHOT_SECONDS[s] + 2; t += 0.25) {
      const p = filmPose(s, t, ctx);
      expect(p.pos.every(Number.isFinite) && p.look.every(Number.isFinite)).toBe(true);
      expect(p.pos[1]).toBeGreaterThanOrEqual(0.4);
    }
  });
  it('flyover ends past the finish line; it starts behind the start', () => {
    expect(filmPose('flyover', 0, ctx).look[0]).toBeLessThan(0);
    expect(filmPose('flyover', SHOT_SECONDS.flyover, ctx).look[0]).toBeGreaterThan(ctx.finishX);
  });
  it('skyline stays low and level (under 10 degrees) and runs along the buildings', () => {
    for (const t of [0, 3, SHOT_SECONDS.skyline]) { const p = filmPose('skyline', t, ctx); expect(Math.asin((p.pos[1] - p.look[1]) / dist(p))).toBeLessThan(0.18); }
    expect(filmPose('skyline', SHOT_SECONDS.skyline, ctx).look[0]).toBeGreaterThan(40); // it stops over the stored buildings, not past them
  });
  it('orbit turns round the obstacle and stays about it', () => {
    const a = filmPose('orbit', 0, ctx), b = filmPose('orbit', SHOT_SECONDS.orbit, ctx);
    expect(a.look[0]).toBe(ctx.focusX);
    expect(Math.sign(a.pos[0] - ctx.focusX)).not.toBe(Math.sign(b.pos[0] - ctx.focusX));
  });
  it('matrix orbit keeps the runner centred, turns behind to side to front-45 in order, and never zooms in or jerks', () => {
    const T = SHOT_SECONDS.matrix, run = { ...ctx, runnerX: 40, runnerY: 2.5 };
    let lastYaw = -Infinity, lastDist = 0;
    for (let i = 0; i <= 240; i++) {
      const t = (T * i) / 240, p = filmPose('matrix', t, run);
      expect(p.look).toEqual([40, 2.7, 0]); // the runner stays the aim point
      expect(p.fov).toBe(38); // no zoom
      const yaw = Math.atan2(p.pos[0] - p.look[0], p.pos[2] - p.look[2]), d = dist(p);
      expect(yaw).toBeGreaterThanOrEqual(lastYaw); lastYaw = yaw; // turns one way only
      expect(d).toBeGreaterThanOrEqual(lastDist - 1e-9); lastDist = d; // only pulls back
    }
    const at = (t: number) => { const p = filmPose('matrix', t, run); return Math.atan2(p.pos[0] - p.look[0], p.pos[2] - p.look[2]); };
    expect(at(0)).toBeCloseTo(MATRIX_YAW[0], 5); // behind
    expect(Math.abs(at(T * 0.5 + 0.0) - 0)).toBeLessThan(0.4); // about side-on in the middle
    expect(at(T)).toBeCloseTo(MATRIX_YAW[1], 5); // front-45
    // smooth: the turn between two frames at 30 fps never changes speed by more than a small fraction
    const w = (t: number) => at(t + 1 / 30) - at(t);
    for (let t = 0; t < T - 3 / 30; t += 1 / 30) expect(Math.abs(w(t + 1 / 30) - w(t))).toBeLessThan(0.004);
  });
  it('follow comes in while the runner is in the air and stands back on the ground', () => {
    expect(dist(filmPose('follow', 1, { ...ctx, airborne: 1 }))).toBeLessThan(dist(filmPose('follow', 1, ctx)));
  });
  it('push gets closer and narrows the view', () => {
    const a = filmPose('push', 0, ctx), b = filmPose('push', SHOT_SECONDS.push, ctx);
    expect(dist(b)).toBeLessThan(dist(a));
    expect(b.fov).toBeLessThan(a.fov);
  });
  it('hero starts close on the object and ends far above the whole course', () => {
    const a = filmPose('hero', 0, ctx), b = filmPose('hero', SHOT_SECONDS.hero, ctx);
    expect(dist(a)).toBeLessThan(6);
    expect(dist(b)).toBeGreaterThan(30);
    expect(b.pos[1]).toBeGreaterThan(15);
  });
  it('the photo is alone, then fades out, never back', () => {
    expect(heroPhotoOpacity(0)).toBe(1);
    expect(heroPhotoOpacity(HERO_PHOTO_HOLD)).toBe(1);
    expect(heroPhotoOpacity(HERO_PHOTO_HOLD + HERO_DISSOLVE)).toBe(0);
    let last = 1;
    for (let t = 0; t < 8; t += 0.1) { const o = heroPhotoOpacity(t); expect(o).toBeLessThanOrEqual(last + 1e-9); last = o; }
  });
  it('dive starts high over the course and settles into the side view at the start', () => {
    const a = filmPose('dive', 0, ctx), b = filmPose('dive', SHOT_SECONDS.dive, ctx);
    expect(a.pos[1]).toBeGreaterThan(10);
    expect(b.pos[1]).toBeLessThan(a.pos[1]);
    expect(Math.abs(b.look[0] - ctx.runnerX)).toBeLessThan(2);
    expect(b.pos[2]).toBeGreaterThan(10); // beside the runner, the normal side view, not above or behind
    expect(b.pos[0] - b.look[0]).toBeLessThan(1);
  });
  it('only turns on for a known shot name', () => {
    expect(filmShotOf('?film=orbit')).toBe('orbit');
    expect(filmShotOf('?film=nope')).toBeNull();
    expect(filmShotOf('')).toBeNull();
  });
});
