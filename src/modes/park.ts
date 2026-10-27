import { startCourse } from './course';
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = (tag: string, props: Record<string, any> = {}, ...kids: (Node | string)[]): any => {
    const { cls, ...rest } = props;
    const n = Object.assign(document.createElement(tag), rest);
    if (cls) n.className = cls;
    n.append(...kids);
    return n;
  };

  const title = el('h1', { textContent: 'The Park: photo in, course out' });
  const intro = el('div', { cls: 'muted', textContent: 'Pick a photo. Move, resize, add or delete the orange boxes until they match the real things. Then make your course.' });
  const picker = el('div', { cls: 'bar' });
  const stage = el('div', { cls: 'stage' });
  const tools = el('div', { cls: 'bar' });
  const out = el('div', { cls: 'panel' });
  out.hidden = true;
  const credit = el('div', { cls: 'muted' });
  root.append(title, intro, picker, stage, tools, out, credit);

  PHOTOS.forEach((p) => {
    const b = el('button', { textContent: p.label, id: `pick-${p.id}` });
    b.onclick = () => void load(p.id);
    picker.appendChild(b);
  });

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
    stage.replaceChildren(el('img', { src: `/assets/park/${d.file}`, alt: 'a park photo' }));
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
    if (!boxEl) { selected = null; drawStage(); drawTools(); return; }
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
    what.onchange = () => { if (sel) { sel.phrase = what.value; drawStage(); } };
    const make = el('button', { textContent: 'Make my course', cls: 'go', id: 'make' });
    make.onclick = makeCourse;
    tools.append(add, del, el('label', {}, 'This is a: ', what), make);
  }

  function makeCourse() {
    if (!data) return;
    const prims = fitPrimitives(boxes);
    proof = proveCourse(prims, `Park: ${data.photo}`);
    showCourse(prims, proof);
  }

  function showCourse(prims: Primitive[], p: Proof) {
    out.hidden = false;
    out.replaceChildren(el('h2', { textContent: 'Your course', cls: '' }));
    if (!prims.length) { out.append(el('div', { cls: 'bad', textContent: 'No boxes yet: add a box and say what it is.' })); return; }
    const rows = prims.map((q, i) => el('tr', {}, el('td', { textContent: String(i + 1) }), el('td', { textContent: q.phrase }), el('td', { textContent: q.type + (q.risers ? ` (${q.risers} steps)` : '') }),
      el('td', { textContent: `${q.height.toFixed(2)} m high` }), el('td', { textContent: `${q.length.toFixed(1)} m long` }),
      el('td', { textContent: `${q.scale.source === 'body-height' ? 'from a person in the photo' : q.scale.reference ? `from ${q.scale.reference}` : 'typical size'} (± ${Math.round(q.scale.uncertainty * 100)} %)` })));
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
    document.documentElement.dataset.parkCleared = String(p.cleared);
  }

  void load(PHOTOS.find((p) => p.id === params.get('photo'))?.id ?? PHOTOS[0].id);
  return { backend: 'webgl2' };
}
