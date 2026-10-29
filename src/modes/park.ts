import { edgeNote } from '../slice/photo-edge';
import { startCourse } from './course';
import { session } from '../ui/feedback';
import { PHRASES, fitPrimitives, proveCourse, type ParkObject, type Proof, type Primitive } from '../park/fit';

// The Park: a photo with boxes over it (from the saved SAM 3.1 results, or drawn by the player), turned into
// a course with real sizes that the Course mode plays. Works with no network: the boxes are editable.
const PHOTOS = [
  { id: 'park01', label: 'Skatepark stairs and rail' },
  { id: 'park02', label: 'Skatepark ledge and rail' },
  { id: 'park03', label: 'Skatepark boxes' },
  { id: 'park06', label: 'Park stairs' },
  { id: 'park07', label: 'Mansion park steps' },
];

interface PhotoData { photo: string; file: string; width: number; height: number; credit: string; objects: ParkObject[] }

export function startPark(host: HTMLElement): { backend: 'webgl2' } {
  const params = new URLSearchParams(location.search);
  const style = document.createElement('style');
  style.textContent = `
    .park{font:16px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:16px;display:grid;gap:12px;grid-auto-rows:min-content;align-content:start}.park>*{max-width:1100px;width:100%;justify-self:center;box-sizing:border-box}
    .park h1{margin:0;font-size:24px}.park .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .park button,.park select{font:inherit;border:1px solid #b9c2bb;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
    .park button[aria-pressed=true]{background:#17201d;color:#fff}.park .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}
    .park .stage{position:relative;width:100%;max-width:900px;user-select:none;touch-action:none;border:1px solid #cfd6d0}
    .park .stage img{display:block;width:100%;height:auto;pointer-events:none}
    .park .box{position:absolute;border:3px solid #f0a020;background:#f0a02025;box-sizing:border-box;cursor:move}
    .park .box.sel{border-color:#0f6b5c;background:#0f6b5c30}
    .park .box span{position:absolute;left:-3px;top:-24px;background:#17201d;color:#fff;font-size:13px;padding:1px 6px;border-radius:4px;white-space:nowrap}
    .park .box i{position:absolute;right:-8px;bottom:-8px;width:16px;height:16px;background:#0f6b5c;border:2px solid #fff;border-radius:4px;cursor:nwse-resize}
    .park .panel{background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:12px;display:grid;gap:8px}
    .park table{border-collapse:collapse;width:100%}.park td,.park th{text-align:left;padding:4px 8px;border-bottom:1px solid #e3e8e4;font-size:15px}
    .park .ok{border-left:4px solid #0f6b5c;padding:6px 10px;background:#f3f7f4;font-weight:600}.park .bad{border-left:4px solid #c0392b;padding:6px 10px;background:#fbeeee;font-weight:600}
    .park .muted{color:#58635d;font-size:14px}`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'park';
  host.appendChild(root);

  let data: PhotoData | null = null;
  let boxes: ParkObject[] = [];
  let selected: number | null = null;
  let nextId = 100;
  let proof: Proof | null = null;
  let lastKind = 'steps'; // what a newly drawn box is, until it is changed

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = (tag: string, props: Record<string, any> = {}, ...kids: (Node | string)[]): any => {
    const { cls, ...rest } = props;
    const n = Object.assign(document.createElement(tag), rest);
    if (cls) n.className = cls;
    n.append(...kids);
    return n;
  };

  const title = el('h1', { textContent: 'The Park: photo in, course out' });
  const intro = el('div', { cls: 'muted', textContent: 'Pick a photo, or use your own. Drag on the picture to draw a box around a real obstacle (or move and resize the orange boxes), say what it is, and type its real height if you know it. Then make your course.' });
  const picker = el('div', { cls: 'bar' });
  const stage = el('div', { cls: 'stage' });
  const tools = el('div', { cls: 'bar' });
  const out = el('div', { cls: 'panel' });
  out.hidden = true;
  const credit = el('div', { cls: 'muted' });
  const paint = el('input', { type: 'checkbox', id: 'paint', checked: true }); // paint the photo's pictures on the obstacles in the game
  root.append(title, intro, picker, stage, tools, out, credit);

  // your own photo: shrunk and re-saved as a jpeg in the browser, which also drops any location data it carried
  const file = el('input', { type: 'file', accept: 'image/*', id: 'upload' });
  file.hidden = true;
  const own = el('button', { textContent: 'Use my own photo', id: 'own' });
  own.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try { await loadOwn(f); } catch { credit.textContent = 'That file could not be read as a photo.'; }
  };
  picker.append(own, file, el('a', { href: '?mode=editor', textContent: 'World editor →', style: 'margin-left:auto' }), el('a', { href: '?mode=gallery', textContent: 'Community courses →' }));

  PHOTOS.forEach((p) => {
    const b = el('button', { textContent: p.label, id: `pick-${p.id}` });
    b.onclick = () => void load(p.id);
    picker.appendChild(b);
  });

  async function loadOwn(f: File) {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    let q = 0.85, url = cv.toDataURL('image/jpeg', q);
    while (url.length > 440_000 && q > 0.3) { q -= 0.1; url = cv.toDataURL('image/jpeg', q); }
    if (url.length > 440_000) throw new Error('too big');
    data = { photo: 'upload', file: url, width: w, height: h, credit: 'your photo', objects: [] };
    boxes = []; selected = null; proof = null; out.hidden = true;
    picker.querySelectorAll('button').forEach((b: Element) => b.setAttribute('aria-pressed', 'false'));
    credit.textContent = 'Your photo stays in your browser until you choose to share the course.';
    drawStage(); drawTools();
  }

  async function load(id: string) {
    const r = await fetch(`/assets/park/${id}.objects.json`);
    data = (await r.json()) as PhotoData;
    boxes = data.objects.map((o) => ({ ...o, box: [...o.box] as ParkObject['box'] }));
    selected = null; proof = null; out.hidden = true;
    picker.querySelectorAll('button').forEach((b: Element) => b.setAttribute('aria-pressed', String(b.id === `pick-${id}`)));
    credit.textContent = `Photo: ${data.credit}. Boxes from SAM 3.1 (saved results); you can change them.`;
    drawStage();
    drawTools();
  }

  function drawStage() {
    if (!data) return;
    const d = data;
    stage.replaceChildren(el('img', { src: d.file.startsWith('data:') ? d.file : `/assets/park/${d.file}`, alt: 'a park photo' }));
    for (const o of boxes) {
      const [x0, y0, x1, y1] = o.box;
      const b = el('div', { cls: 'box' + (o.id === selected ? ' sel' : '') }, el('span', { textContent: `${o.phrase}` }), el('i'));
      b.dataset.id = String(o.id);
      b.style.left = `${(x0 / d.width) * 100}%`; b.style.top = `${(y0 / d.height) * 100}%`;
      b.style.width = `${((x1 - x0) / d.width) * 100}%`; b.style.height = `${((y1 - y0) / d.height) * 100}%`;
      stage.appendChild(b);
    }
  }

  // drag to move, drag the corner to resize
  stage.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!data) return;
    const t = e.target as HTMLElement;
    const boxEl = t.closest('.box') as HTMLElement | null;
    if (!boxEl) {
      // drag on the empty picture to draw a new box
      selected = null;
      const rect0 = stage.getBoundingClientRect(), k0 = data.width / rect0.width;
      const x0 = (e.clientX - rect0.left) * k0, y0 = (e.clientY - rect0.top) * k0;
      const d0 = data;
      const o: ParkObject = { id: nextId++, phrase: lastKind, box: [x0, y0, x0, y0].map(Math.round) as ParkObject['box'], score: 1 };
      let drawn = false;
      const move0 = (ev: PointerEvent) => {
        const x1 = Math.min(d0.width, Math.max(0, (ev.clientX - rect0.left) * k0)), y1 = Math.min(d0.height, Math.max(0, (ev.clientY - rect0.top) * k0));
        o.box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)].map(Math.round) as ParkObject['box'];
        if (!drawn && Math.hypot(x1 - x0, y1 - y0) > 12) { drawn = true; boxes.push(o); selected = o.id; }
        if (drawn) drawStage();
      };
      const up0 = () => { removeEventListener('pointermove', move0); removeEventListener('pointerup', up0); if (drawn && (o.box[2] - o.box[0] < 20 || o.box[3] - o.box[1] < 20)) { boxes = boxes.filter((b) => b !== o); selected = null; } drawStage(); drawTools(); };
      addEventListener('pointermove', move0); addEventListener('pointerup', up0);
      drawStage(); drawTools(); e.preventDefault();
      return;
    }
    const o = boxes.find((b) => b.id === Number(boxEl.dataset.id));
    if (!o) return;
    const resize = t.tagName === 'I';
    selected = o.id;
    const rect = stage.getBoundingClientRect();
    const k = data.width / rect.width;
    const start = { x: e.clientX, y: e.clientY, box: [...o.box] as ParkObject['box'] };
    const w = data.width, h = data.height;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) * k, dy = (ev.clientY - start.y) * k;
      const [x0, y0, x1, y1] = start.box;
      if (resize) o.box = [x0, y0, Math.min(w, Math.max(x0 + 20, x1 + dx)), Math.min(h, Math.max(y0 + 20, y1 + dy))];
      else {
        const nx = Math.min(w - (x1 - x0), Math.max(0, x0 + dx)), ny = Math.min(h - (y1 - y0), Math.max(0, y0 + dy));
        o.box = [nx, ny, nx + (x1 - x0), ny + (y1 - y0)];
      }
      o.box = o.box.map(Math.round) as ParkObject['box'];
      drawStage();
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); drawTools(); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    drawStage(); drawTools();
    e.preventDefault();
  });

  function drawTools() {
    tools.replaceChildren();
    if (!data) return;
    const d = data;
    // CC-170: an object that runs off the photo edge is never turned away; say what we do (switch: ?padretry=0)
    const edge = edgeNote(boxes.map((b) => b.box), d.width, d.height, location.search);
    if (edge) tools.append(el('div', { cls: 'muted', id: 'edge-note', textContent: edge }));
    const add = el('button', { textContent: 'Add a box', id: 'add' });
    add.onclick = () => {
      const w = Math.round(d.width * 0.2), h = Math.round(d.height * 0.15);
      const o: ParkObject = { id: nextId++, phrase: 'bench', box: [Math.round(d.width / 2 - w / 2), Math.round(d.height / 2 - h / 2), Math.round(d.width / 2 + w / 2), Math.round(d.height / 2 + h / 2)], score: 1 };
      boxes.push(o); selected = o.id; drawStage(); drawTools();
    };
    const del = el('button', { textContent: 'Delete the box', id: 'del' });
    del.disabled = selected === null;
    del.onclick = () => { boxes = boxes.filter((b) => b.id !== selected); selected = null; drawStage(); drawTools(); };
    const what = el('select', { id: 'what' });
    for (const p of PHRASES) what.appendChild(el('option', { value: p, textContent: p }));
    const sel = boxes.find((b) => b.id === selected);
    what.disabled = !sel;
    if (sel) what.value = PHRASES.includes(sel.phrase) ? sel.phrase : 'platform';
    what.onchange = () => { if (sel) { sel.phrase = what.value; lastKind = what.value; drawStage(); } };
    const hm = el('input', { type: 'number', id: 'heightm', min: '0.1', max: '3', step: '0.05', placeholder: 'metres' });
    hm.style.width = '90px';
    hm.disabled = !sel || sel.phrase === 'person';
    if (sel?.heightM !== undefined) hm.value = String(sel.heightM);
    hm.oninput = () => { if (sel) { if (hm.value === '') delete sel.heightM; else sel.heightM = Number(hm.value); } };
    const make = el('button', { textContent: 'Make my course', cls: 'go', id: 'make' });
    make.onclick = makeCourse;
    tools.append(add, del, el('label', {}, 'This is a: ', what), el('label', {}, 'Real height (m, optional): ', hm), el('label', {}, paint, ' Paint the photo on the obstacles'), make);
  }

  function makeCourse() {
    if (!data) return;
    const prims = fitPrimitives(boxes);
    proof = proveCourse(prims, `Park: ${data.photo}`, paint.checked ? (data.file.startsWith('data:') ? data.file : `/assets/park/${data.file}`) : undefined);
    showCourse(prims, proof);
  }

  function showCourse(prims: Primitive[], p: Proof) {
    out.hidden = false;
    out.replaceChildren(el('h2', { textContent: 'Your course', cls: '' }));
    if (!prims.length) { out.append(el('div', { cls: 'bad', textContent: 'No boxes yet: add a box and say what it is.' })); return; }
    const rows = prims.map((q, i) => el('tr', {}, el('td', { textContent: String(i + 1) }), el('td', { textContent: q.phrase }), el('td', { textContent: q.type + (q.risers ? ` (${q.risers} steps)` : '') }),
      el('td', { textContent: `${q.height.toFixed(2)} m high` }), el('td', { textContent: `${q.length.toFixed(1)} m long` }),
      el('td', { textContent: `${q.scale.source === 'maker' ? 'from the height you typed' : q.scale.source === 'body-height' ? 'from a person in the photo' : q.scale.reference ? `from ${q.scale.reference}` : 'typical size'} (± ${Math.round(q.scale.uncertainty * 100)} %)` })));
    out.append(el('table', {}, el('tr', {}, ...['#', 'Thing', 'Shape', 'Height', 'Length', 'Where the size comes from'].map((t) => el('th', { textContent: t }))), ...rows));
    out.append(el('div', { cls: p.cleared ? 'ok' : 'bad', id: 'proof', textContent: p.cleared ? 'The simulator found a way to clear it.' : 'Too hard: widen a gap (or move a box).' }));
    if (p.windows.length) out.append(el('div', { cls: 'muted', textContent: 'Clearing window per jump: ' + p.windows.map((w, i) => `jump ${i + 1}: ${w.ms} ms`).join(' · ') }));
    for (const n of p.notes) out.append(el('div', { cls: 'muted', textContent: n }));
    const run = el('button', { textContent: 'Run it', cls: 'go', id: 'run' });
    run.onclick = () => {
      root.remove(); style.remove();
      void startCourse(document.body, p.course);
    };
    run.disabled = !p.cleared;
    out.append(run);
    if (data?.photo === 'upload' && p.cleared) out.append(sharePanel());
    document.documentElement.dataset.parkCleared = String(p.cleared);
  }

  // sharing: the photo, the boxes and a name go to the community; it shows in the gallery once the owner has looked at it
  function sharePanel(): HTMLElement {
    const box = el('div', { cls: 'panel', id: 'share' });
    const name = el('input', { id: 'cname', maxLength: 60, placeholder: 'Name your course, e.g. Library steps' });
    const nick = el('input', { id: 'cnick', maxLength: 30, placeholder: 'A nickname (not your real name), or leave empty' });
    const trap = el('input', { name: 'website', tabIndex: -1, autocomplete: 'off' });
    trap.style.cssText = 'position:absolute;left:-9999px';
    const ok = el('input', { type: 'checkbox', id: 'cok' });
    const send = el('button', { textContent: 'Share with the community', cls: 'go', id: 'sharego' });
    const note = el('div', { cls: 'muted', id: 'sharenote' });
    send.onclick = async () => {
      if (!data) return;
      if (!ok.checked) { note.textContent = 'Please tick the box about the photo first.'; return; }
      if (name.value.trim().length < 3) { note.textContent = 'Please give the course a name (at least 3 letters).'; return; }
      send.disabled = true; note.textContent = 'Sending…';
      try {
        const res = await fetch('/api/community', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session: session(), name: name.value, nick: nick.value, confirm: true, website: trap.value, width: data.width, height: data.height, image: data.file, boxes: boxes.map((b) => ({ phrase: b.phrase, box: b.box, heightM: b.heightM })) }),
        });
        const body = await res.json().catch(() => ({})) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? String(res.status));
        box.replaceChildren(el('div', { cls: 'ok', id: 'shared', textContent: 'Thank you! Your course is waiting for a quick check. Once it is approved it appears in the Community gallery.' }), el('a', { href: '?mode=gallery', textContent: 'Open the gallery →' }));
      } catch (e) { note.textContent = `That did not send (${(e as Error).message}). Please try again later.`; send.disabled = false; }
    };
    box.append(el('h3', { textContent: 'Share it', style: 'margin:0' }), name, nick, trap,
      el('label', {}, ok, ' This is my photo (or I may share it), and no person\'s face can be recognised in it.'), send, note,
      el('div', { cls: 'muted', textContent: 'Your photo and boxes are shown to others after a quick check. Do not share photos of people, private places or anything you would not want public.' }));
    box.querySelectorAll('input[type=text],input:not([type])').forEach((i: Element) => ((i as HTMLElement).style.cssText += 'font:inherit;padding:6px;border:1px solid #b9c2bb;border-radius:8px'));
    return box;
  }

  void load(PHOTOS.find((p) => p.id === params.get('photo'))?.id ?? PHOTOS[0].id);
  return { backend: 'webgl2' };
}
