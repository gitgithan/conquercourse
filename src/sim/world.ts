import type { CourseData } from '../course/course';
import { ballHit } from './shots';
import { DT } from './units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step, type RunnerInput, type RunnerParams, type RunnerState } from './runner';
import { groundAt, heightAt, standingOn } from './terrain';
import { DEFAULT_WALL, runWall, type WallParams, type WallResult } from './wall';
import { DEFAULT_ROPE, ropePoint, release, swingStep, tryCatch, type RopeParams, type Swing } from './rope';
import { DEFAULT_TRAMPOLINE, bounce, type Bounce } from './trampoline';
import { JUMP_COST, VAULT_COST } from './energy';
import { VAULT_BUFFER, VAULT_PLANT_GRIP, VAULT_PLANT_TICKS, findVault, vaultAt, vaultExitSpeed, type Vault } from './vault';
import { ROLL_FORGIVE_TICKS, rollWindowOpen } from './drop';
import { GROUND_ROLL_COST, GROUND_ROLL_RECOVERY, startGroundRoll, stepGroundRoll, type GroundRoll } from './roll';
import { DEFAULT_HANG, bodyVelocity, feetOf, gripSlips, hangStep, releaseHang, tryGrab, type Hang } from './holds';
import { enterCart, railsOf, stepCartWorld, trackParams, trackSegments, type Cart } from './cart';
import { AIM_RATE, DEFAULT_RECOIL, NO_RECOIL, clampAim, isAimable, padHas, shot, stepBall, type RecoilParams, type RecoilState } from './recoil';
import { maybeEnterPlank, stepPlankWorld, type PlankState } from './beam';
import { CLIMB_CATCH_TICKS, CLIMB_COST, CLIMB_EXIT_SPEED, CLIMB_HOLD_TICKS, findClimb, type Climb } from './climb';
import { enterBand, stepBandWorld, type Band } from './band';
import { NO_POLE, POLE_MIN_SPEED, POLE_PICKUP_REACH, plant as polePlant, poleFeetAt, release as poleRelease, type PoleWorld } from './pole-ride';
import { DEFAULT_DRONE, boardDrone, droneStep, feetOfDrone, softTouchdown, type DroneParams, type DroneState } from './drone';
import { DEFAULT_TREBUCHET, deg, feetAt, isDud, launchStep, startLaunch, type Launch, type TrebuchetParams } from './trebuchet';

// One world for the Course: the runner plus whichever obstacle has hold of the runner right now.
// The simulator is the truth: everything the screen shows comes from this state, one tick at a time.
export type Mode = 'run' | 'wall' | 'swing' | 'bounce' | 'hang' | 'vault' | 'cart' | 'launch' | 'plank' | 'climb' | 'band' | 'drone' | 'pole';
export type Outcome = 'running' | 'cleared' | 'splash' | 'hurt' | 'stalled'; // hurt: a landing harder than the body can take; stalled: the cart ran out of speed on a hill

export interface GameEvent {
  tick: number;
  type: 'pole-pickup' | 'pole-plant' | 'pole-release' | 'pole-fell-back' | 'bar-down' | 'pole-land' | 'jump' | 'roll' | 'land' | 'stumble' | 'hard-landing' | 'splash' | 'wall-grab' | 'wall-no-grip' | 'wall-slide' | 'rope-catch' | 'rope-release' | 'hang-catch' | 'hang-release' | 'vault' | 'climb' | 'climb-drop' | 'bounce' | 'cleared' | 'cart-start' | 'cart-stall' | 'cart-off' | 'cart-catch' | 'launch-fire' | 'launch-release' | 'launch-dud' | 'recoil' | 'plank-sag' | 'plank-break' | 'plank-off' | 'band-release' | 'band-snap' | 'drone-board' | 'drone-land' | 'drone-drop' | 'drone-crash' | 'drone-empty' | 'ball-hit';
  detail?: Record<string, number | boolean>;
}

// A landing that would stumble or hurt waits ROLL_FORGIVE_TICKS before it counts, so an X pressed just after touchdown is forgiven.
export interface LandGrace { until: number; landTick: number; before: RunnerState; input: RunnerInput; impact: number; peakDecel: number; squat: boolean; hurt: boolean; stumbled: boolean }

