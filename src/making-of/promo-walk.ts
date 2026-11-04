// The promo walk (CC-133): the whole Grand Entrance, entrance to stage, in exactly PROMO_SECONDS on the film's stepped clock.
// Pure maths, no browser: the same table feeds the page (through window.CCWalk) and the timing test.
// The speed starts at zero, rises on a smooth S-curve for ACCEL seconds, then eases back to a stop over the last EASE_OUT seconds.
// Position is the area under that speed, scaled so the last picture lands exactly on the stage.
export const PROMO_SECONDS = 5;
const ACCEL = 4.0; // seconds of speeding up
const EASE_OUT = PROMO_SECONDS - ACCEL; // seconds of slowing into the stage
const STEPS = 5000;
const smooth = (u: number) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };

// the speed shape, 0..1 (1 = peak)
export const promoSpeed = (t: number): number => (t < ACCEL ? smooth(t / ACCEL) : 1 - smooth((t - ACCEL) / EASE_OUT));

const CUM: number[] = [0]; // area under the speed, at STEPS+1 even times
for (let i = 1; i <= STEPS; i++) {
  const t0 = ((i - 1) * PROMO_SECONDS) / STEPS, t1 = (i * PROMO_SECONDS) / STEPS;
  CUM.push(CUM[i - 1] + ((promoSpeed(t0) + promoSpeed(t1)) / 2) * (t1 - t0));
}
export const AREA = CUM[STEPS]; // seconds-at-peak-speed that make up the whole walk

// how far along the walk, 0..1, at time t seconds
export function promoFraction(t: number): number {
  const x = Math.max(0, Math.min(PROMO_SECONDS, t)) / PROMO_SECONDS * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(x));
  return (CUM[i] + (CUM[i + 1] - CUM[i]) * (x - i)) / AREA;
}

// peak speed in distance units per second for a walk of this length
export const promoPeakSpeed = (length: number): number => length / AREA;

// the leg-swing clock (60 per second at a normal run): slow when the walk starts, quick at the peak, never faster than the picture can show
export function promoStride(t: number): number {
  const tt = Math.max(0, Math.min(PROMO_SECONDS, t));
  // closed enough: integrate 22 + 70 * speed over time with the same table
  const x = tt / PROMO_SECONDS * STEPS, i = Math.min(STEPS - 1, Math.floor(x));
  const area = CUM[i] + (CUM[i + 1] - CUM[i]) * (x - i);
  return 22 * tt + 70 * area;
}
