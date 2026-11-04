import { mountToasts } from '../../ui/toast-stack';
import { toastBand } from '../../ui/toast-band';
import type { CourseState } from './state';

// The short messages on the screen: one stack (new ones below, old ones leave upward), or with ?toasts=old the single centred toast (CC-197).
export function createSay(params: URLSearchParams, st: CourseState) {
  const toastsOld = params.get('toasts') === 'old';
  const toast = document.createElement('div');
  toast.style.cssText = 'order:1;font:700 22px system-ui,sans-serif;color:#10141c;background:#fffffff0;border-radius:10px;padding:6px 14px;pointer-events:none;display:none';
  toastBand().append(toast);
  const toasts = mountToasts();
  let toastUntil = 0;
  const say = (text: string, ticks: number) => { if (toastsOld) { toast.textContent = text; toast.style.display = 'block'; toastUntil = st.world.runner.tick + ticks; } else toasts.show(text, ticks, st.world.runner.tick); };
  if (params.get('check') === '1') (window as unknown as { __say?: typeof say }).__say = say; // for scripts/toast-shot.mjs: three toasts at once
  return {
    say,
    current: () => (toastsOld ? (toast.style.display === 'none' ? '' : toast.textContent ?? '') : toasts.queue.live.length ? toasts.queue.live[toasts.queue.live.length - 1].text : ''), // the one toast in the main slot
    remaining: (tick: number) => (toastsOld ? toastUntil - tick : toasts.remaining(tick)), // how long the line on screen still stays
    clear() { toastUntil = 0; toast.style.display = 'none'; toasts.clear(); },
    update(tick: number) { if (tick > toastUntil) toast.style.display = 'none'; toasts.update(tick); },
  };
}
