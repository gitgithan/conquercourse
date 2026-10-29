// Music bed helpers: volume with ducking under a voice, and cuts that land on a beat.
export interface Duck { from: number; to: number } // seconds the voice or a loud effect is on
export interface Bed { src: string; bpm: number; firstBeat: number; level: number; duckLevel: number; fadeIn: number; fadeOut: number }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Volume at second t: fade in, fade out, and a smooth dip (0.25 s each way) inside every duck window.
export function bedVolume(bed: Bed, duck: Duck[], t: number, total: number): number {
  let v = bed.level * clamp01(t / bed.fadeIn) * clamp01((total - t) / bed.fadeOut);
  for (const d of duck) {
    const inside = clamp01((t - d.from) / 0.25) * clamp01((d.to - t) / 0.25);
    v = Math.min(v, bed.level + (bed.duckLevel - bed.level) * inside);
  }
  return v;
}

// The beat times of the bed inside [0, total] seconds of the film.
export function beatTimes(bed: Bed, total: number, musicStart = 0): number[] {
  const step = 60 / bed.bpm, out: number[] = [];
  for (let b = bed.firstBeat - musicStart; b <= total; b += step) if (b >= 0) out.push(b);
  return out;
}

// Moves a wanted cut time to the nearest beat (every `every` beats, e.g. 4 for a bar).
export function snapToBeat(bed: Bed, t: number, every = 1, musicStart = 0): number {
  const step = (60 / bed.bpm) * every, k = Math.round((t - (bed.firstBeat - musicStart)) / step);
  return Math.max(0, bed.firstBeat - musicStart + k * step);
}
