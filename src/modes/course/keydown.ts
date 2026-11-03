import type { CourseData } from '../../course/course';
import { recoilParams } from '../../sim/world';
import { clearQueued, type CourseState } from './state';
import { isAimable } from '../../sim/recoil';

// What the keydown handler reads and changes: the shared state, and the few actions it triggers. `botMode`, `drumLane` and `ghostCtl` are made later in the closure, so they are accessors.
export interface KeydownCtx {
  st: CourseState;
  typing(e: KeyboardEvent): boolean;
  readonly course: CourseData;
  readonly VIEW_KEYS: string[];
  readonly botMode: boolean;
  readonly drumLane: { toggle(): void };
  readonly ghostCtl: { cycle(): void } | null;
  restart(x?: number): void;
  stopWholeIdeal(): void;
  showWholeIdeal(): void;
  showIdeal(zoneId: string): void;
  zoneAt(x: number): { id: string } | undefined;
  openDojo(): void;
  clearGuides(): void;
  showAgain(): void;
  nextCam(): void;
  toggleDebug(): void;
  paintKeys(open: boolean): void;
}

export function createKeydown(c: KeydownCtx): (e: KeyboardEvent) => void {
  return (e) => {
    const st = c.st;
    if (c.typing(e)) { st.keys.clear(); clearQueued(st); return; }
    if (st.paused && !e.repeat) { st.paused = false; st.last = performance.now(); }
    if (e.repeat) return;
    st.keys.add(e.code);
    if (e.code === 'Space' || ((e.code === 'ArrowUp' || e.code === 'KeyW') && !(c.course.recoil && isAimable(recoilParams(c.course)) && (st.world.recoil?.armed ?? 0) > 0))) { st.jumpQueued = true; e.preventDefault(); } // a loaded cannon takes Up and W to tilt the barrel instead of jumping
    if (e.code === 'KeyV') st.vaultQueued = true;
    if (e.code === 'KeyX') st.rollQueued = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') st.slideQueued = true; // a fresh press; the world slides only on the ground at a jog's speed
    if (e.code === 'KeyK') st.fireQueued = true;
    if (e.code === 'KeyR') { if (e.shiftKey) { st.retryX = c.course.startX; c.restart(c.course.startX); } else c.restart(); }
    if (st.idealWhole && !c.botMode && e.code !== 'KeyI' && !c.VIEW_KEYS.includes(e.code) && !/^(Shift|Control|Alt|Meta)/.test(e.code)) c.stopWholeIdeal(); // a move key takes the run back; the view keys (camera, front view, drum lane) do not
    if (e.code === 'KeyI') { if (e.shiftKey) c.showWholeIdeal(); else c.showIdeal(c.zoneAt(st.world.runner.x)?.id ?? 'gap'); }
    if (e.code === 'KeyL') c.openDojo();
    if (e.code === 'Escape' && st.replay) { st.replay = null; c.clearGuides(); c.showAgain(); }
    if (e.code === 'KeyC') c.nextCam();
    if (e.code === 'KeyG') c.drumLane.toggle();
    if (e.code === 'KeyF') {
      st.frontOverride = !(st.frontOverride ?? true);
      e.preventDefault();
    }
    if (e.code === 'KeyB') c.toggleDebug();
    if (e.code === 'KeyN') c.ghostCtl?.cycle();
    if (e.code === 'KeyH') { st.keysTouched = true; st.keysOpen = !st.keysOpen; c.paintKeys(st.keysOpen); }
  };
}

// While the feedback form is open, or a text box has the focus, no game key does anything (typing a T must not open the Dojo).
export const isTyping = (e: KeyboardEvent): boolean => {
  const t = e.target as HTMLElement | null;
  return document.getElementById('cc-feedback') !== null || (!!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable));
};
