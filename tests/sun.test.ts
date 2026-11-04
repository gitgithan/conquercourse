import { describe, expect, it } from 'vitest';
import { DEFAULT_DAY, TIME_PRESETS, lookFor, presetOf, solarHourFromUtc, sunPosition, sunVector } from '../src/render/sun';

describe('sunPosition', () => {
  it('at the equator on an equinox the sun is overhead at solar noon', () => {
    expect(sunPosition(0, 80.7, 12).elevation).toBeGreaterThan(89.5); // day 80.7 is the March equinox
  });
  it('the sun is below the horizon at midnight and above it at noon (mid latitude)', () => {
    expect(sunPosition(48.8, 172, 0).elevation).toBeLessThan(0);
    expect(sunPosition(48.8, 172, 12).elevation).toBeGreaterThan(60);
  });
  it('the morning and the afternoon are mirror images about noon', () => {
    for (const h of [1, 3, 5.5]) {
      const am = sunPosition(40.7, 100, 12 - h), pm = sunPosition(40.7, 100, 12 + h);
      expect(am.elevation).toBeCloseTo(pm.elevation, 6);
      expect(am.azimuth + pm.azimuth).toBeCloseTo(360, 6);
    }
  });
  it('rises in the east side and sets in the west side; at noon in the north it is due south', () => {
    expect(sunPosition(40, 120, 8).azimuth).toBeLessThan(180);
    expect(sunPosition(40, 120, 16).azimuth).toBeGreaterThan(180);
    expect(sunPosition(40, 120, 12).azimuth).toBeCloseTo(180, 4);
    expect(sunPosition(-35, 120, 12).azimuth % 360).toBeCloseTo(0, 4); // in the south the noon sun is due north
  });
  it('is higher in summer than in winter at the same place and hour', () => {
    expect(sunPosition(51.5, 172, 12).elevation).toBeGreaterThan(sunPosition(51.5, 355, 12).elevation + 30);
  });
  it('the equinox elevation at noon is 90 minus the latitude', () => {
    expect(sunPosition(35, 80.7, 12).elevation).toBeCloseTo(55, 0);
  });
});

describe('solarHourFromUtc', () => {
  it('moves one hour for every 15 degrees east and wraps around the day', () => {
    expect(solarHourFromUtc(12, 0)).toBe(12);
    expect(solarHourFromUtc(12, 15)).toBe(13);
    expect(solarHourFromUtc(23, 30)).toBe(1);
    expect(solarHourFromUtc(1, -30)).toBe(23);
  });
});

describe('sunVector', () => {
  it('is a unit vector, points up by the elevation, and points to the compass side', () => {
    const v = sunVector({ elevation: 30, azimuth: 90 }); // due east, 30 up
    expect(Math.hypot(...v)).toBeCloseTo(1, 9);
    expect(v[1]).toBeCloseTo(0.5, 9);
    expect(v[0]).toBeGreaterThan(0.8);
    const n = sunVector({ elevation: 0, azimuth: 0 }); // due north is -z
    expect(n[2]).toBeCloseTo(-1, 9);
  });
  it('overhead is straight up whatever the turn of the scene', () => {
    expect(sunVector({ elevation: 90, azimuth: 123 }, 0.7)[1]).toBeCloseTo(1, 9);
  });
});

describe('presets and looks', () => {
  it('four presets, golden hour is the default and low, noon is high, dusk is lower still', () => {
    expect(TIME_PRESETS.map((p) => p.id)).toEqual(['morning', 'noon', 'golden', 'dusk']);
    expect(presetOf(null).id).toBe('golden');
    const el = (id: string) => sunPosition(48.85, DEFAULT_DAY, presetOf(id).hour).elevation;
    expect(el('noon')).toBeGreaterThan(55);
    expect(el('golden')).toBeGreaterThan(8);
    expect(el('golden')).toBeLessThan(35);
    expect(el('dusk')).toBeLessThan(el('golden'));
    expect(el('dusk')).toBeGreaterThan(-6);
  });
  it('low sun is warmer (redder) than a high sun, and is dark below the horizon', () => {
    const red = (c: number) => (c >> 16) & 255, blue = (c: number) => c & 255;
    const low = lookFor(5), high = lookFor(60);
    expect(red(low.sunColor) - blue(low.sunColor)).toBeGreaterThan(red(high.sunColor) - blue(high.sunColor));
    expect(lookFor(-10).sunIntensity).toBe(0);
    expect(lookFor(60).sunIntensity).toBeGreaterThan(lookFor(10).sunIntensity);
  });
});

import { courseSkyOn, shadowsOn, skyLightOn } from '../src/render/sky-light';
describe('the sky-light switch', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('is on in dev and preview, off on the live site, and the address word wins', () => {
    expect(skyLightOn(q(''), 'localhost')).toBe(true);
    expect(skyLightOn(q(''), 'preview.conquercourse.pages.dev')).toBe(true);
    expect(skyLightOn(q(''), 'conquercourse.pages.dev')).toBe(false);
    expect(skyLightOn(q('skylight=1'), 'conquercourse.pages.dev')).toBe(true);
    expect(skyLightOn(q('skylight=0'), 'localhost')).toBe(false);
  });
  it('the Course keeps its own sky colour when ?bg= is given; shadows have their own word', () => {
    expect(courseSkyOn(q('bg=ffffff'))).toBe(false);
    expect(shadowsOn(q('shadows=0'))).toBe(false);
    expect(shadowsOn(q(''))).toBe(true);
  });
});
