// The fall tips and the numbers behind a fall (they read the log of the run, the course and the guide meshes through one context).
import * as THREE from 'three/webgpu';
import { OBSTACLES } from '../../course/obstacles';
import { flightPath, pressBand } from '../../sim/needs';
import { DEFAULT_WALL } from '../../sim/wall';
import { bounce, DEFAULT_TRAMPOLINE } from '../../sim/trampoline';
import { groundAt } from '../../sim/terrain';
import { bandParams } from '../../sim/band';
import { crestSpeedLimit, railsOf } from '../../sim/cart';
import type { Window } from '../../sim/ideal';
import type { CourseCtx } from './context';

// The fall tip needs how wide the window of good presses is (see ensureWindows in the Course).
export const windowTip = (ws: Window[], x: number): string | undefined => {
  const w = ws.find((q) => q.obstacle.startsWith('edge') && Math.abs(q.best - x) < 9);
  return w ? (x < w.best ? 'You jumped a bit late. Try pressing Space a little earlier.' : 'You jumped a bit early. Try pressing Space a little later.') : undefined;
};

// Replay numbers and guiding lines, so the player learns something new instead of watching the same thing again.
function guideBand(ctx: CourseCtx, x0: number, x1: number, y: number, color: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05, x1 - x0), 0.06, 1.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  m.position.set((x0 + x1) / 2, y + 0.04, 0.4); ctx.guides.add(m);
}
function guideLine(ctx: CourseCtx, x: number, y: number, h: number, color: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.07), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y + h / 2, 0.4); ctx.guides.add(m);
}
function guidePath(ctx: CourseCtx, pts: { x: number; y: number }[], color: number) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.filter((_, i) => i % 3 === 0).map((q) => new THREE.Vector3(q.x, q.y + 0.9, 0.5)));
  ctx.guides.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
}

