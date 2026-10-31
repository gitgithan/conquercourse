import { addBadge } from '../ui/says';
import type { CourseData } from '../course/course';
import { gapSpecs } from '../sim/needs';
import { playPlan, type Plan } from '../sim/ideal';
import { DEFAULT_PARAMS } from '../sim/runner';
import { DT } from '../sim/units';
import { changeWords, closeGap, dragHandle, editable, handlesOf, lockedPlatforms, splitDeck, type Handle } from '../slice/ground-graph';

// Graph Studio (CC-86): "pause and drag the ground", inside the Course. The side view of the course becomes a graph under the picture:
// decks with a height and two edges, bars hanging in the air, each with a handle. Drag a handle and the verdict under it updates with the
// Course's own physics (the ideal-run search, off the page's thread); "Play from here" carries on from the same checkpoint on the edited course.
// The pattern is the coaster builder's (src/modes/coaster.ts): one picture, handles, a live verdict, double-click to add, instant play.
export interface StudioEnv { course: CourseData; retryX: number; facing: 1 | -1; falls: number; runnerX: number }
export interface StudioHooks {
  env: () => StudioEnv;
  pause: () => void; // freeze the clock while the studio is open
  resume: () => void;
  chipWhen: () => boolean; // the "Edit ground" chip shows after a first fall, or with ?edit=1; Tab always opens it
}

type Verdict = { state: 'working' } | { state: 'clears'; seconds: number } | { state: 'blocked'; reach: number };

const COLOURS = { ink: '#17201d', teal: '#0f6b5c', ghost: '#9aa5a0', deck: '#cbd5cd', water: '#b7d3ee', warn: '#b45309', bad: '#dc2626', good: '#16a34a' };

export function installGraphStudio(hooks: StudioHooks): void {
  let open: { close: () => void } | null = null;
  const chip = document.createElement('button');
  chip.id = 'graphchip';
  chip.textContent = 'Edit the ground (Tab)';
  chip.title = 'Pause and drag the decks, gaps and bars; the verdict updates as you drag';
  chip.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:12;display:none;font:600 14px system-ui,sans-serif;border:1px solid #0f6b5c;background:#fff;color:#0f6b5c;border-radius:8px;padding:6px 12px;cursor:pointer';
  chip.onclick = () => toggle();
  document.body.append(chip);
  const showChip = () => { chip.style.display = !open && editable(hooks.env().course) && hooks.chipWhen() ? 'block' : 'none'; };
  setInterval(showChip, 500);

  function toggle() {
    if (open) { open.close(); return; }
    if (!editable(hooks.env().course)) return;
    hooks.pause();
    open = start(hooks.env(), () => { open = null; hooks.resume(); showChip(); });
    chip.style.display = 'none';
  }
  // capture phase: while the studio is open the game must not hear any key (typing a number must not jump)
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (typing) return;
    if (e.code === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); e.stopImmediatePropagation(); toggle(); return; }
    if (open) { e.stopImmediatePropagation(); if (e.code === 'Escape') open.close(); }
  }, true);
  addEventListener('keyup', (e) => { if (open) e.stopImmediatePropagation(); }, true);
}