export interface WorldState {
  runner: RunnerState;
  mode: Mode;
  outcome: Outcome;
  wall: { result: WallResult; path: { x: number; y: number }[]; index: number; x0: number; v?: number; held?: boolean } | null; // v: the entry speed; held: E was down in the last WALL_HOLD_TICKS before the hands reach the top (CC-168)
  swing: Swing | null;
  hang: Hang | null; // hanging from a bar in the air
  vault: Vault | null; // going over an obstacle with a hand on top
  climb: Climb | null; // hanging from a wall's top edge and pulling up (src/sim/climb.ts)
  launch: Launch | null; // sitting in the trebuchet's sling (before the pin and while it swings)
  drone?: DroneState | null; // riding the cargo drone (src/sim/drone.ts)
  pole?: PoleWorld; // carrying the pole, and the ride from the plant to the let-go (src/sim/pole-ride.ts)
  recoil?: RecoilState; // the launcher clipped on at a recoil pad: loads left, shots fired, balls in flight (src/sim/recoil.ts)
  cart: Cart | null; // riding the rails of a track (src/sim/cart.ts)
  plank?: PlankState | null; // walking on a plank bridge (src/sim/beam.ts)
  stood?: number[]; // platforms stood on so far (kept only on a course whose platforms have a lane gate; CC-228)
  broken?: number[]; // planks that have broken (they are gone)
  band: Band | null; // clipped on to the elastic band (src/sim/band.ts)
  energy: number; // 1 = fresh; each move spends some (src/sim/energy.ts)
  bed: { base: Bounce; vIn: number; start: number; press: number | null; vx: number; top: number } | null;
  noCatchUntil: number;
  lastPress: number; // tick of the last Space press, so a press just before landing counts
  lastVault: number; // tick of the last V press, so a press a moment before the obstacle still vaults it
  lastRoll: number; // tick of the last X press (a press on the ground right after a landing roll is not a new ground roll)
  rollArmed: boolean; // an X press came inside the roll window (the last 0.15 s and 1.2 m before touchdown): the landing is a roll
  landGrace: LandGrace | null; // a stumble or hard landing waiting 3 ticks: an X press in that time turns it into the roll
  plantUntil: number; // tick until which the feet plant after a vault (no key held: brake hard)
  rolledAt: number; // tick of the last roll, on landing or on the ground (the actor plays the roll clip from here); -1000 = none
  groundRoll: GroundRoll | null; // a roll along the ground in progress (X on the ground)
  rollReadyAt: number; // tick from which the next ground roll may start (a short recovery)
  events: GameEvent[];
}

// A start standing still on the ground at x: the whole course, or the start of one obstacle (a checkpoint).
export function newWorld(course: CourseData, x: number = course.startX): WorldState {
  const r = startState(x);
  r.y = groundAt(course.terrain, x);
  const tp = course.trebuchet ? trebuchetParams(course) : null;
  if (tp && x <= tp.x + 0.5) { // the course starts in the sling: the rider lies at the end of the sling behind the machine
    const ln = startLaunch(tp, groundAt(course.terrain, tp.x));
    const f = feetAt(tp, ln);
    return { runner: { ...r, x: f.x, y: f.y }, mode: 'launch', outcome: 'running', wall: null, swing: null, hang: null, vault: null, climb: null, cart: null, band: null, launch: ln, energy: 1, bed: null, noCatchUntil: 0, lastPress: -1000, lastVault: -1000, lastRoll: -1000, rolledAt: -1000, plantUntil: -1000, groundRoll: null, rollReadyAt: 0, rollArmed: false, landGrace: null, events: [] };
  }
  const w: WorldState = { runner: r, mode: 'run', outcome: 'running', wall: null, swing: null, hang: null, vault: null, climb: null, cart: null, band: null, launch: null, energy: 1, bed: null, noCatchUntil: 0, lastPress: -1000, lastVault: -1000, lastRoll: -1000, rolledAt: -1000, plantUntil: -1000, groundRoll: null, rollReadyAt: 0, rollArmed: false, landGrace: null, events: [] };
  if (course.band && x <= course.band.x) return enterBand(w, course);
  return course.track ? enterCart(w, course) : w;
}

export const recoilParams = (c: CourseData): RecoilParams => ({ ...DEFAULT_RECOIL, ...(c.recoil ?? {}) } as RecoilParams);
export const trebuchetParams = (c: CourseData): TrebuchetParams => ({ ...DEFAULT_TREBUCHET, ...(c.trebuchet ?? {}) } as TrebuchetParams);
export const droneParams = (c: CourseData): DroneParams => ({ ...DEFAULT_DRONE, ...(c.drone ?? {}) } as DroneParams);
const wallParams = (c: CourseData): WallParams => ({ ...DEFAULT_WALL, ...(c.wall ?? {}) });
const ropeParams = (c: CourseData): RopeParams => ({ ...DEFAULT_ROPE, ...(c.rope ?? {}) });

