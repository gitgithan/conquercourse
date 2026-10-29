// Touch controls (CC-139): big buttons that press the same keys the keyboard presses, so the run, the log and the share link are the same.
import type { Pointing } from './phone';

export type PadEvent = { type: 'keydown' | 'keyup'; code: string };
export interface TouchButton { id: string; label: string; code: string; side: 'left' | 'right' | 'top'; cannon?: boolean }

/** Every action a key has, as one table: the button, the key it presses, and where it sits. */
export const TOUCH_BUTTONS: TouchButton[] = [
  { id: 'left', label: '◀', code: 'ArrowLeft', side: 'left' },
  { id: 'right', label: '▶', code: 'ArrowRight', side: 'left' },
  { id: 'jump', label: 'Jump', code: 'Space', side: 'right' },
  { id: 'squat', label: 'Bend', code: 'ArrowDown', side: 'right' },
  { id: 'hold', label: 'Hold', code: 'KeyE', side: 'top' },
  { id: 'vault', label: 'Vault', code: 'KeyV', side: 'top' },
  { id: 'roll', label: 'Roll', code: 'KeyX', side: 'top' },
  { id: 'aim', label: 'Aim ▲', code: 'ArrowUp', side: 'top', cannon: true },
  { id: 'fire', label: 'Fire', code: 'KeyK', side: 'top', cannon: true },
  { id: 'retry', label: 'Retry', code: 'KeyR', side: 'top' },
];

/** `?touch=1` shows the buttons (for checks), `?touch=0` never does; otherwise they show where the main pointer is a finger. */
export function touchOn(params: URLSearchParams, ask: () => Pointing): boolean {
  const forced = params.get('touch');
  if (forced === '1') return true;
  if (forced === '0') return false;
  return ask().coarse;
}

/** Which fingers hold which buttons. A key goes down when its first finger lands and up when its last finger leaves, so two fingers on one button press the key once. */
export class PadState {
  private fingers = new Map<number, string>();
  private held = new Map<string, number>(); // button id -> fingers on it
  down(pointer: number, id: string): PadEvent[] {
    const b = TOUCH_BUTTONS.find((x) => x.id === id);
    if (!b || this.fingers.has(pointer)) return [];
    this.fingers.set(pointer, id);
    const n = (this.held.get(id) ?? 0) + 1;
    this.held.set(id, n);
    return n === 1 ? [{ type: 'keydown', code: b.code }] : [];
  }
  up(pointer: number): PadEvent[] {
    const id = this.fingers.get(pointer);
    if (id === undefined) return [];
    this.fingers.delete(pointer);
    const n = (this.held.get(id) ?? 1) - 1;
    this.held.set(id, n);
    return n === 0 ? [{ type: 'keyup', code: TOUCH_BUTTONS.find((x) => x.id === id)!.code }] : [];
  }
  releaseAll(): PadEvent[] {
    return [...this.fingers.keys()].flatMap((p) => this.up(p));
  }
}

const sendKey = (e: PadEvent): void => { dispatchEvent(new KeyboardEvent(e.type, { code: e.code, key: e.code, bubbles: true })); };

/** Draw the buttons over the page. Each finger is its own pointer, so run and jump work together. */
export function mountTouch(root: HTMLElement, o: { cannon: boolean; send?: (e: PadEvent) => void }): { remove: () => void } {
  const send = o.send ?? sendKey, pad = new PadState();
  const box = document.createElement('div');
  box.id = 'touch-pad';
  box.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:40;pointer-events:none;padding:0 max(12px,env(safe-area-inset-right)) calc(max(12px,env(safe-area-inset-bottom)) + 52px) max(12px,env(safe-area-inset-left));display:flex;justify-content:space-between;align-items:flex-end;touch-action:none;user-select:none;-webkit-user-select:none';
  const groups: Record<string, HTMLElement> = {};
  for (const side of ['left', 'right'] as const) {
    const g = document.createElement('div');
    g.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:' + (side === 'left' ? 'flex-start' : 'flex-end') + ';max-width:48%';
    groups[side] = g; box.append(g);
  }
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;width:100%;position:absolute;right:0;bottom:100%;padding:0 12px 6px 12px;box-sizing:border-box';
  box.append(top);
  for (const b of TOUCH_BUTTONS) {
    if (b.cannon && !o.cannon) continue;
    const el = document.createElement('button');
    el.type = 'button'; el.id = `touch-${b.id}`; el.textContent = b.label;
    const big = b.side !== 'top';
    el.style.cssText = `pointer-events:auto;touch-action:none;font:600 ${big ? 18 : 14}px system-ui,sans-serif;min-width:${big ? 76 : 56}px;min-height:${big ? 76 : 44}px;border-radius:${big ? 38 : 22}px;border:2px solid rgba(23,32,29,.7);background:rgba(255,255,255,.78);color:#17201d;padding:0 12px`;
    const press = (e: PointerEvent): void => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.style.background = 'rgba(255,214,102,.95)'; pad.down(e.pointerId, b.id).forEach(send); };
    const release = (e: PointerEvent): void => { el.style.background = 'rgba(255,255,255,.78)'; pad.up(e.pointerId).forEach(send); };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    (b.side === 'top' ? top : groups[b.side]).append(el);
  }
  const letGo = (): void => pad.releaseAll().forEach(send);
  addEventListener('blur', letGo);
  root.append(box);
  return { remove: () => { removeEventListener('blur', letGo); letGo(); box.remove(); } };
}
