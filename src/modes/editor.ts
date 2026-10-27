import { startCourse } from './course';
import { readGlbMesh } from '../slice/glb';
import { LIBRARY } from '../slice/shapes';
import { bestSlices, describe as describeLane, laneToCourse, sliceProfile, CELL, HALF_LANE } from '../slice/slice';
import { crop, duplicate, hits, newPiece, realSize, scaleBy, scaleToHeight, size, worldSamples, type Piece } from '../slice/world';
import { searchIdealRun } from '../sim/ideal';
import { createView3d } from '../slice/view3d';
import { sceneFor } from '../slice/scene';
import { barMesh, holdsOf, isHold, REACH_JUMPING, REACH_STANDING } from '../slice/holds-world';
import { fixLayout } from '../slice/fixit';
import { fixBars } from '../slice/fixbars';
import { adviseLane, type Advice } from '../slice/advice';
import { applyEdits, parseReply, worldBrief, type Edit } from '../slice/designer';

// The World editor (beta): build a world from pieces on a plan view, scale them (a toy brick becomes a block), turn, copy, crop and move them,
// choose the lane the runner takes (turn about the rod, sideways, level), and play it. Everything is in metres.
const KEY = 'cc.world.v1';
interface Saved { pieces: { src: string; x: number; z: number; y: number; yaw: number; scale: number }[]; angle: number; offset: number; level: number }
type P = Piece & { src?: string };

