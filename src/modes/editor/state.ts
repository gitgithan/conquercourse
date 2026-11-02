import type { Hazard } from '../../course/hazard';
import type { Piece } from '../../slice/world';
import type { Advice } from '../../slice/advice';
import type { Edit } from '../../slice/designer';
import type { DroneCfg } from '../../slice/drone-lane';
import type { Machine } from '../../slice/launch-lane';
import type { Proposal } from '../../slice/preview';
import type { RecoilCfg } from '../../slice/recoil-lane';
import type { Role, RoleSuggestion } from '../../slice/roles';
import type { Shortcut } from '../../sim/shortcuts';
import type { holdsOf } from '../../slice/holds-world';
import type { sliceProfile } from '../../slice/slice';
import { DEFAULT_WATER_LEVEL } from '../../slice/editor-defaults';

export type P = Piece & { src?: string };
export interface Lane { angle: number; offset: number; level: number }
// What a saved world holds (localStorage `cc.world.v1`, and the source a Course carries so the editor can open the same pieces again).
export interface Saved { pieces: { src: string; x: number; z: number; y: number; yaw: number; scale: number; role?: Role; decor?: boolean }[]; angle: number; offset: number; level: number; floor?: string }
export interface Preview { pieces: P[]; lane: Lane; machine: Machine | null }

export const isSizeReference = (p: P) => p.src === 'obj:../characters/rookie-a.glb' || p.src === 'obj:../characters/rookie-b.glb';
export const isDevice = (p: P) => p.src?.startsWith('device:') ?? false;

// The state of one World editor session: one object that every module of the editor reads and writes by property, so no module needs a getter or setter per value.
export interface EditorState {
  // the world
  pieces: P[];
  selected: number | null; // the main chosen piece; `group` is the several chosen at once while `selected` is in it
  group: number[];
  angle: number; offset: number; level: number; // the lane: turn about the rod (radians), sideways (m), level (m)
  floorChoice: Hazard; // the floor you must not touch (saved in the course)
  // the picture
  view: { cx: number; cz: number; ppm: number }; // plan view: the world point in the middle, pixels per metre
  topPlan: boolean;
  cropMode: boolean;
  // the lane check
  verdict: string;
  // what the start deck carries (read from the pieces by syncDeviceState, set by the knobs)
  bandK: number | null; // an elastic band (its stiffness in N/m)
  trebuchetKg: number | null; // a trebuchet (the counterweight in kg), or a plain deck
  trebuchetExtra: { short?: number; pin?: number }; // the arm's short end (m) and the pin angle (degrees), when Fix it or advice changed them
  recoilCfg: RecoilCfg | null; // a launcher pad (CC-66)
  droneCfg: DroneCfg | null; // a drone pad (CC-87)
  // preview before apply (Fix it, the partner's changes and advice all become a Proposal)
  proposal: Proposal | null;
  preview: Preview | null;
  previewProfile: ReturnType<typeof sliceProfile> | null;
  previewBars: ReturnType<typeof holdsOf>;
  proofRun: number;
  leadText: string;
  // helpers
  routes: Shortcut[];
  adviceList: Advice[];
  pendingEdits: Edit[];
  movesBusy: string;
  movesList: { label: string; items: RoleSuggestion[] } | null;
}

export const laneOf = (ed: EditorState): Lane => ({ angle: ed.angle, offset: ed.offset, level: ed.level });

export function createEditorState(): EditorState {
  return {
    pieces: [], selected: null, group: [],
    angle: 0, offset: 0, level: DEFAULT_WATER_LEVEL, floorChoice: 'water',
    view: { cx: 8, cz: 0, ppm: 36 }, topPlan: false, cropMode: false,
    verdict: '',
    bandK: null, trebuchetKg: null, trebuchetExtra: {}, recoilCfg: null, droneCfg: null,
    proposal: null, preview: null, previewProfile: null, previewBars: [], proofRun: 0, leadText: '',
    routes: [], adviceList: [], pendingEdits: [], movesBusy: '', movesList: null,
  };
}
