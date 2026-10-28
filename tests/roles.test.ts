import { describe, expect, it } from 'vitest';
import { diffProposal, resultOf } from '../src/slice/preview';
import { type P } from '../src/slice/holds-world';
import { MOVES, WALL_SPEED, applySuggestion, clears, footprint, movesInWorld, roleCandidates, roleCourse, suggestRoles } from '../src/slice/roles';
import { box, dome } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';
import { DEFAULT_WALL, runWall } from '../src/sim/wall';

const mk = (name: string, w: number, h: number, d: number, x: number, y = 0, role?: P['role'], z = 0): P => ({ ...newPiece(name, box(w, h, d), { x, z }), y, ...(role ? { role } : {}) });
const flat = { angle: 0, offset: 0, level: 0 };
const snapshot = (ps: P[]) => JSON.stringify(ps.map((p) => [p.id, p.x, p.y, p.z, p.yaw, p.scale, p.role]));

// Three small worlds, one per role (the simulator's own proof tells the roles apart from plain ground)
const wallWorld = (role?: P['role']) => [mk('Deck', 30, 0.5, 1.8, 15), mk('Wall', 2, 4.0, 1.8, 31, 0, role)];
// deck B is 3.4 m up: from the bed ground (0.3 m) that is a 3.1 m wall, above the climb limit (2.83 m), so only the trampoline gets over it
const bedWorld = (role?: P['role']) => [mk('A', 12, 3, 1.8, -6), mk('Bed', 8, 0.3, 1.8, 10, 0, role), mk('B', 12, 3.4, 1.8, 21.4)];
const bedLane = { angle: 0, offset: 0, level: 3 };
const ropeWorld = (role?: P['role']) => [mk('D1', 12, 0.5, 1.8, 4), mk('Pole', 0.3, 6.6, 0.3, 14, 0, role), mk('D2', 12, 0.5, 1.8, 24)];
const ropeLane = { angle: 0, offset: 0, level: 0.5 };

describe('what a piece measures in the lane', () => {
  it('a long block turned 90 degrees is short along the run and wide across it', () => {
    const p = mk('Long', 6, 1, 1, 0);
    expect(footprint(p, flat).alongHalf).toBeCloseTo(3, 6);
    expect(footprint({ ...p, yaw: Math.PI / 2 }, flat).alongHalf).toBeCloseTo(0.5, 6);
    expect(footprint({ ...p, yaw: Math.PI / 2 }, flat).acrossHalf).toBeCloseTo(3, 6);
    expect(footprint(p, { angle: Math.PI / 2, offset: 0, level: 0 }).alongHalf).toBeCloseTo(0.5, 6); // turning the lane is the same as turning the piece
  });
  it('the top is measured above the lane level', () => {
    expect(footprint(mk('Tall', 1, 2, 1, 0, 0.5), { angle: 0, offset: 0, level: 1 }).top).toBeCloseTo(1.5, 6);
  });
});

describe('the Warped Wall needs the speed the wall law says', () => {
  it('the speed in the plain words is the speed at which the hands just reach the top', () => {
    for (const height of [3.4, 3.8, 4.3]) {
      const p = { ...DEFAULT_WALL, height };
      expect(runWall(WALL_SPEED(height) + 0.2, p).grabbed).toBe(true);
      expect(runWall(WALL_SPEED(height) - 0.4, p).grabbed).toBe(false);
    }
  });
  it('a taller wall needs more speed', () => {
    expect(WALL_SPEED(4.3)).toBeGreaterThan(WALL_SPEED(3.4));
  });
});

describe('candidates: the smallest change that gives a piece the size a role needs', () => {
  it('a 2 m face becomes a wall with scale x2; a 3.9 m face already is one', () => {
    const c = roleCandidates(mk('Tall', 2, 2.0, 1.8, 0), flat).find((s) => s.role === 'wall');
    expect(c?.change).toEqual({ scale: 2, role: 'wall' });
    expect(c?.words).toContain('Warped Wall');
    const ok = roleCandidates(mk('Face', 2, 3.9, 1.8, 0), flat).find((s) => s.role === 'wall');
    expect(ok?.change).toEqual({ role: 'wall' });
  });
  it('a face too narrow to fill the lane is not offered as a wall', () => {
    expect(roleCandidates(mk('Post', 0.4, 2.0, 0.4, 0), flat).some((s) => s.role === 'wall')).toBe(false);
  });
  it('a low flat piece can be a bed; its length is brought into 2 to 6 m', () => {
    const c = roleCandidates(mk('Mat', 1.2, 0.3, 1.8, 0), flat).find((s) => s.role === 'trampoline');
    expect(c?.change.scale).toBeCloseTo(2.5, 2);
    expect(roleCandidates(mk('Mat', 4, 0.3, 1.8, 0), flat).find((s) => s.role === 'trampoline')?.change).toEqual({ role: 'trampoline' });
  });
  it('a pole is lifted or scaled to 6.6 m up; a floating beam is lowered or lifted to it', () => {
    expect(roleCandidates(mk('Pole', 0.3, 3.3, 0.3, 0), flat).find((s) => s.role === 'rope')?.change).toEqual({ scale: 2, role: 'rope' });
    expect(roleCandidates(mk('Beam', 3, 0.2, 0.3, 0, 5), flat).find((s) => s.role === 'rope')?.change).toEqual({ dy: 1.4, role: 'rope' });
  });
  it('a long block can be turned 90 degrees; bars and stacks get no role', () => {
    expect(roleCandidates(mk('Long', 6, 1, 1.5, 0), flat).some((s) => s.role === 'turn' && s.change.yaw === Math.PI / 2)).toBe(true);
    expect(roleCandidates({ ...mk('Bar', 0.1, 0.1, 2, 0), src: 'hold:bar' }, flat)).toEqual([]);
  });
});

