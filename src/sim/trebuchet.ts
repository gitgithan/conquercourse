import { DT, GRAVITY } from './units';

// The trebuchet: the character sits in the sling and is thrown by a falling counterweight.
// Two angles describe the whole machine, so it is a small rigid-body system (a double pendulum with a heavy short end):
//   alpha: the arm, measured from the forward direction of the model (the long end starts low, pointing back and down in the world)
//   beta:  the sling, a stiff link from the arm tip to the rider (the rider is a point mass at its end)
// The model is built with the throw pointing to -x and mirrored into the world, so every number below is in the model frame
// (x behind the pivot, y up from the deck) until `rider` turns it into world coordinates.
// Everything is metres, seconds and kilograms; the pair of equations is integrated with RK4 at the fixed step, like the rope.
export interface TrebuchetParams {
  x: number; // m, the pivot's place along the course
  axleHeight: number; // m, the pivot above the deck
  long: number; // m, pivot to the sling end of the arm
  short: number; // m, pivot to the counterweight (arm ratio = long / short)
  sling: number; // m, arm tip to the rider
  counterweight: number; // kg
  armMass: number; // kg, a uniform arm
  riderMass: number; // kg, the character and the pouch
  startAngle: number; // degrees, the arm before the pin is pulled (long end low)
  pin?: number; // degrees: the arm angle at which the pin lets go by itself (leave out: only Space lets go)
  stopAngle: number; // degrees: the frame stops the arm here; the rider carries on swinging around the stopped tip, so letting go late is not the best moment
  gravity: number;
}

export const DEFAULT_TREBUCHET: TrebuchetParams = {
  x: 0, axleHeight: 5.5, long: 5.5, short: 1.3, sling: 3, counterweight: 1200, armMass: 120, riderMass: 80,
  startAngle: -38, stopAngle: 140, gravity: GRAVITY,
};

export const RIDER_COM = 0.9; // m, the character's middle above the feet: the reference point of the runner is the feet

export interface Launch {
  alpha: number; // rad
  beta: number; // rad
  dalpha: number; // rad/s
  dbeta: number; // rad/s
  fired: boolean; // the pin has been pulled
  t: number; // ticks since the pin was pulled
  deck: number; // m, the ground the machine stands on
}

const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

// Before the pin is pulled: the arm rests with its long end low and the rider lies on the deck at the end of the sling.
export function startLaunch(p: TrebuchetParams, deck: number): Launch {
  const alpha = rad(p.startAngle);
  const sin = (RIDER_COM - p.axleHeight - p.long * Math.sin(alpha)) / p.sling; // the rider's middle starts RIDER_COM above the deck: the feet rest on it
  const beta = Math.asin(Math.max(-1, Math.min(1, sin)));
  return { alpha, beta, dalpha: 0, dbeta: 0, fired: false, t: 0, deck };
}

function accel(p: TrebuchetParams, al: number, be: number, dal: number, dbe: number): [number, number] {
  const { long: b, short: a, sling: s, counterweight: M, armMass: ma, riderMass: m, gravity: g } = p;
  const Iarm = (ma / 12) * (a + b) * (a + b) + ma * ((b - a) / 2) * ((b - a) / 2);
  const K = -M * a + (ma * (b - a)) / 2 + m * b;
  const M11 = Iarm + M * a * a + m * b * b, M12 = m * b * s * Math.cos(be - al), M22 = m * s * s;
  const r1 = m * b * s * Math.sin(be - al) * dbe * dbe - g * K * Math.cos(al);
  const r2 = -m * b * s * Math.sin(be - al) * dal * dal - m * g * s * Math.cos(be);
  const det = M11 * M22 - M12 * M12;
  return [(r1 * M22 - M12 * r2) / det, (M11 * r2 - M12 * r1) / det];
}

