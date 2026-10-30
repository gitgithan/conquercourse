// "Make an object from my photo" (CC-221): pick a photo, draw a box round one thing, say what it is, and a few minutes later it is a 3D piece.
// Behind a feature switch (?uploadobj=1) so new players are not shown everything at once. Desktop mouse and keyboard.
import { liftObject, shrinkPhoto, type LiftDone, type Shrunk } from '../slice/object-lift-client';
import { LABEL_RE, MIN_BOX } from '../slice/object-lift';
import { pageSearch } from '../flags';

export const uploadObjOn = (search = pageSearch()): boolean => /[?&]uploadobj(=1|\b(?!=))/.test(search);
const LABELS = ['bench', 'bollard', 'railing', 'stairs', 'trash bin', 'bicycle rack', 'pull-up bar', 'fire hydrant', 'planter', 'log', 'stump', 'wall'];

export function openPhotoObject(onDone: (r: LiftDone) => void): void {
  const shade = Object.assign(document.createElement('div'), { id: 'photoobj' });
  shade.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50;display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif';
  const card = document.createElement('div');
  card.style.cssText = 'background:#1b1f27;color:#eee;border-radius:10px;padding:16px;width:min(760px,94vw);max-height:92vh;overflow:auto';
  shade.appendChild(card);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '', props: Record<string, unknown> = {}): HTMLElementTagNameMap[K] => { const e = Object.assign(document.createElement(tag), props); if (text) e.textContent = text; parent.appendChild(e); return e; };
  el('strong', card, 'Make an object from my photo');
  el('div', card, 'Pick a photo of one real thing (a bench, a rail, a bar). Draw a box round it. People in the photo are blurred, and the photo is not kept.').style.margin = '6px 0 10px';
  const file = el('input', card, '', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'pofile' });
  const stage = el('div', card); stage.style.cssText = 'position:relative;margin:10px 0;user-select:none;touch-action:none';
  const form = el('div', card); form.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:end';
  const lab = el('input', el('label', form, 'What is it? '), '', { id: 'polabel', placeholder: 'bench' });
  lab.setAttribute('list', 'pol');
  const dl = el('datalist', form, '', { id: 'pol' }); LABELS.forEach((l) => el('option', dl, '', { value: l }));
  const hgt = el('input', el('label', form, 'Height in metres (optional) '), '', { id: 'poheight', type: 'number', min: '0.1', max: '6', step: '0.05', placeholder: 'typical' });
  hgt.style.width = '6em';
  const go = el('button', form, 'Make the 3D object', { id: 'pogo' });
  const close = el('button', form, 'Close', { id: 'poclose' });
  const msg = el('div', card, '', { id: 'pomsg' }); msg.style.cssText = 'margin-top:10px;min-height:2.4em';
  const retry = el('button', card, 'Try again', { id: 'poretry' }); retry.hidden = true;
  const ctl = new AbortController();
  close.onclick = () => { ctl.abort(); shade.remove(); };
  let photo: Shrunk | null = null;
  let box: [number, number, number, number] | null = null;
  let boxEl: HTMLDivElement | null = null;
  go.disabled = true;
  const sync = () => { go.disabled = !photo || !box || !LABEL_RE.test(lab.value.trim().toLowerCase().replace(/\s+/g, ' ')); };
  lab.oninput = sync;

  file.onchange = async () => {
    const f = file.files?.[0]; if (!f) return;
    msg.textContent = 'Reading the photo.';
    try { photo = await shrinkPhoto(f); } catch { msg.textContent = 'We could not read that photo. Try a JPEG.'; return; }
    box = null; boxEl = null; stage.replaceChildren();
    const img = el('img', stage, '', { src: photo.image, alt: 'your photo', draggable: false }); img.style.cssText = 'max-width:100%;max-height:52vh;display:block;cursor:crosshair';
    msg.textContent = 'Drag on the photo to draw a box round the object.';
    let start: { x: number; y: number } | null = null;
    const pos = (e: PointerEvent) => { const r = img.getBoundingClientRect(); return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width), y: Math.min(Math.max(e.clientY - r.top, 0), r.height), r }; };
    img.onpointerdown = (e) => { const p = pos(e); start = { x: p.x, y: p.y }; img.setPointerCapture(e.pointerId); boxEl?.remove(); boxEl = el('div', stage); boxEl.style.cssText = 'position:absolute;border:2px solid #ff9f1c;background:rgba(255,159,28,.15);pointer-events:none'; };
    img.onpointermove = (e) => {
      if (!start || !boxEl) return;
      const p = pos(e); const x0 = Math.min(start.x, p.x), y0 = Math.min(start.y, p.y);
      Object.assign(boxEl.style, { left: `${x0}px`, top: `${y0}px`, width: `${Math.abs(p.x - start.x)}px`, height: `${Math.abs(p.y - start.y)}px` });
      const k = photo!.width / p.r.width;
      box = [Math.round(x0 * k), Math.round(y0 * k), Math.round(Math.max(start.x, p.x) * k), Math.round(Math.max(start.y, p.y) * k)];
    };
    img.onpointerup = () => { start = null; if (box && (box[2] - box[0] < MIN_BOX || box[3] - box[1] < MIN_BOX)) { box = null; boxEl?.remove(); msg.textContent = 'That box is tiny. Draw it round the whole object.'; } else if (box) msg.textContent = 'Say what it is, then press the button.'; sync(); };
    sync();
  };

  const run = async () => {
    if (!photo || !box) return;
    go.disabled = true; retry.hidden = true; file.disabled = true;
    const h = hgt.value.trim() ? Number(hgt.value) : null;
    try {
      const r = await liftObject({ photo, box, label: lab.value.trim().toLowerCase().replace(/\s+/g, ' '), height_m: h }, (s) => { msg.textContent = s; }, ctl.signal);
      msg.textContent = `Done in ${r.seconds} s. ${r.privacy.people ? 'People in the photo were blurred. ' : ''}${r.notes.join(' ')} It is saved in this browser: look for "Mine: ${r.prov.name}" in the piece list.`;
      onDone(r);
      setTimeout(() => shade.remove(), 1800);
    } catch (e) {
      msg.textContent = (e as Error).message; const final = (e as { final?: boolean }).final === true; retry.hidden = final; go.disabled = final; file.disabled = false;
    }
  };
  go.onclick = run; retry.onclick = run;
  document.body.appendChild(shade);
}
