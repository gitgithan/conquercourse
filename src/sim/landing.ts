// Landing: the same speed change spread over more time is a gentler force (impulse = force x time).
export interface LandingParams {
  stiffStopTime: number; // s, stopping with straight legs
  squatStopTime: number; // s, stopping while bending the knees
  stumbleDecel: number; // m/s², a stop harder than this makes the runner stumble
  stumbleKeep: number; // share of forward speed kept after a stumble
  // Past a few metres of drop the legs run out of room: the stop can last no longer than the body can travel.
  stiffTravel?: number; // m the body can move while stopping with straight legs
  squatTravel?: number; // m the body can move while bending the knees
  rollTravel?: number; // m the body travels along the ground while rolling out of the fall
  rollStopTime: number; // s, a roll spreads a soft landing over this long
  rollKeep: number; // share of forward speed a roll keeps (a roll is never a stumble)
  hurtDecel: number; // m/s², a stop harder than this ends the run (the "broken bone" end of the ouch scale)
}

export const DEFAULT_LANDING: LandingParams = {
  stiffStopTime: 0.1, squatStopTime: 0.3, stumbleDecel: 60, stumbleKeep: 0.3,
  stiffTravel: 0.3, squatTravel: 0.6, rollTravel: 1.2, rollStopTime: 0.5, rollKeep: 0.85, hurtDecel: 80,
};

export interface LandingReport {
  impactSpeed: number; // m/s, downward speed at touchdown
  squatted: boolean;
  stopTime: number;
  peakDecel: number; // m/s², impactSpeed / stopTime (force per unit mass)
  stumbled: boolean;
  rolled: boolean; // the landing was a roll
  hurt: boolean; // too hard a stop: the run is over
}

export type LandStyle = 'stiff' | 'squat' | 'roll';

// The time a stop takes: the usual time for a soft landing, but never longer than the body can travel at constant push (distance = speed x time / 2).
function stopTimeFor(style: LandStyle, v: number, p: LandingParams): number {
  const time = style === 'roll' ? p.rollStopTime : style === 'squat' ? p.squatStopTime : p.stiffStopTime;
  const travel = style === 'roll' ? p.rollTravel : style === 'squat' ? p.squatTravel : p.stiffTravel;
  return travel === undefined || v <= 0 ? time : Math.min(time, (2 * travel) / v);
}

export function landing(impactSpeed: number, squatted: boolean, p: LandingParams = DEFAULT_LANDING, rolled = false): LandingReport {
  const style: LandStyle = rolled ? 'roll' : squatted ? 'squat' : 'stiff';
  const stopTime = stopTimeFor(style, impactSpeed, p);
  const peakDecel = impactSpeed / stopTime;
  const hurt = peakDecel > p.hurtDecel;
  return { impactSpeed, squatted: squatted && !rolled, stopTime, peakDecel, stumbled: !rolled && !hurt && peakDecel > p.stumbleDecel, rolled, hurt };
}

// The biggest fall each landing style survives, in metres (impact speed v = sqrt(2 g h)): worked out from the same stop times, not a table.
// `clean` is the biggest fall with no stumble (a roll never stumbles); `survive` is the biggest fall that does not end the run.
export function safeDrop(style: LandStyle, p: LandingParams = DEFAULT_LANDING, g = 9.81): { clean: number; survive: number } {
  const time = style === 'roll' ? p.rollStopTime : style === 'squat' ? p.squatStopTime : p.stiffStopTime;
  const travel = style === 'roll' ? p.rollTravel : style === 'squat' ? p.squatTravel : p.stiffTravel;
  const speedFor = (decel: number) => Math.min(time * decel, travel === undefined ? Infinity : Math.sqrt(2 * travel * decel));
  const h = (v: number) => (v * v) / (2 * g);
  const survive = h(speedFor(p.hurtDecel));
  return { clean: style === 'roll' ? survive : h(speedFor(p.stumbleDecel)), survive };
}

// How it feels, not a physics number: 0 is a feather, 3 is a firm landing, 6 is a stumble, 10 is a broken bone.
export const ouch = (peakDecel: number): number => Math.min(10, Math.max(0, peakDecel / 10));
export const ouchWord = (o: number): string => (o < 3 ? 'soft' : o < 6 ? 'firm' : o < 8 ? 'hard' : 'dangerous');
