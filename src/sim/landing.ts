// Landing: the same speed change spread over more time is a gentler force (impulse = force x time).
export interface LandingParams {
  stiffStopTime: number; // s, stopping with straight legs
  squatStopTime: number; // s, stopping while bending the knees
  stumbleDecel: number; // m/s², a stop harder than this makes the runner stumble
  stumbleKeep: number; // share of forward speed kept after a stumble
}

export const DEFAULT_LANDING: LandingParams = { stiffStopTime: 0.08, squatStopTime: 0.3, stumbleDecel: 45, stumbleKeep: 0.3 };

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
