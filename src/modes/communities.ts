import { flowOn } from '../community/flow';
import { pageQuery } from '../flags';
import { startCommunityFlow } from './community-flow';
import { Regions, type Region } from '../ui/regions';
import { liftObject, shrinkPhoto, type Shrunk } from '../slice/object-lift-client';
import { LABEL_RE, MIN_BOX } from '../slice/object-lift';
import { suggestRegions } from '../slice/segment-client';

// Communities (CC-247): make a wallpaper or a 3D object from a real photo, and see what people made.
// Steps: Photo, Pick (click suggested things, or draw boxes by hand), Choose (wallpaper or 3D object), Make.
// Looks only: nothing here changes how a course is cleared. Desktop mouse and keyboard.
const STYLE = `
.com{font:16px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:56px 24px 24px}
.com h1{margin:0;font-size:26px}.com h2{margin:0 0 6px;font-size:18px}
.com .top{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.com button,.com a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:10px;padding:7px 14px;cursor:pointer;text-decoration:none}
.com button:disabled{opacity:.45;cursor:default}
.com .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}
.com .tabs{display:flex;gap:6px}.com .tabs button[aria-selected=true]{background:#0f6b5c;color:#fff;border-color:#0f6b5c}
.com .steps{display:flex;gap:8px;margin:0 0 14px;padding:0;list-style:none;flex-wrap:wrap}
.com .steps li{padding:4px 12px;border-radius:999px;background:#e1e7e2;color:#58635d;font-size:14px}
.com .steps li.on{background:#0f6b5c;color:#fff;font-weight:700}.com .steps li.done{background:#cfe6df;color:#0f6b5c}
.com .panel{background:#fff;border:1px solid #cfd6d0;border-radius:14px;padding:16px;display:grid;gap:12px}
.com .muted{color:#58635d;font-size:14px}.com .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.com .stage{position:relative;display:inline-block;user-select:none;touch-action:none;max-width:100%}
.com .stage img{max-width:100%;max-height:56vh;display:block;cursor:crosshair}
.com .box{position:absolute;border:2px solid #ff9f1c;background:rgba(255,159,28,.14);cursor:move;box-sizing:border-box}
.com .box.sug{border-color:#2d9cdb;background:rgba(45,156,219,.10)}.com .box.sug::before{content:'';position:absolute;inset:0;background:#2d9cdb;opacity:.5;-webkit-mask:var(--cut) center/100% 100% no-repeat;mask:var(--cut) center/100% 100% no-repeat}.com .box.sug.sel::before{background:#0f6b5c;opacity:.6}.com .box.sel{border-width:3px;background:rgba(15,107,92,.22);border-color:#0f6b5c}
.com .box b{position:absolute;left:0;top:-20px;font:600 12px system-ui;background:#17201d;color:#fff;border-radius:4px;padding:1px 6px;white-space:nowrap}
.com .box i{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#0f6b5c;border-radius:3px;cursor:nwse-resize}
.com .choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.com .choice{text-align:left;display:grid;gap:8px;padding:12px;border:2px solid #cfd6d0;border-radius:14px;background:#fff}
.com .choice[aria-pressed=true]{border-color:#0f6b5c;box-shadow:0 0 0 3px #0f6b5c33}
.com .choice svg{width:100%;height:auto;border-radius:10px;background:#cfe3f4}
.com .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.com .card{background:#fff;border:1px solid #cfd6d0;border-radius:12px;overflow:hidden}.com .card img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.com .card div{padding:8px 10px}`;

// the two pictures on the Choose step: what each one would look like on a course
const asked = new WeakSet<object>(); // photos already sent for suggestions, so going back and forth asks once
const WALL_SVG = '<svg viewBox="0 0 280 150" role="img" aria-label="A wallpaper: a photo hangs behind the lane"><rect width="280" height="150" fill="#cfe3f4"/><rect x="20" y="14" width="240" height="84" rx="4" fill="#c8b79a"/><rect x="40" y="36" width="50" height="62" fill="#a89677"/><rect x="110" y="26" width="70" height="72" fill="#b9a784"/><rect x="200" y="44" width="46" height="54" fill="#a89677"/><rect y="98" width="280" height="52" fill="#6f9c4e"/><rect x="90" y="86" width="100" height="12" fill="#3b5d2a"/><circle cx="60" cy="78" r="7" fill="#ff9f1c"/><rect x="56" y="84" width="8" height="14" fill="#ff9f1c"/></svg>';
const OBJ_SVG = '<svg viewBox="0 0 280 150" role="img" aria-label="A 3D object: a bench you can place on a course"><rect width="280" height="150" fill="#cfe3f4"/><rect y="104" width="280" height="46" fill="#6f9c4e"/><path d="M70 96 L190 96 L220 80 L100 80Z" fill="#8a6a43"/><path d="M70 96 L190 96 L190 106 L70 106Z" fill="#6b5233"/><path d="M190 96 L220 80 L220 90 L190 106Z" fill="#583f26"/><rect x="78" y="106" width="8" height="18" fill="#444"/><rect x="176" y="106" width="8" height="18" fill="#444"/><path d="M96 78 L214 78 L222 60 L104 60Z" fill="#9a7a50"/><circle cx="40" cy="92" r="7" fill="#ff9f1c"/><rect x="36" y="98" width="8" height="14" fill="#ff9f1c"/></svg>';