describe('the course a world makes with its roles', () => {
  it('a wall piece becomes the wall: its curve ends at the face, and the top is a deck to run on', () => {
    const { course, notes } = roleCourse(wallWorld('wall'), flat);
    expect(notes).toEqual([]);
    expect(course.wall?.height).toBeCloseTo(3.5, 2); // 4.0 m piece on a 0.5 m deck
    const top = course.terrain.platforms.find((p) => p.top === 4)!;
    if (!course.wall) throw new Error('no wall');
    expect(course.wall.x0 + (course.wall.height ?? 0)).toBeCloseTo(top.x0, 1); // the curve ends at the face
    expect(top.x1 - top.x0).toBeGreaterThanOrEqual(8);
  });
  it('without the role the same piece is a step far too tall to climb', () => {
    expect(roleCourse(wallWorld(), flat).course.wall).toBeUndefined();
  });
  it('a bed piece becomes a bouncy platform of its own', () => {
    const { course, notes } = roleCourse(bedWorld('trampoline'), bedLane);
    expect(notes).toEqual([]);
    const beds = course.terrain.platforms.filter((p) => p.bouncy);
    expect(beds).toHaveLength(1);
    expect(beds[0].x1 - beds[0].x0).toBeCloseTo(8, 0);
    expect(beds[0].top).toBeLessThan(0);
  });
  it('a rope anchor hangs the rope from the top of the piece and keeps the gap under it', () => {
    const { course } = roleCourse(ropeWorld('rope'), ropeLane);
    expect(course.rope?.anchorY).toBeCloseTo(6.1, 2); // 6.6 m top, lane level 0.5 m
    const gap = course.terrain.platforms[2].x0 - course.terrain.platforms[1].x1;
    expect(gap).toBeGreaterThan(5); // not bridged down to the 5 m of an ordinary gap
  });
  it('a bed that cannot be a platform of its own says why', () => {
    const mound: P = { ...newPiece('Mound', dome(1.5, 0.8, 1), { x: 15, z: 0 }), role: 'trampoline' }; // a curved top is not a flat bed
    const { notes } = roleCourse([mk('Deck', 30, 0.5, 1.8, 15), mound], flat);
    expect(notes.join(' ')).toMatch(/trampoline/);
  });
});

describe('every role is proved by the simulator: the world clears with the role and not without it', () => {
  it('wall', () => {
    expect(clears(wallWorld('wall'), flat)).toBe(true);
    expect(clears(wallWorld(), flat)).toBe(false);
  }, 120000);
  it('trampoline bed', () => {
    expect(clears(bedWorld('trampoline'), bedLane)).toBe(true);
    expect(clears(bedWorld(), bedLane)).toBe(false);
  }, 120000);
  it('rope anchor', () => {
    expect(clears(ropeWorld('rope'), ropeLane)).toBe(true);
    expect(clears(ropeWorld(), ropeLane)).toBe(false);
  }, 240000);
});

describe('the moves panel and the suggestions', () => {
  it('lists every move the game knows, with what it needs in plain words', () => {
    const status = movesInWorld(wallWorld('wall'), flat);
    expect(status.map((m) => m.id)).toEqual(MOVES.map((m) => m.id));
    for (const m of status) expect(m.need.length).toBeGreaterThan(20);
    expect(status.find((m) => m.id === 'wall')?.have).toBe('yes');
    expect(status.find((m) => m.id === 'rope')?.have).toBe('no');
    expect(status.find((m) => m.id === 'coaster')?.have).toBe('elsewhere');
    expect(status.find((m) => m.id === 'trebuchet')?.have).toBe('no');
    expect(movesInWorld(wallWorld('wall'), flat, { trebuchet: true }).find((m) => m.id === 'trebuchet')?.have).toBe('yes');
  });
  it('a wall suggestion for an unmarked tall piece is proved, leaves the pieces untouched, and clears once applied', () => {
    const world = [mk('Deck', 30, 0.5, 1.8, 15), mk('Slab', 2, 2.0, 1.8, 31)]; // 2 m tall: too tall to jump, too low for a wall until it is made x2
    const before = snapshot(world);
    const found = suggestRoles(world, flat, { moves: ['wall'], budgetMs: 100000 });
    expect(snapshot(world)).toBe(before);
    expect(found.length).toBeGreaterThanOrEqual(1);
    const s = found[0];
    expect(s.proved).toBe(true);
    expect(s.change).toEqual({ scale: 2, role: 'wall' });
    expect(clears(applySuggestion(world, s), flat)).toBe(true);
    expect(clears(world, flat)).toBe(false);
  }, 240000);
  it('suggestions go through the shared preview: the words name the role, and Apply sets it', () => {
    const world = wallWorld();
    const next = world.map((p) => (p.name === 'Wall' ? { ...p, role: 'wall' as const } : p));
    const pr = diffProposal('role', 'Roles', world, flat, next, flat);
    expect(pr.items).toHaveLength(1);
    expect(pr.items[0].kind === 'piece' && pr.items[0].words).toContain('Warped Wall');
    expect(resultOf(world, flat, pr).pieces.find((p) => p.name === 'Wall')?.role).toBe('wall');
    expect(world.find((p) => p.name === 'Wall')?.role).toBeUndefined();
  });
});
