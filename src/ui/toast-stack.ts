// CC-197: one stack for every short message (toast): they never overlap.
// A new toast is added below the others, older ones sit above (pushed up as the stack grows), and each leaves by moving up and fading out.
// The queue logic is pure (time is passed in, so a test or the stepped clock decides when); the DOM view is small and only draws it.

import { toastBand } from './toast-band';

export interface ToastItem { id: number; text: string; until: number; leaving: boolean }
export const MAX_TOASTS = 4;

export class ToastQueue {
  items: ToastItem[] = [];
  private next = 1;
  /** Add a toast below the others for `duration` (same unit as `now`). The same words showing already only get more time. */
  push(text: string, duration: number, now: number): ToastItem {
    const same = this.items.find((t) => !t.leaving && t.text === text);
    if (same) { same.until = Math.max(same.until, now + duration); return same; }
    const t: ToastItem = { id: this.next++, text, until: now + duration, leaving: false };
    this.items.push(t);
    const live = this.items.filter((x) => !x.leaving);
    for (const old of live.slice(0, Math.max(0, live.length - MAX_TOASTS))) old.leaving = true; // the oldest makes room
    return t;
  }
  /** Mark finished toasts as leaving; returns the ones that just started to leave. */
  tick(now: number): ToastItem[] {
    const gone: ToastItem[] = [];
    for (const t of this.items) if (!t.leaving && now >= t.until) { t.leaving = true; gone.push(t); }
    return gone;
  }
  /** Drop a toast once its leaving animation is over. */
  remove(id: number) { this.items = this.items.filter((t) => t.id !== id); }
  /** The longest time any showing toast has left (0 when none). */
  remaining(now: number): number { return this.items.reduce((m, t) => (t.leaving ? m : Math.max(m, t.until - now)), 0); }
  clear() { this.items = []; }
  get live(): ToastItem[] { return this.items.filter((t) => !t.leaving); }
}

const CSS = `#toasts{order:1;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:100%}
#toasts .toast{font:700 18px/1.25 system-ui,sans-serif;color:#10141c;background:#fffffff0;border-radius:10px;padding:6px 14px;text-align:center;box-shadow:0 2px 10px #0002;max-width:100%;box-sizing:border-box;transition:transform .45s ease-in,opacity .45s ease-in,margin .45s ease-in;opacity:1;transform:translateY(0)}
#toasts .toast.in{animation:toastin .25s ease-out}
#toasts .toast.leaving{transform:translateY(-34px);opacity:0}
@keyframes toastin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`;

export interface ToastView { show(text: string, duration: number, now: number): void; update(now: number): void; remaining(now: number): number; clear(): void; el: HTMLElement; queue: ToastQueue }

/** The stack on the page. Duration and `now` share one unit (the Course uses simulation ticks, so a paused game keeps its toasts). */
export function mountToasts(parent: HTMLElement = toastBand()): ToastView {
  const queue = new ToastQueue();
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = document.createElement('div'); el.id = 'toasts'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  parent.append(el);
  const nodes = new Map<number, HTMLElement>();
  const sync = () => {
    for (const t of queue.items) {
      let n = nodes.get(t.id);
      if (!n) { n = document.createElement('div'); n.className = 'toast in'; n.textContent = t.text; nodes.set(t.id, n); el.append(n); } // appended last: below the others
      if (t.leaving && !n.classList.contains('leaving')) {
        n.classList.add('leaving');
        const id = t.id, node = n;
        setTimeout(() => { node.remove(); nodes.delete(id); queue.remove(id); }, 480);
      }
    }
  };
  return {
    el, queue,
    show(text, duration, now) { queue.push(text, duration, now); sync(); },
    update(now) { if (queue.tick(now).length) sync(); },
    remaining: (now) => queue.remaining(now),
    clear() { queue.clear(); nodes.forEach((n) => n.remove()); nodes.clear(); },
  };
}
