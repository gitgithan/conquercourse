import { el } from '../dom';
import type { EditorState, P } from '../state';
import type { EditorLane } from '../lane';

// What a piece tool may use: the state, what is derived from it, and the few things only the editor's closure owns.
export interface ToolCtx {
  ed: EditorState;
  lane: EditorLane;
  addBar: HTMLElement;
  changed: () => void;
  nextX: () => number;
  nextLaneU: () => number;
  addBarPiece: (x: number, y: number, z?: number) => P;
  // put the camera on a new device (the 3D picture is made later than the toolbar, so this looks it up when called)
  focusOn: (device: P, dist: number) => void;
}

// What the fix search hands a tool: the reply line to write in, and the change signal.
export interface FixEnv { reply: HTMLElement; changed: () => void; }

// One special piece: its toolbar part, its knobs, and what the editor asks of it.
export interface PieceTool {
  id: string;
  mount(): void; // adds the buttons and knobs to the toolbar, in the order the page shows them
  sync?(): void; // the state changed: show or hide the knobs and set them from the state
  fixOrder?: number; // the fix search asks the tools in this order; the first to answer true ends the run
  fix?(f: FixEnv): boolean;
  panel?(p: P, side: HTMLElement): void; // knobs for a chosen piece, in the piece panel
}

// A labelled number box. The label is returned too, so a single knob can hide the whole label.
export function knob(parent: HTMLElement, text: string, id: string, min: number, max: number, step: number, value: number) {
  const label = el('label', parent, { text: text + ' ' });
  const input = el('input', label, { type: 'number', min: String(min), max: String(max), step: String(step), value: String(value), id });
  return { label, input };
}

export const inRange = (v: number, min: number, max: number) => v >= min && v <= max;
