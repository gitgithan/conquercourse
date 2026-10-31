import { Regions } from '../ui/regions';
import { JobError, liftObject, shrinkPhoto, type Shrunk } from '../slice/object-lift-client';
import { LIFT_STEPS, SEGMENT_STEPS } from '../slice/stages';
import { jobProgress } from '../ui/job-progress';
import { LABEL_RE, MIN_BOX } from '../slice/object-lift';
import { SegmentOff, suggestRegions } from '../slice/segment-client';
import { deleteUserObject, listUserObjects, saveUserObject, type UserObject } from '../slice/user-objects';
import { deleteShared, forgetLink, links, rememberLink, shareItem } from '../community/share-client';
import { DEMOS, worldHref } from '../ui/world-picker';
import { SAMPLE_WALLPAPERS, cropToThumb, deleteWallpaper, saveWallpaper, savedWallpapers } from '../community/wallpaper';
import type { PublicItem } from '../community/items';
import { listSharedPage } from '../community/share-client';
import { placeableShared, sharedSrc, useShared, COST_WORDS, LIFT_PARALLEL, MAX_PICKS, STEPS, TABS, afterMarksChanged, buildFound, canEnter, editorHref, makeLabel, nextStep, prevStep, runQueue, startState, tabFor, toggleTick, wallpaperCrop, whyNot, type Box, type FlowState, type Found, type Kind, type Step, type Tab } from '../community/flow';
import { openPrize } from '../ui/prize';
import { startGallery } from './gallery';

// Community (CC-247): one screen, two tabs: Explore (finished work first) and Make your own, a stepper: Photo, Mark, Segment, Choose, Make.
// A photo gives objects and wallpapers only; courses come from World Slicing and the Editor. One rectangle at a time. The mark is also the crop tool. Looks only: nothing here changes how a course is cleared.
const SAMPLES = ['park01', 'park02', 'park03', 'park06'];
const STYLE = `
.com{font:16px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:56px 24px 24px}
.com h1{margin:0;font-size:26px}.com h2{margin:0 0 6px;font-size:18px}
.com .top{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.com button,.com a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:10px;padding:7px 14px;cursor:pointer;text-decoration:none;display:inline-block}
.com button:disabled{opacity:.45;cursor:default}
.com .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}
.com .tabs{display:flex;gap:6px}.com .tabs button[aria-selected=true],.com .pick[aria-pressed=true]{background:#0f6b5c;color:#fff;border-color:#0f6b5c}
.com .steps{display:flex;gap:8px;margin:0 0 14px;padding:0;list-style:none;flex-wrap:wrap}
.com .steps button{border-radius:999px;border:0;background:#e1e7e2;color:#58635d;font-size:14px;padding:4px 12px}
.com .steps .on{background:#0f6b5c;color:#fff;font-weight:700}.com .steps .done{background:#cfe6df;color:#0f6b5c}
.com .panel{background:#fff;border:1px solid #cfd6d0;border-radius:14px;padding:16px;display:grid;gap:12px}
.com .muted{color:#58635d;font-size:14px}.com .err{color:#b3261e;font-weight:600}.com .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.com .stage{position:relative;display:inline-block;user-select:none;touch-action:none;max-width:100%}
.com .stage img{max-width:100%;max-height:52vh;display:block;cursor:crosshair}
.com .box{position:absolute;border:2px solid #ff9f1c;background:rgba(255,159,28,.14);cursor:move;box-sizing:border-box}
.com .box.cut::before{content:'';position:absolute;inset:0;background:#2d9cdb;opacity:.5;-webkit-mask:var(--cut) center/100% 100% no-repeat;mask:var(--cut) center/100% 100% no-repeat}
.com .box.pick{cursor:pointer;border-color:#7a8a80;background:rgba(122,138,128,.10)}.com .box.hl{z-index:2;border-color:#ffd166;background:rgba(255,209,102,.30)}
.com .found{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:8px 0}.com .found label{display:flex;gap:8px;align-items:center;border:1px solid #cfd6d0;border-radius:10px;padding:6px 10px;background:#fff;cursor:pointer}.com .found label.hl{border-color:#ffd166;box-shadow:0 0 0 2px #ffd166}.com .found label.on{border-color:#0f6b5c;background:#e7f3ef}.com .found s{display:inline-block;width:28px;height:28px;border-radius:4px;background:#2d9cdb;flex:none;-webkit-mask:var(--cut) center/100% 100% no-repeat;mask:var(--cut) center/100% 100% no-repeat}
.com .qrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0}
.com .box.sel{border-width:3px;border-color:#0f6b5c;background:rgba(15,107,92,.22)}
.com .box b{position:absolute;left:0;top:-20px;font:600 12px system-ui;background:#17201d;color:#fff;border-radius:4px;padding:1px 6px;white-space:nowrap}
.com .box i{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#0f6b5c;border-radius:3px;cursor:nwse-resize}
.com .chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #b9c2bb;border-radius:999px;padding:3px 12px;background:#fff}
.com .chip s{display:inline-block;width:18px;height:18px;border-radius:4px;background:#2d9cdb;-webkit-mask:var(--cut) center/100% 100% no-repeat;mask:var(--cut) center/100% 100% no-repeat}
.com .item{display:grid;grid-template-columns:140px 1fr;gap:12px;align-items:start;border:1px solid #cfd6d0;border-radius:12px;padding:10px}
.com .item img{width:140px;border-radius:8px;display:block}
.com .samples{display:flex;gap:8px;flex-wrap:wrap}.com .samples img{width:120px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent}
.com .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.com .card{background:#fff;border:1px solid #cfd6d0;border-radius:12px;overflow:hidden}.com .card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.com .card div{padding:8px 10px}
.com .places .gal{position:static;inset:auto;padding:0;background:none;overflow:visible}.com .places .gal>:nth-child(-n+2){display:none}`;