export interface Wallpaper { id: string; name: string; thumb: string; at: number }
const KEY = 'cc.wallpapers';
export const savedWallpapers = (): Wallpaper[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Wallpaper[]; } catch { return []; } };
const saveWallpaper = (w: Wallpaper): boolean => { try { localStorage.setItem(KEY, JSON.stringify([w, ...savedWallpapers()].slice(0, 12))); return true; } catch { return false; } };

export function startCommunities(host: HTMLElement): { backend: 'webgl2' } {
  if (flowOn(pageQuery())) return startCommunityFlow(host, pageQuery()); // CC-247: the one-screen flow; ?flow=0 keeps these older screens
  const style = Object.assign(document.createElement('style'), { textContent: STYLE });
  document.head.append(style);
  const root = Object.assign(document.createElement('div'), { className: 'com' });
  host.append(root);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '', props: Record<string, unknown> = {}): HTMLElementTagNameMap[K] => { const e = Object.assign(document.createElement(tag), props); if (text) e.textContent = text; parent.append(e); return e; };

  const top = el('div', root); top.className = 'top';
  el('h1', top, 'Communities');
  const tabs = el('div', top); tabs.className = 'tabs'; tabs.setAttribute('role', 'tablist');
  const tabBrowse = el('button', tabs, 'Browse', { id: 'tab-browse' }), tabMake = el('button', tabs, 'Contribute', { id: 'tab-make' });
  for (const t of [tabBrowse, tabMake]) t.setAttribute('role', 'tab');
  el('a', top, 'Photo courses', { className: 'btn', href: '?mode=gallery&welcome=0', title: 'Courses made from obstacles in photos' });
  const body = el('div', root);

  const show = (which: 'browse' | 'make') => {
    tabBrowse.setAttribute('aria-selected', String(which === 'browse')); tabMake.setAttribute('aria-selected', String(which === 'make'));
    body.replaceChildren(); document.onkeydown = null;
    if (which === 'browse') browse(); else contribute();
  };
  tabBrowse.onclick = () => show('browse'); tabMake.onclick = () => show('make');

  function browse() {
    const p = el('div', body); p.className = 'panel';
    el('h2', p, 'Made by people, from real photos');
    el('div', p, 'Wallpapers go behind the Course. 3D objects are pieces you place in the World Editor. Yours are kept in this browser; shared ones will show here once they are checked.').className = 'muted';
    const mine = savedWallpapers();
    if (!mine.length) { const e = el('div', p, 'Nothing here yet. Make the first one.'); e.className = 'muted'; el('button', p, 'Contribute a photo', { className: 'go', id: 'first' }).onclick = () => show('make'); return; }
    const g = el('div', p); g.className = 'grid';
    for (const w of mine) { const c = el('div', g); c.className = 'card'; el('img', c, '', { src: w.thumb, alt: w.name }); el('div', c, `Mine: ${w.name}`); }
  }

  function contribute() {
    let step = 0, photo: Shrunk | null = null, regions: Regions | null = null, kind: 'wallpaper' | 'object' | null = null;
    const names = ['Photo', 'Pick', 'Choose', 'Make'];
    const bar = el('ol', body); bar.className = 'steps';
    const panel = el('div', body); panel.className = 'panel';
    const paint = () => { bar.replaceChildren(); names.forEach((n, i) => el('li', bar, `${i + 1}. ${n}`, { className: i === step ? 'on' : i < step ? 'done' : '' })); panel.replaceChildren(); [stepPhoto, stepPick, stepChoose, stepMake][step](); };
    const go = (s: number) => { step = s; paint(); };

    function stepPhoto() {
      el('h2', panel, 'Pick a photo');
      el('div', panel, 'A photo of a place you know: a park, a street, a playground. People in it are blurred, and the photo is not kept on our side.').className = 'muted';
      const file = el('input', panel, '', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'cfile' });
      const msg = el('div', panel); msg.className = 'muted';
      file.onchange = async () => {
        const f = file.files?.[0]; if (!f) return; msg.textContent = 'Reading the photo.';
        try { photo = await shrinkPhoto(f); regions = new Regions(photo.width, photo.height); go(1); } catch { msg.textContent = 'We could not read that photo. Try a JPEG.'; }
      };
    }

    function stepPick() {
      if (!photo || !regions) return go(0);
      const rg = regions, ph = photo;
      el('h2', panel, 'Pick the things you want');
      const help = el('div', panel, 'Click a suggested outline to pick it, or drag on the photo to draw your own box. Drag a box to move it, the green corner to resize. Ctrl+C and Ctrl+V copy and paste, Delete removes, Ctrl+Z undoes.'); help.className = 'muted';
      const stage = el('div', panel); stage.className = 'stage';
      const img = el('img', stage, '', { src: ph.image, alt: 'your photo', draggable: false });
      const info = el('div', panel); info.className = 'muted';
      const row = el('div', panel); row.className = 'row';
      const nameIn = el('input', row, '', { placeholder: 'name it (bench)', id: 'cname', disabled: true }); nameIn.setAttribute('list', 'cn');
      const dl = el('datalist', row, '', { id: 'cn' }); for (const l of ['bench', 'bollard', 'railing', 'stairs', 'planter', 'wall', 'log', 'pull-up bar']) el('option', dl, '', { value: l });
      const back = el('button', row, 'Back'), next = el('button', row, 'Next: choose', { className: 'go', id: 'cnext' });
      back.onclick = () => go(0);
      const k = () => ph.width / img.getBoundingClientRect().width; // photo pixels per screen pixel
      const draw = () => {
        stage.querySelectorAll('.box').forEach((n) => n.remove());
        const s = 1 / k();
        for (const r of rg.list) {
          const b = el('div', stage); b.className = `box ${r.source === 'suggested' ? 'sug' : ''} ${rg.selected.has(r.id) ? 'sel' : ''}`; b.dataset.id = String(r.id);
          Object.assign(b.style, { left: `${r.box[0] * s}px`, top: `${r.box[1] * s}px`, width: `${(r.box[2] - r.box[0]) * s}px`, height: `${(r.box[3] - r.box[1]) * s}px` });
          if (r.cutout) b.style.setProperty('--cut', `url(data:image/png;base64,${r.cutout})`);
          if (r.label) el('b', b, r.label);
          if (rg.selected.has(r.id)) el('i', b, '').dataset.grip = '1';
        }
        const one = rg.selected.size === 1 ? rg.list.find((r) => rg.selected.has(r.id)) : undefined;
        nameIn.disabled = !one; nameIn.value = one?.label ?? '';
        next.disabled = !rg.selected.size && !rg.list.some((r) => r.source === 'manual');
        const sug = info.dataset.suggest ? `${info.dataset.suggest} ` : '';
        info.textContent = `${sug}${rg.list.length ? `${rg.list.length} on the photo${rg.selected.size ? `, ${rg.selected.size} chosen` : ''}.` : 'Nothing picked yet.'}`;
        stage.dataset.count = String(rg.list.length);
      };
      nameIn.oninput = () => { const id = [...rg.selected][0]; if (id !== undefined) { rg.rename(id, nameIn.value.trim().toLowerCase()); draw(); } };
      let drag: { mode: 'new' | 'move' | 'size'; id?: number; x: number; y: number; last: { x: number; y: number } } | null = null;
      const at = (e: PointerEvent) => { const r = img.getBoundingClientRect(); return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width) * k(), y: Math.min(Math.max(e.clientY - r.top, 0), r.height) * k() }; };
      stage.onpointerdown = (e) => {
        const p = at(e), t = e.target as HTMLElement, box = t.closest('.box') as HTMLElement | null; stage.setPointerCapture(e.pointerId);
        if (t.dataset.grip && box) drag = { mode: 'size', id: Number(box.dataset.id), x: p.x, y: p.y, last: p };
        else if (box) { const id = Number(box.dataset.id); rg.toggle(id, e.shiftKey); if (!rg.selected.has(id) && !e.shiftKey) rg.selected = new Set(); drag = { mode: 'move', id, x: p.x, y: p.y, last: p }; draw(); }
        else { rg.selected = new Set(); drag = { mode: 'new', x: p.x, y: p.y, last: p }; draw(); }
      };
      stage.onpointermove = (e) => {
        if (!drag) return; const p = at(e);
        if (drag.mode === 'move' && drag.id !== undefined && rg.selected.has(drag.id)) { for (const id of rg.selected) rg.move(id, p.x - drag.last.x, p.y - drag.last.y); }
        else if (drag.mode === 'size' && drag.id !== undefined) { const r = rg.list.find((x) => x.id === drag!.id); if (r) rg.resize(r.id, [r.box[0], r.box[1], p.x, p.y]); }
        else if (drag.mode === 'new') { stage.querySelector('.ghost')?.remove(); const g = el('div', stage); g.className = 'box ghost'; const s = 1 / k(); Object.assign(g.style, { left: `${Math.min(drag.x, p.x) * s}px`, top: `${Math.min(drag.y, p.y) * s}px`, width: `${Math.abs(p.x - drag.x) * s}px`, height: `${Math.abs(p.y - drag.y) * s}px`, pointerEvents: 'none' }); }
        drag.last = p; if (drag.mode !== 'new') draw();
      };
      stage.onpointerup = (e) => {
        if (!drag) return; const p = at(e), d = drag; drag = null; stage.querySelector('.ghost')?.remove();
        if (d.mode === 'new') { const b: Region['box'] = [Math.min(d.x, p.x), Math.min(d.y, p.y), Math.max(d.x, p.x), Math.max(d.y, p.y)]; if (b[2] - b[0] >= MIN_BOX && b[3] - b[1] >= MIN_BOX) rg.add(b); }
        draw();
      };
      document.onkeydown = (e) => { if ((e.target as HTMLElement).tagName === 'INPUT') return; if (rg.key(e)) { e.preventDefault(); draw(); } };
      next.onclick = () => go(2);
      if (!asked.has(ph)) { asked.add(ph); suggestRegions(ph, (t) => { info.dataset.suggest = t; draw(); }).then((items) => { rg.suggest(items); info.dataset.suggest = items.length ? `${items.length} suggestions: click an outline to pick it.` : 'Nothing to suggest here. Draw boxes by hand.'; draw(); }).catch((e: Error) => { info.dataset.suggest = e.message; draw(); }); }
      if (img.complete) draw(); else img.onload = draw;
      draw();
    }

    function stepChoose() {
      el('h2', panel, 'What do you want to make?');
      const wrap = el('div', panel); wrap.className = 'choices';
      const mk = (id: 'wallpaper' | 'object', title: string, text: string, svg: string) => {
        const b = el('button', wrap, '', { className: 'choice', id: `choose-${id}` }); b.setAttribute('aria-pressed', String(kind === id));
        const pic = el('div', b); pic.innerHTML = svg; el('strong', b, title); el('span', b, text).className = 'muted';
        b.onclick = () => { kind = id; wrap.querySelectorAll('.choice').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); next.disabled = false; };
      };
      mk('wallpaper', 'Wallpaper', 'Your photo hangs behind the lane, like scenery. It is for looks: the course plays the same.', WALL_SVG);
      mk('object', '3D object', 'One thing from your photo becomes a solid piece you can place in the World Editor and run over.', OBJ_SVG);
      const row = el('div', panel); row.className = 'row';
      el('button', row, 'Back').onclick = () => go(1);
      const next = el('button', row, 'Next: make it', { className: 'go', id: 'cmake', disabled: kind === null }); next.onclick = () => go(3);
    }

    function stepMake() {
      if (!photo || !regions || !kind) return go(0);
      const ph = photo, rg = regions, msg = el('div', panel); msg.className = 'muted'; msg.id = 'cmsg';
      const row = el('div', panel); row.className = 'row';
      const nm = el('input', row, '', { placeholder: 'give it a name', id: 'cwname', maxLength: 40, value: rg.list[0]?.label ?? '' });
      const doIt = el('button', row, kind === 'wallpaper' ? 'Save the wallpaper' : 'Make the 3D object', { className: 'go', id: 'cdo' });
      el('button', row, 'Back').onclick = () => go(2);
      el('h2', panel, kind === 'wallpaper' ? 'Name your wallpaper' : 'Name your object'); panel.prepend(panel.lastElementChild!);
      doIt.onclick = async () => {
        const name = nm.value.trim() || 'my photo';
        if (kind === 'wallpaper') {
          const ok = saveWallpaper({ id: `w${Date.now().toString(36)}`, name, thumb: ph.thumb, at: Date.now() });
          msg.textContent = ok ? 'Saved in this browser. It shows under Browse. Putting it behind a course comes next.' : 'Your browser has no room to keep it.'; return;
        }
        const first = rg.list.find((r) => rg.selected.has(r.id)) ?? rg.list[0];
        const label = first.label || name.toLowerCase();
        if (!LABEL_RE.test(label)) { msg.textContent = 'Name the picked thing with a plain word like bench, railing, stairs or wall.'; return; }
        doIt.disabled = true;
        try { const r = await liftObject({ photo: ph, box: first.box, label, height_m: null }, (s) => { msg.textContent = s; }); msg.textContent = `Done in ${r.seconds} s. It is saved in this browser as "Mine: ${r.prov.name}" in the World Editor.`; }
        catch (e) { msg.textContent = (e as Error).message; doIt.disabled = false; }
      };
    }
    paint();
  }

  show('browse');
  return { backend: 'webgl2' };
}
