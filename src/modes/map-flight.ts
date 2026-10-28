// The map flight (CC-79, part of the Atlas, CC-72): bird's eye, painted into the real map, tilting down to the street.
// Steps 1 to 3 are the MapLibre camera plus a "rise" factor for the buildings; step 4 (the hand-over to the editor's 3D view) happens when the player presses Build.
// The camera is driven by hand (one pure function of the time), so the flight can be skipped, frozen for a picture, and tested.

export const STEP_ENDS = [1.5, 3.5, 5.5]; // seconds at which steps 1, 2 and 3 end
export const FLIGHT_SECONDS = STEP_ENDS[2];

export interface Camera { zoom: number; pitch: number; bearing: number }
const ease = (t: number) => t * t * (3 - 2 * t); // smooth start and end
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// `fit` is the zoom at which the circle of the course fills the screen well. The flight starts 3 steps out (a bird's eye) and ends at the street.
export function flightCamera(t: number, fit: number): Camera {
  const A = { zoom: fit - 3.2, pitch: 0, bearing: 0 }, B = { zoom: fit - 1.2, pitch: 25, bearing: -10 }, C = { zoom: fit + 0.2, pitch: 72, bearing: -30 };
  if (t <= STEP_ENDS[0]) return A;
  if (t <= STEP_ENDS[1]) { const u = ease((t - STEP_ENDS[0]) / (STEP_ENDS[1] - STEP_ENDS[0])); return { zoom: mix(A.zoom, B.zoom, u), pitch: mix(A.pitch, B.pitch, u), bearing: mix(A.bearing, B.bearing, u) }; }
  if (t >= STEP_ENDS[2]) return C;
  const u = ease((t - STEP_ENDS[1]) / (STEP_ENDS[2] - STEP_ENDS[1]));
  return { zoom: mix(B.zoom, C.zoom, u), pitch: mix(B.pitch, C.pitch, u), bearing: mix(B.bearing, C.bearing, u) };
}

// The wave of rising buildings (0 to 1, smooth): nothing in step 1, rising over step 2, all risen after.
export const wave = (t: number): number => (t <= STEP_ENDS[0] ? 0 : ease(Math.min(1, (t - STEP_ENDS[0]) / (STEP_ENDS[1] - STEP_ENDS[0]))));
// How much of its height one building has risen (0 to 1). `reach` is how far from the pin it is, 0 (the middle) to 1 (the edge of the circle): the wave runs from the middle outward.
export const rise = (t: number, reach = 0): number => Math.max(0, Math.min(1, wave(t) * 1.6 - reach * 0.6));

export const stepOf = (t: number): 1 | 2 | 3 => (t < STEP_ENDS[0] ? 1 : t < STEP_ENDS[1] ? 2 : 3);

// The caption under the flight, in plain words.
export function caption(t: number, radiusM: number): string {
  const s = stepOf(t);
  if (s === 1) return `Step 1 of 3: the real place from above. This circle is ${Math.round(2 * radiusM)} m across.`;
  if (s === 2) return 'Step 2 of 3: the place is painted in. The buildings rise out of the map.';
  return 'Step 3 of 3: down to the street.';
}

// The scale, in one sentence about the player's own place. `k` is the shrink (1 = real size).
export function scaleWords(radiusM: number, k: number, medianHeight: number): string {
  const across = Math.round(2 * radiusM * k * 10) / 10, per = Math.round(1 / k), tall = Math.round(medianHeight), small = Math.round(medianHeight * k * 10) / 10;
  return `This circle is ${Math.round(2 * radiusM)} m across. In the game it is ${across} m wide: 1 m in the game is ${per} m in the real place. A ${tall} m tall building becomes ${small} m high.`;
}

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface FlightHooks {
  camera(c: Camera): void; // move the map camera
  wave(w: number): void; // the wave of rising buildings, 0 to 1 (see `rise` for how it reaches one building)
  say(text: string): void;
  end(): void;
}
// Runs the flight from now. Returns a skip function. With `at` the flight is frozen at that second (for pictures); with reduced motion it jumps to the end of step 3.
export function runFlight(h: FlightHooks, fit: number, radiusM: number, opts: { at?: number; reduced?: boolean } = {}): { skip: () => void } {
  const show = (t: number) => { h.camera(flightCamera(t, fit)); h.wave(wave(t)); h.say(caption(t, radiusM)); };
  if (opts.at !== undefined) { show(opts.at); return { skip: () => {} }; }
  if (opts.reduced) { show(FLIGHT_SECONDS); h.end(); return { skip: () => {} }; }
  let raf = 0, done = false;
  const t0 = performance.now();
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); show(FLIGHT_SECONDS); h.end(); };
  const tick = () => { const t = (performance.now() - t0) / 1000; if (t >= FLIGHT_SECONDS) { finish(); return; } show(t); raf = requestAnimationFrame(tick); };
  show(0); raf = requestAnimationFrame(tick);
  return { skip: finish };
}
