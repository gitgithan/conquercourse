import type { LaneProgress } from '../../slice/lane-check';
import { el } from './dom';

// Obstacle progress is not a time estimate: a bar search can take longer than several jumps.
export function previewCheckView(p: LaneProgress | null, elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const elapsed = `${seconds} ${seconds === 1 ? 'second' : 'seconds'} elapsed`;
  if (!p) return { stage: 'Trying movement timings to find a complete run through these edits.', elapsed, fraction: null };
  if (p.label === 'the whole course') return { stage: 'Replaying a complete run through the proposed course.', elapsed, fraction: null };
  const at = /(?:edge|step) at (-?[\d.]+) m/.exec(p.label);
  const place = at ? ` at ${at[1]} m` : '';
  const task = p.label.includes('monkey bars') ? `Trying bar swing and reach timings${place}`
    : p.label.includes('trebuchet') ? 'Trying trebuchet release timings'
    : p.label.includes('step at') ? `Trying vault and climb timings${place}`
    : p.label.includes('edge at') ? `Trying jump and grab timings${place}` : `Testing ${p.label}`;
  const total = Number.isFinite(p.of) ? Math.max(0, Math.floor(p.of)) : 0;
  const step = Number.isFinite(p.step) ? Math.min(total, Math.max(0, Math.floor(p.step))) : 0;
  return {
    stage: total ? `Obstacle ${Math.min(total, step + 1)} of ${total}: ${task}.` : `${task}.`,
    elapsed,
    // Stay indeterminate until an obstacle has been passed. Completion requires the actual verdict.
    fraction: total && step > 0 ? Math.min(0.95, step / total) : null,
  };
}

/** A persistent card outside the scrolling edits: the check remains visible even with a long proposal. */
export function createPreviewCheck(parent: HTMLElement, hooks: { stop: () => void; retry: () => void }, now = () => Date.now()) {
  const box = el('div', parent, { id: 'previewcheck', hidden: true });
  box.style.cssText = 'padding:8px 14px;border-top:1px solid #cfd6d0;background:#edf6f2;display:grid;gap:4px;font-size:12px';
  // Author display rules must not override the native hidden attribute.
  const style = el('style', box, { text: '#previewcheck[hidden],#previewcheck progress[hidden]{display:none!important}.ed.ux .helper:has(#previewcheck:not([hidden])) #reply{min-height:60px}.ed.ux .helper:has(#previewcheck:not([hidden])) .helper-engines{display:none}.ed.ux .helper:has(#previewcheck:not([hidden])) #ask{min-height:44px;height:44px}' });
  style.hidden = true;
  const title = el('strong', box, { text: 'Simulator: checking proposed changes' });
  const stage = el('div', box, { id: 'preview-check-stage' });
  stage.setAttribute('role', 'status'); stage.setAttribute('aria-live', 'polite');
  const bar = el('progress', box, { id: 'preview-check-bar', max: 1, title: 'Obstacle progress in the current search pass, not a time estimate.' });
  bar.style.cssText = 'display:block;width:100%;height:10px;accent-color:#0f6b5c';
  bar.setAttribute('aria-label', 'Simulator check of the proposed course'); bar.setAttribute('aria-describedby', stage.id);
  const row = el('div', box); row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
  const time = el('span', row);
  const button = el('button', row, { text: 'Stop check', type: 'button', id: 'preview-check-action' });
  button.style.cssText = 'font-size:12px;padding:2px 8px;min-height:24px';
  let running = false, started = 0, timer: ReturnType<typeof setInterval> | undefined, progress: LaneProgress | null = null;
  const stopTimer = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
  function render() {
    if (!running) return;
    const view = previewCheckView(progress, now() - started);
    if (stage.textContent !== view.stage) stage.textContent = view.stage;
    time.textContent = view.elapsed;
    if (view.fraction === null) bar.removeAttribute('value'); else bar.value = view.fraction;
  }
  button.onclick = () => { if (running) hooks.stop(); else hooks.retry(); };
  return {
    start() {
      stopTimer(); running = true; progress = null; started = now(); box.hidden = false; bar.hidden = false;
      bar.setAttribute('aria-busy', 'true'); title.textContent = 'Simulator: checking proposed changes'; button.textContent = 'Stop check';
      render(); timer = setInterval(render, 250);
    },
    progress(p: LaneProgress) { if (running) { progress = p; render(); } },
    hide() { running = false; stopTimer(); box.hidden = true; bar.setAttribute('aria-busy', 'false'); },
    unavailable(message: string) {
      running = false; stopTimer(); box.hidden = false; bar.hidden = true; bar.setAttribute('aria-busy', 'false');
      title.textContent = 'Simulator check not finished'; stage.textContent = message; time.textContent = 'Apply remains locked'; button.textContent = 'Retry check';
    },
  };
}