// CC-228: a platform with a `gate` is air until the runner has stood on the gate platform; nothing here runs on a course with no gates (old courses and their hashes are untouched).
const gatedCache = new WeakMap<CourseData, Map<string, CourseData>>();
const hasGates = (c: CourseData): boolean => c.terrain.platforms.some((q) => q.gate !== undefined);
function openCourse(course: CourseData, stood: number[]): CourseData {
  const key = stood.join(',');
  let m = gatedCache.get(course); if (!m) gatedCache.set(course, (m = new Map()));
  let c = m.get(key);
  if (!c) { c = { ...course, terrain: { ...course.terrain, platforms: course.terrain.platforms.filter((q) => q.gate === undefined || stood.includes(q.gate)) } }; m.set(key, c); }
  return c;
}
export function stepWorld(w: WorldState, input: RunnerInput, course: CourseData, p: RunnerParams = DEFAULT_PARAMS): WorldState {
  const n = stepGated(w, input, course, p);
  if (!course.shots || n.outcome !== 'running') return n;
  // timed balls: where they are is a formula of the tick, so a hit is the same for every player (src/sim/shots.ts)
  const b = ballHit(course.shots, n.runner.tick, n.runner.x, n.runner.y, p.gravity);
  return b ? { ...n, outcome: 'hurt', events: [...n.events, { tick: n.runner.tick, type: 'ball-hit', detail: { x: b.x, y: b.y, launcher: b.launcher } }] } : n;
}
function stepGated(w: WorldState, input: RunnerInput, course: CourseData, p: RunnerParams): WorldState {
  if (!hasGates(course)) return stepWorldPlain(w, input, course, p);
  const stood = w.stood ?? [];
  const n = stepWorldPlain(w, input, openCourse(course, stood), p);
  if (n.runner.grounded) {
    const on = standingOn(course.terrain, n.runner.x);
    const i = on ? course.terrain.platforms.indexOf(on) : -1;
    if (i >= 0 && !stood.includes(i)) return { ...n, stood: [...stood, i].sort((a, b) => a - b) };
  }
  return { ...n, stood };
}
function stepWorldPlain(w: WorldState, input: RunnerInput, course: CourseData, p: RunnerParams = DEFAULT_PARAMS): WorldState {
  if (w.outcome !== 'running') return { ...w, runner: { ...w.runner, tick: w.runner.tick + 1 } };
  // the roll counts only if X was pressed inside the window before touchdown (an earlier press is ignored: no buffer); a course can switch the roll off
  const armed = !course.off?.includes('roll') && (w.rollArmed || (!!input.roll && !w.runner.grounded && w.mode === 'run' && rollWindowOpen(w, course)));
  const input2: RunnerInput = { ...(input.jump && w.runner.grounded && w.mode === 'run' ? { ...input, jumpSpeed: course.jumpSpeed } : input), roll: armed };
  const events: GameEvent[] = [];
  const tick = w.runner.tick + 1;
  const ev = (type: GameEvent['type'], detail?: GameEvent['detail']) => events.push({ tick, type, detail });
  let n: WorldState = { ...w, lastPress: input.jump ? w.runner.tick + 1 : w.lastPress, lastVault: input.vault ? w.runner.tick + 1 : w.lastVault, lastRoll: input.roll ? w.runner.tick + 1 : w.lastRoll };

  // the wait is over: the stumble or hard landing counts now, whatever the runner is doing (the cart and other modes included)
  if (w.landGrace && tick > w.landGrace.until) { // (a press on the third tick after touchdown still counts)
    const g = w.landGrace;
    n.landGrace = null;
    if (g.stumbled) ev('stumble', { peakDecel: g.peakDecel });
    if (g.hurt) { n.outcome = 'hurt'; ev('hard-landing', { impact: g.impact, peakDecel: g.peakDecel, rolled: false, squat: g.squat }); return { ...n, events }; }
  }

  if (w.mode === 'wall') return stepWall(w, input, course);
  if (w.mode === 'swing') return stepSwing(w, input, course);
  if (w.mode === 'bounce') return stepBounce(w, input);
  if (w.mode === 'hang') return stepHang(w, input, course);
  if (w.mode === 'cart') return stepCartWorld(w, input, course);
  if (w.mode === 'band') return stepBandWorld(w, input, course);
  if (w.mode === 'vault') return stepVault(w);
  if (w.mode === 'climb') return stepClimb(w, input);
  if (w.mode === 'launch') return stepLaunchMode(w, input, course);
  if (w.mode === 'plank') return stepPlankWorld(w, input, course);
  if (course.planks) { const onPlank = maybeEnterPlank(w, input, course); if (onPlank) return onPlank; }
  if (w.mode === 'drone') return stepDroneMode(w, input, course);
  if (w.mode === 'pole') return stepPoleMode(w, input, course);

  // the drone pad: standing on it with E held boards the cargo drone, which lifts a little way off the ground
  if (course.drone && w.runner.grounded && (input.handL || input.handR) && w.runner.x >= course.drone.x0 && w.runner.x <= course.drone.x1) {
    const dp = droneParams(course);
    ev('drone-board');
    return { ...w, mode: 'drone', drone: boardDrone(dp, w.runner.x, w.runner.y), lastPress: n.lastPress, events, runner: { ...w.runner, tick, vx: 0, vy: 0, grounded: false } };
  }

  // the vault: a hand on top of the obstacle just ahead, the body goes over it and keeps most of the speed
  if (n.lastVault >= 0 && !course.off?.includes('vault') && w.runner.tick + 1 - n.lastVault <= VAULT_BUFFER && w.runner.grounded) { // a V pressed up to a fifth of a second early still counts
    const v = findVault(course.terrain, w.runner.x, w.runner.y, w.runner.vx);
    if (v) {
      ev('vault', { rise: v.y1 - v.y0, vx: w.runner.vx });
      return { ...w, mode: 'vault', vault: v, energy: Math.max(0, w.energy - VAULT_COST), lastPress: n.lastPress, lastVault: -1000, events, runner: { ...w.runner, tick, grounded: false } };
    }
  }

  // a stumble or hard landing waits ROLL_FORGIVE_TICKS: an X pressed in that time is forgiven and the landing becomes the roll
  if (w.landGrace && input.roll && w.mode === 'run') {
    const g = w.landGrace;
    const redone = step(g.before, { ...g.input, roll: true }, p, course.terrain); // the same touchdown, rolled
    const since = tick - g.landTick;
    ev('roll', { vx: redone.vx, late: true });
    return { ...n, runner: { ...redone, tick, x: redone.x + redone.vx * DT * since }, rolledAt: tick, landGrace: null, rollArmed: false, events };
  }

  // the ground roll (X on the ground, standing or running; a fresh press, not the one still held from a landing roll)
  if (!w.groundRoll && w.runner.grounded && input.roll && w.lastRoll < w.runner.tick && w.runner.tick + 1 >= w.rollReadyAt && !input.jump && !input.vault) {
    const g = startGroundRoll(w.runner, input.run && !input.left ? 1 : input.left && !input.run ? -1 : 0);
    ev('roll', { vx: g.dir * g.v0 });
    n.groundRoll = g; n.rolledAt = tick; n.energy = Math.max(0, w.energy - GROUND_ROLL_COST);
  }
  const before = w.runner;
  const planting = w.plantUntil > tick && !input2.run && !input2.left; // just off a vault with no key held: the feet plant and the runner stops
  let flightTerrain = course.terrain;
  if (course.track && !before.grounded) {
    const nextX = before.x + before.vx * DT;
    const underRail = course.terrain.platforms.some((platform) => platform.coasterRail && nextX >= platform.x0 && nextX <= platform.x1 && before.y < heightAt(platform, nextX) - 0.02);
    if (underRail) flightTerrain = { ...course.terrain, platforms: course.terrain.platforms.filter((platform) => !platform.coasterRail) };
  }
  let r: RunnerState;
  if (n.groundRoll) {
    const g = stepGroundRoll(before, n.groundRoll, flightTerrain);
    r = g.runner;
    if (g.ended) { n.rollReadyAt = tick + Math.round(GROUND_ROLL_RECOVERY * 120); n.groundRoll = null; }
  } else r = step(before, input2, planting ? { ...p, grip: p.grip * VAULT_PLANT_GRIP } : p, flightTerrain);
  n.runner = r;
  n.rollArmed = armed && !r.grounded;
  let caughtTrack = false;
  if (course.track && !before.grounded && r.grounded && r.landing) {
    const params = trackParams(course), x = r.landedAtX ?? r.x;
    const segment = trackSegments(course.track).findIndex((pts) => x >= pts[0][0] && x <= pts[pts.length - 1][0]);
    if (segment >= 0) {
      const rails = railsOf(course.track, segment), slope = rails.slope(x), cos = 1 / Math.sqrt(1 + slope * slope);
      const previousHeight = rails.y(before.x) + params.seat;
      const normalVelocity = before.vy - slope * before.vx;
      if (Math.abs(r.y - (rails.y(x) + params.seat)) <= 0.12 && before.y >= previousHeight - 0.02 && normalVelocity < -0.05) {
        const v = before.vx * cos - r.landing.impactSpeed * slope * cos;
        if (v > 0.5) {
          n.mode = 'cart'; n.outcome = 'running'; caughtTrack = true;
          n.cart = { segment, x, v, started: true, stalledAt: null, tilt: Math.atan(slope) };
          n.runner = { ...r, x, y: rails.y(x) + params.seat, vx: v * cos, vy: v * slope * cos, grounded: true, landing: null, landedAtTick: null, landedAtX: null, splashed: false };
          ev('cart-catch', { segment, x, v });
        }
      }
    }
  }
  if (before.grounded && !r.grounded && input2.jump) { ev('jump', { vy: r.vy, vx: r.vx, x: r.x }); n.energy = Math.max(0, w.energy - JUMP_COST); if (course.jumpKeep !== undefined && course.jumpKeep !== 1) n.runner = { ...r, vx: r.vx * course.jumpKeep }; }
  if (!caughtTrack && !before.grounded && r.grounded && r.landing) {
    const plat = standingOn(course.terrain, r.x);
    ev('land', { impact: r.landing.impactSpeed, peakDecel: r.landing.peakDecel, squat: r.landing.squatted, rolled: r.landing.rolled, bouncy: !!plat?.bouncy });
    if (r.landing.rolled) n.rolledAt = r.tick;
    if ((r.landing.stumbled || r.landing.hurt) && !r.landing.rolled && !plat?.bouncy) { // the landing waits 3 ticks for a forgiven X press (above)
      n.landGrace = { until: tick + ROLL_FORGIVE_TICKS, landTick: tick, before, input: input2, impact: r.landing.impactSpeed, peakDecel: r.landing.peakDecel, squat: r.landing.squatted, hurt: r.landing.hurt, stumbled: r.landing.stumbled };
    } else if (r.landing.hurt && !plat?.bouncy) { n.outcome = 'hurt'; ev('hard-landing', { impact: r.landing.impactSpeed, peakDecel: r.landing.peakDecel, rolled: r.landing.rolled, squat: r.landing.squatted }); }
    if (plat?.bouncy) {
      const base = bounce(r.landing.impactSpeed, DEFAULT_TRAMPOLINE);
      n.mode = 'bounce';
      const early = r.tick - w.lastPress <= 8; // a press just before landing counts as a press at the start of the bounce
      n.bed = { base, vIn: r.landing.impactSpeed, start: r.tick, press: early ? 0 : null, vx: r.vx, top: r.y };
      ev('bounce', { vIn: r.landing.impactSpeed });
    }
  }
  if (r.splashed) { n.outcome = 'splash'; ev('splash', { x: r.x }); }

  // recoil: the pad clips the launcher on (one load per visit); the fire key throws the ball back and pushes the runner by the momentum the ball carries away.
  // A big cannon is aimed first: up and down tilt the barrel while it is loaded (the barrel points backward and down, so the push goes forward and up).
  if (course.recoil && n.outcome === 'running') {
    const rp = recoilParams(course);
    const prev = w.recoil ?? NO_RECOIL;
    const onPad = n.runner.grounded && padHas(rp, n.runner.x);
    let armed = onPad && !prev.onPad ? rp.shots : prev.armed, fired = prev.fired;
    let aim = prev.aim ?? clampAim(rp.angle);
    if (isAimable(rp) && armed > 0) aim = input.aim !== undefined ? clampAim(input.aim) : clampAim(aim + ((input.aimUp ? 1 : 0) - (input.aimDown ? 1 : 0)) * AIM_RATE * DT);
    const balls = prev.balls.map((b) => stepBall(b, course.terrain)).slice(-6);
    if (input.fire && armed > 0) {
      const airborne = !n.runner.grounded;
      const sh = shot(rp, n.runner.vx, n.runner.vy, airborne, isAimable(rp) ? aim : rp.angle);
      n.runner = { ...n.runner, vx: n.runner.vx + sh.dvx, vy: n.runner.vy + sh.dvy, ...(sh.dvy > 0 ? { grounded: false } : {}) }; // pushed up: off the ground
      armed--; fired++;
      balls.push({ x: n.runner.x - 0.3 - 1.2 * Math.cos(sh.angle), y: n.runner.y + 1.0 - 1.2 * Math.sin(sh.angle), vx: sh.ballVx, vy: sh.ballVy, landed: false });
      ev('recoil', { dvx: sh.dvx, dvy: sh.dvy, muzzle: sh.muzzle, ball: Math.hypot(sh.ballVx, sh.ballVy), angle: sh.angle });
    }
    n.recoil = { armed, fired, onPad, aim, balls };
  }

  // the wall: running onto the curve with the feet on the ground
  if (course.wall && !course.off?.includes('wall') && n.mode === 'run' && r.grounded && r.vx > 0.5 && r.x >= course.wall.x0 && r.y === groundAt(course.terrain, course.wall.x0)) {
    const wp = wallParams(course);
    const result = runWall(r.vx, wp);
    n.mode = 'wall';
    n.wall = { result, path: wallPath(result, course.wall.x0, wp.height), index: 0, x0: course.wall.x0, v: r.vx };
  }

  // the rope: airborne hands meet it, with E held
  if (course.rope && !course.off?.includes('rope') && n.mode === 'run' && !r.grounded && r.tick >= w.noCatchUntil && (input.handL || input.handR)) { // the rope never catches by itself: hold E
    const sw = tryCatch(ropeParams(course), r.x, r.y, r.vx, r.vy, 0);
    if (sw) {
      n.mode = 'swing';
      n.swing = sw;
      ev('rope-catch', { grip: sw.grip, omega: sw.omega });
    }
  }

  // a bar: airborne with a hand on the key and the hands within reach of it
  if (course.holds?.length && n.mode === 'run' && !r.grounded && r.tick >= w.noCatchUntil && (input.handL || input.handR)) {
    const g = tryGrab(course.holds, r.x, r.y, r.vx, r.vy, course.grabReach === undefined ? undefined : { ...DEFAULT_HANG, reach: course.grabReach }, w.noCatchUntil > 0);
    if (g) {
      n.mode = 'hang';
      n.hang = g;
      ev('hang-catch', { hold: g.hold, omega: g.omega });
    }
  }

  // a wall's top edge: the hands (hold key) meet it, from the ground or in the air (src/sim/climb.ts); the run speed is lost
  if (n.mode === 'run' && n.outcome === 'running' && (input.handL || input.handR) && r.tick >= w.noCatchUntil) {
    const c = findClimb(course.terrain, r.x, r.y, r.vx, r.vy, course.jumpSpeed);
    if (c) {
      n.mode = 'climb'; n.climb = c; n.energy = Math.max(0, w.energy - CLIMB_COST);
      n.runner = { ...r, vx: 0, vy: 0, grounded: false };
      ev('climb', { rise: c.top - r.y, vx: r.vx });
    }
  }

  // the pole: E on the pole lying on the ground picks it up; carrying it, E held in the plant box jams it and the runner rises (src/sim/pole-ride.ts)
  if (course.pole && n.mode === 'run' && n.outcome === 'running' && r.grounded) {
    const ps = course.pole, held = !!(input.handL || input.handR), pw = n.pole ?? NO_POLE;
    if (!pw.carrying && held && Math.abs(r.x - ps.pickX) <= POLE_PICKUP_REACH) { n.pole = { ...pw, carrying: true }; ev('pole-pickup'); }
    else if (pw.carrying && held && r.x >= ps.x0 && r.x <= ps.x1 && r.vx >= POLE_MIN_SPEED) {
      n.mode = 'pole'; n.pole = { carrying: true, ride: polePlant(ps, r.x, r.y, r.vx), barDown: false, over: pw.over };
      n.runner = { ...r, vx: 0, vy: 0, grounded: false };
      ev('pole-plant', { vx: r.vx });
    }
  }

  // finish: standing on the finish platform past the line
  if (n.outcome === 'running' && r.grounded && r.x >= course.finishX && n.mode === 'run' && !n.landGrace && (!course.pole || n.pole?.over)) { n.outcome = 'cleared'; ev('cleared'); }
  n.events = events;
  return n;
}

