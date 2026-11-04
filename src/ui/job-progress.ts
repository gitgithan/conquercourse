import { progressOf, type Progress, type Step } from '../slice/stages';

// A stepped progress bar for a Modal job (CC-247): the plain-words stage, "step 2 of 5", seconds so far, and Cancel.
// The job reports its own stage names; this only draws them. Nothing here is silent: a failure leaves the bar red with the reason beside it.
const STYLE = `
.jp{display:grid;gap:6px;border:1px solid #cfd6d0;border-radius:10px;padding:10px 12px;background:#f6f8f5}
.jp ol{display:flex;gap:6px;margin:0;padding:0;list-style:none;flex-wrap:wrap;font-size:13px}
.jp li{padding:2px 10px;border-radius:999px;background:#e1e7e2;color:#58635d}
.jp li.done{background:#cfe6df;color:#0f6b5c}.jp li.on{background:#0f6b5c;color:#fff;font-weight:700}
.jp .bar{height:8px;border-radius:4px;background:#e1e7e2;overflow:hidden}.jp .bar i{display:block;height:100%;width:0;background:#0f6b5c;transition:width .6s}
.jp .line{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px}.jp .line button{margin-left:auto}`;
let styled = false;

export interface JobBar { el: HTMLElement; update(p: Progress): void; finish(): void; fail(): void }

export function jobProgress(parent: HTMLElement, steps: Step[], onCancel: () => void): JobBar {
  if (!styled) { styled = true; document.head.append(Object.assign(document.createElement('style'), { id: 'job-progress-style', textContent: STYLE })); }
  const box = Object.assign(document.createElement('div'), { className: 'jp' });
  box.setAttribute('role', 'status'); box.dataset.stage = steps[0].id;
  const list = document.createElement('ol'), lis = steps.map((s) => Object.assign(document.createElement('li'), { textContent: s.words }));
  list.append(...lis);
  const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('i'); bar.append(fill);
  const line = document.createElement('div'); line.className = 'line';
  const words = document.createElement('span'), secs = document.createElement('span'), cancel = Object.assign(document.createElement('button'), { textContent: 'Cancel', type: 'button' });
  cancel.dataset.jobCancel = '1'; cancel.onclick = () => { cancel.disabled = true; onCancel(); };
  line.append(words, secs, cancel); box.append(list, bar, line); parent.append(box);
  const t0 = Date.now(); let index = 0, ended = false;
  const paint = (i: number) => {
    index = Math.max(index, i); box.dataset.stage = steps[index].id;
    lis.forEach((li, k) => { li.className = k < index || (ended && k === index) ? 'done' : k === index ? 'on' : ''; });
    fill.style.width = `${Math.round(((ended ? index + 1 : index + 0.5) / steps.length) * 100)}%`;
    words.textContent = ended ? steps[index].words : `Step ${index + 1} of ${steps.length}: ${steps[index].words}`;
  };
  const tick = () => { secs.textContent = `${progressOf(steps, index, t0).seconds} s`; };
  const timer = setInterval(tick, 1000);
  paint(0); tick();
  const stop = () => { ended = true; clearInterval(timer); cancel.hidden = true; };
  return {
    el: box,
    update: (p) => { if (!ended) { paint(p.index); tick(); } },
    finish: () => { stop(); paint(steps.length - 1); tick(); },
    fail: () => { stop(); box.remove(); }, // the message under the button says what went wrong; a stuck bar next to it only confuses
  };
}
