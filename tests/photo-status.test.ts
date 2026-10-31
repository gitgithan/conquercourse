// CC-90: the 60 m is real map metres, and the plain-words status of street photos along a lane.
import { describe, expect, it } from 'vitest';
import { NEAR_M, pickPhotos, progressOf, spotAt, toLatLon, type AllowedPhoto, type AllowList, type PlaceLine } from '../src/world/live-photos';
import { laneShare, levelOf, levelWords, NOT_PREPARED, photoStatus } from '../src/world/photo-status';

const place: PlaceLine = { lat: 48.8867, lon: 2.3431, lane: { line: [0, 0, 100, 0] } }; // a real lane 100 m due east of the pin
const photo = (id: string, x: number, y: number, compass: number): AllowedPhoto => { const ll = toLatLon(place.lat, place.lon, { x, y }); return { id, creator: 'c', capturedAt: null, lat: ll.lat, lon: ll.lon, compass }; };
const list = (photos: AllowedPhoto[]): AllowList => ({ place: 'p', name: 'P', generated: '2026-11-01', source: 't', photos });

describe('the 60 m is real metres on the real street, not game metres', () => {
  it('uses the same real photos whether the game course is long or squeezed to half the length', () => {
    const photos = [photo('100001', 20, -30, 180), photo('100002', 50, -40, 180), photo('100003', 90, -20, 180)];
    const long = { startX: 0, finishX: 40 }, half = { startX: 0, finishX: 20 }, shifted = { startX: 500, finishX: 510 };
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const picks = (c: { startX: number; finishX: number }, x: number) => pickPhotos(photos, place, spotAt(place, progressOf(c, x))).map((p) => p.id);
      const at = (c: { startX: number; finishX: number }) => picks(c, c.startX + t * (c.finishX - c.startX));
      expect(at(half), `t=${t}`).toEqual(at(long));
      expect(at(shifted), `t=${t}`).toEqual(at(long));
    }
  });
  it('reaches the same real spot at the same fraction of the lane, and NEAR_M is the distance on the street', () => {
    expect(NEAR_M).toBe(60);
    expect(spotAt(place, progressOf({ startX: 0, finishX: 20 }, 10))).toEqual({ x: 50, y: 0 });
    expect(spotAt(place, progressOf({ startX: 0, finishX: 40 }, 20))).toEqual({ x: 50, y: 0 });
    expect(pickPhotos([photo('100009', 50, -59, 180)], place, { x: 50, y: 0 })).toHaveLength(1); // 59 real metres away: near
    expect(pickPhotos([photo('100010', 50, -61, 180)], place, { x: 50, y: 0 })).toHaveLength(0); // 61 real metres away: not near
  });
});

describe('street photos along a lane, in plain words', () => {
  const dense = list([0, 25, 50, 75, 100].map((x, i) => photo(`30000${i}`, x, -20, 180)));
  it('says whole, part or none from the share of the lane with a facing photo', () => {
    expect(laneShare(dense, place)).toBe(1);
    expect(levelOf(1)).toBe('whole'); expect(levelOf(0.5)).toBe('part'); expect(levelOf(0)).toBe('none');
    const half = list([photo('400001', 10, -20, 180), photo('400002', 30, -20, 180)]);
    expect(levelOf(laneShare(half, place))).toBe('part');
    expect(laneShare(list([]), place)).toBe(0); expect(laneShare(null, place)).toBe(0);
  });
  it('a lane that is squeezed or stretched in the game gets the same words', () => {
    const p = { slug: 'p', name: 'P', lat: place.lat, lon: place.lon, list: dense };
    expect(photoStatus(place, [p]).text).toBe(levelWords.whole);
  });
  it('a custom slice with no list near it is told lists exist only for the prepared places, and is pointed at the nearest one', () => {
    const far = { slug: 'far', name: 'Far', lat: place.lat + 0.5, lon: place.lon, list: dense };
    const s = photoStatus(place, [far]);
    expect(s.level).toBe('none'); expect(s.text).toBe(NOT_PREPARED); expect(s.nearest?.slug).toBe('far');
  });
  it('a custom slice beside a prepared place is read from that place\'s list', () => {
    const near = { slug: 'near', name: 'Near', lat: place.lat + 0.001, lon: place.lon, list: dense }; // 111 m away
    expect(photoStatus(place, [near]).level).not.toBe('none');
  });
});
