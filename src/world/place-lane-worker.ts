// Runs laneForPlace off the page (CC-78): the search takes seconds to a minute and must never freeze the map.
import { laneForPlace } from './place-lane';
import type { OverpassAnswer } from './osm';
import type { Ground } from './terrain';
import type { PlaceLane } from './places';

export interface PlaceLaneAsk { id: number; answer: OverpassAnswer; lat: number; lon: number; ground: Ground | null; ladder?: number[] }
export type PlaceLaneAnswer = { id: number; phase: 'step'; message: string } | { id: number; phase: 'done'; lane: PlaceLane | null };

const ctx = self as unknown as { onmessage: ((e: { data: PlaceLaneAsk }) => void) | null; postMessage(m: PlaceLaneAnswer): void };
ctx.onmessage = (e) => {
  const { id, answer, lat, lon, ground, ladder } = e.data;
  const lane = laneForPlace(answer, lat, lon, ground, { ladder, onStep: (message) => ctx.postMessage({ id, phase: 'step', message }) });
  ctx.postMessage({ id, phase: 'done', lane });
};
