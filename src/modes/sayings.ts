// When a physics saying is earned: the player has tried the obstacle at clearly different settings and seen clearly different
// outcomes. A lucky single run, or three runs with the slider nudged a hair, does not count (CC-14).
export interface Try { v: number; a: number } // the main knob's value and the answer it gave

const MAX_TRIES = 12;

// Add a try; a try at almost the same setting as one already there replaces it instead of counting twice.
export function addTry(list: Try[], t: Try, knob: { min: number; max: number }): Try[] {
  const near = 0.04 * (knob.max - knob.min);
  const out = list.filter((x) => Math.abs(x.v - t.v) > near);
  out.push(t);
  return out.slice(-MAX_TRIES);
}

// Discovered: at least 3 tries that cover at least a third of the knob's range and whose answers differ by at least a fifth.
export function discovered(list: Try[], knob: { min: number; max: number }): boolean {
  if (list.length < 3) return false;
  const vs = list.map((x) => x.v), as = list.map((x) => x.a);
  const spanV = Math.max(...vs) - Math.min(...vs);
  const hiA = Math.max(...as.map(Math.abs)), spanA = Math.max(...as) - Math.min(...as);
  return spanV >= (knob.max - knob.min) / 3 && hiA > 0 && spanA >= 0.2 * hiA;
}
