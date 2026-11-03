import { CELL, roofStartOn } from '../../slice/slice';
import { startMarkSide } from '../../slice/editor-defaults';
import type { Profile } from '../../slice/slice';
import type { EditorState } from './state';

export interface StartPoint { x: number; z: number; y: number }

// Keep the chosen pivot in world coordinates; a new profile must not slide it along the lane during a turn.
export function editorStart(ed: Pick<EditorState, 'angle' | 'offset' | 'level' | 'start'>, profile: Profile) {
  const c = Math.cos(ed.angle), s = Math.sin(ed.angle);
  const pinned = ed.start;
  if (pinned && Math.abs(-pinned.x * s + pinned.z * c - ed.offset) < 0.001) {
    return { ...pinned, u: pinned.x * c + pinned.z * s, h: pinned.y - ed.level };
  }
  const st = roofStartOn() ? startMarkSide(profile, CELL) : null;
  const u = st?.u ?? 0, h = st?.h ?? 0;
  return { x: u * c - ed.offset * s, z: u * s + ed.offset * c, y: ed.level + h, u, h };
}

export function turnLane(ed: EditorState, angle: number, profile: Profile): void {
  const { x, z, y } = editorStart(ed, profile);
  ed.start = { x, z, y };
  ed.angle = angle;
  ed.offset = -x * Math.sin(angle) + z * Math.cos(angle);
}

export function shiftLane(ed: EditorState, offset: number): void {
  if (ed.start) {
    const d = offset - ed.offset;
    ed.start = { ...ed.start, x: ed.start.x - d * Math.sin(ed.angle), z: ed.start.z + d * Math.cos(ed.angle) };
  }
  ed.offset = offset;
}
