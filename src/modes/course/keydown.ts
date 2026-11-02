import type { CourseData } from '../../course/course';
import { recoilParams, type WorldState } from '../../sim/world';
import { isAimable } from '../../sim/recoil';

// What the keydown handler reads and changes in the course closure. The values that change later (paused, replay, the queues...) are accessors, never copies.
export interface KeydownCtx {
  typing(e: KeyboardEvent): boolean;
  keys: Set<string>;
  jumpQueued: boolean; vaultQueued: boolean; rollQueued: boolean; slideQueued: boolean; fireQueued: boolean;
  paused: boolean; last: number;
  readonly course: CourseData;
  readonly world: WorldState;
  retryX: number;
  restart(x?: number): void;
  readonly idealWhole: boolean;
  readonly botMode: boolean;
  readonly VIEW_KEYS: string[];
  stopWholeIdeal(): void;
  showWholeIdeal(): void;
  showIdeal(zoneId: string): void;
  zoneAt(x: number): { id: string } | undefined;
  openDojo(): void;
  replay: unknown;
  clearGuides(): void;
  showAgain(): void;
  nextCam(): void;
  readonly drumLane: { toggle(): void };
  frontOverride: boolean | null;
  toggleDebug(): void;
  readonly ghostCtl: { cycle(): void } | null;
  keysTouched: boolean; keysOpen: boolean;
  paintKeys(open: boolean): void;
}

export function createKeydown(c: KeydownCtx): (e: KeyboardEvent) => void {
  return (e) => {
    if (c.typing(e)) { c.keys.clear(); c.jumpQueued = false; c.vaultQueued = false; c.rollQueued = false; c.slideQueued = false; c.fireQueued = false; return; }
    if (c.paused && !e.repeat) { c.paused = false; c.last = performance.now(); }
    if (e.repeat) return;
    c.keys.add(e.code);
    if (e.code === 'Space' || ((e.code === 'ArrowUp' || e.code === 'KeyW') && !(c.course.recoil && isAimable(recoilParams(c.course)) && (c.world.recoil?.armed ?? 0) > 0))) { c.jumpQueued = true; e.preventDefault(); } // a loaded cannon takes Up and W to tilt the barrel instead of jumping
    if (e.code === 'KeyV') c.vaultQueued = true;
    if (e.code === 'KeyX') c.rollQueued = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') c.slideQueued = true; // a fresh press; the world slides only on the ground at a jog's speed
    if (e.code === 'KeyK') c.fireQueued = true;
    if (e.code === 'KeyR') { if (e.shiftKey) { c.retryX = c.course.startX; c.restart(c.course.startX); } else c.restart(); }
    if (c.idealWhole && !c.botMode && e.code !== 'KeyI' && !c.VIEW_KEYS.includes(e.code) && !/^(Shift|Control|Alt|Meta)/.test(e.code)) c.stopWholeIdeal(); // a move key takes the run back; the view keys (camera, front view, drum lane) do not
    if (e.code === 'KeyI') { if (e.shiftKey) c.showWholeIdeal(); else c.showIdeal(c.zoneAt(c.world.runner.x)?.id ?? 'gap'); }
    if (e.code === 'KeyT') c.openDojo();
    if (e.code === 'Escape' && c.replay) { c.replay = null; c.clearGuides(); c.showAgain(); }
    if (e.code === 'KeyC') c.nextCam();
    if (e.code === 'KeyG') c.drumLane.toggle();
    if (e.code === 'KeyF') {
      c.frontOverride = !(c.frontOverride ?? true);
      e.preventDefault();
    }
    if (e.code === 'KeyB') c.toggleDebug();
    if (e.code === 'KeyN') c.ghostCtl?.cycle();
    if (e.code === 'KeyH') { c.keysTouched = true; c.keysOpen = !c.keysOpen; c.paintKeys(c.keysOpen); }
  };
}