// After the hands reach the top the runner pulls up and over: a smooth hand-over from the grab point to the deck,
// so nothing ever jumps (no teleport). Positions are feet positions.
export const MANTLE_RUN = 0.4;
const MANTLE_TICKS = 72;
export function wallPath(result: WallResult, x0: number, height: number): { x: number; y: number }[] {
  if (!result.grabbed) return result.path;
  const up = result.path.slice(0, result.grabTick! + 1);
  const from = up[up.length - 1];
  const to = { x: height + MANTLE_RUN, y: height };
  const out = [...up];
  for (let i = 1; i <= MANTLE_TICKS; i++) {
    const t = i / MANTLE_TICKS;
    const e = t * t * (3 - 2 * t); // smoothstep: slow start and end
    out.push({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
  }
  void x0;
  return out;
}

// The hands must be on the key for the last 16 ticks (0.13 s) of the climb, when they are about a metre under the lip, or they miss the edge and the body slides back
// (CC-168; the course can switch it off with wall.needE = false). It was 24 ticks (CC-194: a third of a second of the climb was too far below the top).
// A key already held when the window opens counts, so a player may press early and hold; a tap that ends before the window does nothing: the body slides back, no fall.
export const WALL_HOLD_TICKS = 16;
// The "Hold E to grab" tip shows this many ticks before the end of the climb: the window plus a short time to read it.
export const WALL_HINT_TICKS = WALL_HOLD_TICKS + 8;
function stepWall(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  let wl = w.wall!;
  let path = wl.path;
  const i = wl.index;
  const tick = w.runner.tick + 1;
  const events: GameEvent[] = [];
  const gt = wl.result.grabTick;
  if (wl.result.grabbed && gt !== null && wallParams(course).needE !== false) {
    const held = wl.held || (i >= gt - WALL_HOLD_TICKS && (!!input.handL || !!input.handR));
    if (i >= gt && !held) { // the hands reach the edge with no grip: the same climb, then the slide back
      const wp = wallParams(course);
      const res = runWall(wl.v ?? 0, { ...wp, stopAtGrab: false });
      wl = { ...wl, result: { ...res, grabbed: false, grabTick: null }, path: res.path, held };
      path = wl.path;
      events.push({ tick, type: 'wall-no-grip', detail: { margin: res.margin } });
    } else if (held !== wl.held) wl = { ...wl, held };
  }
  if (i >= path.length - 1) {
    const wp = wallParams(course);
    if (wl.result.grabbed) {
      events.push({ tick, type: 'wall-grab', detail: { margin: wl.result.margin } });
      const x = wl.x0 + wp.height + MANTLE_RUN;
      return { ...w, mode: 'run', wall: null, events, runner: { ...w.runner, tick, x, y: groundAt(course.terrain, wl.x0) + wp.height, vx: 0, vy: 0, grounded: true } }; // the wall stands on the ground at its foot, not only on level 0
    }
    events.push({ tick, type: 'wall-slide', detail: { margin: wl.result.margin, exit: wl.result.exitSpeed } });
    return { ...w, mode: 'run', wall: null, events, runner: { ...w.runner, tick, x: wl.x0 - 0.5, y: groundAt(course.terrain, wl.x0 - 0.5), vx: 0, vy: 0, grounded: true } };
  }
  const q = path[i];
  return { ...w, wall: { ...wl, index: i + 1 }, events, runner: { ...w.runner, tick, x: wl.x0 + q.x, y: groundAt(course.terrain, wl.x0) + q.y, vx: 0, vy: 0, grounded: true } };
}

function stepSwing(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const rp = ropeParams(course);
  const tick = w.runner.tick + 1;
  const events: GameEvent[] = [];
  if (input.jump || !(input.handL || input.handR)) { // let go of E (or press jump) to let go of the rope
    const rel = release(rp, w.swing!);
    events.push({ tick, type: 'rope-release', detail: { vx: rel.vx, vy: rel.vy } });
    return { ...w, mode: 'run', swing: null, noCatchUntil: tick + 60, events, runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  }
  const sw = swingStep(w.swing!);
  const hand = ropePoint(rp, sw.grip, sw.theta);
  const speed = sw.omega * sw.grip;
  return { ...w, swing: sw, events, runner: { ...w.runner, tick, x: hand.x, y: hand.y - rp.handHeight, vx: speed * Math.cos(sw.theta), vy: speed * Math.sin(sw.theta), grounded: false } };
}

function stepVault(w: WorldState): WorldState {
  const v = w.vault!;
  const tick = w.runner.tick + 1;
  const i = v.i + 1;
  if (i >= v.n) {
    const end = vaultAt(v, v.n);
    return { ...w, mode: 'run', vault: null, plantUntil: tick + VAULT_PLANT_TICKS, events: [], runner: { ...w.runner, tick, x: end.x, y: end.y, vx: vaultExitSpeed(v), vy: 0, grounded: true } };
  }
  const q = vaultAt(v, i);
  return { ...w, vault: { ...v, i }, events: [], runner: { ...w.runner, tick, x: q.x, y: q.y, vx: q.vx, vy: q.vy, grounded: false } };
}

const CLIMB_HANG_END = CLIMB_CATCH_TICKS + CLIMB_HOLD_TICKS; // the pull-up is committed after this tick
function stepClimb(w: WorldState, input: RunnerInput): WorldState {
  const c = w.climb!;
  const tick = w.runner.tick + 1;
  const i = c.i + 1;
  // letting go of the hold key while still hanging (before the pull-up starts): the body drops from where it hangs
  if (!input.handL && !input.handR && i < CLIMB_HANG_END) {
    const q = c.path[c.i];
    return { ...w, mode: 'run', climb: null, noCatchUntil: tick + 60, events: [{ tick, type: 'climb-drop' }], runner: { ...w.runner, tick, x: q.x, y: q.y, vx: 0, vy: 0, grounded: false } };
  }
  if (i >= c.n) {
    return { ...w, mode: 'run', climb: null, events: [], runner: { ...w.runner, tick, x: c.exit.x, y: c.exit.y, vx: CLIMB_EXIT_SPEED, vy: 0, grounded: true } };
  }
  const q = c.path[i], prev = c.path[c.i];
  return { ...w, climb: { ...c, i }, events: [], runner: { ...w.runner, tick, x: q.x, y: q.y, vx: (q.x - prev.x) * 120, vy: (q.y - prev.y) * 120, grounded: false } };
}

function stepHang(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const holds = course.holds ?? [];
  const h = holds[w.hang!.hold];
  const tick = w.runner.tick + 1;
  // both hands off the bar: let go and fly on
  if (!input.handL && !input.handR) {
    const rel = releaseHang(h, w.hang!);
    return { ...w, mode: 'run', hang: null, noCatchUntil: tick + 24, events: [{ tick, type: 'hang-release', detail: { vx: rel.vx, vy: rel.vy } }], runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  }
  const pump = ((input.run ? 1 : 0) - (input.left ? 1 : 0)) as -1 | 0 | 1;
  const s = hangStep(w.hang!, pump);
  // the bar pulls harder than the hands can hold: they open and the body flies on with the speed it has
  if (gripSlips(s)) {
    const rel = releaseHang(h, s);
    return { ...w, mode: 'run', hang: null, noCatchUntil: tick + 24, events: [{ tick, type: 'hang-release', detail: { vx: rel.vx, vy: rel.vy, slipped: true } }], runner: { ...w.runner, tick, x: rel.x, y: rel.y, vx: rel.vx, vy: rel.vy, grounded: false } };
  }
  const f = feetOf(h, s), v = bodyVelocity(s);
  return { ...w, hang: s, events: [], runner: { ...w.runner, tick, x: f.x, y: f.y, vx: v.vx, vy: v.vy, grounded: false } };
}

// The trebuchet: Space-free until the pin is pulled (the run key), then the arm swings; Space (or the pin angle, or the frame) lets the rider go.
function stepLaunchMode(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const tp = trebuchetParams(course);
  const tick = w.runner.tick + 1;
  let ln = w.launch!;
  const events: GameEvent[] = [];
  if (!ln.fired) {
    if (!input.run) return { ...w, events, runner: { ...w.runner, tick } };
    ln = { ...ln, fired: true };
    events.push({ tick, type: 'launch-fire' });
  } else ln = launchStep(ln, tp);
  const f = feetAt(tp, ln);
  if (isDud(tp, ln)) { // too light a counterweight: nothing lifts the rider, who ends up standing where the sling dragged them
    const x = Math.min(Math.max(f.x, course.startX), tp.x);
    events.push({ tick, type: 'launch-dud' });
    return { ...w, mode: 'run', launch: null, events, runner: { ...w.runner, tick, x, y: groundAt(course.terrain, x), vx: 0, vy: 0, grounded: true } };
  }
  const letGo = ln.t > 0 && (input.jump || (tp.pin !== undefined && deg(ln.alpha) >= tp.pin));
  if (letGo) {
    events.push({ tick, type: 'launch-release', detail: { vx: f.vx, vy: f.vy, speed: Math.hypot(f.vx, f.vy), t: ln.t } });
    return { ...w, mode: 'run', launch: null, noCatchUntil: tick, events, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: f.vx, vy: f.vy, grounded: false } };
  }
  return { ...w, launch: ln, events, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: f.vx, vy: f.vy, grounded: !ln.fired } };
}

// The cargo drone: the arrows lean it and climb it, E keeps the rider holding on. Letting go low steps off; letting go high is a drop. A soft touchdown sets the rider down; a hard one ends the run.
// The pole ride: the runner follows the path pole.ts worked out; every way it ends hands the body back to the ordinary physics (or the cushion).
function stepPoleMode(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const ps = course.pole!, pw = w.pole ?? NO_POLE;
  let ride = pw.ride!;
  const tick = w.runner.tick + 1, t = ride.t + 1, events: GameEvent[] = [];
  const ev = (type: GameEvent['type'], detail?: GameEvent['detail']) => events.push({ tick, type, detail });
  if (!ride.result && !(input.handL || input.handR)) { ride = poleRelease(ride, ps, t); ev('pole-release', { t }); }
  const f = poleFeetAt(ride, ps, t);
  const free = (barDown: boolean): WorldState => ({ ...w, mode: 'run', pole: { carrying: false, ride: null, barDown: barDown || pw.barDown, over: pw.over || f.x >= ps.barX }, noCatchUntil: tick, events, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: f.vx, vy: f.vy, grounded: false } });
  const end = ride.path.length - 1, res = ride.result;
  if (!res) { // still held: the pole may stand the runner up (fall back) or lean onto the bar
    if (t >= end) { ev('pole-fell-back'); return free(false); }
  } else {
    const leaned = res.outcome === 'hit_bar' && res.barlineTick === null;
    if (res.outcome === 'fell_back' || res.outcome === 'short' || leaned) { ev(res.outcome === 'short' ? 'pole-release' : 'pole-fell-back'); if (leaned) ev('bar-down', { lean: true }); return free(leaned); }
    if (res.outcome === 'hit_bar' && res.barlineTick !== null && t >= res.barlineTick) { ev('bar-down', { y: f.y }); return free(true); }
    const gy = groundAt(course.terrain, f.x);
    if (res.outcome === 'cleared' && f.vy < 0 && Number.isFinite(gy) && f.y <= gy) { // down on the cushion (a platform at the cushion's height)
      ev('pole-land', { vy: -f.vy });
      return { ...w, mode: 'run', pole: { carrying: false, ride: null, barDown: pw.barDown, over: true }, noCatchUntil: tick, events, runner: { ...w.runner, tick, x: f.x, y: gy, vx: Math.max(0.5, f.vx * 0.3), vy: 0, grounded: true } };
    }
    if (t >= end) return free(false);
  }
  return { ...w, pole: { ...pw, ride: { ...ride, t } }, events, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: 0, vy: 0, grounded: false } };
}

