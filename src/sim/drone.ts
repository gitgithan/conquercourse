import { DT, GRAVITY } from './units';

// The drone ferry (CC-87): a cargo drone carries the runner across a gap. A point mass with a push (thrust) along its lean, Earth gravity,
// air drag, a battery that pays for the push, and a stabiliser that holds the height. Everything is a metre, a kilogram, a newton, a watt or a second.
//
// Forces on the drone (and its rider): thrust T along the lean, weight m g, drag c m v.
//   horizontal:  m ax = T sin(lean) - c m vx + wind
//   vertical:    m ay = T cos(lean) - m g - c m vy
// The rotors' electric power for a thrust T (the standard rotor law, divided by how good a real rotor is):
//   P = T^1.5 / sqrt(2 rho A) / merit + avionics
export interface DroneParams {
  x0: number; x1: number; // the pad: hold E on it to board
  droneMass: number; // kg: frame, rotors and battery
  payload: number; // kg: the rider
  maxThrust: number; // N: the most the rotors can push
  rotorArea: number; // m^2: all the rotor discs together
  merit: number; // 0..1: how close a real rotor gets to the ideal one
  avionics: number; // W: electronics
  battery: number; // Wh
  drag: number; // 1/s: air drag per unit of mass (a = -drag v)
  maxLean: number; // rad: the lean the arrows ask for
  leanLag: number; // s: how fast the lean follows the arrows (the controller's reaction time)
  climb: number; // m/s: the climb or descent rate the up and down arrows ask for
  wind: number; // m/s^2: size of the gusts from the side (0: calm)
  windPeriod: number; // s
  hang: number; // m: the rider's feet are this far below the middle of the drone
  stabiliser: boolean; // true: the drone holds its height by itself; false: the arrows move a thrust lever (the Hover lesson)
}

export const AIR_DENSITY = 1.225; // kg/m^3 at sea level

export const DEFAULT_DRONE: DroneParams = {
  x0: 0, x1: 4, droneMass: 85, payload: 70, maxThrust: 3100, rotorArea: 12.3, merit: 0.65, avionics: 300, battery: 50,
  drag: 0.35, maxLean: 0.5, leanLag: 0.25, climb: 2, wind: 0, windPeriod: 6, hang: 1.1, stabiliser: true,
};

export interface DroneState {
  t: number; // s since boarding
  x: number; y: number; // the middle of the drone
  vx: number; vy: number;
  lean: number; // rad, positive leans forward (+x)
  hold: number; // the height the stabiliser holds
  throttle: number; // 0..1, the thrust lever when the stabiliser is off
  thrust: number; // N now
  power: number; // W now
  energy: number; // J left
  empty: boolean; // the battery has run out
}

export interface DroneCmd { lean: -1 | 0 | 1; climb: -1 | 0 | 1 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const totalMass = (p: DroneParams): number => p.droneMass + p.payload;
export const weight = (p: DroneParams): number => totalMass(p) * GRAVITY;
export const batteryJoules = (p: DroneParams): number => p.battery * 3600;

// The electric power for a thrust.
export function rotorPower(T: number, p: DroneParams): number {
  return (Math.max(0, T) * Math.sqrt(Math.max(0, T))) / Math.sqrt(2 * AIR_DENSITY * p.rotorArea) / p.merit + p.avionics;
}
export const hoverPower = (p: DroneParams): number => rotorPower(weight(p), p);
export const hoverSeconds = (p: DroneParams): number => batteryJoules(p) / hoverPower(p);

// The drone can lift off only with some push to spare (5%).
export const canLiftOff = (p: DroneParams): boolean => p.maxThrust >= 1.05 * weight(p);
// The heaviest rider that still lifts off.
export const maxPayload = (p: DroneParams): number => p.maxThrust / (1.05 * GRAVITY) - p.droneMass;
// The steepest lean that still holds the height (the push upward must equal the weight).
export const maxLevelLean = (p: DroneParams): number => (p.maxThrust >= weight(p) ? Math.acos(weight(p) / p.maxThrust) : 0);
// The sideways acceleration of a drone that holds its height at a lean.
export const leanAcceleration = (lean: number): number => GRAVITY * Math.tan(lean);

export function boardDrone(p: DroneParams, x: number, feetY: number): DroneState {
  const y = feetY + p.hang;
  return { t: 0, x, y, vx: 0, vy: 0, lean: 0, hold: y + 2, throttle: weight(p) / p.maxThrust, thrust: weight(p), power: 0, energy: batteryJoules(p), empty: false };
}

export const feetOfDrone = (s: DroneState, p: DroneParams): { x: number; y: number } => ({ x: s.x, y: s.y - p.hang });

// One tick. With the stabiliser on, the drone chooses the push that holds its height (or climbs at the asked rate) at whatever lean it has,
// so leaning costs push; without it, the arrows move a thrust lever and nothing corrects the height.
export function droneStep(s: DroneState, cmd: DroneCmd, p: DroneParams): DroneState {
  const m = totalMass(p);
  const lean = s.lean + (cmd.lean * p.maxLean - s.lean) * (1 - Math.exp(-DT / p.leanLag));
  let hold = s.hold, throttle = s.throttle;
  let T: number;
  if (s.empty) T = 0;
  else if (p.stabiliser) {
    let vz: number;
    if (cmd.climb !== 0) { vz = cmd.climb * p.climb; hold = s.y; } else vz = clamp((hold - s.y) * 1.5, -1.5, 1.5);
    const az = clamp(4 * (vz - s.vy), -6, 6);
    T = clamp((m * (GRAVITY + az + p.drag * s.vy)) / Math.cos(lean), 0, p.maxThrust);
  } else {
    throttle = clamp(throttle + cmd.climb * 0.3 * DT, 0, 1);
    T = throttle * p.maxThrust;
  }
  const gust = p.wind * Math.sin((2 * Math.PI * s.t) / p.windPeriod);
  const ax = (T * Math.sin(lean)) / m - p.drag * s.vx + gust;
  const ay = (T * Math.cos(lean)) / m - GRAVITY - p.drag * s.vy;
  const vx = s.vx + ax * DT, vy = s.vy + ay * DT;
  const power = rotorPower(T, p);
  const energy = Math.max(0, s.energy - power * DT);
  return { t: s.t + DT, x: s.x + vx * DT, y: s.y + vy * DT, vx, vy, lean, hold, throttle, thrust: T, power, energy, empty: s.empty || energy <= 0 };
}

// A touchdown the drone can take: slow, nearly level, and not racing along the ground.
export const SOFT_VY = 2.5; // m/s
export const SOFT_VX = 8; // m/s
export const SOFT_LEAN = 0.35; // rad
export function softTouchdown(s: DroneState): boolean {
  return Math.abs(s.vy) <= SOFT_VY && Math.abs(s.vx) <= SOFT_VX && Math.abs(s.lean) <= SOFT_LEAN;
}

// Where the drone goes if the arrows stay as they are (the debug view's ghost path): a few seconds, until it touches something or the battery ends.
export function previewDrone(s: DroneState, cmd: DroneCmd, p: DroneParams, floor: (x: number) => number, seconds = 8): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let q = s;
  for (let i = 0; i < seconds * 120; i++) {
    q = droneStep(q, cmd, p);
    if (i % 6 === 0) pts.push({ x: q.x, y: q.y });
    if (q.y - p.hang <= floor(q.x)) break;
  }
  return pts;
}
