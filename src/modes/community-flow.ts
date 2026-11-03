import { addBadge, meetTheCrew, saysOn } from '../ui/says';
import { JobError, liftObject, piecesToday, shrinkPhoto, type Shrunk } from '../slice/object-lift-client';
import { LIFT_STEPS, SEGMENT_STEPS } from '../slice/stages';
import { jobProgress } from '../ui/job-progress';
import { LABEL_RE } from '../slice/object-lift';
import { suggestRegions } from '../slice/segment-client';
import { warmUp } from '../slice/warm-client';
import { deleteUserObject, listUserObjects, saveUserObject, type UserObject } from '../slice/user-objects';
import { receiptFor, deleteShared, forgetLink, links, rememberLink, sessionCode, shareItem } from '../community/share-client';
import { cropToThumb } from '../community/crop';
import { registerThumbSource, thumbOf } from '../ui/glb-thumb';
import type { PublicItem } from '../community/items';
import { listSharedPage } from '../community/share-client';
import { placeableShared, sharedSrc, useShared, LIFT_PARALLEL, MAX_PICKS, STEPS, TABS, allowedNow, buildFound, canEnter, dailyLine, editorHref, makeLabel, nextStep, prevStep, runQueue, queueWarning, startState, tabFor, toggleTick, whyNot, whyOff, type Box, type FlowState, type Found, type Kind, type PiecesToday, type Step, type Tab } from '../community/flow';
import { openPrize } from '../ui/prize';

