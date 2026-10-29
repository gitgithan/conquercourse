import { describe, expect, it } from 'vitest';
import { FILM_SHOTS, HERO_DISSOLVE, HERO_PHOTO_HOLD, SHOT_SECONDS, filmPose, filmShotOf, heroPhotoOpacity, type FilmCtx } from '../src/film/camera';

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
  it('skyline stays low and level (under 10 degrees) and runs the length of the lane', () => {
    for (const t of [0, 3, SHOT_SECONDS.skyline]) { const p = filmPose('skyline', t, ctx); expect(Math.asin((p.pos[1] - p.look[1]) / dist(p))).toBeLessThan(0.18); }
    expect(filmPose('skyline', SHOT_SECONDS.skyline, ctx).look[0]).toBeGreaterThan(ctx.finishX - 8);
  });
  it('orbit turns round the obstacle and stays about it', () => {
    const a = filmPose('orbit', 0, ctx), b = filmPose('orbit', SHOT_SECONDS.orbit, ctx);
    expect(a.look[0]).toBe(ctx.focusX);
    expect(Math.sign(a.pos[0] - ctx.focusX)).not.toBe(Math.sign(b.pos[0] - ctx.focusX));
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
  it('only turns on for a known shot name', () => {
    expect(filmShotOf('?film=orbit')).toBe('orbit');
    expect(filmShotOf('?film=nope')).toBeNull();
    expect(filmShotOf('')).toBeNull();
  });
});
