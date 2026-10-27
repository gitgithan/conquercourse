// Landing: the same speed change spread over more time is a gentler force (impulse = force x time).
export interface LandingParams {
  stiffStopTime: number; // s, stopping with straight legs
  squatStopTime: number; // s, stopping while bending the knees
  stumbleDecel: number; // m/s², a stop harder than this makes the runner stumble
  stumbleKeep: number; // share of forward speed kept after a stumble
}

export const DEFAULT_LANDING: LandingParams = { stiffStopTime: 0.1, squatStopTime: 0.3, stumbleDecel: 60, stumbleKeep: 0.3 };

export interface LandingReport {
  impactSpeed: number; // m/s, downward speed at touchdown
  squatted: boolean;
  stopTime: number;
  peakDecel: number; // m/s², impactSpeed / stopTime (force per unit mass)
  stumbled: boolean;
}

export function landing(impactSpeed: number, squatted: boolean, p: LandingParams = DEFAULT_LANDING): LandingReport {
  const stopTime = squatted ? p.squatStopTime : p.stiffStopTime;
  const peakDecel = impactSpeed / stopTime;
  return { impactSpeed, squatted, stopTime, peakDecel, stumbled: peakDecel > p.stumbleDecel };
}

// How it feels, not a physics number: 0 is a feather, 3 is a firm landing, 6 is a stumble, 10 is a broken bone.
export const ouch = (peakDecel: number): number => Math.min(10, Math.max(0, peakDecel / 10));
export const ouchWord = (o: number): string => (o < 3 ? 'soft' : o < 6 ? 'firm' : o < 8 ? 'hard' : 'dangerous');
