// The "Mark it yourself" tool (CC-133): drag a rectangle on the photo, nudge it with the arrow keys, name it, confirm.
// Mouse: drag on the photo. Keyboard: Tab to the photo layer, Enter starts a box in the middle, arrows move it, Shift+arrows resize it, Enter confirms, Esc cancels.
// All the rules (size, people, label) are in src/slice/markbox.ts; this file only draws and listens.
import { MARK_LABELS, boxFromCorners, markProblem, nudge, photoToScreen, screenToPhoto, startBox, type Box } from '../slice/markbox';

export interface MarkOpts { stage: HTMLElement; img: HTMLImageElement; width: number; height: number; people: Box[]; onUse: (box: Box, label: string) => void; onClose: () => void }

export function openMarkTool(o: MarkOpts): { close: () => void } {
  const { stage, img, width: W, height: H } = o;
  let box: Box | null = null, drag: { x: number; y: number } | null = null, naming = false;
  const layer = document.createElement('div');
  layer.className = 'markzone'; layer.id = 'markzone'; layer.tabIndex = 0; layer.setAttribute('role', 'application');
  layer.setAttribute('aria-label', 'Mark it yourself. Press Enter to start a box. Arrow keys move it, Shift with arrows makes it bigger or smaller, Enter to use it, Escape to cancel.');
  const rectEl = document.createElement('div'); rectEl.className = 'markrect'; rectEl.id = 'markrect'; rectEl.hidden = true;
  layer.append(rectEl);
  stage.append(layer);
  const panel = document.createElement('div'); panel.className = 'markpanel'; panel.id = 'markpanel';
  stage.after(panel);
  const help = document.createElement('div'); help.className = 'muted'; help.id = 'markhelp'; panel.append(help);
  const msg = document.createElement('div'); msg.className = 'err'; msg.id = 'markmsg'; msg.setAttribute('role', 'alert'); panel.append(msg);
  const say = (t: string, bad = false) => { (bad ? msg : help).textContent = t; if (bad) help.textContent = ''; else msg.textContent = ''; };
  say('Drag a rectangle round the thing you want. Without a mouse, press Enter on the photo, then use the arrow keys. Press Escape to cancel.');

  const rect = () => img.getBoundingClientRect();
  const show = () => {
    if (!box) { rectEl.hidden = true; return; }
    const r = rect(), s = photoToScreen(box, { left: 0, top: 0, width: r.width, height: r.height }, W, H);
    Object.assign(rectEl.style, { left: `${s.left}px`, top: `${s.top}px`, width: `${s.width}px`, height: `${s.height}px` });
    rectEl.hidden = false;
  };
  const pt = (e: PointerEvent) => screenToPhoto({ x: e.clientX, y: e.clientY }, rect(), W, H);
  layer.onpointerdown = (e) => { if (naming) return; layer.setPointerCapture(e.pointerId); drag = pt(e); box = null; show(); say(''); };
  layer.onpointermove = (e) => { if (!drag) return; box = boxFromCorners(drag, pt(e), W, H); show(); };
  layer.onpointerup = (e) => {
    if (!drag) return; box = boxFromCorners(drag, pt(e), W, H); drag = null; show();
    const bad = markProblem(box, W, H, o.people, 'bar'); // the label is asked for next, so only size and people are judged here
    if (bad && !/few letters/.test(bad)) { say(bad, true); box = null; show(); return; }
    askName();
  };
  layer.onkeydown = (e) => {
    if (naming) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (!box) { box = startBox(W, H); show(); say('Move the box with the arrow keys, make it bigger or smaller with Shift and the arrow keys, then press Enter.'); } else askName(); return; }
    if (e.key.startsWith('Arrow') && box) { e.preventDefault(); box = nudge(box, e.key, e.shiftKey, W, H); show(); }
  };

  function askName() {
    if (!box) return;
    const bad = markProblem(box, W, H, o.people, 'bar');
    if (bad) { say(bad, true); return; }
    naming = true; say('What is it? Pick a word or type your own.');
    const row = document.createElement('div'); row.className = 'row'; row.id = 'markname';
    const input = document.createElement('input'); input.id = 'marklabel'; input.maxLength = 30; input.placeholder = 'bar'; input.setAttribute('aria-label', 'What is it called'); input.setAttribute('list', 'marklist');
    const dl = document.createElement('datalist'); dl.id = 'marklist'; for (const l of MARK_LABELS) dl.append(Object.assign(document.createElement('option'), { value: l }));
    row.append(input, dl);
    for (const l of MARK_LABELS) { const b = document.createElement('button'); b.type = 'button'; b.textContent = l; b.dataset.label = l; b.onclick = () => { input.value = l; input.focus(); }; row.append(b); }
    const use = document.createElement('button'); use.type = 'button'; use.className = 'go'; use.id = 'markuse'; use.textContent = 'Use this box';
    const back = document.createElement('button'); back.type = 'button'; back.id = 'markredo'; back.textContent = 'Draw it again';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'markcancel'; cancel.textContent = 'Cancel';
    row.append(use, back, cancel); panel.append(row);
    const finish = () => {
      const label = input.value.trim().toLowerCase();
      const why = markProblem(box as Box, W, H, o.people, label);
      if (why) { say(why, true); return; }
      o.onUse(box as Box, label); close();
    };
    use.onclick = finish; cancel.onclick = close;
    back.onclick = () => { row.remove(); naming = false; box = null; show(); say('Drag a rectangle round the thing you want.'); layer.focus(); };
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } };
    input.focus();
  }
  function close() { layer.remove(); panel.remove(); o.onClose(); }
  layer.focus();
  return { close };
}