// Community (CC-247): one screen, two tabs: Explore (finished work first) and Make your own, a stepper: Photo, Mark, Segment, Choose, Make.
// A photo gives objects only; courses come from World Slicing and the Editor. The finder looks at the whole photo and a click picks a found thing. Looks only: nothing here changes how a course is cleared.
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
.com .stage img{max-width:100%;max-height:52vh;display:block}
.com .box{position:absolute;border:2px solid #7a8a80;background:rgba(122,138,128,.10);cursor:pointer;box-sizing:border-box}.com .box:focus-visible{outline:3px solid #0f6b5c;outline-offset:2px}
.com .box.cut::before{content:'';position:absolute;inset:0;background:#2d9cdb;opacity:.5;-webkit-mask:var(--cut) center/100% 100% no-repeat;mask:var(--cut) center/100% 100% no-repeat}
.com .box.hl{z-index:2;border-color:#ffd166;background:rgba(255,209,102,.30)}
.com .found{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:8px 0}.com .found label{display:flex;gap:8px;align-items:center;border:1px solid #cfd6d0;border-radius:10px;padding:6px 10px;background:#fff;cursor:pointer}.com .found label.hl{border-color:#ffd166;box-shadow:0 0 0 2px #ffd166}.com .found label.on{border-color:#0f6b5c;background:#e7f3ef}.com .found s{display:inline-block;width:28px;height:28px;border-radius:4px;background:#2d9cdb;flex:none;-webkit-mask:var(--cut) center/100% 100% no-repeat;mask:var(--cut) center/100% 100% no-repeat}
.com .qrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0}
.com .box.sel{border-width:3px;border-color:#0f6b5c;background:rgba(15,107,92,.22)}
.com .box b{display:none}.com .box.hl b,.com .box.sel b,.com .box:focus b{display:block}
.com .box b{position:absolute;left:0;top:-20px;font:600 12px system-ui;background:#17201d;color:#fff;border-radius:4px;padding:1px 6px;white-space:nowrap}
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

  // the photo work survives a tab change, so looking at Objects does not lose your picks
  const work: { step: Step; photo: Shrunk | null; fs: FlowState; kinds: Map<number, Kind>; names: Map<number, string>; made: { pieces: string[] }; cands: Found[]; ticked: number[]; areas: { id: number; box: Box; label: string; cutout?: string }[]; segMsg: string } =
    { step: 'photo', photo: null, fs: startState(), kinds: new Map(), names: new Map(), made: { pieces: [] }, cands: [], ticked: [], areas: [], segMsg: '' };

  function showTab(t: Tab) {
    for (const id of Object.keys(tabBtn) as Tab[]) tabBtn[id].setAttribute('aria-selected', String(id === t));
    body.replaceChildren(); document.onkeydown = null; root.dataset.tab = t;
    if (t === 'make') { warmUp('mask'); photos(); } else explore();
  }

  // Explore: finished work first (premade courses), then one clear button, then pieces (premade examples and yours)
  function explore() {
    const sec = (title: string, text: string, id: string) => { const p = el('div', body); p.className = 'panel'; p.id = id; p.style.marginBottom = '14px'; el('h2', p, title); el('div', p, text).className = 'muted'; return p; };
    const mk = sec('Now make your own', 'Start with a photo of a place you know. The finder outlines the things in it, you click the one you want, and it becomes a 3D piece you can place in the World Editor. Courses are made in the World Slicer and the Editor.', 'ex-make');
    el('button', mk, 'Make your own', { className: 'go', id: 'make-own' }).onclick = () => showTab('make');

    const made = sec('Pieces people made', 'Each piece was made from a real photo, and the picture is the part of the photo it came from. Press Use to put one in your World Editor tray. Our examples come first, then yours, then the ones players shared.', 'ex-objects');
    const g = el('div', made); g.className = 'grid'; g.id = 'objgrid';
    const card = (img: string, title: string, sub: string, link?: [string, string]) => { const c = el('div', g); c.className = 'card'; if (img) el('img', c, '', { src: img, alt: title, loading: 'lazy' }); const d = el('div', c); el('strong', d, title); el('div', d, sub).className = 'muted'; if (link) el('a', d, link[0], { href: link[1] }); return c; };
    // CC-249: every piece card opens the same turntable; its picture does the same
    const lookButton = (c: HTMLElement, id: string, getGlb: () => Promise<ArrayBuffer>, name: string, href: string) => {
      const b = el('button', c.lastElementChild as HTMLElement, 'See Object', { id, title: 'See it turn on a turntable' }); b.style.marginTop = '6px';
      b.onclick = async () => { b.disabled = true; try { await openPrize({ glb: await getGlb(), name, editorHref: href, view: {} }); } catch { b.textContent = 'Could not open it'; } finally { b.disabled = false; } };
      const img = c.querySelector('img'); if (img) { img.style.cursor = 'pointer'; img.title = 'See Object'; img.onclick = () => b.click(); }
    };
    void (async () => {
      try {
        const [idx, prov] = await Promise.all([fetch('/assets/objects/index.json').then((r) => r.json()), fetch('/assets/objects/provenance.json').then((r) => r.json())]) as [{ objects: { name: string; photo: string; box: Box; label: string; glb: string }[] }, { objects: { glb: string; credit?: { line?: string } }[] }];
        // an example only appears with its picture: some source photos are not shipped, so those pieces are skipped (the next ones fill the row)
        const pics = await Promise.all(idx.objects.map((o) => cropToThumb(`/assets/park/${o.photo}.jpg`, o.box).catch(() => '')));
        let shown = 0;
        idx.objects.forEach((o, i) => {
          if (!pics[i] || shown >= 8) return;
          shown++;
          const credit = prov.objects.find((x) => x.glb.endsWith(o.glb))?.credit?.line ?? '';
          const ec = card(pics[i], `Example piece: ${o.label}`, credit || 'Made from a real photo', ['Use it in the World Editor', '?mode=editor&welcome=0']);
          lookButton(ec, `look-ex-${i}`, async () => (await fetch(`/assets/objects/${o.glb}`)).arrayBuffer(), `Example piece: ${o.label}`, '?mode=editor&welcome=0');
        });
      } catch { /* the examples are a bonus */ }
      const shared = links(), sharedLocal = new Set(Object.values(shared).map((l) => `${l.kind}:${l.local}`));
      let objs: UserObject[] = []; try { objs = await listUserObjects(); } catch { /* none kept */ }
      for (const o of objs) if (!sharedLocal.has(`piece:${o.id}`)) {
        // a piece made here and not shared yet: it keeps its picture, and sharing is a button you press when you want to (CC-249)
        registerThumbSource(`mine-${o.id}`, async () => o.glb);
        const pic = o.thumb || (await thumbOf(`mine-${o.id}`)) || '';
        const oc = card(pic, `Yours: ${o.prov.name}`, '3D piece, only in this browser', ['Open the World Editor', editorHref(o.id)]); lookButton(oc, `look-mine-${o.id}`, async () => o.glb, o.prov.name, editorHref(o.id));
        const side = oc.lastElementChild as HTMLElement, row = el('div', side); row.className = 'row'; row.style.marginTop = '6px';
        const sb = el('button', row, 'Share in Community', { id: `share-mine-${o.id}`, title: 'Show it in the Community gallery. You can delete it there any time.' });
        const note = el('div', side); note.className = 'muted'; note.id = `share-mine-note-${o.id}`;
        sb.onclick = async () => {
          sb.disabled = true; note.className = 'muted'; note.textContent = 'Sharing…'; addBadge(side, 'safety', { before: note });
          try {
            const out = await shareItem({ kind: 'piece', name: o.prov.name, thumb: pic, glb: o.glb, height_m: o.prov.height_m, receipt: receiptFor(o.id) });
            rememberLink(out.id, { kind: 'piece', local: o.id }); sb.textContent = 'Shared';
            note.textContent = out.status === 'approved' ? 'Shared. Everyone can see it.' : 'Shared. You can see it now; everyone sees it after the safety check.';
          } catch (e) { note.textContent = (e as Error).message; note.className = 'err'; note.setAttribute('role', 'alert'); sb.disabled = false; }
        };
      }
      // shared in Community: yours (with Delete) and everyone's approved ones
      // a search box, a kind filter and Show more: the shared list is served one page at a time, searched by name on the server
      const bar = el('div', made); bar.className = 'row'; bar.id = 'shared-controls'; made.insertBefore(bar, g);
      const find = el('input', bar, '', { id: 'shared-q', type: 'search', placeholder: 'Search pieces by name' }) as HTMLInputElement;
      const more = el('button', made, 'Show more', { id: 'shared-more' }); more.style.display = 'none';
      let cursor: string | null = null;
      const loadPage = async (reset: boolean) => {
        if (reset) { for (const n of [...g.querySelectorAll('[data-shared]')]) n.remove(); cursor = null; }
        let pg: Awaited<ReturnType<typeof listSharedPage>> = { items: [], next: null };
        try { pg = await listSharedPage({ q: find.value.trim(), cursor: cursor ?? undefined }); } catch { /* the list is a bonus */ }
        cursor = pg.next; more.style.display = pg.next ? '' : 'none';
        for (const it of pg.items) addItem(it);
      };
      let timer = 0;
      find.oninput = () => { clearTimeout(timer); timer = window.setTimeout(() => { void loadPage(true); }, 300); };
      more.onclick = () => { void loadPage(false); };
      const addItem = (it: PublicItem) => {
        const l = shared[it.id];
        const c = card(it.thumb ?? '', it.mine ? `Yours: ${it.name}` : it.name, `3D piece${it.mine ? (it.status === 'approved' ? ', shared with everyone' : ', shared: waiting for the safety check, only you see it') : ', made from part of their own photo and shared by a player'}`,
          it.kind === 'piece' && it.mine ? ['Open the World Editor', l?.kind === 'piece' ? editorHref(l.local) : '?mode=editor&welcome=0&uploadobj=1'] : undefined);
        c.dataset.shared = it.id; c.dataset.kind = it.kind;
        if (placeableShared(it) || (it.mine && it.kind === 'piece')) { // CC-249: any approved piece opens on the same turntable as a new piece
          const look = el('button', c.lastElementChild as HTMLElement, 'See Object', { id: `look-${it.id}`, title: 'See it turn on a turntable' });
          look.style.marginTop = '6px';
          look.onclick = async () => {
            look.disabled = true;
            try {
              const res = await fetch(`/api/community-items?id=${encodeURIComponent(it.id)}&file=glb`, { headers: { 'x-cc-session': sessionCode() } });
              if (!res.ok) throw new Error('no file');
              await openPrize({ glb: await res.arrayBuffer(), name: it.name, editorHref: editorHref(sharedSrc(it.id)), view: it.mine ? {} : { use: () => useShared({ id: it.id, name: it.name }) } });
            } catch { look.textContent = 'Could not open it'; } finally { look.disabled = false; }
          };
          const img = c.querySelector('img'); if (img) { img.style.cursor = 'pointer'; img.title = 'See Object'; img.onclick = () => look.click(); }
        }
        if (!it.mine && placeableShared(it)) { // someone else's approved piece: add it to your own list, then place it in the World Editor
          const d = c.lastElementChild as HTMLElement; const row = el('div', d); row.className = 'row'; row.style.marginTop = '6px';
          const use = el('button', row, 'Use in my World Editor', { id: `use-${it.id}`, className: 'go', title: 'Adds it to Add pieces in the World Editor' });
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
              if (link) void deleteUserObject(link.local).catch(() => undefined);
              c.remove();
            };
          };
        }
      };
      await loadPage(true);
    })();
    if (saysOn()) { const cr = sec('Meet the crew', 'Every message in the game says who is speaking. These are the guys behind the checks, the cut-outs and the characters.', 'ex-crew'); cr.append(meetTheCrew()); } // CC-243
  }

  function photos() {
    const bar = el('ol', body); bar.className = 'steps';
    const panel = el('div', body); panel.className = 'panel';
    const paint = () => {
      bar.replaceChildren();
      STEPS.forEach((s, i) => { const li = el('li', bar); const b = el('button', li, `${i + 1}. ${s.label}`, { id: `step-${s.id}`, className: s.id === work.step ? 'on' : i < STEPS.findIndex((x) => x.id === work.step) ? 'done' : '', disabled: !canEnter(s.id, work.fs) }); b.title = whyNot(s.id, work.fs); b.onclick = () => go(s.id); });
      panel.replaceChildren(); document.onkeydown = null; panel.dataset.step = work.step;
      ({ photo: stepPhoto, segment: stepSegment, make: stepMake })[work.step]();
    };
    const go = (s: Step) => { if (!canEnter(s, work.fs)) return; work.step = s; paint(); };
    const navRow = (parent: HTMLElement, nextLabel: string | null, nextOk = true, nextId = 'cnext') => {
      const row = el('div', parent); row.className = 'row';
      const pv = prevStep(work.step); if (pv) el('button', row, 'Back', { id: 'cback' }).onclick = () => go(pv);
      const nx = nextStep(work.step); const b = nextLabel && nx ? el('button', row, nextLabel, { className: 'go', id: nextId, disabled: !nextOk }) : null;
      if (b && nx) b.onclick = () => go(nx);
      return { row, next: b };
    };
    const useShrunk = (s: Shrunk) => { work.photo = s; work.fs = { ...startState(), hasPhoto: true }; work.kinds.clear(); work.names.clear(); work.cands = []; work.ticked = []; work.areas = []; work.segMsg = ''; work.made = { pieces: [] }; go('segment'); };

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
    /** The photo with the found things outlined on it. Hover lights one, a click (or Enter on a focused one) picks it. Nothing can be drawn here. */
    function stage(ph: Shrunk, viewOf: () => View | undefined) {
      const st = el('div', panel); st.className = 'stage';
      const img = el('img', st, '', { src: ph.image, alt: 'your photo', draggable: false });
      const k = () => ph.width / img.getBoundingClientRect().width;
      const draw = () => {
        const view = viewOf(); const had = (document.activeElement as HTMLElement | null)?.closest?.('.box') as HTMLElement | null, hadId = had && st.contains(had) ? had.dataset.id : null;
        st.querySelectorAll('.box').forEach((n) => n.remove()); const s = 1 / k();
        for (const r of view ? view.list() : []) {
          const b = el('div', st); b.className = `box ${r.cutout ? 'cut' : ''} ${r.cls}`; b.dataset.id = String(r.id);
          b.tabIndex = 0; b.setAttribute('role', 'checkbox'); b.setAttribute('aria-checked', String(r.cls.includes('sel'))); b.setAttribute('aria-label', `${r.label}: press Enter to pick it`);
          if (view) {
            b.onmouseenter = () => view.hover(r.id); b.onmouseleave = () => view.hover(null); b.onfocus = () => view.hover(r.id); b.onblur = () => view.hover(null);
            b.onclick = (e) => { e.stopPropagation(); view.click(r.id); };
            b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view.click(r.id); } };
          }
          Object.assign(b.style, { left: `${r.box[0] * s}px`, top: `${r.box[1] * s}px`, width: `${(r.box[2] - r.box[0]) * s}px`, height: `${(r.box[3] - r.box[1]) * s}px` });
          if (r.cutout) b.style.setProperty('--cut', `url(data:image/png;base64,${r.cutout})`);
          if (r.label) el('b', b, r.label);
          if (String(r.id) === hadId) b.focus();
        }
        st.dataset.count = String(view ? view.list().length : 0);
      };
      if (img.complete) draw(); else img.onload = draw;
      draw();
      return { draw, root: st };
    }

    function stepSegment() {
      if (!work.photo) return go('photo');
      const ph = work.photo;
      addBadge(panel, 'cutter', { after: el('h2', panel, 'Step 2. Pick the things') }); // CC-243: SAM 3 finds and outlines the things
      el('div', panel, 'The finder looks at the whole photo and outlines the separate things in it: a bench, stairs, a railing. You do not draw anything. When the outlines show up, you click the one you want. It usually takes under a minute; the first one after a quiet spell can take a bit longer.').className = 'muted';
      const msg = el('div', panel, work.segMsg); msg.className = 'muted'; msg.id = 'cseginfo';
      let hovered: number | null = null;
      const row = el('div', panel); row.className = 'row';
      const view: View = {
        list: () => work.cands.map((c, i) => ({ id: i, box: c.box, label: c.label, cutout: c.cutout, cls: `${work.ticked.includes(i) ? 'sel' : ''} ${hovered === i ? 'hl' : ''}` })),
        hover: (id) => { hovered = id; paintHover(); },
        click: (id) => tick(id),
      };
      const st = stage(ph, () => (work.cands.length ? view : undefined));
      const prog = el('div', panel); prog.id = 'cprog';
      const foundEl = el('div', panel); foundEl.id = 'cfound';
      const nav = navRow(panel, 'Next: Make', work.fs.segmented, 'cnext');
      const run = el('button', row, work.cands.length ? 'Segment Objects again' : 'Segment Objects', { className: 'go', id: 'cseg' });
      run.addEventListener('click', () => { warmUp('mask'); warmUp('lift'); }); // CC-133: the 3D maker loads while the outlines are found and a thing is picked
      const fall = el('div', panel); fall.className = 'row'; fall.id = 'cfall'; // shown only when nothing was found or the finder failed
      const showFall = () => {
        fall.replaceChildren();
        el('button', fall, 'Try again', { id: 'cretry' }).onclick = () => { fall.replaceChildren(); run.click(); };
        el('button', fall, 'Pick a different photo', { id: 'cpick' }).onclick = () => { work.step = 'photo'; paint(); };
      };
      const paintHover = () => { // only a class changes: nothing is rebuilt, so nothing can move under the mouse
        st.root.querySelectorAll('.box').forEach((b) => b.classList.toggle('hl', Number((b as HTMLElement).dataset.id) === hovered));
        foundEl.querySelectorAll('label').forEach((l) => l.classList.toggle('hl', Number((l as HTMLElement).dataset.i) === hovered));
      };
      const sync = () => {
        work.areas = work.ticked.map((i) => ({ id: i, box: work.cands[i].box, label: work.cands[i].label, cutout: work.cands[i].cutout }));
        work.fs = { ...work.fs, segmented: work.ticked.length > 0, choices: Object.fromEntries(work.ticked.map((id) => [id, 'piece'])) };
        for (const id of work.ticked) work.kinds.set(id, 'piece'); // every pick is a 3D piece
        if (nav.next) nav.next.disabled = !canEnter('make', work.fs);
      };
      function tick(i: number) { work.ticked = toggleTick(work.ticked, i); sync(); showFound(); st.draw(); }
      function showFound() {
        foundEl.replaceChildren();
        if (!work.cands.length) return;
        el('div', foundEl, `Click a thing in the photo to pick it, and click it again to put it back. You can pick up to ${MAX_PICKS} and make them all at once. Without a mouse: press Tab to move through the things and Enter to pick. This list is the same things, in a fixed order.`).className = 'muted';
        const grid = el('div', foundEl); grid.className = 'found';
        work.cands.forEach((c, i) => {
          const l = el('label', grid); l.dataset.i = String(i); l.className = work.ticked.includes(i) ? 'on' : '';
          const cb = el('input', l, '', { type: 'checkbox', checked: work.ticked.includes(i), id: `found-${i}` });
          const sw = el('s', l); if (c.cutout) sw.style.setProperty('--cut', `url(data:image/png;base64,${c.cutout})`);
          el('span', l, c.label);
          l.onmouseenter = () => { hovered = i; paintHover(); }; l.onmouseleave = () => { hovered = null; paintHover(); };
          cb.onchange = () => tick(i);
        });
        const left = MAX_PICKS - work.ticked.length;
        el('div', foundEl, work.ticked.length ? `${work.ticked.length} picked${left ? '' : ' (the most you can make at once)'}.` : 'Pick at least one thing to go on.').className = 'muted';
      }
      const say = (t: string, bad = false) => { work.segMsg = t; msg.textContent = t; msg.className = bad ? 'err' : 'muted'; if (bad) msg.setAttribute('role', 'alert'); else msg.removeAttribute('role'); };
      const done = (found: Found[], note: string) => {
        work.cands = found; work.ticked = []; work.kinds.clear();
        say(note); run.disabled = false; sync(); showFound(); st.draw();
        if (!found.length) showFall();
      };
      run.onclick = async () => {
        run.disabled = true; prog.replaceChildren(); fall.replaceChildren(); say('');
        const ctl = new AbortController(), bar = jobProgress(prog, SEGMENT_STEPS, () => ctl.abort());
        try {
          const found = await suggestRegions(ph, () => undefined, ctl.signal, bar.update);
          bar.finish();
          done(buildFound(found), found.length ? `Found ${found.length} thing${found.length === 1 ? '' : 's'} in the photo. Click the one you want.` : 'The finder did not find anything it could name in this photo. Try again, or pick a different photo.');
        } catch (e) {
          bar.fail();
          const err = e as JobError;
          if (err.stopped) say('Stopped. You can try again or pick a different photo.'); else say(`${err.message} You can try again, or pick a different photo.`, true);
          run.disabled = false; showFall();
        }
      };
      if (work.cands.length) { sync(); showFound(); }
    }

    function stepMake() {
      if (!work.photo) return go('photo');
      const ph = work.photo;
      addBadge(panel, 'builder', { after: el('h2', panel, 'Step 3. Make them') }); // CC-243: SAM 3D Objects lifts a cut-out into a solid piece
      const next = el('div', panel); next.id = 'cnow'; next.className = 'panel'; next.hidden = true;
      const showNext = (shared = false) => {
        next.hidden = false; next.replaceChildren(); el('h2', next, 'What next');
        const r = el('div', next); r.className = 'row';
        const lastPiece = work.made.pieces[work.made.pieces.length - 1];
        if (lastPiece) el('a', r, 'Open the World Editor', { className: 'btn go', id: 'go-editor', href: editorHref(lastPiece) });
        el('button', r, shared ? 'See it in Explore' : 'See them in Explore', { id: 'go-objects' }).onclick = () => showTab('explore');
        el('button', r, 'Start with another photo', { id: 'go-again' }).onclick = () => { work.step = 'photo'; work.photo = null; work.fs = startState(); paint(); };
      };
      // Sharing is its own deliberate press: the piece is kept in this browser either way.
      const doShare = async (make: () => Promise<{ id: string; input: Parameters<typeof shareItem>[0]; local: { kind: 'piece'; local: string } }>): Promise<string> => {
        const m = await make(); const out = await shareItem({ ...m.input, receipt: receiptFor(m.id) }); rememberLink(out.id, m.local);
        return out.status === 'approved' ? 'Shared. Everyone can see it in Explore.' : 'Shared. You can see it in Explore now; everyone sees it after the safety check.';
      };
      const shareButton = (side: HTMLElement, rid: number, make: Parameters<typeof doShare>[0]) => {
        const row = el('div', side); row.className = 'row';
        const b = el('button', row, 'Share in Community', { id: `share-${rid}`, title: 'Show it in the Community gallery. You can delete it there any time.' });
        const note = el('div', side); note.className = 'muted'; note.id = `share-note-${rid}`;
        b.onclick = async () => {
          b.disabled = true; note.textContent = 'Sharing…'; note.className = 'muted'; addBadge(side, 'safety', { before: note }); // CC-243: every share is looked at first
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

      type Slot = { gen: HTMLButtonElement; msg: HTMLElement; prog: HTMLElement; r: (typeof work.areas)[number]; label: () => string; busy: boolean; made: boolean; off: string };
      let today: PiecesToday | null = null, queueRunning = false, applyToday = () => undefined as void;
      const slots: Slot[] = [];
      const makeOne = async (sl: Slot): Promise<void> => {
        const { gen, msg, prog, r } = sl, label = sl.label();
        if (!LABEL_RE.test(label)) { msg.textContent = 'Name the area with a plain word like bench, railing, stairs or wall (in the name box).'; msg.className = 'err'; throw new Error('name'); }
        sl.busy = true; gen.disabled = true; gen.textContent = 'Making it…'; msg.textContent = ''; msg.className = 'muted'; prog.replaceChildren();
        const ctl = new AbortController(), bar = jobProgress(prog, LIFT_STEPS, () => ctl.abort());
        try {
          const res = await liftObject({ photo: ph, box: r.box, label, height_m: null }, () => undefined, ctl.signal, bar.update);
          bar.finish();
          try { await saveUserObject({ id: res.prov.id, glb: res.glb, prov: res.prov, thumb: await cropToThumb(ph.image, r.box).catch(() => '') }); } catch { /* not kept after this visit */ }
          work.made.pieces.push(res.prov.id); sl.made = true; gen.textContent = 'Made'; if (today) today = { ...today, left: Math.max(0, today.left - 1) }; applyToday(); msg.textContent = `Done in ${res.seconds} s. It is in the World Editor under "My pieces" as "📷 Mine: ${res.prov.name}".`; showNext();
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

      let allBtn: HTMLButtonElement | null = null, allNote: HTMLElement | null = null, dailyEl: HTMLElement | null = null, warnEl: HTMLElement | null = null;
      const pieces = work.areas.filter((r) => work.kinds.get(r.id) === 'piece');
      if (pieces.length) {
        const q = el('div', panel); q.className = 'qrow';
        el('span', q, `${pieces.length} piece${pieces.length === 1 ? '' : 's'} to make. Each one is its own lift, made one after another, so ${pieces.length === 1 ? 'it costs' : `${pieces.length} pieces cost ${pieces.length} times as much as one`}.`).className = 'muted';
        if (pieces.length > 1) { allBtn = el('button', q, makeLabel(pieces.length), { className: 'go', id: 'make-all' }); allNote = el('span', q); allNote.className = 'muted'; allNote.id = 'make-all-note'; }
        dailyEl = el('div', panel); dailyEl.className = 'muted'; dailyEl.id = 'daily-line'; dailyEl.textContent = 'Checking how many pieces you can make today.';
        warnEl = el('div', panel); warnEl.className = 'err'; warnEl.id = 'queue-warning'; warnEl.hidden = true;
      }
      for (const r of work.areas) {
        const kind = work.kinds.get(r.id); if (!kind) continue;
        const it = el('div', panel); it.className = 'item'; it.dataset.id = String(r.id);
        const th = el('img', it, '', { alt: r.label || 'area' }); void cropToThumb(ph.image, r.box).then((u) => { th.src = u; });
        const side = el('div', it); side.style.display = 'grid'; side.style.gap = '8px';
        const label = () => (work.names.get(r.id) || r.label || '').toLowerCase();
        const msg = el('div', side); msg.className = 'muted'; msg.id = `cmsg-${r.id}`;
        if (kind === 'piece') {
          el('strong', side, '3D piece');
          const nm = el('input', side, '', { id: `cname-${r.id}`, placeholder: 'name it (bench)', value: work.names.get(r.id) ?? r.label, maxLength: 40 }); nm.setAttribute('list', 'cn');
          nm.oninput = () => work.names.set(r.id, nm.value.trim().toLowerCase());
          const gen = el('button', side, 'Generate Piece', { className: 'go', id: `gen-${r.id}` });
          const prog = el('div', side);
          const sl: Slot = { gen, msg, prog, r, label, busy: false, made: false, off: '' }; slots.push(sl);
          gen.onclick = () => { void makeOne(sl).catch(() => undefined); };
        }
      }
      if (!document.getElementById('cn')) { const dl = el('datalist', panel, '', { id: 'cn' }); for (const l of ['bench', 'bollard', 'railing', 'stairs', 'planter', 'wall', 'log', 'pull-up bar']) el('option', dl, '', { value: l }); }
      // the daily count comes from the server before anything is pressed: a line by the button, a warning when the queue is longer than what is left, the extra ones switched off with a reason
      applyToday = () => {
        if (dailyEl) dailyEl.textContent = today ? dailyLine(today) : 'We could not read how many pieces you have left today. The 3D maker will tell you when you press the button.';
        const open = slots.filter((s) => !s.made);
        if (warnEl) { const w = queueWarning(open.length, today); warnEl.textContent = w; warnEl.hidden = !w; }
        if (allBtn) { const n = allowedNow(open.length, today); allBtn.textContent = makeLabel(n); if (!queueRunning) allBtn.disabled = n === 0; }
        if (queueRunning) return;
        open.forEach((s, i) => {
          const why = whyOff(i, today);
          if (why) { s.off = why; s.gen.disabled = true; s.gen.title = why; s.msg.textContent = why; s.msg.className = 'muted'; }
          else if (s.off) { s.off = ''; s.gen.disabled = false; s.gen.title = ''; s.msg.textContent = ''; }
        });
      };
      void piecesToday().then((t) => { today = t; applyToday(); });
      if (allBtn) {
        const btn = allBtn;
        btn.onclick = async () => {
          btn.disabled = true; queueRunning = true; slots.forEach((s) => { s.gen.disabled = true; });
          const todo = slots.filter((s) => !s.made && !s.busy).slice(0, allowedNow(slots.filter((s) => !s.made && !s.busy).length, today));
          const out = await runQueue(todo, (s) => makeOne(s), LIFT_PARALLEL, (i, state) => {
            const s = todo[i];
            if (state === 'waiting') { s.msg.textContent = 'Waiting in line.'; s.msg.className = 'muted'; }
            if (allNote) allNote.textContent = `${todo.filter((_, k) => k <= i && state !== 'waiting').length} of ${todo.length} started.`;
          });
          const failed = out.filter((o) => o.status === 'rejected').length;
          if (allNote) allNote.textContent = failed ? `${todo.length - failed} made, ${failed} did not work. Press its own button to try again.` : `All ${todo.length} made.`;
          queueRunning = false; slots.forEach((s) => { if (!s.made && !s.off) s.gen.disabled = false; }); applyToday();
        };
      }
      navRow(panel, null);
    }
    paint();
  }

  showTab(tabFor(params.get('mode'), params));
  return { backend: 'webgl2' };
}
