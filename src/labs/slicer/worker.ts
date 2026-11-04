import { analyse, tryLane, type Knobs, type PlaceData } from "./slicer-lab-core";

// Runs the simulator's search for one lane off the page's thread (a big place can take about ten seconds), then plays the run back for the picture.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; place: PlaceData; knobs: Knobs } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const t0 = Date.now(), a = analyse(e.data.place, e.data.knobs);
  const tried = a.proved || a.lengthM >= 8 ? tryLane(a) : null;
  ctx.postMessage({ id: e.data.id, a, tried, ms: Date.now() - t0 });
};