export function startCommunityFlow(host: HTMLElement, params: URLSearchParams): { backend: 'webgl2' } {
  document.head.append(Object.assign(document.createElement('style'), { textContent: STYLE }));
  const root = Object.assign(document.createElement('div'), { className: 'com' });
  host.append(root);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '', props: Record<string, unknown> = {}): HTMLElementTagNameMap[K] => { const e = Object.assign(document.createElement(tag), props); if (text) e.textContent = text; parent.append(e); return e; };

  const top = el('div', root); top.className = 'top';
  el('h1', top, 'Community');
  const tabsEl = el('div', top); tabsEl.className = 'tabs'; tabsEl.setAttribute('role', 'tablist');
  const tabBtn = {} as Record<Tab, HTMLButtonElement>;
  for (const t of TABS) { const b = el('button', tabsEl, t.label, { id: `tab-${t.id}`, title: t.hint }); b.setAttribute('role', 'tab'); tabBtn[t.id] = b; b.onclick = () => showTab(t.id); }
  const body = el('div', root);

  // the photo work survives a tab change, so looking at Objects does not lose your marks
  const work: { step: Step; photo: Shrunk | null; rg: Regions | null; fs: FlowState; kinds: Map<number, Kind>; names: Map<number, string>; made: { pieces: string[]; walls: string[] }; cands: Found[]; ticked: number[]; areas: { id: number; box: Box; label: string; cutout?: string }[]; segMsg: string } =
    { step: 'photo', photo: null, rg: null, fs: startState(), kinds: new Map(), names: new Map(), made: { pieces: [], walls: [] }, cands: [], ticked: [], areas: [], segMsg: '' };

  function showTab(t: Tab) {
    for (const id of Object.keys(tabBtn) as Tab[]) tabBtn[id].setAttribute('aria-selected', String(id === t));
    body.replaceChildren(); document.onkeydown = null; root.dataset.tab = t;
    if (t === 'make') photos(); else explore();
  }

  // Explore: finished work first (premade courses), then one clear button, then pieces and wallpapers (premade examples and yours)
  function explore() {
    const sec = (title: string, text: string, id: string) => { const p = el('div', body); p.className = 'panel'; p.id = id; p.style.marginBottom = '14px'; el('h2', p, title); el('div', p, text).className = 'muted'; return p; };
    const courses = sec('Courses people made', 'Finished courses made from real places. Press Play on any card to try it.', 'ex-courses');
    const holder = el('div', courses); holder.className = 'places'; startGallery(holder);

    const mk = sec('Now make your own', 'Start with a photo of a place you know. You mark one area, cut it out, then turn it into a 3D piece or a wallpaper. Courses are made in the World Slicer and the World Editor.', 'ex-make');
    el('button', mk, 'Make your own', { className: 'go', id: 'make-own' }).onclick = () => showTab('make');

    const made = sec('Pieces and wallpapers', 'Finished examples first, then yours. Pieces go in the World Editor tray; wallpapers go behind a course.', 'ex-objects');
    const g = el('div', made); g.className = 'grid'; g.id = 'objgrid';
    const card = (img: string, title: string, sub: string, link?: [string, string]) => { const c = el('div', g); c.className = 'card'; if (img) el('img', c, '', { src: img, alt: title, loading: 'lazy' }); const d = el('div', c); el('strong', d, title); el('div', d, sub).className = 'muted'; if (link) el('a', d, link[0], { href: link[1] }); return c; };
    for (const id of SAMPLE_WALLPAPERS) card(`/assets/park/${id}.jpg`, `Example wallpaper ${id.slice(4)}`, 'A real place behind the lane', ['Play with it', `${worldHref(DEMOS[0][0])}&wallpaper=sample:${id}`]);
    void (async () => {
      try {
        const [idx, prov] = await Promise.all([fetch('/assets/objects/index.json').then((r) => r.json()), fetch('/assets/objects/provenance.json').then((r) => r.json())]) as [{ objects: { name: string; photo: string; box: Box; label: string; glb: string }[] }, { objects: { glb: string; credit?: { line?: string } }[] }];
        for (const o of idx.objects.slice(0, 8)) {
          const credit = prov.objects.find((x) => x.glb.endsWith(o.glb))?.credit?.line ?? '';
          const c = card('', `Example piece: ${o.label}`, credit || 'Made from a real photo', ['Use it in the World Editor', '?mode=editor&welcome=0']);
          void cropToThumb(`/assets/park/${o.photo}.jpg`, o.box).then((u) => { c.prepend(Object.assign(document.createElement('img'), { src: u, alt: o.label })); }).catch(() => undefined);
        }
      } catch { /* the examples are a bonus */ }
      const shared = links(), sharedLocal = new Set(Object.values(shared).map((l) => `${l.kind}:${l.local}`));
      for (const w of savedWallpapers()) if (!sharedLocal.has(`wallpaper:${w.id}`)) card(w.thumb, `Yours: ${w.name}`, 'Wallpaper, only in this browser', w.course ? ['Play it', `${worldHref(w.course)}&wallpaper=${w.id}`] : undefined);
      let objs: UserObject[] = []; try { objs = await listUserObjects(); } catch { /* none kept */ }
      for (const o of objs) if (!sharedLocal.has(`piece:${o.id}`)) card('', `Yours: ${o.prov.name}`, '3D piece, only in this browser', ['Open the World Editor', editorHref(o.id)]);
      // shared in Community: yours (with Delete) and everyone's approved ones
      // a search box, a kind filter and Show more: the shared list is served one page at a time, searched by name on the server
      const bar = el('div', made); bar.className = 'row'; bar.id = 'shared-controls'; made.insertBefore(bar, g);
      const find = el('input', bar, { id: 'shared-q', type: 'search', placeholder: 'Search shared things by name' } as never) as HTMLInputElement;
      const kindSel = el('select', bar, { id: 'shared-kind' } as never) as HTMLSelectElement;
      for (const [v, t] of [['', 'Everything'], ['piece', '3D pieces'], ['wallpaper', 'Wallpapers']]) el('option', kindSel, t, { value: v } as never);
      const more = el('button', made, 'Show more', { id: 'shared-more' }); more.style.display = 'none';
      let cursor: string | null = null;
      const loadPage = async (reset: boolean) => {
        if (reset) { for (const n of [...g.querySelectorAll('[data-shared]')]) n.remove(); cursor = null; }
        let pg: Awaited<ReturnType<typeof listSharedPage>> = { items: [], next: null };
        try { pg = await listSharedPage({ q: find.value.trim(), kind: kindSel.value, cursor: cursor ?? undefined }); } catch { /* the list is a bonus */ }
        cursor = pg.next; more.style.display = pg.next ? '' : 'none';
        for (const it of pg.items) addItem(it);
      };
      let timer = 0;
      find.oninput = () => { clearTimeout(timer); timer = window.setTimeout(() => { void loadPage(true); }, 300); };
      kindSel.onchange = () => { void loadPage(true); };
      more.onclick = () => { void loadPage(false); };
      const addItem = (it: PublicItem) => {
        const l = shared[it.id];
        const c = card(it.thumb ?? '', it.mine ? `Yours: ${it.name}` : it.name, `${it.kind === 'piece' ? '3D piece' : 'Wallpaper'}${it.mine ? (it.status === 'approved' ? ', shared with everyone' : ', shared: waiting for the safety check, only you see it') : ', shared by a player'}`,
          it.kind === 'wallpaper' && it.meta.course && l ? ['Play it', `${worldHref(it.meta.course)}&wallpaper=${l.local}`] : it.kind === 'piece' && it.mine ? ['Open the World Editor', l?.kind === 'piece' ? editorHref(l.local) : '?mode=editor&welcome=0&uploadobj=1'] : undefined);
        c.dataset.shared = it.id; c.dataset.kind = it.kind;
        if (!it.mine && placeableShared(it)) { // someone else's approved piece: add it to your own list, then place it in the World Editor
          const d = c.lastElementChild as HTMLElement; const row = el('div', d); row.className = 'row'; row.style.marginTop = '6px';
          const use = el('button', row, 'Use in my course', { id: `use-${it.id}`, className: 'go', title: 'Adds it to Add pieces in the World Editor' });
          use.onclick = () => { useShared({ id: it.id, name: it.name }); row.replaceChildren(); el('span', row, 'Added to your pieces. ').className = 'muted'; el('a', row, 'Open the World Editor', { className: 'btn go', id: `use-open-${it.id}`, href: editorHref(sharedSrc(it.id)) }); };
        }
        if (it.mine) {
          const d = c.lastElementChild as HTMLElement; const row = el('div', d); row.className = 'row'; row.style.marginTop = '6px';
          const del = el('button', row, 'Delete', { id: `del-${it.id}`, title: 'Delete this for good' });
          del.onclick = () => {
            row.replaceChildren(); el('span', row, `Delete "${it.name}" for good?`).className = 'muted';
            const yes = el('button', row, 'Yes, delete', { id: `del-yes-${it.id}`, className: 'go' }), no = el('button', row, 'Keep it', { id: `del-no-${it.id}` });
            no.onclick = () => { row.replaceChildren(del); };
            yes.onclick = async () => {
              yes.disabled = true;
              if (!(await deleteShared(it.id))) { row.replaceChildren(); el('span', row, 'Could not delete it. Try again.').className = 'err'; return; }
              const link = links()[it.id]; forgetLink(it.id);
              if (link?.kind === 'wallpaper') deleteWallpaper(link.local); else if (link) void deleteUserObject(link.local).catch(() => undefined);
              c.remove();
            };
          };
        }
      };
      await loadPage(true);
    })();
  }

  function photos() {
    const bar = el('ol', body); bar.className = 'steps';
    const panel = el('div', body); panel.className = 'panel';
    const paint = () => {
      bar.replaceChildren();
      STEPS.forEach((s, i) => { const li = el('li', bar); const b = el('button', li, `${i + 1}. ${s.label}`, { id: `step-${s.id}`, className: s.id === work.step ? 'on' : i < STEPS.findIndex((x) => x.id === work.step) ? 'done' : '', disabled: !canEnter(s.id, work.fs) }); b.title = whyNot(s.id, work.fs); b.onclick = () => go(s.id); });
      panel.replaceChildren(); document.onkeydown = null; panel.dataset.step = work.step;
      ({ photo: stepPhoto, mark: stepMark, segment: stepSegment, choose: stepChoose, make: stepMake })[work.step]();
    };
    const go = (s: Step) => { if (!canEnter(s, work.fs)) return; work.step = s; paint(); };
    const navRow = (parent: HTMLElement, nextLabel: string | null, nextOk = true, nextId = 'cnext') => {
      const row = el('div', parent); row.className = 'row';
      const pv = prevStep(work.step); if (pv) el('button', row, 'Back', { id: 'cback' }).onclick = () => go(pv);
      const nx = nextStep(work.step); const b = nextLabel && nx ? el('button', row, nextLabel, { className: 'go', id: nextId, disabled: !nextOk }) : null;
      if (b && nx) b.onclick = () => go(nx);
      return { row, next: b };
    };
    const useShrunk = (s: Shrunk) => { work.photo = s; work.rg = new Regions(s.width, s.height); work.fs = { ...startState(), hasPhoto: true }; work.kinds.clear(); work.names.clear(); work.cands = []; work.ticked = []; work.areas = []; work.segMsg = ''; work.made = { pieces: [], walls: [] }; go('mark'); };

    function stepPhoto() {
      el('h2', panel, 'Step 1. Pick a photo');
      el('div', panel, 'A photo of a place you know: a park, a street, a playground. People in it are blurred, and the photo is not kept on our side.').className = 'muted';
      const file = el('input', panel, '', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'cfile' });
      const msg = el('div', panel); msg.className = 'muted'; msg.id = 'cmsg';
      el('div', panel, 'Or try one of ours:').className = 'muted';
      const sm = el('div', panel); sm.className = 'samples';
      for (const s of SAMPLES) {
        const im = el('img', sm, '', { src: `/assets/park/${s}.jpg`, alt: `sample place ${s}`, title: 'Use this photo' }); im.dataset.sample = s;
        im.onclick = async () => { msg.textContent = 'Reading the photo.'; try { const blob = await (await fetch(`/assets/park/${s}.jpg`)).blob(); useShrunk(await shrinkPhoto(new File([blob], `${s}.jpg`, { type: 'image/jpeg' }))); } catch { msg.textContent = 'We could not read that photo.'; } };
      }
      file.onchange = async () => { const f = file.files?.[0]; if (!f) return; msg.textContent = 'Reading the photo.'; try { useShrunk(await shrinkPhoto(f)); } catch { msg.textContent = 'We could not read that photo. Try a JPEG.'; } };
    }

    interface View { list(): { id: number; box: Box; label: string; cutout?: string; cls: string }[]; hover(id: number | null): void; click(id: number): void }
    function stage(rg: Regions, ph: Shrunk, editable: boolean, onChange: () => void, viewOf?: () => View | undefined) {
      const st = el('div', panel); st.className = 'stage';
      const img = el('img', st, '', { src: ph.image, alt: 'your photo', draggable: false });
      const k = () => ph.width / img.getBoundingClientRect().width;
      const draw = () => {
        const view = viewOf?.();
        st.querySelectorAll('.box').forEach((n) => n.remove()); const s = 1 / k();
        const shown = view ? view.list() : rg.list.map((r) => ({ id: r.id, box: r.box, label: r.label, cutout: r.cutout, cls: rg.selected.has(r.id) ? 'sel' : '' }));
        for (const r of shown) {
          const b = el('div', st); b.className = `box ${r.cutout ? 'cut' : ''} ${r.cls}`; b.dataset.id = String(r.id);
          if (view) { b.onmouseenter = () => view.hover(r.id); b.onmouseleave = () => view.hover(null); b.onclick = () => view.click(r.id); }
          Object.assign(b.style, { left: `${r.box[0] * s}px`, top: `${r.box[1] * s}px`, width: `${(r.box[2] - r.box[0]) * s}px`, height: `${(r.box[3] - r.box[1]) * s}px` });
          if (r.cutout) b.style.setProperty('--cut', `url(data:image/png;base64,${r.cutout})`);
          if (r.label) el('b', b, r.label);
          if (editable && !view && rg.selected.has(r.id)) el('i', b, '').dataset.grip = '1';
        }
        st.dataset.count = String(rg.list.length);
      };
      if (editable) {
        let drag: { mode: 'new' | 'move' | 'size'; id?: number; x: number; y: number; last: { x: number; y: number } } | null = null;
        const at = (e: PointerEvent) => { const r = img.getBoundingClientRect(); return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width) * k(), y: Math.min(Math.max(e.clientY - r.top, 0), r.height) * k() }; };
        st.onpointerdown = (e) => {
          const p = at(e), t = e.target as HTMLElement, box = t.closest('.box') as HTMLElement | null; st.setPointerCapture(e.pointerId);
          if (t.dataset.grip && box) drag = { mode: 'size', id: Number(box.dataset.id), x: p.x, y: p.y, last: p };
          else if (box) { const id = Number(box.dataset.id); rg.toggle(id, e.shiftKey); if (!rg.selected.has(id) && !e.shiftKey) rg.selected = new Set(); drag = { mode: 'move', id, x: p.x, y: p.y, last: p }; draw(); }
          else { rg.selected = new Set(); drag = { mode: 'new', x: p.x, y: p.y, last: p }; draw(); }
        };
        st.onpointermove = (e) => {
          if (!drag) return; const p = at(e);
          if (drag.mode === 'move' && drag.id !== undefined && rg.selected.has(drag.id)) { for (const id of rg.selected) rg.move(id, p.x - drag.last.x, p.y - drag.last.y); }
          else if (drag.mode === 'size' && drag.id !== undefined) { const r = rg.list.find((x) => x.id === drag!.id); if (r) rg.resize(r.id, [r.box[0], r.box[1], p.x, p.y]); }
          else if (drag.mode === 'new') { st.querySelector('.ghost')?.remove(); const g = el('div', st); g.className = 'box ghost'; const s = 1 / k(); Object.assign(g.style, { left: `${Math.min(drag.x, p.x) * s}px`, top: `${Math.min(drag.y, p.y) * s}px`, width: `${Math.abs(p.x - drag.x) * s}px`, height: `${Math.abs(p.y - drag.y) * s}px`, pointerEvents: 'none' }); }
          drag.last = p; if (drag.mode !== 'new') { draw(); onChange(); }
        };
        st.onpointerup = (e) => {
          if (!drag) return; const p = at(e), d = drag; drag = null; st.querySelector('.ghost')?.remove();
          if (d.mode === 'new') {
            let b: Box = [Math.min(d.x, p.x), Math.min(d.y, p.y), Math.max(d.x, p.x), Math.max(d.y, p.y)];
            if (b[2] - b[0] < MIN_BOX || b[3] - b[1] < MIN_BOX) { const w = ph.width * 0.2, h = w * 0.75; b = [Math.max(0, Math.min(d.x - w / 2, ph.width - w)), Math.max(0, Math.min(d.y - h / 2, ph.height - h)), 0, 0]; b[2] = b[0] + w; b[3] = b[1] + h; } // a click drops a ready-made box
            rg.add(b); rg.limit(1); // one rectangle at a time: a new one replaces the old one
          }
          draw(); onChange();
        };
        document.onkeydown = (e) => { if ((e.target as HTMLElement).tagName === 'INPUT') return; if (rg.key(e)) { e.preventDefault(); rg.limit(1); draw(); onChange(); } };
      }
      if (img.complete) draw(); else img.onload = draw;
      draw();
      return { draw, root: st };
    }

    function stepMark() {
      if (!work.photo || !work.rg) return go('photo');
      const rg = work.rg, ph = work.photo;
      el('h2', panel, 'Step 2. Mark the area you want');
      el('div', panel, 'Click the photo to drop a box, or drag to draw your own. Only one box is kept: a new box replaces the old one. Drag the box to move it, the green corner to resize. Delete removes it, Ctrl+Z undoes. The same box cuts out a wallpaper, so there is only one tool.').className = 'muted';
      const info = el('div', panel); info.className = 'muted'; info.id = 'cinfo';
      let nav: ReturnType<typeof navRow>;
      const changed = () => { const was = work.fs.segmented; work.fs = afterMarksChanged(work.fs, rg.list.length); if (was) { work.kinds.clear(); work.cands = []; work.ticked = []; work.areas = []; } info.textContent = rg.list.length ? 'Area marked.' : 'Nothing marked yet.'; if (nav.next) nav.next.disabled = !canEnter('segment', work.fs); };
      stage(rg, ph, true, changed);
      nav = navRow(panel, 'Next: Segment', canEnter('segment', work.fs), 'cnext');
      info.textContent = rg.list.length ? 'Area marked.' : 'Nothing marked yet.';
    }

    function stepSegment() {
      if (!work.photo || !work.rg) return go('photo');
      const rg = work.rg, ph = work.photo;
      el('h2', panel, 'Step 3. Segment Region');
      el('div', panel, 'This looks at the whole photo and finds the separate things in it: a bench, stairs, a railing. Your box is not a crop: nothing outside it is hidden. The box only tells us which found thing is yours. It usually takes under a minute; the first one after a quiet spell can take a bit longer.').className = 'muted';
      const msg = el('div', panel, work.segMsg); msg.className = 'muted'; msg.id = 'cseginfo';
      let hovered: number | null = null;
      const row = el('div', panel); row.className = 'row';
      const view: View = {
        list: () => work.cands.map((c, i) => ({ id: i, box: c.box, label: c.label, cutout: c.cutout, cls: `pick ${work.ticked.includes(i) ? 'sel' : ''} ${hovered === i ? 'hl' : ''}` })),
        hover: (id) => { hovered = id; paintHover(); },
        click: (id) => tick(id),
      };
      const st = stage(rg, ph, false, () => undefined, () => (work.cands.length ? view : undefined));
      const prog = el('div', panel); prog.id = 'cprog';
      const foundEl = el('div', panel); foundEl.id = 'cfound';
      const nav = navRow(panel, 'Next: Choose', work.fs.segmented, 'cnext');
      const skip = el('button', row, 'Skip the finder: use my box as it is', { id: 'cskip', title: 'Nothing is searched. Your box is cut out of the photo and made into a piece or a wallpaper. This always works.' });
      const run = el('button', row, work.fs.segmented ? 'Segment Region again' : 'Segment Region', { className: 'go', id: 'cseg' });
      row.prepend(run);
      const paintHover = () => { // only a class changes: nothing is rebuilt, so nothing can move under the mouse
        st.root.querySelectorAll('.box').forEach((b) => b.classList.toggle('hl', Number((b as HTMLElement).dataset.id) === hovered));
        foundEl.querySelectorAll('label').forEach((l) => l.classList.toggle('hl', Number((l as HTMLElement).dataset.i) === hovered));
      };
      const sync = () => {
        work.areas = work.ticked.map((i) => ({ id: i, box: work.cands[i].box, label: work.cands[i].label, cutout: work.cands[i].cutout }));
        work.fs = { ...work.fs, segmented: work.ticked.length > 0, choices: Object.fromEntries([...work.kinds].filter(([id]) => work.ticked.includes(id))) };
        if (nav.next) nav.next.disabled = !canEnter('choose', work.fs);
      };
      function tick(i: number) { work.ticked = toggleTick(work.ticked, i); sync(); showFound(); st.draw(); }
      function showFound() {
        foundEl.replaceChildren();
        if (!work.cands.length) return;
        el('div', foundEl, `Tick the things you want (up to ${MAX_PICKS}). The list keeps this order. Point at one to see where it is in the photo.`).className = 'muted';
        const grid = el('div', foundEl); grid.className = 'found';
        work.cands.forEach((c, i) => {
          const l = el('label', grid); l.dataset.i = String(i); l.className = work.ticked.includes(i) ? 'on' : '';
          const cb = el('input', l, '', { type: 'checkbox', checked: work.ticked.includes(i), id: `found-${i}` });
          const sw = el('s', l); if (c.cutout) sw.style.setProperty('--cut', `url(data:image/png;base64,${c.cutout})`);
          el('span', l, c.yours ? `${c.label} (your box)` : c.label);
          l.onmouseenter = () => { hovered = i; paintHover(); }; l.onmouseleave = () => { hovered = null; paintHover(); };
          cb.onchange = () => tick(i);
        });
        const left = MAX_PICKS - work.ticked.length;
        el('div', foundEl, work.ticked.length ? `${work.ticked.length} ticked${left ? '' : ' (the most you can make at once)'}.` : 'Tick at least one thing to go on.').className = 'muted';
      }
      const done = (found: Found[], note: string) => {
        work.cands = found; work.ticked = found.length ? [0] : []; work.kinds.clear();
        say(note); run.disabled = false; skip.disabled = false; sync(); showFound(); st.draw();
      };
      const say = (t: string, bad = false) => { work.segMsg = t; msg.textContent = t; msg.className = bad ? 'err' : 'muted'; if (bad) msg.setAttribute('role', 'alert'); else msg.removeAttribute('role'); };
      const mark = () => { const r = rg.list[0]; return r ? { box: r.box, label: r.label } : null; };
      skip.onclick = () => { const m = mark(); if (!m) return; done(buildFound(m, []).items, 'Nothing was searched. Your box is the area.'); };
      run.onclick = async () => {
        run.disabled = true; skip.disabled = true; prog.replaceChildren(); say('');
        const ctl = new AbortController(), bar = jobProgress(prog, SEGMENT_STEPS, () => ctl.abort());
        try {
          const found = await suggestRegions(ph, () => undefined, ctl.signal, bar.update);
          bar.finish();
          const { items } = buildFound(mark(), found);
          const n = items.length - 1;
          done(items, `Found ${found.length} thing${found.length === 1 ? '' : 's'} in the photo. The one on your box is ticked${n > 0 ? '; tick others to make several at once' : ''}.`);
        } catch (e) {
          bar.fail();
          const err = e as JobError;
          if (err instanceof SegmentOff) done(buildFound(mark(), []).items, err.message); // the finder is off here: your box is used as it is
          else if (err.stopped) { say('Stopped. You can try again or skip the finder.'); run.disabled = false; skip.disabled = false; }
          else { say(`${err.message} You can try again, or skip the finder.`, true); run.disabled = false; skip.disabled = false; }
        }
      };
      if (work.cands.length) { sync(); showFound(); }
    }

    function stepChoose() {
      if (!work.photo) return go('photo');
      const ph = work.photo;
      el('h2', panel, 'Step 4. Choose what each area becomes');
      el('div', panel, '3D piece: a solid thing you place in the World Editor and run over. Wallpaper: the area hangs behind a course as scenery. The course plays the same.').className = 'muted';
      const nav = navRow(panel, 'Next: Make', canEnter('make', work.fs), 'cnext');
      const sync = () => { work.fs = { ...work.fs, choices: Object.fromEntries(work.kinds) }; if (nav.next) nav.next.disabled = !canEnter('make', work.fs); };
      for (const r of work.areas) {
        const it = el('div', panel); it.className = 'item'; it.dataset.id = String(r.id);
        const th = el('img', it, '', { alt: r.label || 'area' }); void cropToThumb(ph.image, r.box).then((u) => { th.src = u; });
        const side = el('div', it); side.style.display = 'grid'; side.style.gap = '8px';
        const nm = el('input', side, '', { id: `cname-${r.id}`, placeholder: 'name it (bench)', value: work.names.get(r.id) ?? r.label, maxLength: 40 }); nm.setAttribute('list', 'cn');
        nm.oninput = () => work.names.set(r.id, nm.value.trim().toLowerCase());
        const bt = el('div', side); bt.className = 'row';
        for (const [k, label, id] of [['piece', '3D piece', 'piece'], ['wallpaper', 'Wallpaper', 'wall']] as [Kind, string, string][]) {
          const b = el('button', bt, label, { id: `choose-${id}-${r.id}`, className: 'pick' }); b.setAttribute('aria-pressed', String(work.kinds.get(r.id) === k));
          b.onclick = () => { if (work.kinds.get(r.id) === k) work.kinds.delete(r.id); else work.kinds.set(r.id, k); bt.querySelectorAll('.pick').forEach((x) => x.setAttribute('aria-pressed', String(x === b && work.kinds.get(r.id) === k))); sync(); };
        }
      }
      const dl = el('datalist', panel, '', { id: 'cn' }); for (const l of ['bench', 'bollard', 'railing', 'stairs', 'planter', 'wall', 'log', 'pull-up bar']) el('option', dl, '', { value: l });
      sync();
    }

    function stepMake() {
      if (!work.photo) return go('photo');
      const ph = work.photo;
      el('h2', panel, 'Step 5. Make them');
      const lastCourse: { id?: string } = {};
      const next = el('div', panel); next.id = 'cnow'; next.className = 'panel'; next.hidden = true;
      const showNext = (shared = false) => {
        next.hidden = false; next.replaceChildren(); el('h2', next, 'What next');
        const r = el('div', next); r.className = 'row';
        const lastPiece = work.made.pieces[work.made.pieces.length - 1];
        if (lastPiece) el('a', r, 'Open the World Editor', { className: 'btn go', id: 'go-editor', href: editorHref(lastPiece) });
        if (work.made.walls.length) el('a', r, 'Play a course with the wallpaper', { className: 'btn go', id: 'go-course', href: `${worldHref(lastCourse.id ? (savedWallpapers().find((w) => w.id === lastCourse.id)?.course ?? '') : '')}&wallpaper=${lastCourse.id}` });
        el('button', r, shared ? 'See it in Explore' : 'See them in Explore', { id: 'go-objects' }).onclick = () => showTab('explore');
        el('button', r, 'Start with another photo', { id: 'go-again' }).onclick = () => { work.step = 'photo'; work.photo = null; work.rg = null; work.fs = startState(); paint(); };
      };
      // Sharing is its own deliberate press: the piece or wallpaper is kept in this browser either way.
      const doShare = async (make: () => Promise<{ id: string; input: Parameters<typeof shareItem>[0]; local: { kind: 'piece' | 'wallpaper'; local: string } }>): Promise<string> => {
        const m = await make(); const out = await shareItem(m.input); rememberLink(out.id, m.local);
        return out.status === 'approved' ? 'Shared. Everyone can see it in Explore.' : 'Shared. You can see it in Explore now; everyone sees it after the safety check.';
      };
      const shareButton = (side: HTMLElement, rid: number, make: Parameters<typeof doShare>[0]) => {
        const row = el('div', side); row.className = 'row';
        const b = el('button', row, 'Share in Community', { id: `share-${rid}`, title: 'Show it in the Community gallery. You can delete it there any time.' });
        const note = el('div', side); note.className = 'muted'; note.id = `share-note-${rid}`;
        b.onclick = async () => {
          b.disabled = true; note.textContent = 'Sharing…'; note.className = 'muted';
          try { note.textContent = await doShare(make); b.textContent = 'Shared'; showNext(true); } catch (e) { note.textContent = (e as Error).message; note.className = 'err'; note.setAttribute('role', 'alert'); b.disabled = false; }
        };
      };

      // one lift per ticked piece; the prizes are shown one after another, never on top of each other
      let prizes: Promise<unknown> = Promise.resolve();
      const showPrize = (r: { box: Box }, res: { glb: ArrayBuffer; prov: { id: string; name: string; height_m: number } }) => {
        prizes = prizes.then(async () => {
          const end = await openPrize({
            glb: res.glb, name: res.prov.name, editorHref: editorHref(res.prov.id),
            share: () => doShare(async () => ({ id: res.prov.id, input: { kind: 'piece', name: res.prov.name, thumb: await cropToThumb(ph.image, r.box), glb: res.glb, height_m: res.prov.height_m }, local: { kind: 'piece', local: res.prov.id } })),
          });
          if (end === 'again') { work.step = 'segment'; paint(); }
        });
      };

      type Slot = { gen: HTMLButtonElement; msg: HTMLElement; prog: HTMLElement; r: (typeof work.areas)[number]; label: () => string; busy: boolean; made: boolean };
      const slots: Slot[] = [];
      const makeOne = async (sl: Slot): Promise<void> => {
        const { gen, msg, prog, r } = sl, label = sl.label();
        if (!LABEL_RE.test(label)) { msg.textContent = 'Name the area with a plain word like bench, railing, stairs or wall (Step 4).'; msg.className = 'err'; throw new Error('name'); }
        sl.busy = true; gen.disabled = true; gen.textContent = 'Making it…'; msg.textContent = ''; msg.className = 'muted'; prog.replaceChildren();
        const ctl = new AbortController(), bar = jobProgress(prog, LIFT_STEPS, () => ctl.abort());
        try {
          const res = await liftObject({ photo: ph, box: r.box, label, height_m: null }, () => undefined, ctl.signal, bar.update);
          bar.finish();
          try { await saveUserObject({ id: res.prov.id, glb: res.glb, prov: res.prov }); } catch { /* not kept after this visit */ }
          work.made.pieces.push(res.prov.id); sl.made = true; gen.textContent = 'Made'; msg.textContent = `Done in ${res.seconds} s. It is in the World Editor under "My pieces" as "📷 Mine: ${res.prov.name}".`; showNext();
          shareButton(msg.parentElement as HTMLElement, r.id, async () => ({ id: res.prov.id, input: { kind: 'piece', name: res.prov.name, thumb: await cropToThumb(ph.image, r.box), glb: res.glb, height_m: res.prov.height_m }, local: { kind: 'piece', local: res.prov.id } }));
          showPrize(r, res);
        } catch (e) {
          bar.fail();
          const err = e as JobError; gen.textContent = 'Generate Piece';
          msg.className = err.stopped ? 'muted' : 'err'; msg.setAttribute('role', 'alert');
          msg.textContent = err.stopped ? 'Stopped. The 3D maker may still finish in the background, and it still counts for today.' : err.message;
          if (err.final && err.retryAt) setTimeout(() => { gen.disabled = false; }, Math.min(err.retryAt - Date.now(), 2_000_000_000)); // the button comes back when the wait is over
          else gen.disabled = !!err.final;
          throw e;
        } finally { sl.busy = false; }
      };

      let allBtn: HTMLButtonElement | null = null, allNote: HTMLElement | null = null;
      const pieces = work.areas.filter((r) => work.kinds.get(r.id) === 'piece');
      if (pieces.length) {
        const q = el('div', panel); q.className = 'qrow';
        el('span', q, `${pieces.length} piece${pieces.length === 1 ? '' : 's'} to make. Each one is made on its own, one after another: ${COST_WORDS}.`).className = 'muted';
        if (pieces.length > 1) { allBtn = el('button', q, makeLabel(pieces.length), { className: 'go', id: 'make-all' }); allNote = el('span', q); allNote.className = 'muted'; allNote.id = 'make-all-note'; }
      }
      for (const r of work.areas) {
        const kind = work.kinds.get(r.id); if (!kind) continue;
        const it = el('div', panel); it.className = 'item'; it.dataset.id = String(r.id);
        const th = el('img', it, '', { alt: r.label || 'area' }); void cropToThumb(ph.image, kind === 'wallpaper' ? wallpaperCrop(r.box, ph.width, ph.height) : r.box).then((u) => { th.src = u; });
        const side = el('div', it); side.style.display = 'grid'; side.style.gap = '8px';
        const label = () => (work.names.get(r.id) || r.label || '').toLowerCase();
        const msg = el('div', side); msg.className = 'muted'; msg.id = `cmsg-${r.id}`;
        if (kind === 'piece') {
          el('strong', side, `3D piece: ${label() || '(name it in Step 4)'}`);
          const gen = el('button', side, 'Generate Piece', { className: 'go', id: `gen-${r.id}` });
          const prog = el('div', side);
          const sl: Slot = { gen, msg, prog, r, label, busy: false, made: false }; slots.push(sl);
          gen.onclick = () => { void makeOne(sl).catch(() => undefined); };
        } else {
          el('strong', side, 'Wallpaper');
          const nm = el('input', side, '', { id: `wname-${r.id}`, placeholder: 'give it a name', maxLength: 40, value: label() || 'my photo' });
          const sel = el('select', side, '', { id: `wcourse-${r.id}` }); for (const [v, l] of DEMOS) el('option', sel, l, { value: v });
          const save = el('button', side, 'Save wallpaper', { className: 'go', id: `wsave-${r.id}` });
          save.onclick = async () => {
            save.disabled = true;
            try {
              const id = `w${Date.now().toString(36)}`, thumb = await cropToThumb(ph.image, wallpaperCrop(r.box, ph.width, ph.height));
              if (!saveWallpaper({ id, name: nm.value.trim() || 'my photo', thumb, at: Date.now(), course: sel.value })) throw new Error('Your browser has no room to keep it.');
              work.made.walls.push(id); lastCourse.id = id; msg.textContent = 'Saved in this browser, and attached to that course.'; showNext();
              shareButton(side, r.id, async () => ({ id, input: { kind: 'wallpaper', name: nm.value.trim() || 'my photo', thumb, course: sel.value }, local: { kind: 'wallpaper', local: id } }));
            } catch (e) { msg.textContent = (e as Error).message; save.disabled = false; }
          };
        }
      }
      if (allBtn) {
        const btn = allBtn;
        btn.onclick = async () => {
          btn.disabled = true; slots.forEach((s) => { s.gen.disabled = true; });
          const todo = slots.filter((s) => !s.made && !s.busy);
          const out = await runQueue(todo, (s) => makeOne(s), LIFT_PARALLEL, (i, state) => {
            const s = todo[i];
            if (state === 'waiting') { s.msg.textContent = 'Waiting in line.'; s.msg.className = 'muted'; }
            if (allNote) allNote.textContent = `${todo.filter((_, k) => k <= i && state !== 'waiting').length} of ${todo.length} started.`;
          });
          const failed = out.filter((o) => o.status === 'rejected').length;
          if (allNote) allNote.textContent = failed ? `${todo.length - failed} made, ${failed} did not work. Press its own button to try again.` : `All ${todo.length} made.`;
          slots.forEach((s) => { if (!s.made) s.gen.disabled = false; });
        };
      }
      navRow(panel, null);
    }
    paint();
  }

  showTab(tabFor(params.get('mode'), params));
  return { backend: 'webgl2' };
}
