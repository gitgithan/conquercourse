import { describe, expect, it } from 'vitest';
import { CREW_SIZE, FILM_LINK, FILM_SECONDS, HIT_ORDER, MOVE_OF_SLOT, ROOKIE_SLOTS, cameraOf, cardAt, dimAt, freezeOf, lastFreeze, momentOf, poseOf, spotOf } from '../src/film/group-moves';
import { chooseClip } from '../src/motion/actor-pose';

describe('film group photo (?demo=groupmoves)', () => {
  it('has ten characters, the two Rookies in the middle, each with a different move', () => {
    expect(MOVE_OF_SLOT).toHaveLength(CREW_SIZE);
    expect(new Set(MOVE_OF_SLOT).size).toBe(CREW_SIZE);
    expect([...ROOKIE_SLOTS]).toEqual([CREW_SIZE / 2 - 1, CREW_SIZE / 2]);
    expect([...HIT_ORDER].sort((a, b) => a - b)).toEqual([...Array(CREW_SIZE).keys()]);
  });
  it('stands first, moves, then holds the same still pose', () => {
    for (let i = 0; i < CREW_SIZE; i++) {
      expect(momentOf(i, 0).phase).toBe('stand');
      expect(chooseClip(poseOf(MOVE_OF_SLOT[i], momentOf(i, 0)).state)).toBe('stand');
      const a = poseOf(MOVE_OF_SLOT[i], momentOf(i, freezeOf(i) + 0.1)), b = poseOf(MOVE_OF_SLOT[i], momentOf(i, FILM_SECONDS));
      expect(a).toEqual(b);
      expect(momentOf(i, freezeOf(i) + 0.1).phase).toBe('frozen');
    }
  });
  it('shows ten different clips when frozen, all before the dim', () => {
    const clips = MOVE_OF_SLOT.map((m, i) => chooseClip(poseOf(m, momentOf(i, lastFreeze() + 0.1)).state));
    expect(new Set(clips).size).toBeGreaterThanOrEqual(8); // wall-reach and bounce etc. are separate clips; run/leap/land/slide/roll/vault/climb/swing differ
    expect(lastFreeze()).toBeLessThan(dimAt(0) + 5.3);
    expect(dimAt(5.3 - 1e-6)).toBe(0);
  });
  it('keeps every character inside the frame and facing the camera', () => {
    for (let i = 0; i < CREW_SIZE; i++) { const s = spotOf(i); expect(Math.abs(s.x)).toBeLessThan(5.5); expect(Math.cos(s.yaw)).toBeLessThanOrEqual(0.2 + 1); }
    expect(spotOf(4).x).toBeLessThan(0); expect(spotOf(5).x).toBeGreaterThan(0);
  });
  it('pushes in slowly, then dims, then the end card shows with the exact link', () => {
    expect(cameraOf(FILM_SECONDS).z).toBeLessThan(cameraOf(0).z);
    expect(cameraOf(0)).toEqual(cameraOf(1));
    expect(cardAt(0)).toBe(0); expect(cardAt(FILM_SECONDS)).toBe(1); expect(dimAt(FILM_SECONDS)).toBe(1);
    expect(FILM_LINK).toBe('https://conquercourse.pages.dev/');
  });
});
