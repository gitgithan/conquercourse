// CC-133: where the sun is, and how its light looks. Pure maths: no DOM, no three.js, no network. Looks only: never read by the sim.
// Angles are in degrees at the edges and radians inside. Azimuth is measured from north, turning clockwise (east is 90).
const RAD = Math.PI / 180;

export interface SunPos { elevation: number; azimuth: number } // degrees; elevation below 0 means the sun is under the horizon

// Time of day is the local SOLAR hour (12 = the sun is highest), so no time zone is needed.
// The day is the number of the day in the year (1 to 365); the sun's tilt comes from it.
export function sunPosition(latDeg: number, dayOfYear: number, solarHour: number): SunPos {
  const decl = 23.44 * RAD * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)); // the tilt of the sun above the equator that day
  const lat = latDeg * RAD, ha = 15 * (solarHour - 12) * RAD; // the hour angle: 15 degrees for every hour from noon
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // azimuth from north through east: atan2 of the east and north parts of the sun's direction
  const east = -Math.cos(decl) * Math.sin(ha);
  const north = Math.sin(decl) * Math.cos(lat) - Math.cos(decl) * Math.cos(ha) * Math.sin(lat);
  const az = (Math.atan2(east, north) / RAD + 360) % 360;
  return { elevation: el / RAD, azimuth: az };
}

// A clock time in UTC to the local solar hour at a longitude (east is positive): 15 degrees of longitude is one hour. Ignores the small yearly wobble.
export const solarHourFromUtc = (utcHour: number, lonDeg: number): number => (((utcHour + lonDeg / 15) % 24) + 24) % 24;

// The unit vector pointing from the ground TO the sun in a scene where +x is east, +y is up and +z is south (so north is -z).
// `yaw` turns the scene (radians, counter-clockwise seen from above) when the scene is not lined up with the compass.
export function sunVector(s: SunPos, yaw = 0): [number, number, number] {
  const el = s.elevation * RAD, az = s.azimuth * RAD, c = Math.cos(el);
  const x = c * Math.sin(az), y = Math.sin(el), z = -c * Math.cos(az); // east = +x, north = -z
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  return [x * cy + z * sy, y, -x * sy + z * cy];
}

export interface TimePreset { id: 'morning' | 'noon' | 'golden' | 'dusk'; label: string; hour: number }
export const TIME_PRESETS: readonly TimePreset[] = [
  { id: 'morning', label: 'Morning', hour: 8.5 },
  { id: 'noon', label: 'Noon', hour: 12 },
  { id: 'golden', label: 'Golden hour', hour: 17.5 },
  { id: 'dusk', label: 'Dusk', hour: 19.3 },
];
export const DEFAULT_PRESET: TimePreset['id'] = 'noon'; // the product owner chose noon as the default (2026-11-04): bright, with short shadows; golden hour stays one click away
export const DEFAULT_DAY = 150; // the end of May; a day when every populated latitude has a sun in the evening
export const presetOf = (id: string | null | undefined): TimePreset => TIME_PRESETS.find((p) => p.id === id) ?? TIME_PRESETS.find((p) => p.id === DEFAULT_PRESET)!;

// ---- the colours that go with a sun height (hex numbers; the renderer file turns them into colours) ----
export interface Look {
  sunColor: number; sunIntensity: number; // the one directional light
  skyTop: number; skyHorizon: number; // the dome, and the colour the distance fades into (the fog)
  hemiSky: number; hemiGround: number; hemiIntensity: number; // the cool fill from above and the bounce from the ground
  fogNear: number; fogFar: number; // as a share of the camera's far distance
}
const STOPS: { el: number; look: Look }[] = [
  { el: -8, look: { sunColor: 0xff6a3a, sunIntensity: 0, skyTop: 0x0d1630, skyHorizon: 0x2b2f52, hemiSky: 0x5a6a9a, hemiGround: 0x2a2a30, hemiIntensity: 0.55, fogNear: 0.2, fogFar: 0.85 } },
  { el: 0, look: { sunColor: 0xff6f3c, sunIntensity: 0.5, skyTop: 0x35457f, skyHorizon: 0xf08a5c, hemiSky: 0x7f93c4, hemiGround: 0x4a4540, hemiIntensity: 0.8, fogNear: 0.2, fogFar: 0.85 } },
  { el: 8, look: { sunColor: 0xff9a52, sunIntensity: 1.5, skyTop: 0x4a74b8, skyHorizon: 0xf5bb85, hemiSky: 0x9bb6dc, hemiGround: 0x6b6558, hemiIntensity: 1.0, fogNear: 0.22, fogFar: 0.9 } },
  { el: 22, look: { sunColor: 0xffd9a2, sunIntensity: 2.2, skyTop: 0x4687d6, skyHorizon: 0xcfe0ee, hemiSky: 0xa9c7ea, hemiGround: 0x6f6d5e, hemiIntensity: 1.15, fogNear: 0.25, fogFar: 0.95 } },
  { el: 50, look: { sunColor: 0xfff3df, sunIntensity: 2.6, skyTop: 0x3a80dc, skyHorizon: 0xbcd9f2, hemiSky: 0xb3d0f0, hemiGround: 0x74715f, hemiIntensity: 1.25, fogNear: 0.28, fogFar: 1.0 } },
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixHex = (a: number, b: number, t: number): number => {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
};
export function lookFor(elevationDeg: number): Look {
  const e = Math.max(STOPS[0].el, Math.min(STOPS[STOPS.length - 1].el, elevationDeg));
  let i = 0; while (i < STOPS.length - 2 && e > STOPS[i + 1].el) i++;
  const a = STOPS[i], b = STOPS[i + 1], t = (e - a.el) / (b.el - a.el), A = a.look, B = b.look;
  return {
    sunColor: mixHex(A.sunColor, B.sunColor, t), sunIntensity: lerp(A.sunIntensity, B.sunIntensity, t),
    skyTop: mixHex(A.skyTop, B.skyTop, t), skyHorizon: mixHex(A.skyHorizon, B.skyHorizon, t),
    hemiSky: mixHex(A.hemiSky, B.hemiSky, t), hemiGround: mixHex(A.hemiGround, B.hemiGround, t), hemiIntensity: lerp(A.hemiIntensity, B.hemiIntensity, t),
    fogNear: lerp(A.fogNear, B.fogNear, t), fogFar: lerp(A.fogFar, B.fogFar, t),
  };
}