export function startEditor(host: HTMLElement): { backend: 'webgl2' } {
  const style = document.createElement('style');
  style.textContent = `
    .ed{font:14px/1.35 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:hidden;padding:8px;display:grid;gap:8px;grid-template-columns:minmax(0,1fr) 270px;grid-template-rows:auto auto minmax(0,1fr)}
    .ed h1{margin:0;font-size:18px}.ed .top{grid-column:1/3;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .ed button,.ed select,.ed input[type=number],.ed a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:3px 9px;cursor:pointer;text-decoration:none}
    .ed .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}.ed button[aria-pressed=true]{background:#17201d;color:#fff}
    .ed .main{display:grid;grid-template-rows:minmax(0,2fr) minmax(0,1fr);gap:8px;min-height:0;min-width:0}
    .ed .planwrap{min-height:0;min-width:0;position:relative;background:#fff;border:1px solid #cfd6d0;border-radius:10px;overflow:hidden}
    .ed canvas{display:block;touch-action:none}
    .ed .profilewrap{background:#fff;border:1px solid #cfd6d0;border-radius:10px;overflow:hidden;min-width:0}
    .ed .aside{padding-bottom:46px;display:grid;gap:8px;grid-template-rows:auto auto minmax(0,1fr);align-content:start;min-height:0;overflow:hidden}.ed .helper{position:absolute;right:10px;bottom:10px;z-index:5;width:min(400px,calc(100% - 20px));height:min(330px,calc(100% - 20px));box-sizing:border-box;box-shadow:0 6px 24px #0003;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden}.ed .helper.closed{display:none}.ed .helper textarea{min-height:56px}.ed .reply{overflow:auto;font-size:13px;min-height:0}.ed textarea{font:inherit;width:100%;box-sizing:border-box;border:1px solid #b9c2bb;border-radius:8px;padding:4px 6px;resize:none}
    .ed .panel{background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:8px;display:grid;gap:5px;align-content:start}
    .ed label{display:grid;gap:1px;font-size:13px}.ed .muted{color:#58635d;font-size:12px}.ed .ok{border-left:4px solid #0f6b5c;padding:3px 6px;background:#f3f7f4;font-weight:600;font-size:13px}.ed .bad{border-left:4px solid #c0392b;padding:3px 6px;background:#fbeeee;font-weight:600;font-size:13px}
    .ed .row{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.ed input[type=range]{width:100%;margin:0}.ed input[type=number]{width:100%;box-sizing:border-box}
    @media(max-height:700px){.ed .muted.help{display:none}}
    @media(max-width:800px){.ed{grid-template-columns:minmax(0,1fr) 220px}}`;  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'ed';
  host.appendChild(root);

  let pieces: P[] = [];
  let selected: number | null = null;
  let angle = 0, offset = 0, level = 0; // the lane: turn about the rod (radians), sideways (m), level (m)
  let view = { cx: 8, cz: 0, ppm: 36 }; // plan view: the world point in the middle, pixels per metre
  let cropMode = false;
  let verdict = '';
  const pendingObjects: Saved['pieces'] = []; // saved photo objects, loaded once the list is in

  // a new piece goes just past the last one, on the lane's line, so pieces do not pile up
  const freeSpot = (id: string) => { const m = lib(id).mesh(); const w = size(m).w * (id === 'brick' ? 15 : 1); const right = pieces.reduce((r, p) => Math.max(r, p.x + (size(p.mesh).w * p.scale) / 2), 0); return { x: right + 1.5 + w / 2, z: 0 }; };
  const lib = (id: string) => LIBRARY.find((l) => l.id === id)!;
  const add = (id: string, at = { x: 0, z: 0 }): P => { const p: P = { ...newPiece(lib(id).label, lib(id).mesh(), at), src: id }; if (id === 'brick') p.scale = 15; pieces.push(p); selected = p.id; return p; };
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Saved;
      pendingObjects.push(...s.pieces.filter((q) => q.src.startsWith('obj:')));
      pieces = s.pieces.filter((q) => !q.src.startsWith('obj:')).map((q) => (q.src === 'hold:bar' ? { ...newPiece('Bar', barMesh(), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale } : { ...newPiece(lib(q.src).label, lib(q.src).mesh(), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale }));
      angle = s.angle; offset = s.offset; level = s.level;
    } catch {
      // a first world made of real objects (no blocks): a bench, a long low box and a rail, loaded once the object list is in
      pendingObjects.push({ src: 'obj:bench-concrete.glb', x: 3, z: 0, y: 0, yaw: 0, scale: 1 }, { src: 'obj:box-skate-03.glb', x: 9, z: 0, y: 0, yaw: 0, scale: 1 }, { src: 'obj:rail-skate-01.glb', x: 16, z: 0, y: 0, yaw: 0, scale: 1 });
      selected = null;
    }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pieces: pieces.filter((p) => p.src).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale })), angle, offset, level } satisfies Saved)); } catch { /* private window */ } };
  load();

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, props: Partial<HTMLElementTagNameMap[K]> & { text?: string } = {}) => { const { text, ...rest } = props as Record<string, unknown> & { text?: string }; const e = Object.assign(document.createElement(tag), rest); if (text) e.textContent = text; parent.appendChild(e); return e as HTMLElementTagNameMap[K]; };

  const top = el('div', root, { className: 'top' });
  el('h1', top, { text: 'World editor (beta)' });
  el('a', top, { text: 'Back to the Course', href: '?', className: 'btn go' });
  const addBar = el('div', root, { className: 'top' });
  el('strong', addBar, { text: 'Basic shapes:' });
  for (const l of LIBRARY) el('button', addBar, { text: l.label }).onclick = () => { add(l.id, freeSpot(l.id)); changed(); };
  // undo and redo: a snapshot after every change (pieces are copied shallowly; a crop makes a new mesh, so old meshes stay valid)
  interface Snap { pieces: P[]; angle: number; offset: number; level: number }
  const hist: Snap[] = [];
  let hi = -1;
  const snapNow = (): Snap => ({ pieces: pieces.map((q) => ({ ...q })), angle, offset, level });
  const same = (a: Snap, b: Snap) => a.angle === b.angle && a.offset === b.offset && a.level === b.level && a.pieces.length === b.pieces.length && a.pieces.every((q, i) => { const r = b.pieces[i]; return q.id === r.id && q.x === r.x && q.z === r.z && q.y === r.y && q.yaw === r.yaw && q.scale === r.scale && q.mesh === r.mesh; });
  const remember = () => { const n = snapNow(); if (hi >= 0 && same(hist[hi], n)) return; hist.splice(hi + 1); hist.push(n); if (hist.length > 80) hist.shift(); hi = hist.length - 1; undoBtn.disabled = hi < 1; redoBtn.disabled = true; };
  const goto = (k: number) => { const t = hist[k]; if (!t) return; hi = k; pieces = t.pieces.map((q) => ({ ...q })); angle = t.angle; offset = t.offset; level = t.level; if (!pieces.some((q) => q.id === selected)) selected = null; undoBtn.disabled = hi < 1; redoBtn.disabled = hi >= hist.length - 1; changed(false); };
  const undoBtn = el('button', top, { text: 'Undo', id: 'undo', title: 'Undo (Ctrl+Z)' });
  const redoBtn = el('button', top, { text: 'Redo', id: 'redo', title: 'Redo (Ctrl+Y)' });
  undoBtn.disabled = redoBtn.disabled = true;
  undoBtn.onclick = () => goto(hi - 1); redoBtn.onclick = () => goto(hi + 1);
  // objects lifted from real photos (SAM 3D Objects, CC-38): each is a baked .glb at its real size
  const photoBar = addBar;
  void (async () => {
    try {
      const idx = (await (await fetch('/assets/objects/index.json')).json()) as { objects: { name: string; glb: string; label: string; height_m: number; author: string }[] };
      el('strong', photoBar, { text: 'From real photos:' });
      for (const o of idx.objects) {
        const b = el('button', photoBar, { text: `${o.label} (${o.height_m} m)`, title: `Photo by ${o.author}` });
        b.dataset.object = o.name;
        b.onclick = async () => {
          try {
            const p: P = { ...newPiece(o.name, readGlbMesh(await (await fetch(`/assets/objects/${o.glb}`)).arrayBuffer()), freeSpot('bench')), src: `obj:${o.glb}` };
            p.x = freeSpot('bench').x + size(p.mesh).w / 2; pieces.push(p); selected = p.id; changed();
          } catch { verdict = 'That object could not be loaded.'; draw(); }
        };
      }
      // pieces saved from a past visit
      for (const q of pendingObjects) {
        try { const p: P = { ...newPiece(q.src, readGlbMesh(await (await fetch(`/assets/objects/${q.src.slice(4)}`)).arrayBuffer()), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale }; pieces.push(p); } catch { /* a missing object is skipped */ }
      }
      if (pendingObjects.length) { pendingObjects.length = 0; changed(false); hist.length = 0; hi = -1; remember(); } // the saved or first world is the starting point of the undo list
    } catch { /* no objects on this site */ }
  })();
  // overhead: bars hanging in the air (a game, not real: they need no frame); the side view is where they are dragged
  el('strong', addBar, { text: 'Overhead:' });
  const nextX = () => pieces.reduce((r, q) => Math.max(r, q.x + (size(q.mesh).w * q.scale) / 2), 0) + 3;
  const addBarPiece = (x: number, y: number): P => { const q: P = { ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y }; pieces.push(q); selected = q.id; return q; };
  el('button', addBar, { text: 'Bar', id: 'addbar' }).onclick = () => { addBarPiece(nextX(), 2.86); changed(); };
  el('button', addBar, { text: 'Lache pair', id: 'addlache', title: 'Two bars to swing between' }).onclick = () => { const x = nextX(); addBarPiece(x, 2.86); addBarPiece(x + 3.5, 2.86); changed(); };
  // size references: a Rookie (1.75 m, T-pose) and the demo scene, so a piece can be judged against a person
  el('strong', addBar, { text: 'Size references:' });
  for (const r of [{ id: 'rookie-a', label: 'Person (1.75 m)', url: '/assets/characters/rookie-a.glb', src: 'obj:../characters/rookie-a.glb' }, { id: 'demo-scene', label: 'Demo scene', url: '/assets/demo/demo-scene.glb', src: 'obj:../demo/demo-scene.glb' }]) {
    const b = el('button', addBar, { text: r.label });
    b.dataset.object = r.id;
    b.onclick = async () => {
      try { const p: P = { ...newPiece(r.id, readGlbMesh(await (await fetch(r.url)).arrayBuffer()), freeSpot('bench')), src: r.src }; p.x = freeSpot('bench').x + size(p.mesh).w / 2; pieces.push(p); selected = p.id; changed(); } catch { verdict = 'That reference could not be loaded.'; draw(); }
    };
  }
  const file = el('input', addBar, { type: 'file', accept: '.glb' });
  file.hidden = true;
  el('button', addBar, { text: 'Import a .glb…', id: 'import' }).onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try { const p = scaleToHeight(newPiece(f.name.replace(/\.glb$/i, ''), readGlbMesh(await f.arrayBuffer()), { x: view.cx, z: view.cz }), 1); pieces.push(p); p.x = freeSpot('bench').x; selected = p.id; changed(); } catch { verdict = 'That file could not be read as a .glb.'; draw(); }
  };

  const main = el('div', root, { className: 'main' });
  const planWrap = el('div', main, { className: 'planwrap' });
  const plan = el('canvas', planWrap, { width: 900, height: 520, id: 'plan' });
  // the 3D view is the main picture; the flat plan is kept for exact dragging and cropping (button "Top plan")
  const view3d = createView3d(planWrap, {
    pieces: () => pieces, selected: () => selected, lane: () => ({ angle, offset, level }),
    select: (id) => { selected = id; drawPanel(); draw(); },
    moved: (p, x, z) => { p.x = x; p.z = z; draw(); drawProfile(); },
    dropped: () => changed(),
  });
  let topPlan = false;
  const setView = (plan2d: boolean) => { topPlan = plan2d; plan.style.display = plan2d ? 'block' : 'none'; view3d.show(!plan2d); viewBtn.textContent = plan2d ? '3D view' : 'Top plan'; viewBtn.setAttribute('aria-pressed', String(plan2d)); if (plan2d) fit(); };
  const viewBtn = el('button', top, { text: 'Top plan', id: 'viewmode', title: 'Switch between the 3D view and the flat plan (the plan is for cropping)' });
  viewBtn.onclick = () => setView(!topPlan);
  const profileWrap = el('div', main, { className: 'profilewrap' });
  const profileCanvas = el('canvas', profileWrap, { width: 900, height: 128, id: 'profile' });
  const aside = el('div', root, { className: 'aside' });
  const side = el('div', aside, { className: 'panel', id: 'panel' });
  const lanePanel = el('div', aside, { className: 'panel' });
  // ---- helpers: what to shift when the lane cannot be cleared, and a design partner (Muse Spark Open) to talk it through
  const helper = el('div', planWrap, { className: 'panel helper', id: 'helper' });
  const head = el('div', helper, { className: 'row' });
  el('strong', head, { text: 'Design partner' });
  el('button', head, { text: 'Fix it', id: 'fixit', className: 'go', title: 'Change the layout now into one the simulator can clear' }).onclick = () => runFix();
  el('button', head, { text: '✕', id: 'closehelper', title: 'Hide' }).onclick = () => { helper.classList.add('closed'); helperBtn.setAttribute('aria-pressed', 'false'); };
  const adviceBox = el('div', helper, { id: 'advice' });
  const reply = el('div', helper, { className: 'reply muted', id: 'reply', text: 'Ask for a change, or press "What should I change?".' });
  const askRow = el('div', helper, { className: 'row' });
  const ask = el('textarea', askRow, { id: 'ask', rows: 2, placeholder: 'e.g. make the gap easier, or a harder second half' });
  const sendBtn = el('button', askRow, { text: 'Ask', id: 'send', className: 'go' });
  const whatBtn = el('button', askRow, { text: 'What should I change?', id: 'what' });
  const helperBtn = el('button', top, { text: 'Design partner', id: 'helperbtn', title: 'Show or hide the design partner' });
  helperBtn.setAttribute('aria-pressed', 'true');
  helperBtn.onclick = () => { const closed = helper.classList.toggle('closed'); helperBtn.setAttribute('aria-pressed', String(!closed)); };
  function runFix() {
    reply.className = 'reply'; reply.textContent = 'Working it out…';
    setTimeout(() => {
      if (barsNow().length) {
        const rb = fixBars(pieces, { angle, offset, level });
        for (const q of rb.pieces) { const mine = pieces.find((x) => x.id === q.id); if (mine) { mine.x = q.x; mine.z = q.z; mine.y = q.y; } }
        changed();
        reply.className = rb.ok ? 'reply ok' : 'reply bad';
        reply.textContent = rb.ok ? (rb.steps.length ? 'Fixed. ' + rb.steps.join(' ') : 'It already works.') : rb.steps.join(' ');
        document.documentElement.dataset.fixed = rb.ok ? '1' : '0';
        return;
      }
      const r = fixLayout(pieces, { angle, offset, level });
      for (const q of r.pieces) { const mine = pieces.find((x) => x.id === q.id); if (mine) { mine.x = q.x; mine.z = q.z; mine.y = q.y; mine.yaw = q.yaw; mine.scale = q.scale; } }
      angle = r.lane.angle; offset = r.lane.offset; level = r.lane.level;
      changed();
      reply.className = r.ok ? 'reply ok' : 'reply bad';
      reply.textContent = r.ok ? (r.steps.length ? 'Fixed. ' + r.steps.join(' ') : 'It already works.') : 'I could not find a layout that works. ' + r.steps.join(' ') + ' Try other pieces.';
      document.documentElement.dataset.fixed = r.ok ? '1' : '0';
    }, 30);
  }
  let adviceList: Advice[] = [];
  let pendingEdits: Edit[] = [];
  const chat: { role: 'user' | 'assistant'; content: string }[] = [];
  function applyAdvice(a: Advice) {
    const p = pieces.find((q) => q.id === a.piece);
    const c = a.change;
    if (p) { p.x += c.dx ?? 0; p.z += c.dz ?? 0; p.y = Math.max(0, p.y + (c.dy ?? 0)); if (c.scale !== undefined) p.scale = c.scale; if (c.yaw !== undefined) p.yaw += c.yaw; }
    if (c.angle !== undefined) angle = c.angle;
    if (c.offset !== undefined) offset = c.offset;
    if (c.level !== undefined) level = c.level;
    changed();
  }
  function showAdvice() {
    adviceBox.textContent = '';
    for (const a of adviceList) {
      const row = el('div', adviceBox, { className: 'row' });
      el('span', row, { text: a.text });
      el('button', row, { text: 'Do it', className: 'go' }).onclick = () => applyAdvice(a);
    }
  }
  async function askPartner(text: string) {
    chat.push({ role: 'user', content: text });
    reply.className = 'reply'; reply.textContent = 'Thinking…'; sendBtn.disabled = whatBtn.disabled = true;
    try {
      const r = await fetch('/api/designer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: chat.slice(-6), world: worldBrief(pieces, { angle, offset, level }, verdict, adviceList.map((a) => a.text), barsNow()) }) });
      if (r.status === 503) { reply.className = 'reply muted'; reply.textContent = 'The design partner is switched off on this site (no key set).'; return; }
      if (!r.ok) throw new Error(String(r.status));
      const got = parseReply(((await r.json()) as { reply: string }).reply, pieces.map((q) => q.id));
      chat.push({ role: 'assistant', content: got.text });
      reply.textContent = got.text; pendingEdits = got.edits;
      if (!verdict.startsWith('The simulator can')) el('button', reply, { text: 'Fix it', className: 'go', id: 'replyfix' }).onclick = () => runFix();
      if (got.edits.length) el('button', reply, { text: `Do these ${got.edits.length} change${got.edits.length > 1 ? 's' : ''}`, className: 'go', id: 'applyedits' }).onclick = () => { applyEdits(pieces, pendingEdits); pendingEdits = []; changed(); };
    } catch { reply.className = 'reply bad'; reply.textContent = 'The design partner could not answer. Try again.'; }
    finally { sendBtn.disabled = whatBtn.disabled = false; }
  }
  sendBtn.onclick = () => { const t = ask.value.trim(); if (t) { ask.value = ''; void askPartner(t); } };
  whatBtn.onclick = () => void askPartner(verdict.startsWith('The simulator can') ? 'The lane clears. Suggest one change that makes it more interesting to run.' : 'The lane does not clear. What should I change?');

  // the two pictures fill their boxes exactly, so nothing ever scrolls
  const fit = () => {
    plan.width = Math.max(200, planWrap.clientWidth); plan.height = Math.max(120, planWrap.clientHeight);
    profileCanvas.width = Math.max(200, profileWrap.clientWidth); profileCanvas.height = Math.max(60, profileWrap.clientHeight);
    draw(); drawProfile();
  };
  new ResizeObserver(fit).observe(planWrap);
  new ResizeObserver(fit).observe(profileWrap);
  setView(false);

  // ---- the selected piece
  function drawPanel() {
    side.replaceChildren();
    const p = pieces.find((q) => q.id === selected);
    el('strong', side, { text: p ? p.name : 'No piece chosen' });
    if (!p) { el('div', side, { className: 'muted', text: 'Click a piece on the picture to choose it. Drag it to move it. Scroll to zoom, drag the background to pan.' }); return; }
    const r = realSize(p);
    el('div', side, { id: 'realsize', className: 'muted', text: `Real size: ${r.w.toFixed(2)} × ${r.d.toFixed(2)} m, ${r.h.toFixed(2)} m high (scale ×${p.scale.toPrecision(3)})` });
    const lab = el('label', side, { text: 'Real height (m): make it this tall' });
    const h = el('input', lab, { type: 'number', min: '0.02', max: '60', step: '0.05', value: r.h.toFixed(2), id: 'realheight' });
    h.onchange = () => { const v = Number(h.value); if (v > 0) { Object.assign(p, scaleToHeight(p, v)); changed(); } };
    const row = el('div', side, { className: 'row' });
    for (const [t, k] of [['× 0.5', 0.5], ['× 2', 2], ['× 10', 10]] as const) el('button', row, { text: t }).onclick = () => { Object.assign(p, scaleBy(p, k)); changed(); };
    const row2 = el('div', side, { className: 'row' });
    el('button', row2, { text: 'Turn −15°' }).onclick = () => { p.yaw -= Math.PI / 12; changed(); };
    el('button', row2, { text: 'Turn +15°' }).onclick = () => { p.yaw += Math.PI / 12; changed(); };
    const lift = el('label', side, { text: `Height off the ground: ${p.y.toFixed(2)} m` });
    const ly = el('input', lift, { type: 'range', min: '0', max: '4', step: '0.05', value: String(p.y), id: 'lift' });
    ly.oninput = () => { p.y = Number(ly.value); lift.firstChild!.textContent = `Height off the ground: ${p.y.toFixed(2)} m`; drawProfile(); };
    ly.onchange = () => changed();
    const row3 = el('div', side, { className: 'row' });
    el('button', row3, { text: 'Copy and paste', id: 'dup' }).onclick = () => { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; pieces.push(q); selected = q.id; changed(); };
    el('button', row3, { text: 'Delete', id: 'del' }).onclick = () => { pieces = pieces.filter((q) => q !== p); selected = null; changed(); };
    const cb = el('button', side, { text: cropMode ? 'Cropping: drag a box on the picture' : 'Crop…', id: 'crop' });
    cb.setAttribute('aria-pressed', String(cropMode));
    cb.onclick = () => { cropMode = !cropMode; drawPanel(); };
  }

  // ---- the lane
  function drawLanePanel() {
    lanePanel.replaceChildren();
    el('strong', lanePanel, { text: 'The lane the runner takes' });
    const slider = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const l = el('label', lanePanel, { text: `${label}: ${fmt(get())}` });
      const i = el('input', l, { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(get()) });
      i.oninput = () => { set(Number(i.value)); l.firstChild!.textContent = `${label}: ${fmt(get())}`; draw(); drawProfile(); };
      i.onchange = () => { save(); verify(); };
    };
    slider('Turn about the rod', 'angle', 0, 180, 5, () => Math.round((angle * 180) / Math.PI), (v) => (angle = (v * Math.PI) / 180), (v) => `${v}°`);
    slider('Sideways', 'offset', -30, 30, 0.5, () => offset, (v) => (offset = v), (v) => `${v.toFixed(1)} m`);
    slider('Where the water starts (level)', 'level', 0, 4, 0.05, () => level, (v) => (level = v), (v) => `${v.toFixed(2)} m`);
    el('button', lanePanel, { text: 'Find the best lane for me', id: 'best' }).onclick = () => {
      const s = worldSamples(ground());
      const found = bestSlices({ positions: Array.from(s) }, { top: 1, levels: [level], centre: { x: 0, z: 0 } }); // the editor's rod is the origin, so the lane it finds is the lane it shows
      if (!found.length) { verdict = 'No lane the runner can clear was found: try other pieces or levels.'; drawLanePanel(); return; }
      angle = found[0].angle; offset = found[0].offset; level = found[0].level; verdict = '';
      save(); drawLanePanel(); draw(); drawProfile(); verify();
    };
    const play = el('button', lanePanel, { text: 'Play this lane', className: 'go', id: 'play' });
    play.onclick = () => {
      const course = courseNow();
      if (!searchIdealRun(course).cleared) { verdict = 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; drawLanePanel(); return; }
      // the real objects are drawn in the game instead of blocks (a cropped photo object is drawn whole; its collision is still the cropped lane)
      course.scene = sceneFor(ground(), { angle, offset, level }, course.uMap ?? []);
      root.remove(); style.remove();
      void startCourse(document.body, course);
    };
    const testBtn = el('button', lanePanel, { text: 'Test from the selected piece', id: 'testhere', title: 'Start the runner a few metres before the selected piece and play from there' });
    testBtn.onclick = () => {
      const q = pieces.find((x) => x.id === selected);
      const course = courseNow();
      if (!q) { verdict = 'Select a piece first: the test starts just before it.'; drawLanePanel(); return; }
      course.scene = sceneFor(ground(), { angle, offset, level }, course.uMap ?? []);
      const gx = isHold(q) ? (course.holds?.[barsNow().findIndex((b) => b.id === q.id)]?.x ?? 0) : sceneFor([q], { angle, offset, level }, course.uMap ?? [])[0]?.x ?? 0;
      // start on the ground about 8 m before it (on the nearest ground at or before that spot)
      const want = Math.max(course.startX, gx - 8);
      const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
      const on = ps.find((r) => want >= r.x0 && want <= r.x1);
      course.startX = on ? want : Math.max(course.startX, (ps.filter((r) => r.x1 <= want).pop()?.x1 ?? course.startX) - 1);
      root.remove(); style.remove();
      void startCourse(document.body, course);
    };
    el('div', lanePanel, { id: 'verdict', className: verdict.startsWith('The simulator can') ? 'ok' : verdict ? 'bad' : 'muted', text: verdict });
    el('div', lanePanel, { className: 'muted help', text: 'The runner goes left to right along the orange band; the shapes in it are what you see underneath.' });
  }

  const ground = () => pieces.filter((q) => !isHold(q)); // bars are not ground
  const currentProfile = () => sliceProfile(worldSamples(ground()), { x: 0, z: 0 }, { angle, offset, level });
  const barsNow = () => holdsOf(pieces, { angle, offset, level });
  const courseNow = () => laneToCourse(currentProfile(), 'My world', barsNow());
  let verifyTimer = 0, adviceRun = 0;
  function verify() {
    clearTimeout(verifyTimer);
    verifyTimer = window.setTimeout(() => {
      const p = currentProfile();
      if (p.length < 8) { verdict = 'Nothing is in the lane: move the lane or the pieces.'; }
      else { const r = describeLane(p); verdict = searchIdealRun(laneToCourse(p, 'My world', barsNow())).cleared ? `The simulator can clear this lane (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces, ${r.length.toFixed(0)} m).` : 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; }
      const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
      if (v) { v.textContent = verdict; v.className = verdict.startsWith('The simulator can') ? 'ok' : 'bad'; }
      document.documentElement.dataset.verdict = verdict;
      // when it cannot be cleared, say what to shift (each suggestion was proved by the simulator)
      adviceList = []; showAdvice();
      if (!verdict.startsWith('The simulator can') && p.length >= 8 && barsNow().length) {
        adviceBox.textContent = 'This lane has bars. Drag them in the side view (position and height), or press Fix it to try small moves of the bars.';
      } else if (!verdict.startsWith('The simulator can') && p.length >= 8) {
        const mine = ++adviceRun;
        setTimeout(() => { if (mine !== adviceRun) return; adviceList = adviseLane(pieces, { angle, offset, level }); showAdvice(); if (!adviceList.length) adviceBox.textContent = 'No single small shift clears it. Press "What should I change?" to think it through together.'; document.documentElement.dataset.advice = String(adviceList.length); }, 30);
      } else document.documentElement.dataset.advice = '0';
    }, 350);
  }

  // ---- drawing
  const sx = (x: number) => plan.width / 2 + (x - view.cx) * view.ppm;
  const sz = (z: number) => plan.height / 2 + (z - view.cz) * view.ppm;
  const wx = (px: number) => (px - plan.width / 2) / view.ppm + view.cx;
  const wz = (py: number) => (py - plan.height / 2) / view.ppm + view.cz;
  const COLORS = ['#c9893b', '#6fa3c9', '#8bb36b', '#b779b0', '#d96a5b', '#7b8f9c'];
  function draw() {
    view3d.sync();
    const c = plan.getContext('2d')!;
    c.clearRect(0, 0, plan.width, plan.height);
    c.strokeStyle = '#e3e8e4'; c.lineWidth = 1; c.fillStyle = '#58635d'; c.font = '11px system-ui';
    const step = view.ppm > 25 ? 1 : view.ppm > 8 ? 5 : 20;
    for (let x = Math.floor(wx(0) / step) * step; x < wx(plan.width); x += step) { c.beginPath(); c.moveTo(sx(x), 0); c.lineTo(sx(x), plan.height); c.stroke(); if (x % (step * 2) === 0) c.fillText(`${x} m`, sx(x) + 2, 12); }
    for (let z = Math.floor(wz(0) / step) * step; z < wz(plan.height); z += step) { c.beginPath(); c.moveTo(0, sz(z)); c.lineTo(plan.width, sz(z)); c.stroke(); }
    // the lane: a band 2 m wide through the rod's turn and sideways step
    c.save(); c.translate(sx(0), sz(0)); c.rotate(angle);
    c.fillStyle = '#f0a02033'; c.fillRect(-400 * view.ppm, (offset - HALF_LANE) * view.ppm, 800 * view.ppm, 2 * HALF_LANE * view.ppm);
    c.strokeStyle = '#f0a020'; c.lineWidth = 2; c.beginPath(); c.moveTo(-400 * view.ppm, offset * view.ppm); c.lineTo(400 * view.ppm, offset * view.ppm); c.stroke();
    c.restore();
    c.fillStyle = '#17201d'; c.beginPath(); c.arc(sx(0), sz(0), 5, 0, 7); c.fill(); c.fillText('rod', sx(0) + 8, sz(0) - 6);
    pieces.forEach((p, i) => {
      const s = size(p.mesh);
      c.save(); c.translate(sx(p.x), sz(p.z)); c.rotate(p.yaw);
      const w = s.w * p.scale * view.ppm, d = s.d * p.scale * view.ppm;
      c.fillStyle = COLORS[i % COLORS.length] + (p.id === selected ? 'dd' : '99'); c.fillRect(-w / 2, -d / 2, w, d);
      c.strokeStyle = p.id === selected ? '#0f6b5c' : '#17201d'; c.lineWidth = p.id === selected ? 3 : 1; c.strokeRect(-w / 2, -d / 2, w, d);
      c.restore();
      c.fillStyle = '#17201d'; c.font = '12px system-ui'; c.fillText(`${p.name} ${(s.h * p.scale + p.y).toFixed(2)} m`, sx(p.x) - 28, sz(p.z) + 4);
    });
    if (rubber) { c.strokeStyle = '#0f6b5c'; c.setLineDash([5, 4]); c.strokeRect(sx(rubber.x0), sz(rubber.z0), (rubber.x1 - rubber.x0) * view.ppm, (rubber.z1 - rubber.z0) * view.ppm); c.setLineDash([]); }
  }
  // the side view: the lane's ground, the bars (drag them here), and where a person can reach
  let sideMap = { uMin: 0, ppm: 20, ph: 20, base: 100 };
  function drawProfile() {
    const c = profileCanvas.getContext('2d')!;
    const W = profileCanvas.width, H = profileCanvas.height;
    c.clearRect(0, 0, W, H);
    const prof = currentProfile();
    const bars = barsNow();
    const o = prof.origin ?? 0;
    const uLo = Math.min(prof.length ? o : 0, ...bars.map((b) => b.u));
    const uHi = Math.max(prof.length ? o + prof.length : -Infinity, ...bars.map((b) => b.u), uLo + 10);
    c.fillStyle = '#58635d'; c.font = '12px system-ui';
    c.fillText('What the runner sees: the lane from the side (water at the bottom, grid every metre). Drag a bar to move it.', 8, 14);
    const base = H - 14, ppm = Math.min(30, (W - 40) / Math.max(10, uHi - uLo + 1)), ph = Math.max(14, (base - 24) / 4.3);
    sideMap = { uMin: uLo, ppm, ph, base };
    c.fillStyle = '#cfe3f5'; c.fillRect(0, base, W, 14);
    c.strokeStyle = '#e3e8e4';
    for (let m = 0; m < 5; m++) { c.beginPath(); c.moveTo(0, base - m * ph); c.lineTo(W, base - m * ph); c.stroke(); }
    // reach guide: what hands can grab standing and with a jump (the simulator's own numbers)
    c.setLineDash([6, 4]); c.lineWidth = 1.5; c.font = '11px system-ui';
    for (const [h, col, label] of [[REACH_STANDING, '#2f9e5b', 'hands reach standing'], [REACH_JUMPING, '#c9951b', 'hands reach with a jump']] as [number, string, string][]) {
      c.strokeStyle = col; c.fillStyle = col; c.beginPath(); c.moveTo(0, base - h * ph); c.lineTo(W, base - h * ph); c.stroke(); c.fillText(`${label} (${h} m)`, W - 190, base - h * ph - 3);
    }
    c.setLineDash([]);
    c.fillStyle = '#17201d'; c.strokeStyle = '#17201d'; c.lineWidth = 2;
    c.beginPath();
    let pen = false;
    prof.cells.forEach((h, i) => { if (h === null) { pen = false; return; } const x = 10 + (o - uLo + i * CELL) * ppm, y = base - h * ph; if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); });
    c.stroke();
    for (const b of bars) {
      const x = 10 + (b.u - uLo) * ppm, y = base - b.y * ph, sel = b.id === selected;
      c.strokeStyle = '#c9ced4'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.stroke();
      c.strokeStyle = sel ? '#0f6b5c' : '#f0a020'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke();
      c.fillStyle = '#17201d'; c.fillText(`${b.y.toFixed(2)} m`, x + 12, y - 8);
    }
    document.documentElement.dataset.laneLength = String(prof.length.toFixed(1));
    document.documentElement.dataset.bars = String(bars.length);
    document.documentElement.dataset.barPx = JSON.stringify(bars.map((b) => [10 + (b.u - uLo) * ppm, base - b.y * ph]));
    document.documentElement.dataset.barYs = JSON.stringify(bars.map((b) => Number(b.y.toFixed(2))));
  }
  const barAtPx = (px: number, py: number) => barsNow().find((b) => Math.hypot(10 + (b.u - sideMap.uMin) * sideMap.ppm - px, sideMap.base - b.y * sideMap.ph - py) < 16);
  let barDrag: { p: P } | null = null;
  profileCanvas.addEventListener('pointerdown', (e) => {
    const r = profileCanvas.getBoundingClientRect();
    const b = barAtPx(e.clientX - r.left, e.clientY - r.top);
    const p = b && pieces.find((q) => q.id === b.id);
    if (!p) return;
    selected = p.id; barDrag = { p }; profileCanvas.setPointerCapture(e.pointerId); drawPanel(); draw(); drawProfile();
  });
  profileCanvas.addEventListener('pointermove', (e) => {
    const r = profileCanvas.getBoundingClientRect();
    if (!barDrag) { profileCanvas.style.cursor = barAtPx(e.clientX - r.left, e.clientY - r.top) ? 'grab' : 'default'; return; }
    const p = barDrag.p, c = Math.cos(angle), s = Math.sin(angle);
    const u = Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 20) / 20;
    const y = Math.min(4.3, Math.max(0.35, Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph - 0.04) * 20) / 20));
    const v = -p.x * s + p.z * c; // keep the sideways place, move along the run
    p.x = u * c - v * s; p.z = u * s + v * c; p.y = y;
    draw(); drawProfile();
  });
  const endBar = () => { if (!barDrag) return; barDrag = null; changed(); };
  profileCanvas.addEventListener('pointerup', endBar); profileCanvas.addEventListener('pointercancel', endBar);

  // ---- the mouse on the picture
  let rubber: { x0: number; z0: number; x1: number; z1: number } | null = null;
  let drag: { kind: 'move' | 'pan' | 'rubber'; p?: P; ox: number; oz: number; sx0: number; sz0: number; cx: number; cz: number } | null = null;
  plan.addEventListener('pointerdown', (e) => {
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    plan.setPointerCapture(e.pointerId);
    if (cropMode && selected !== null) { drag = { kind: 'rubber', ox: x, oz: z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    const hit = [...pieces].reverse().find((p) => hits(p, x, z));
    if (hit) { selected = hit.id; drag = { kind: 'move', p: hit, ox: x - hit.x, oz: z - hit.z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; }
    else { selected = null; drag = { kind: 'pan', ox: 0, oz: 0, sx0: px, sz0: py, cx: view.cx, cz: view.cz }; }
    drawPanel(); draw();
  });
  plan.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (drag.kind === 'move' && drag.p) { drag.p.x = Math.round((wx(px) - drag.ox) * 20) / 20; drag.p.z = Math.round((wz(py) - drag.oz) * 20) / 20; draw(); drawProfile(); }
    else if (drag.kind === 'pan') { view.cx = drag.cx - (px - drag.sx0) / view.ppm; view.cz = drag.cz - (py - drag.sz0) / view.ppm; draw(); }
    else if (drag.kind === 'rubber' && rubber) { rubber = { x0: Math.min(drag.ox, wx(px)), z0: Math.min(drag.oz, wz(py)), x1: Math.max(drag.ox, wx(px)), z1: Math.max(drag.oz, wz(py)) }; draw(); }
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'rubber' && rubber && selected !== null) {
      const p = pieces.find((q) => q.id === selected);
      if (p && rubber.x1 - rubber.x0 > 0.05 && rubber.z1 - rubber.z0 > 0.05) {
        // the box in the piece's own units: the four corners turned back, then their bounds
        const c = Math.cos(-p.yaw), s = Math.sin(-p.yaw), xs: number[] = [], zs: number[] = [];
        for (const [x, z] of [[rubber.x0, rubber.z0], [rubber.x1, rubber.z0], [rubber.x1, rubber.z1], [rubber.x0, rubber.z1]]) { const dx = x - p.x, dz = z - p.z; xs.push((dx * c - dz * s) / p.scale); zs.push((dx * s + dz * c) / p.scale); }
        const cut = crop(p, { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) });
        if (cut) { Object.assign(p, cut, { id: p.id }); } else verdict = 'Nothing of the piece is inside that box.';
      }
      rubber = null; cropMode = false; changed(); return;
    }
    changed();
  };
  plan.addEventListener('pointerup', end); plan.addEventListener('pointercancel', end);
  plan.addEventListener('wheel', (e) => { e.preventDefault(); view.ppm = Math.min(120, Math.max(2, view.ppm * Math.exp(-e.deltaY * 0.001))); draw(); }, { passive: false });
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); goto(e.shiftKey ? hi + 1 : hi - 1); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); goto(hi + 1); return; }
    if (e.code === 'KeyT') location.href = '?';
    const p = pieces.find((q) => q.id === selected);
    if (!p) return;
    if (e.code === 'Delete' || e.code === 'Backspace') { pieces = pieces.filter((q) => q !== p); selected = null; changed(); }
    if (e.code === 'KeyD') { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; pieces.push(q); selected = q.id; changed(); }
  });

  function changed(record = true) { if (record) remember(); document.documentElement.dataset.pieces = String(pieces.length); save(); drawPanel(); drawLanePanel(); draw(); drawProfile(); verify(); }
  drawPanel(); drawLanePanel(); draw(); drawProfile(); verify();
  remember();
  document.documentElement.dataset.pieces = String(pieces.length);
  return { backend: 'webgl2' };
}