function start(env: StudioEnv, onClose: () => void): { close: () => void } {
  const original = env.course;
  let edited = original, note = '';
  let drag: Handle | null = null, panFrom: { px: number; x0: number; x1: number } | null = null;
  let view = { x0: env.runnerX - 22, x1: env.runnerX + 58 };
  let verdict: Verdict = { state: 'working' }, baseline: Verdict = { state: 'working' };
  let gapLine = '';
  const workers: Record<'base' | 'live', Worker | null> = { base: null, live: null };
  let token = 0, timer = 0;

  const root = document.createElement('div');
  root.id = 'graphstudio';
  root.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:40;height:min(44vh,360px);background:#fffffff4;border-top:2px solid #0f6b5c;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;font:14px/1.35 system-ui,sans-serif;color:#17201d';
  root.innerHTML = `<div style="display:flex;gap:8px;align-items:center;padding:6px 12px;flex-wrap:wrap">
      <strong>Pause and drag the ground</strong>
      <span style="color:#58635d">Drag a deck to raise it, a deck's edge to change a gap, a bar to move it. Double-click a deck to cut a gap in it, a deck's edge to close one. Drag the background to pan, scroll to zoom.</span>
      <span style="flex:1"></span>
      <button id="gsplay" style="font:600 14px system-ui;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer">Play from here</button>
      <button id="gsreset" style="font:600 14px system-ui;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer">Undo my edits</button>
      <button id="gsclose" style="font:600 14px system-ui;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer">Close (Tab)</button></div>
    <div style="position:relative;min-height:0"><canvas id="gscanvas" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block"></canvas></div>
    <div style="padding:6px 12px;display:grid;gap:2px"><div id="gsverdict" class="says-when" style="font-weight:700;border-left:5px solid #888;padding-left:8px"></div><div id="gsgap" style="color:#58635d"></div><div id="gschanges" style="color:#58635d"></div></div>`;
  document.body.append(root);
  const cv = root.querySelector('#gscanvas') as HTMLCanvasElement, c = cv.getContext('2d')!;
  const verdictEl = root.querySelector('#gsverdict') as HTMLElement, gapEl = root.querySelector('#gsgap') as HTMLElement, changesEl = root.querySelector('#gschanges') as HTMLElement;
  addBadge(verdictEl.parentElement!, 'simulator', { before: verdictEl }); // CC-243
  const fit = () => { cv.width = Math.max(300, cv.clientWidth); cv.height = Math.max(100, cv.clientHeight); };

  const yRange = () => {
    const ps = edited.terrain.platforms.filter((p) => p.x1 >= view.x0 && p.x0 <= view.x1), hs = (edited.holds ?? []).filter((h) => h.x >= view.x0 && h.x <= view.x1);
    const ys = [edited.terrain.waterY, ...ps.map((p) => p.top), ...hs.map((h) => h.y)];
    const lo = Math.min(...ys) - 1.5, hi = Math.max(...ys) + 3;
    return { lo, hi: Math.max(hi, lo + 8) };
  };
  const geom = () => {
    const W = cv.width, H = cv.height, padB = 22, padT = 8, { lo, hi } = yRange();
    return { W, H, sx: (x: number) => ((x - view.x0) / (view.x1 - view.x0)) * W, sy: (y: number) => H - padB - ((y - lo) / (hi - lo)) * (H - padB - padT), ix: (px: number) => view.x0 + (px / W) * (view.x1 - view.x0), iy: (py: number) => lo + ((H - padB - py) / (H - padB - padT)) * (hi - lo) };
  };

  function draw() {
    const g = geom(), { W, H } = g;
    c.clearRect(0, 0, W, H);
    c.font = '12px system-ui'; c.textAlign = 'left';
    // the ground as it was (grey outline) and as it is now
    const sortedOld = [...original.terrain.platforms].sort((a, b) => a.x0 - b.x0), sortedNew = [...edited.terrain.platforms].sort((a, b) => a.x0 - b.x0);
    c.fillStyle = COLOURS.water; c.fillRect(0, g.sy(edited.terrain.waterY), W, H);
    c.fillStyle = '#58635d'; c.fillText(`${edited.hazard && edited.hazard !== 'water' ? edited.hazard : 'water'}`, 6, g.sy(edited.terrain.waterY) + 14);
    const locked = lockedPlatforms(edited);
    sortedNew.forEach((p) => {
      const i = edited.terrain.platforms.indexOf(p), o = original.terrain.platforms[i];
      const changed = !!o && (o.top !== p.top || o.x0 !== p.x0 || o.x1 !== p.x1);
      if (changed) { c.setLineDash([6, 5]); c.strokeStyle = COLOURS.ghost; c.lineWidth = 2; c.strokeRect(g.sx(o.x0), g.sy(o.top), g.sx(o.x1) - g.sx(o.x0), H - g.sy(o.top)); c.setLineDash([]); }
      c.fillStyle = locked.has(i) ? '#d7dbd8' : changed ? '#c7e6df' : COLOURS.deck; c.strokeStyle = changed ? COLOURS.teal : COLOURS.ink; c.lineWidth = changed ? 3 : 2;
      c.fillRect(g.sx(p.x0), g.sy(p.top), g.sx(p.x1) - g.sx(p.x0), H - g.sy(p.top)); c.strokeRect(g.sx(p.x0), g.sy(p.top), g.sx(p.x1) - g.sx(p.x0), H - g.sy(p.top));
      if (changed && o && Math.abs(o.top - p.top) >= 0.01) { // an arrow from where the top was to where it is now
        const ax = g.sx((p.x0 + p.x1) / 2) + 14, y0 = g.sy(o.top), y1 = g.sy(p.top), dir = y1 < y0 ? -1 : 1;
        c.strokeStyle = COLOURS.teal; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, y0); c.lineTo(ax, y1); c.moveTo(ax - 5, y1 - dir * 7); c.lineTo(ax, y1); c.lineTo(ax + 5, y1 - dir * 7); c.stroke();
      }
      c.fillStyle = COLOURS.ink; c.textAlign = 'center'; c.fillText(`${p.top.toFixed(1)} m`, g.sx((p.x0 + p.x1) / 2), g.sy(p.top) - 18); c.textAlign = 'left';
      if (locked.has(i)) { c.fillStyle = '#58635d'; c.fillText('fixed', g.sx(p.x0) + 4, g.sy(p.top) + 14); }
    });
    // gap widths
    sortedNew.forEach((p, i) => {
      const n = sortedNew[i + 1];
      if (!n || n.x0 - p.x1 < 0.05) return;
      const mid = (p.x1 + n.x0) / 2;
      c.fillStyle = COLOURS.warn; c.textAlign = 'center'; c.fillText(`gap ${(n.x0 - p.x1).toFixed(1)} m${n.top !== p.top ? `, ${n.top > p.top ? 'up' : 'down'} ${Math.abs(n.top - p.top).toFixed(1)}` : ''}`, g.sx(mid), g.sy(Math.max(p.top, n.top)) - 4); c.textAlign = 'left';
    });
    void sortedOld;
    // bars, and where they were
    (original.holds ?? []).forEach((h, i) => {
      const n = edited.holds?.[i];
      if (n && (n.x !== h.x || n.y !== h.y)) { c.setLineDash([4, 4]); c.strokeStyle = COLOURS.ghost; c.lineWidth = 2; c.beginPath(); c.arc(g.sx(h.x), g.sy(h.y), 8, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.beginPath(); c.moveTo(g.sx(h.x), g.sy(h.y)); c.lineTo(g.sx(n.x), g.sy(n.y)); c.stroke(); }
    });
    (edited.holds ?? []).forEach((h, i) => { c.fillStyle = COLOURS.ink; c.fillRect(g.sx(h.x) - 14, g.sy(h.y) - 2, 28, 4); c.fillStyle = '#58635d'; c.fillText(`bar ${i + 1}`, g.sx(h.x) - 14, g.sy(h.y) - 8); });
    // where the runner is and where "play from here" starts
    c.strokeStyle = COLOURS.good; c.lineWidth = 2; c.beginPath(); c.moveTo(g.sx(env.retryX), 8); c.lineTo(g.sx(env.retryX), H - 22); c.stroke();
    c.fillStyle = COLOURS.good; c.fillText('start of the try', g.sx(env.retryX) + 4, 20);
    c.strokeStyle = COLOURS.teal; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(g.sx(env.runnerX), 8); c.lineTo(g.sx(env.runnerX), H - 22); c.stroke(); c.setLineDash([]);
    if (Math.abs(env.runnerX - env.retryX) > 1) { c.fillStyle = COLOURS.teal; c.fillText('you', g.sx(env.runnerX) + 4, 34); }
    // axis
    c.fillStyle = '#58635d'; c.strokeStyle = '#e5e7eb'; c.lineWidth = 1;
    const step = view.x1 - view.x0 > 70 ? 10 : 5;
    for (let x = Math.ceil(view.x0 / step) * step; x <= view.x1; x += step) { c.beginPath(); c.moveTo(g.sx(x), H - 22); c.lineTo(g.sx(x), H - 18); c.stroke(); c.fillText(`${x}`, g.sx(x) - 8, H - 6); }
    // handles
    handlesOf(edited).forEach((h) => {
      const x = g.sx(h.x), y = g.sy(h.y);
      c.fillStyle = drag?.id === h.id ? COLOURS.teal : '#fff'; c.strokeStyle = COLOURS.teal; c.lineWidth = 3;
      c.beginPath();
      if (h.kind === 'top') c.rect(x - 8, y - 8, 16, 16); else c.arc(x, y, h.kind === 'bar' ? 8 : 6, 0, Math.PI * 2);
      c.fill(); c.stroke();
    });
    publish();
  }

  function publish() {
    const g = geom(), b = cv.getBoundingClientRect();
    const hs = handlesOf(edited).map((h) => ({ id: h.id, sx: Math.round(b.left + (g.sx(h.x) / cv.width) * b.width), sy: Math.round(b.top + (g.sy(h.y) / cv.height) * b.height), x: h.x, y: h.y }));
    document.documentElement.dataset.graph = JSON.stringify({ open: true, verdict: verdict.state, baseline: baseline.state, seconds: verdict.state === 'clears' ? +verdict.seconds.toFixed(2) : null, baselineSeconds: baseline.state === 'clears' ? +baseline.seconds.toFixed(2) : null, changes: changeWords(original, edited).length, handles: hs.slice(0, 40) });
    const v = verdict;
    verdictEl.style.borderLeftColor = v.state === 'clears' ? COLOURS.good : v.state === 'blocked' ? COLOURS.bad : '#888';
    const was = baseline.state === 'clears' ? `clears in ${baseline.seconds.toFixed(1)} s` : baseline.state === 'blocked' ? 'could not be cleared' : 'being checked';
    if (v.state === 'working') verdictEl.textContent = `Working it out… (before your edits: ${was})`;
    else if (v.state === 'clears') {
      const d = baseline.state === 'clears' ? v.seconds - baseline.seconds : null;
      verdictEl.textContent = `The ideal run clears it in ${v.seconds.toFixed(1)} s${d === null ? '' : Math.abs(d) < 0.05 ? ', the same as before' : d < 0 ? `, ${(-d).toFixed(1)} s faster than before` : `, ${d.toFixed(1)} s slower than before`}.`;
    } else verdictEl.textContent = `The simulator finds no way through from here: the ideal run gets as far as ${v.reach.toFixed(0)} m. (Before your edits: ${was}.)`;
    gapEl.textContent = gapLine;
    const words = changeWords(original, edited);
    changesEl.textContent = (words.length ? `Your edits: ${words.join(' ')}` : 'No edits yet.') + (note ? ` ${note}` : '');
  }

  // ---- the verdict: the ideal-run search for the edited course, from the checkpoint, off the page's thread; a new drag cancels the old search
  function ask(course: CourseData, slot: 'base' | 'live'): Promise<Verdict> {
    return new Promise((resolve) => {
      const id = ++token;
      workers[slot]?.terminate(); workers[slot] = null;
      const run = (plan: Plan) => {
        const c2 = { ...course, startX: env.retryX };
        const r = playPlan(c2, plan, 120 * 120);
        resolve(r.world.outcome === 'cleared' ? { state: 'clears', seconds: r.world.runner.tick * DT } : { state: 'blocked', reach: r.maxX });
      };
      try {
        const w = new Worker(new URL('../sim/ideal-worker.ts', import.meta.url), { type: 'module' });
        workers[slot] = w;
        w.onmessage = (e: MessageEvent) => { if (e.data.id !== id) return; w.terminate(); if (workers[slot] === w) workers[slot] = null; run(e.data.plan as Plan); };
        w.postMessage({ id, course: { ...course, startX: env.retryX } });
      } catch { void import('../sim/ideal').then((m) => run(m.searchIdealRun({ ...course, startX: env.retryX }).plan)); }
    });
  }
  function schedule() {
    verdict = { state: 'working' };
    clearTimeout(timer);
    draw();
    const mine = edited;
    timer = window.setTimeout(() => {
      // the quick part: how hard is the hardest gap, from the same jump physics the Course uses
      try {
        const gs = gapSpecs(mine).sort((a, b) => b.needed - a.needed)[0];
        gapLine = gs ? (Number.isFinite(gs.needed) ? `Hardest gap: ${gs.width.toFixed(1)} m wide${Math.abs(gs.rise) > 0.05 ? `, ${gs.rise > 0 ? 'up' : 'down'} ${Math.abs(gs.rise).toFixed(1)} m` : ''}, a jump needs ${gs.needed.toFixed(1)} m/s at the edge (top running speed ${DEFAULT_PARAMS.topSpeed} m/s).` : `Hardest gap: ${gs.width.toFixed(1)} m wide: no running jump crosses it.`) : '';
      } catch { gapLine = ''; }
      void ask(mine, 'live').then((v) => { if (edited === mine) { verdict = v; draw(); } });
    }, 350);
  }

  // ---- pointer
  const pos = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); return { px: ((e.clientX - b.left) / b.width) * cv.width, py: ((e.clientY - b.top) / b.height) * cv.height }; };
  const hit = (px: number, py: number): Handle | null => {
    const g = geom();
    let best: Handle | null = null, bd = 14;
    for (const h of handlesOf(edited)) { const d = Math.hypot(g.sx(h.x) - px, g.sy(h.y) - py); if (d < bd) { bd = d; best = h; } }
    return best;
  };
  cv.addEventListener('pointerdown', (e) => {
    const { px, py } = pos(e), h = hit(px, py);
    cv.setPointerCapture(e.pointerId);
    if (h) drag = h; else panFrom = { px, x0: view.x0, x1: view.x1 };
    draw();
  });
  cv.addEventListener('pointermove', (e) => {
    const { px, py } = pos(e), g = geom();
    if (drag) {
      const r = dragHandle(edited, drag, g.ix(px), g.iy(py));
      edited = r.course; note = r.note ?? note;
      verdict = { state: 'working' }; // the old verdict is for the old ground
      draw();
    } else if (panFrom) {
      const dx = ((px - panFrom.px) / cv.width) * (panFrom.x1 - panFrom.x0);
      view = { x0: panFrom.x0 - dx, x1: panFrom.x1 - dx }; draw();
    } else cv.style.cursor = hit(px, py) ? 'grab' : 'default';
  });
  cv.addEventListener('dblclick', (e) => {
    const { px, py } = pos(e as unknown as PointerEvent), g = geom(), h = hit(px, py);
    let r = null as ReturnType<typeof closeGap>;
    if (h && (h.kind === 'edge-left' || h.kind === 'edge-right')) r = closeGap(edited, h);
    else if (!h) {
      const x = g.ix(px), y = g.iy(py), i = edited.terrain.platforms.findIndex((p) => x >= p.x0 && x <= p.x1 && y <= p.top);
      if (i >= 0) r = splitDeck(edited, i, x, 2);
    }
    if (r) { edited = r.course; note = r.note ?? note; schedule(); }
  });
  const release = () => { const was = drag; drag = null; panFrom = null; if (was) schedule(); else draw(); };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { px } = pos(e as unknown as PointerEvent), g = geom(), at = g.ix(px), k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const w = Math.min(400, Math.max(12, (view.x1 - view.x0) * k));
    view = { x0: at - ((at - view.x0) / (view.x1 - view.x0)) * w, x1: at + ((view.x1 - at) / (view.x1 - view.x0)) * w }; draw();
  }, { passive: false });

  // ---- buttons
  const finish = () => { clearTimeout(timer); workers.base?.terminate(); workers.live?.terminate(); root.remove(); delete document.documentElement.dataset.graph; document.documentElement.dataset.graphclosed = '1'; onClose(); };
  (root.querySelector('#gsclose') as HTMLButtonElement).onclick = finish;
  (root.querySelector('#gsreset') as HTMLButtonElement).onclick = () => { edited = original; note = ''; schedule(); };
  (root.querySelector('#gsplay') as HTMLButtonElement).onclick = () => {
    if (edited !== original) {
      try {
        localStorage.setItem('cc.course', JSON.stringify(edited)); // the Dojo and the next visit see the edited ground
        localStorage.setItem('cc.course.edits', JSON.stringify({ at: new Date().toISOString(), words: changeWords(original, edited) }));
      } catch { /* the edit still plays */ }
    }
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course: edited, world: null, retryX: env.retryX, facing: env.facing, falls: env.falls })); } catch { /* the page starts fresh */ }
    location.reload();
  };

  fit();
  new ResizeObserver(() => { fit(); draw(); }).observe(root);
  draw();
  // the baseline verdict (the course as it was) and the first verdict for the edited course are the same until something is dragged
  void ask(original, 'base').then((v) => { baseline = v; if (edited === original) verdict = v; draw(); });
  return { close: finish };
}
