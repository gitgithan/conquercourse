import { IDLE, barFraction, begin, cancel, finalText, finish, isSearching, isStopped, progressText, tick, withProgress, type LaneProgress, type LaneState } from './lane-check';

// CC-243: the lane check's progress line, bar and buttons. The editor owns the worker; this owns what the person sees and the 3-minute clock.
// One element lives for the whole editor session and is moved under the verdict each time the lane panel is drawn.

export interface LaneCheckHooks {
  stopWorker: () => void; // Cancel and the cap both end the search at once
  playAnyway: () => void; // go to the Course without waiting: it searches in its own worker with its own progress and cancel
  checkAgain: () => void; // the person asked for a search after Stopped or Timed out
  stopped?: (s: LaneState) => void; // the verdict line and the page flags for a lane that is not checked
}

export interface LaneCheck {
  state: () => LaneState;
  start: () => void;
  progress: (p: LaneProgress) => void;
  done: (cleared: boolean) => void;
  cancel: () => void;
  reset: () => void; // an edit: the old state is gone
  mount: (parent: HTMLElement) => void;
}

const STYLE = '#lanecheck{display:grid;gap:4px;margin-top:4px}#lanecheck[hidden]{display:none}#lanecheck progress{width:100%;height:10px}#lanecheck .row{display:flex;gap:6px;flex-wrap:wrap}#lanecheck button{font-size:12px}';

export function createLaneCheck(hooks: LaneCheckHooks, now: () => number = () => performance.now()): LaneCheck {
  let s: LaneState = IDLE, timer = 0;
  const box = document.createElement('div'); box.id = 'lanecheck'; box.hidden = true; box.setAttribute('aria-live', 'polite');
  const style = document.createElement('style'); style.textContent = STYLE; box.append(style);
  const line = document.createElement('div'); line.className = 'muted'; line.id = 'lane-progress-text';
  const bar = document.createElement('progress'); bar.id = 'lane-progress-bar'; bar.max = 1; // no value: the browser draws it moving
  const row = document.createElement('div'); row.className = 'row';
  const mk = (id: string, text: string, title: string, on: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = text; b.title = title; b.onclick = on; return b; };
  const cancelBtn = mk('lane-cancel', 'Cancel', 'Stop the search now. The lane stays as it is, marked not checked.', () => api.cancel());
  const anywayBtn = mk('lane-anyway', 'Play anyway', 'Do not wait: the Course works out the ideal run itself, and shows its own progress.', () => hooks.playAnyway());
  const againBtn = mk('lane-recheck', 'Check again', 'Start the search again for this lane.', () => hooks.checkAgain());
  row.append(cancelBtn, anywayBtn, againBtn);
  box.append(line, bar, row);

  function render() {
    const t = now();
    document.documentElement.dataset.laneState = s.kind;
    const searching = isSearching(s);
    box.hidden = !(searching || isStopped(s));
    bar.hidden = !searching; cancelBtn.hidden = !searching; anywayBtn.hidden = !(searching || isStopped(s)); againBtn.hidden = !isStopped(s);
    if (searching) {
      line.textContent = progressText(s, t); line.className = 'muted';
      const f = barFraction(s);
      if (f === null) bar.removeAttribute('value'); else bar.value = f;
      document.documentElement.dataset.laneProgress = line.textContent;
    } else {
      line.textContent = finalText(s)?.line ?? ''; line.className = isStopped(s) ? 'bad' : 'muted';
      if (!isStopped(s)) line.textContent = '';
      delete document.documentElement.dataset.laneProgress;
    }
  }
  function set(next: LaneState) {
    const was = s; s = next;
    if (isSearching(s) && !timer) timer = window.setInterval(() => { const t = tick(s, now()); if (t !== s) api.settle(t); else render(); }, 250);
    if (!isSearching(s) && timer) { clearInterval(timer); timer = 0; }
    render();
    if (isStopped(s) && !isStopped(was)) hooks.stopped?.(s);
  }
  const api: LaneCheck & { settle: (t: LaneState) => void } = {
    state: () => s,
    start: () => set(begin(now())),
    progress: (p) => { if (isSearching(s)) { s = withProgress(s, p); render(); } },
    done: (cleared) => set(finish(s, cleared)),
    cancel: () => { if (!isSearching(s)) return; hooks.stopWorker(); set(cancel(s)); },
    reset: () => set(IDLE),
    mount: (parent) => { parent.append(box); render(); },
    settle: (t) => { hooks.stopWorker(); set(t); }, // the cap
  };
  return api;
}
