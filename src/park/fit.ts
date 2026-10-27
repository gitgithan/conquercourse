import type { CourseData } from '../course/course';
import { searchIdealRun, type Window } from '../sim/ideal';

// Park fit: detected objects (a phrase and a box in pixels) become primitives with sizes in metres, and the
// primitives become a CourseData the Course mode plays. Pure functions, no browser.

export interface ParkObject {
  id: number;
  phrase: string;
  box: [number, number, number, number]; // x0, y0, x1, y1 in image pixels
  score: number;
  heightM?: number; // the real height in metres, typed by the maker of the course (beats every guess)
}

export type Kind = 'bench' | 'wall' | 'steps' | 'rail' | 'ledge' | 'platform' | 'person';
export type ScaleSource = 'body-height' | 'typical-size' | 'maker'; // 'maker': the person who drew the box typed the real height

export interface Primitive {
  id: number;
  phrase: string;
  kind: Kind;
  type: 'platform' | 'wall' | 'bar'; // names from docs/primitives.md (steps are a platform; a rail is the proposed bar)
  roles: ('stand' | 'grab' | 'vault')[];
  x: number; // centre in image pixels, to keep the left-to-right order
  height: number; // m
  length: number; // m
  risers?: number;
  scale: { source: ScaleSource; uncertainty: number; reference?: string };
  box?: [number, number, number, number]; // where it was in the photo (pixels), for painting that part of the photo on it
}

// Typical sizes by phrase: height and length in metres (steps: height of one riser).
export const TYPICAL: Record<Exclude<Kind, 'person'>, { height: number; length: number; type: Primitive['type']; roles: Primitive['roles'] }> = {
  bench: { height: 0.45, length: 1.8, type: 'platform', roles: ['stand'] },
  wall: { height: 0.9, length: 3, type: 'wall', roles: ['vault', 'grab'] },
  steps: { height: 0.17, length: 3, type: 'platform', roles: ['stand'] },
  rail: { height: 1.0, length: 3, type: 'bar', roles: ['grab'] },
  ledge: { height: 0.5, length: 3, type: 'platform', roles: ['stand', 'grab'] },
  platform: { height: 0.5, length: 3, type: 'platform', roles: ['stand'] },
};
export const PERSON_HEIGHT = 1.75;
const SYNONYMS: Record<string, Kind> = {
  bench: 'bench', wall: 'wall', 'low wall': 'wall', 'concrete block': 'wall', steps: 'steps', stairs: 'steps',
  rail: 'rail', handrail: 'rail', ledge: 'ledge', platform: 'platform', box: 'platform', person: 'person',
};
export const PHRASES = ['bench', 'wall', 'low wall', 'steps', 'rail', 'ledge', 'platform', 'person'];
export const kindOf = (phrase: string): Kind | null => SYNONYMS[phrase.trim().toLowerCase()] ?? null;

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Pixels per metre from the best known-size object in the frame: a person (1.75 m tall), else a bench (1.8 m long).
export function findScale(objects: ParkObject[]): { pxPerM: number; source: ScaleSource; uncertainty: number; reference: string } | null {
  const person = objects.find((o) => kindOf(o.phrase) === 'person');
  if (person) return { pxPerM: (person.box[3] - person.box[1]) / PERSON_HEIGHT, source: 'body-height', uncertainty: 0.12, reference: 'a person, 1.75 m tall' };
  const bench = objects.find((o) => kindOf(o.phrase) === 'bench');
  if (bench) return { pxPerM: (bench.box[2] - bench.box[0]) / TYPICAL.bench.length, source: 'typical-size', uncertainty: 0.3, reference: 'a bench, 1.8 m long' };
  return null;
}