// The numbers behind a coaster fall: where the cart started, how fast it was, and what the hilltop could hold.
export function cartDiag(ctx: CourseCtx): string[] {
  const { course, st, log } = ctx;
  const rails = railsOf(course.track!, st.world.cart?.segment ?? Number(log.find((e) => e.type === 'cart-off')?.detail?.segment ?? 0)), L: string[] = [];
  const start = rails.y(rails.x0);
  L.push(`The cart started ${start.toFixed(1)} m up and was pushed off at ${(course.track!.push ?? 1.5).toFixed(1)} m/s.`);
  const off = log.find((e) => e.type === 'cart-off'), stall = log.find((e) => e.type === 'cart-stall');
  if (off) {
    const x = off.detail!.x as number;
    L.push(`It left the rails at ${x.toFixed(0)} m, ${rails.y(x).toFixed(1)} m up, doing ${(off.detail!.v as number).toFixed(1)} m/s.`);
    L.push(`That hilltop lets go above ${crestSpeedLimit(rails, x).toFixed(1)} m/s: the sharper the top, the slower the limit.`);
  }
  if (stall) L.push(`It turned round on a hill ${(stall.detail!.height as number).toFixed(1)} m up: the highest it could reach was about the height it started from.`);
  return L;
}
// The elastic band: what the throw was, and what would have gone farther (never how well you did)
export function bandTip(ctx: CourseCtx): string {
  const { course, log } = ctx;
  const rel = [...log].reverse().find((e) => e.type === 'band-release');
  const snap = [...log].reverse().find((e) => e.type === 'band-snap');
  const bp = bandParams(course);
  if (snap) return `The band snapped at ${(snap.detail!.stretch as number).toFixed(0)} m: it takes ${bp.snap.toFixed(0)} m at most. Turn round (hold \u2192) a little sooner.`;
  if (!rel) return OBSTACLES.band.tips.noRelease;
  return `You left the band at ${(rel.detail!.vx as number).toFixed(1)} m/s after stretching it ${(rel.detail!.stretch as number).toFixed(0)} m. A longer stretch throws faster: hold \u2190 a little longer before you turn round (it snaps at ${bp.snap.toFixed(0)} m).`;
}
export function buildDiag(ctx: CourseCtx, zoneId: string, what: 'splash' | 'slide'): string[] {
  const { course, log, specs } = ctx;
  const L: string[] = [];
  const jump = [...log].reverse().find((e) => e.type === 'jump');
  const push = course.jumpSpeed;
  if (what === 'slide' && course.wall) {
    const wp = { ...DEFAULT_WALL, ...course.wall };
    const need = wp.height - wp.hipHeight - wp.reach;
    const ev = [...log].reverse().find((e) => e.type === 'wall-slide');
    const margin = (ev?.detail?.margin as number) ?? 0;
    if ([...log].some((e) => e.type === 'wall-no-grip')) L.push('Your feet climbed high enough, but the hands never held on: hold E near the top to grab the edge.');
    else L.push(`Speed at the foot of the wall: ${ctx.wallEntry.toFixed(1)} m/s. This wall needs at least ${ctx.wallNeed.toFixed(1)} m/s.`);
    if (![...log].some((e) => e.type === 'wall-no-grip')) L.push(`Your feet climbed ${(need + margin).toFixed(1)} m; they had to climb ${need.toFixed(1)} m for your hands to reach the top.`);
    guideBand(ctx, course.wall.x0, course.wall.x0 + 3, need, 0x2ca66f); guideBand(ctx, course.wall.x0, course.wall.x0 + 3, need + margin, 0xe8622c);
    L.push('Green line: the height you needed. Orange line: the height you reached.');
  } else if ((zoneId === 'gap' || zoneId === 'landing') && jump) {
    const v = jump.detail?.vx as number, px = jump.detail?.x as number;
    const g = specs.find((q2) => px >= q2.x - 6.5 && px <= q2.x + 0.2) ?? specs.find((q2) => q2.x >= px - 1);
    if (g) {
      const y0 = groundAt(course.terrain, g.x - 0.1);
      L.push(`Speed when you jumped: ${v.toFixed(1)} m/s. This ${g.width.toFixed(1)} m gap needs at least ${g.needed.toFixed(1)} m/s.`);
      L.push(`You pressed Space ${Math.max(0, g.x - px).toFixed(1)} m before the edge.`);
      const band = pressBand(course.terrain, g.x, y0, g.width, v, push);
      if (band) { L.push(`At ${v.toFixed(1)} m/s, pressing between ${(g.x - band.hi).toFixed(1)} and ${(g.x - band.lo).toFixed(1)} m before the edge works (green strip).`); guideBand(ctx, band.lo, band.hi, y0, 0x2ca66f); }
      else L.push(`At ${v.toFixed(1)} m/s no press works: even at the very edge you fall short. Run longer first.`);
      const mine = flightPath(course.terrain, px, y0, v, push);
      const ideal = flightPath(course.terrain, g.x - 0.2, y0, Math.max(g.needed + 0.4, v), push);
      L.push(`Your jump flew ${(mine.x - px).toFixed(1)} m; the far side is ${(g.x + g.width - px).toFixed(1)} m from where you jumped.`);
      guidePath(ctx, mine.pts, 0xe8622c); guidePath(ctx, ideal.pts, 0x2ca66f); guideLine(ctx, px, y0, 2.5, 0xd33);
      L.push('Orange: your flight. Green: a flight that works. Red post: where you pressed.');
    }
  } else if (zoneId === 'trampoline') {
    const ev = [...log].reverse().find((e) => e.type === 'bounce' && e.detail?.vyOut !== undefined);
    const bedTop = groundAt(course.terrain, course.terrain.platforms.find((q2) => q2.bouncy)?.x0 ?? 0);
    const top = course.terrain.platforms[course.terrain.platforms.length - 1].top;
    const vIn = Math.sqrt(2 * 9.81 * (course.terrain.platforms.find((q2) => q2.bouncy) ? Math.max(0.1, top - bedTop) : 4));
    const base = bounce(vIn, DEFAULT_TRAMPOLINE).vyOut;
    const needV = Math.sqrt(2 * 9.81 * (top - bedTop + 0.3));
    L.push(`Your press added ${((ev?.detail?.gain as number) ?? 0).toFixed(1)} of a possible ${DEFAULT_TRAMPOLINE.pump.toFixed(1)} m/s.`);
    L.push(`Without a press the trampoline throws you ${((base * base) / (2 * 9.81)).toFixed(1)} m high; the far platform is ${(top - bedTop).toFixed(1)} m up, so you need an extra ${Math.max(0, needV - base).toFixed(1)} m/s.`);
    L.push('Press Space while you are pressing into the trampoline (the bottom of the bounce is best).');
  } else if (zoneId === 'rope') {
    const ev = [...log].reverse().find((e) => e.type === 'rope-release');
    if (ev) L.push((ev.detail?.vy as number) > 0 ? 'You let go while rising: good. If you fell short, let go a little later.' : 'You let go while falling back down: let go earlier, while you are still rising.');
    else L.push('You never grabbed the rope. Jump from the end of the deck so your hands meet it.');
  }
  return L;
}

// Coaster tips: what the track did, and what would have worked. Nothing about how well the rider played.
// The plank broke: what bent it too far, in plain words (no formulas on the Course).
export function plankTip(ctx: CourseCtx): string {
  const { course, log } = ctx;
  const br = log.find((e) => e.type === 'plank-break');
  const pk = course.planks?.[0];
  if (!br || !pk) return OBSTACLES.plank.tips.weak;
  const cm = ((br.detail?.sag as number) * 100).toFixed(0);
  return `The plank bent ${cm} cm under you, more than it can take, and snapped ${(br.detail?.at as number).toFixed(1)} m from the edge. A thicker plank, a shorter gap, or a post under the middle each make it bend less. Try the Dojo bridge lesson to find out how much.`;
}
export function cartTip(ctx: CourseCtx, what: 'splash' | 'slide' | 'stall'): string {
  const { log } = ctx;
  if (what === 'stall') {
    const stall = log.find((e) => e.type === 'cart-stall');
    return `It turned round on a hill ${stall ? (stall.detail?.height as number).toFixed(1) + ' m high' : ''}. A cart can only climb as high as it started, plus a little from the push. Make the first hill higher, or the hill it stopped on lower.`;
  }
  const off = log.find((e) => e.type === 'cart-off');
  return off ? `At ${(off.detail?.v as number).toFixed(1)} m/s the top of that hill bends away faster than gravity can hold the cart down, so the rails let go. Hold ↓ to brake before the crest, or make the crest broader.` : 'Try again.';
}