function stepDroneMode(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const dp = droneParams(course);
  const tick = w.runner.tick + 1;
  const d = w.drone!;
  const events: GameEvent[] = [];
  const ground = (x: number) => groundAt(course.terrain, x);
  const f0 = feetOfDrone(d, dp);
  if (!(input.handL || input.handR)) { // the rider lets go
    const gy = ground(f0.x);
    if (Number.isFinite(gy) && f0.y - gy <= 0.6) {
      events.push({ tick, type: 'drone-land', detail: { vy: d.vy, vx: d.vx, stepped: true } });
      return { ...w, mode: 'run', drone: null, noCatchUntil: tick, events, runner: { ...w.runner, tick, x: f0.x, y: gy, vx: d.vx * 0.6, vy: 0, grounded: true } };
    }
    events.push({ tick, type: 'drone-drop', detail: { height: f0.y - (Number.isFinite(gy) ? gy : course.terrain.waterY), vx: d.vx, vy: d.vy } });
    return { ...w, mode: 'run', drone: null, noCatchUntil: tick, events, runner: { ...w.runner, tick, x: f0.x, y: f0.y, vx: d.vx, vy: d.vy, grounded: false } };
  }
  const lean = input.run && !input.left ? 1 : input.left && !input.run ? -1 : 0;
  const climb = input.up && !input.squat ? 1 : input.squat && !input.up ? -1 : 0;
  let d2 = droneStep(d, { lean: lean as -1 | 0 | 1, climb: climb as -1 | 0 | 1 }, dp);
  if (d2.y > 60) d2 = { ...d2, y: 60, vy: Math.min(0, d2.vy) }; // the ceiling
  if (d2.empty && !d.empty) events.push({ tick, type: 'drone-empty' });
  const f = feetOfDrone(d2, dp);
  if (f.y < course.terrain.waterY) {
    events.push({ tick, type: 'splash', detail: { x: f.x } });
    return { ...w, drone: d2, outcome: 'splash', events, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: d2.vx, vy: d2.vy, grounded: false, splashed: true } };
  }
  const gy = ground(f.x);
  if (d2.vy <= 0 && Number.isFinite(gy) && f.y <= gy) { // the skids meet the ground
    const fromAbove = f0.y >= gy - 0.05; // a drone that was above this ground a moment ago lands; one that was below it has flown into the side of the deck
    if (!fromAbove) {
      events.push({ tick, type: 'drone-crash', detail: { vy: d2.vy, vx: d2.vx, lean: d2.lean, side: true } });
      return { ...w, drone: d2, outcome: 'hurt', events, runner: { ...w.runner, tick, x: f0.x, y: f0.y, vx: 0, vy: 0, grounded: false } };
    }
    if (softTouchdown(d2)) {
      events.push({ tick, type: 'drone-land', detail: { vy: d2.vy, vx: d2.vx } });
      return { ...w, mode: 'run', drone: null, noCatchUntil: tick, events, runner: { ...w.runner, tick, x: f.x, y: gy, vx: d2.vx * 0.6, vy: 0, grounded: true } };
    }
    events.push({ tick, type: 'drone-crash', detail: { vy: d2.vy, vx: d2.vx, lean: d2.lean } });
    return { ...w, drone: d2, outcome: 'hurt', events, runner: { ...w.runner, tick, x: f.x, y: gy, vx: 0, vy: 0, grounded: true } };
  }
  return { ...w, drone: d2, events, runner: { ...w.runner, tick, x: f.x, y: f.y, vx: d2.vx, vy: d2.vy, grounded: false } };
}

function stepBounce(w: WorldState, input: RunnerInput): WorldState {
  const bed = w.bed!;
  const tick = w.runner.tick + 1;
  const k = tick - bed.start;
  const press = input.jump && bed.press === null ? k : bed.press;
  const x = w.runner.x + bed.vx * DT;
  if (k >= bed.base.ticksOnBed) {
    const out = bounce(bed.vIn, DEFAULT_TRAMPOLINE, press);
    const events: GameEvent[] = [{ tick, type: 'bounce', detail: { vyOut: out.vyOut, pumped: out.pumped, gain: out.gain } }];
    return { ...w, mode: 'run', bed: null, events, runner: { ...w.runner, tick, x, y: bed.top, vx: bed.vx, vy: out.vyOut, grounded: false } };
  }
  return { ...w, bed: { ...bed, press }, events: [], runner: { ...w.runner, tick, x, y: bed.top + bed.base.path[k], vy: 0 } };
}

export { NO_INPUT, DT };
