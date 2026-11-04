import { centred, newPiece, laneProfile } from '../../slice/world';
import { sceneFor } from '../../slice/scene';
import { holdsOf, isHold } from '../../slice/holds-world';
import { isPlankPiece } from '../../slice/plank-world';
import { isPolePiece } from '../../slice/pole-world';
import { isBarsPiece } from '../../slice/bars-world';
import { withTrebuchet, wrapFor, type Machine } from '../../slice/launch-lane';
import { withRecoil } from '../../slice/recoil-lane';
import { withBand } from '../../slice/band-lane';
import { DRONE_PAD_LENGTH, withDrone } from '../../slice/drone-lane';
import { roleCourse } from '../../slice/roles';
import { deviceMesh, RECOIL_PAD_LENGTH, TREBUCHET_PIVOT_FROM_CENTRE } from '../../slice/device';
import type { CourseSource } from '../../course/course';
import type { EditorState, P } from './state';
import { isDevice, isSizeReference } from './state';

// What the World editor derives from its state: the pieces that are ground, the lane profile, the bars, the devices on the start deck and the course the lane check proves.
// Nothing here touches the page, so every function reads `ed` and nothing else.
export function createLane(ed: EditorState) {
  const coursePieces = () => ed.pieces.filter((q) => !isSizeReference(q) && !isDevice(q));
  const makeDevice = (src: string, name: string, u: number): P => {
    const c = Math.cos(ed.angle), s = Math.sin(ed.angle), x = u * c - ed.offset * s, z = u * s + ed.offset * c;
    return { ...newPiece(name, deviceMesh(src), { x, z }), src, yaw: ed.angle };
  };
  const makeRecoilDevice = (kind: 'cannon' | 'bigcannon', mass: number, muzzle: number): P => {
    const cfg = { kind, ballMass: mass, muzzle }, base = roleCourse(coursePieces(), { angle: ed.angle, offset: ed.offset, level: ed.level }, 'My world').course, withPad = withRecoil(base, cfg);
    const pad = withPad.recoil, x0 = pad?.x0 ?? base.startX + 1.5, x1 = pad?.x1 ?? base.startX + 4;
    const len = Math.max(0.8, x1 - x0), src = `device:${kind}:${mass}:${muzzle}:${len}`;
    return makeDevice(src, kind === 'bigcannon' ? 'Cannon' : 'Launcher', (x0 + x1) / 2);
  };
  const makeDroneDevice = (payload: number, battery: number): P => {
    const base = roleCourse(coursePieces(), { angle: ed.angle, offset: ed.offset, level: ed.level }, 'My world').course, withPad = withDrone(base, { payload, battery });
    const pad = withPad.drone, x0 = pad?.x0 ?? base.startX + 1.5, x1 = pad?.x1 ?? base.startX + 1.5 + DRONE_PAD_LENGTH;
    return makeDevice(`device:drone:${payload}:${battery}:${Math.max(2, x1 - x0)}`, 'Drone', (x0 + x1) / 2);
  };
  const updateDeviceSource = (prefix: string, src: string) => {
    const p = ed.pieces.find((q) => q.src?.startsWith(prefix));
    if (p) { p.src = src; p.mesh = centred(deviceMesh(src)); }
  };
  const groundOf = (ps: P[]) => ps.filter((q) => !isSizeReference(q) && !isDevice(q)).filter((q) => !isHold(q) && !isPolePiece(q) && q.role !== 'rope' && q.role !== 'bar' && !isPlankPiece(q) && !isBarsPiece(q)); // references, bars, rope anchors and planks are not ground
  const ground = () => groundOf(ed.pieces);
  const profileFor = (ps: P[], ln: { angle: number; offset: number; level: number }) => laneProfile(groundOf(ps), ln);
  const currentProfile = () => profileFor(ed.pieces, { angle: ed.angle, offset: ed.offset, level: ed.level });
  const barsNow = () => holdsOf(ed.pieces, { angle: ed.angle, offset: ed.offset, level: ed.level });
  const dronePiece = () => ed.pieces.find((p) => p.src?.startsWith('device:drone:'));
  const droneRange = () => { const p = dronePiece(); if (!p) return undefined; const u = p.x * Math.cos(ed.angle) + p.z * Math.sin(ed.angle), length = Number(p.src?.split(':')[4]) || DRONE_PAD_LENGTH; return { x0: u - length / 2, x1: u + length / 2 }; };
  const recoilPiece = () => ed.pieces.find((p) => p.src?.startsWith('device:cannon:') || p.src?.startsWith('device:bigcannon:'));
  const recoilRange = () => { const p = recoilPiece(); if (!p) return undefined; const u = p.x * Math.cos(ed.angle) + p.z * Math.sin(ed.angle), length = Number(p.src?.split(':')[4]) || RECOIL_PAD_LENGTH; return { x0: u - length / 2, x1: u + length / 2 }; };
  const machineNow = (): Machine | null => (ed.trebuchetKg ? { counterweight: ed.trebuchetKg, ...ed.trebuchetExtra } : null);
  const trebuchetPivot = (): number => { const p = ed.pieces.find((q) => q.src?.startsWith('device:trebuchet:')); return p ? p.x * Math.cos(ed.angle) + p.z * Math.sin(ed.angle) + TREBUCHET_PIVOT_FROM_CENTRE * p.scale : 0; };
  const machineWrap = (m: Machine | null) => wrapFor(m, trebuchetPivot());
  const laneCourseAt = (ln: { angle: number; offset: number; level: number }) => courseFor(ed.pieces, ln, machineNow());
  const laneCourse = (_p?: ReturnType<typeof currentProfile>) => laneCourseAt({ angle: ed.angle, offset: ed.offset, level: ed.level }); // the course the lane check and Play prove: roles, bars and machines included
  // what this course was cut from, so the Course can open the same pieces again (CC-80); a world with a map piece cannot be kept: its mesh is too big
  const sourceNow = (): CourseSource | undefined => ed.pieces.some((p) => p.src?.startsWith('map:')) ? undefined : { kind: 'editor', pieces: ed.pieces.filter((p) => p.src).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale, ...(p.role ? { role: p.role } : {}) })), angle: ed.angle, offset: ed.offset, level: ed.level, floor: ed.floorChoice, ...(ed.start ? { start: ed.start } : {}) };
  const courseNow = () => { const c = laneCourse(currentProfile()); if (ed.floorChoice !== 'water') c.hazard = ed.floorChoice; if (ed.designed.size) c.designedShortcuts = [...ed.designed]; const src = sourceNow(); if (src) c.source = src; return c; };
  // One builder for the live lane and a preview: only devices present in these pieces are included.
  const courseFor = (ps: P[], ln: { angle: number; offset: number; level: number }, machine?: Machine | null) => {
    let c = roleCourse(ps.filter((q) => !isSizeReference(q) && !isDevice(q)), ln, 'My world').course;
    const tre = ps.find((q) => q.src?.startsWith('device:trebuchet:'));
    const drone = ps.find((q) => q.src?.startsWith('device:drone:'));
    const rec = ps.find((q) => q.src?.startsWith('device:cannon:') || q.src?.startsWith('device:bigcannon:'));
    const range = (p: P, fallback: number) => {
      const u = p.x * Math.cos(ln.angle) + p.z * Math.sin(ln.angle), length = Number(p.src?.split(':')[4]) || fallback;
      return { x0: u - length / 2, x1: u + length / 2 };
    };
    // Preserve the same device precedence as Play: trebuchet, drone, recoil, then band.
    if (tre) {
      const cfg = machine ?? { counterweight: Number(tre.src!.split(':')[2]) || 1200, ...ed.trebuchetExtra };
      c = withTrebuchet(c, cfg, tre.x * Math.cos(ln.angle) + tre.z * Math.sin(ln.angle) + TREBUCHET_PIVOT_FROM_CENTRE * tre.scale);
    } else if (drone) {
      const parts = drone.src!.split(':');
      c = withDrone(c, { payload: Number(parts[2]) || 70, battery: Number(parts[3]) || 50 }, range(drone, DRONE_PAD_LENGTH));
    } else if (rec) {
      const parts = rec.src!.split(':');
      c = withRecoil(c, { kind: parts[1] as 'cannon' | 'bigcannon', ballMass: Number(parts[2]) || 12, muzzle: Number(parts[3]) || 30 }, range(rec, RECOIL_PAD_LENGTH));
    } else if (ed.bandK) c = withBand(c, ed.bandK);
    if (ed.floorChoice !== 'water') c.hazard = ed.floorChoice;
    return c;
  };
  // where along the run a piece is in the game (a bar by its place among the bars)
  const xOfPiece = (q: P, c: ReturnType<typeof courseNow>) => (isHold(q) ? c.holds?.[barsNow().findIndex((b) => b.id === q.id)]?.x : sceneFor([q], { angle: ed.angle, offset: ed.offset, level: ed.level }, c.uMap ?? [])[0]?.x) ?? 0;
  // the runner starts on the ground about 8 m before a place (the nearest ground at or before that spot)
  const startBefore = (c: ReturnType<typeof courseNow>, gx: number) => {
    const want = Math.max(c.startX, gx - 8);
    const ps = [...c.terrain.platforms].sort((a, b) => a.x0 - b.x0);
    const on = ps.find((r) => want >= r.x0 && want <= r.x1);
    return on ? want : Math.max(c.startX, (ps.filter((r) => r.x1 <= want).pop()?.x1 ?? c.startX) - 1);
  };
  return { coursePieces, makeDevice, makeRecoilDevice, makeDroneDevice, updateDeviceSource, ground, profileFor, currentProfile, barsNow, dronePiece, droneRange, recoilPiece, recoilRange, machineNow, trebuchetPivot, machineWrap, laneCourseAt, laneCourse, sourceNow, courseNow, courseFor, xOfPiece, startBefore };
}
export type EditorLane = ReturnType<typeof createLane>;