export function fitPrimitives(objects: ParkObject[]): Primitive[] {
  const ref = findScale(objects);
  const out: Primitive[] = [];
  for (const o of objects) {
    const kind = kindOf(o.phrase);
    if (!kind || kind === 'person') continue;
    const t = TYPICAL[kind];
    const wPx = o.box[2] - o.box[0], hPx = o.box[3] - o.box[1];
    // length from the box width when a reference sets the scale; otherwise the typical length (a wide box in a photo
    // is mostly perspective, not metres)
    const length = ref ? clamp(wPx / ref.pxPerM, 0.8, 8) : t.length;
    let height = t.height, risers: number | undefined;
    if (kind === 'steps') {
      risers = ref ? clamp(Math.round(hPx / ref.pxPerM / t.height), 2, 5) : 4;
      height = risers * t.height;
    }
    const typed = o.heightM !== undefined && o.heightM >= 0.1 && o.heightM <= 3;
    if (typed) { height = o.heightM!; if (kind === 'steps') risers = clamp(Math.round(height / t.height), 2, 8); }
    out.push({
      id: o.id, phrase: o.phrase, kind, type: t.type, roles: t.roles, x: (o.box[0] + o.box[2]) / 2,
      height: round(height), length: round(length), risers, box: [...o.box] as Primitive['box'],
      scale: typed ? { source: 'maker', uncertainty: 0.1, reference: 'the height typed by the maker' } : ref ? { source: ref.source, uncertainty: ref.uncertainty, reference: ref.reference } : { source: 'typical-size', uncertainty: 0.35 },
    });
  }
  return out.sort((a, b) => a.x - b.x);
}

export const MAX_TOP = 0.9; // the tallest step-up the runner can make; a taller primitive is flattened to it
export const PITCH = 7; // m from the start of one platform to the start of the next
export const MIN_GAP = 1.5;
export const MAX_GAP = 5;

// One platform per primitive, left to right, each across a stretch of water; gapScale shrinks every gap.
export function buildCourse(prims: Primitive[], name = 'Park Course', gapScale = 1, photo?: string): CourseData {
  const platforms: CourseData['terrain']['platforms'] = [{ x0: -10, x1: 6, top: 0 }];
  let x = 6;
  for (const p of prims) {
    const len = clamp(p.length, 2.5, 6);
    const gap = clamp((PITCH - len) * gapScale, MIN_GAP, MAX_GAP);
    platforms.push({ x0: round(x + gap), x1: round(x + gap + len), top: round(Math.min(p.height, MAX_TOP)), ...(photo && p.box ? { skin: { image: photo, crop: [...p.box] as [number, number, number, number] } } : {}) });
    x += gap + len;
  }
  const gap = clamp((PITCH - 6) * gapScale + 1, MIN_GAP, MAX_GAP);
  platforms.push({ x0: round(x + gap), x1: round(x + gap + 8), top: 0 });
  return {
    version: 1, name, startX: 0, finishX: round(x + gap + 2), jumpSpeed: 4.5,
    terrain: { waterY: -1.5, platforms },
  };
}

export interface Proof {
  course: CourseData;
  cleared: boolean;
  gapScale: number;
  windows: (Window & { ms: number })[];
  notes: string[];
}

// Prove the course clearable with the simulator; if it is not, shrink the gaps (down to MIN_GAP) and try again.
export function proveCourse(prims: Primitive[], name?: string, photo?: string): Proof {
  const notes: string[] = [];
  for (const p of prims) if (p.height > MAX_TOP) notes.push(`${p.phrase} (${p.height} m) is flattened to ${MAX_TOP} m so a run can step up`);
  let gapScale = 1;
  for (let i = 0; i < 8; i++) {
    const course = buildCourse(prims, name, gapScale, photo);
    const found = searchIdealRun(course);
    const windows = found.windows.filter((w) => w.obstacle.startsWith('edge')).map((w) => ({ ...w, ms: Math.round(w.widthMs) }));
    if (found.cleared) {
      if (gapScale < 1) notes.push(`gaps shrunk to ${Math.round(gapScale * 100)} % so the run can be cleared`);
      return { course, cleared: true, gapScale, windows, notes };
    }
    if (i === 7) return { course, cleared: false, gapScale, windows, notes };
    gapScale *= 0.8;
  }
  throw new Error('unreachable');
}