// One fixed step of the swing (after the pin is pulled).
export function launchStep(s: Launch, p: TrebuchetParams): Launch {
  if (!s.fired) return s;
  if (s.alpha >= rad(p.stopAngle)) return stoppedStep(s, p); // the arm is against the frame
  const { alpha: al, beta: be, dalpha: dal, dbeta: dbe } = s;
  const k1 = accel(p, al, be, dal, dbe);
  const a2 = al + 0.5 * DT * dal, b2 = be + 0.5 * DT * dbe, da2 = dal + 0.5 * DT * k1[0], db2 = dbe + 0.5 * DT * k1[1];
  const k2 = accel(p, a2, b2, da2, db2);
  const a3 = al + 0.5 * DT * da2, b3 = be + 0.5 * DT * db2, da3 = dal + 0.5 * DT * k2[0], db3 = dbe + 0.5 * DT * k2[1];
  const k3 = accel(p, a3, b3, da3, db3);
  const a4 = al + DT * da3, b4 = be + DT * db3, da4 = dal + DT * k3[0], db4 = dbe + DT * k3[1];
  const k4 = accel(p, a4, b4, da4, db4);
  return {
    ...s, t: s.t + 1,
    alpha: al + (DT / 6) * (dal + 2 * da2 + 2 * da3 + da4), beta: be + (DT / 6) * (dbe + 2 * db2 + 2 * db3 + db4),
    dalpha: dal + (DT / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), dbeta: dbe + (DT / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  };
}

// The arm has hit the frame: the tip is fixed and the rider swings round it like a pendulum (beta'' = -(g / sling) cos beta).
function stoppedStep(s: Launch, p: TrebuchetParams): Launch {
  const f = (b: number) => -(p.gravity / p.sling) * Math.cos(b);
  const k1 = f(s.beta), b2 = s.beta + 0.5 * DT * s.dbeta, d2 = s.dbeta + 0.5 * DT * k1;
  const k2 = f(b2), b3 = s.beta + 0.5 * DT * d2, d3 = s.dbeta + 0.5 * DT * k2;
  const k3 = f(b3), b4 = s.beta + DT * d3, d4 = s.dbeta + DT * k3;
  const k4 = f(b4);
  return { ...s, t: s.t + 1, alpha: rad(p.stopAngle), dalpha: 0, beta: s.beta + (DT / 6) * (s.dbeta + 2 * d2 + 2 * d3 + d4), dbeta: s.dbeta + (DT / 6) * (k1 + 2 * k2 + 2 * k3 + k4) };
}

// Where everything is, in world coordinates (the throw goes toward +x).
export function pieces(p: TrebuchetParams, s: Launch) {
  const { long: b, short: a, sling: l, axleHeight: H } = p;
  const pivot = { x: p.x, y: s.deck + H };
  const tip = { x: p.x - b * Math.cos(s.alpha), y: s.deck + H + b * Math.sin(s.alpha) };
  const weight = { x: p.x + a * Math.cos(s.alpha), y: s.deck + H - a * Math.sin(s.alpha) };
  const rider = { x: tip.x - l * Math.cos(s.beta), y: tip.y + l * Math.sin(s.beta) };
  return { pivot, tip, weight, rider };
}

// The rider's middle: where it is and how fast it moves.
export function rider(p: TrebuchetParams, s: Launch): { x: number; y: number; vx: number; vy: number } {
  const { long: b, sling: l } = p;
  const q = pieces(p, s);
  const vxm = -b * s.dalpha * Math.sin(s.alpha) - l * s.dbeta * Math.sin(s.beta);
  const vym = b * s.dalpha * Math.cos(s.alpha) + l * s.dbeta * Math.cos(s.beta);
  return { x: q.rider.x, y: q.rider.y, vx: -vxm, vy: vym };
}

// The runner's reference point is the feet: the middle of the body is RIDER_COM above them.
export function feetAt(p: TrebuchetParams, s: Launch): { x: number; y: number; vx: number; vy: number } {
  const r = rider(p, s);
  return { x: r.x, y: r.y - RIDER_COM, vx: r.vx, vy: r.vy };
}

// The energy the falling counterweight has given up so far (J, net of the arm's own rise), and the rider's kinetic energy (J):
// the throw can never exceed the first (a well-tuned real trebuchet turns about half to two thirds of it into the throw).
export function releasedEnergy(p: TrebuchetParams, s: Launch): number {
  const rise = Math.sin(s.alpha) - Math.sin(rad(p.startAngle));
  return p.gravity * rise * (p.counterweight * p.short - p.armMass * ((p.long - p.short) / 2));
}
export const riderEnergy = (p: TrebuchetParams, s: Launch): number => {
  const r = rider(p, s);
  return 0.5 * p.riderMass * (r.vx * r.vx + r.vy * r.vy);
};

// Ground under the rider: the pouch cannot go below the deck. If the counterweight is too light the arm sags and the rider is dragged
// into the ground: the throw is a dud (nothing lifts the rider).
export const isDud = (p: TrebuchetParams, s: Launch): boolean => s.fired && s.t > 2 && rider(p, s).y < s.deck + RIDER_COM - 0.3; // the feet would go through the deck

// Simple world helper for the proof and the debug view: swing the machine on its own and report the rider's state for every tick until the stop.
export function swingPath(p: TrebuchetParams, deck: number, maxTicks = 120 * 6): { s: Launch; feet: { x: number; y: number; vx: number; vy: number } }[] {
  let s: Launch = { ...startLaunch(p, deck), fired: true };
  const out: { s: Launch; feet: { x: number; y: number; vx: number; vy: number } }[] = [{ s, feet: feetAt(p, s) }];
  for (let i = 0; i < maxTicks; i++) {
    s = launchStep(s, p);
    out.push({ s, feet: feetAt(p, s) });
    if (deg(s.alpha) >= p.stopAngle || isDud(p, s)) break;
  }
  return out;
}

// Total mechanical energy of the machine (J): kinetic plus potential of the arm, the counterweight and the rider. With no friction it is constant.
export function mechanicalEnergy(p: TrebuchetParams, s: Launch): number {
  const { long: b, short: a, sling: l, counterweight: M, armMass: ma, riderMass: m, gravity: g, axleHeight: H } = p;
  const Iarm = (ma / 12) * (a + b) * (a + b) + ma * ((b - a) / 2) * ((b - a) / 2);
  const M11 = Iarm + M * a * a + m * b * b, M12 = m * b * l * Math.cos(s.beta - s.alpha), M22 = m * l * l;
  const T = 0.5 * M11 * s.dalpha * s.dalpha + M12 * s.dalpha * s.dbeta + 0.5 * M22 * s.dbeta * s.dbeta;
  const V = g * (M * (H - a * Math.sin(s.alpha)) + ma * (H + ((b - a) / 2) * Math.sin(s.alpha)) + m * (H + b * Math.sin(s.alpha) + l * Math.sin(s.beta)));
  return T + V;
}
