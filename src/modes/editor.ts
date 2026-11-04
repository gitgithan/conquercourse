import { HAZARDS, type Hazard } from '../course/hazard';
import { styleEditor } from '../ui/editor-ux';
import { applyMarquee, toggleId } from '../ui/selection';
import { organizeEditor } from '../ui/editor-layout';
import { startCourse } from './course';
import { readGlbMesh } from '../slice/glb';
import { type Provenance } from '../slice/provenance';
import { getUserObject, listUserObjects, saveUserObject, userObjectUrls, userSrc } from '../slice/user-objects';
import { openPhotoObject, uploadObjOn } from '../ui/photo-object';
import { registerThumbSource } from '../ui/glb-thumb';
import { isSharedSrc, placeParam, sharedGlbUrl, sharedSrc, useShared, usedShared } from '../community/flow';
import { LIBRARY } from '../slice/shapes';
import { CELL } from '../slice/slice';
import { newPiece, realSize, scaleToHeight, size, laneProfile, liftToRoof } from '../slice/world';
import type { CourseData } from '../course/course';
import { createView3d } from '../slice/view3d';
import { sceneFor } from '../slice/scene';
import { isHold } from '../slice/holds-world';
import { isTrack } from '../slice/track-world';
import { editorStart } from './editor/start';
import { pieceBounds } from '../slice/view-fit';
import { DEFAULT_WATER_LEVEL, levelOfSaved } from '../slice/editor-defaults';
import { createTools } from './editor/tools';
import { PRESETS } from '../slice/presets';
import { MAX_PIECES } from '../slice/suggest-prompt';
import { editorWords, simSaysPanel } from '../ui/sim-says';
import { EDIT_KEY, HIST_KEY, checkpointFor, piecesFromSource, readHandoff } from '../slice/roundtrip';
import { pageQuery, pageSearch } from '../flags';
import { createLaneCheck } from '../slice/lane-check-ui';
import { onEditorKey } from './editor/keys';
import { createHistory, type Snap } from './editor/history';
import { createHelper } from './editor/helper';
import { createMoves } from './editor/moves';
import { el } from './editor/dom';
import { createLane } from './editor/lane';
import type { PresetPlan } from '../slice/preset-plans';
import { createSearch } from './editor/search';
import { attachPlanMouse } from './editor/plan-mouse';
import { createLanePanel } from './editor/lane-panel';
import { createVerify } from './editor/verify';
import { createPlanDraw } from './editor/plan-draw';
import { createProfile } from './editor/profile';
import { createPiecePanel } from './editor/piece-panel';
import { createSelection } from './editor/selection';
import { createEditorState, isDevice, isSizeReference, type P, type Saved } from './editor/state';
import { finalText } from '../slice/lane-check';

// The World editor: build a world from pieces on a plan view, scale them (a toy brick becomes a block), turn, copy, crop and move them,
// choose the lane the runner takes (turn about the start, sideways, level), and play it. Everything is in metres.
const KEY = 'cc.world.v1';

export function startEditor(host: HTMLElement): { backend: 'webgl2' } {
  const style = document.createElement('style');
  style.textContent = `
    .ed{font:14px/1.35 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:hidden;padding:8px;display:grid;gap:8px;grid-template-columns:minmax(0,1fr) 510px;grid-template-rows:auto auto minmax(0,1fr)}
    .ed h1{margin:0;font-size:18px}.ed .top{grid-column:1/3;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .ed button,.ed select,.ed input[type=number],.ed a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:3px 9px;cursor:pointer;text-decoration:none}
    .ed .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}.ed button[aria-pressed=true]{background:#17201d;color:#fff}
    .ed .main{display:grid;grid-template-rows:minmax(0,2fr) minmax(0,1fr);gap:8px;min-height:0;min-width:0}
    .ed .planwrap{min-height:0;min-width:0;position:relative;background:#fff;border:1px solid #cfd6d0;border-radius:10px;overflow:hidden}
    .ed canvas{display:block;touch-action:none}
    .ed .howto{border:2px solid #0f6b5c;border-radius:10px;background:#fff;padding:7px 10px;display:grid;gap:4px;font-size:13px;color:#17201d}.ed .howto h2{margin:0;font-size:15px;color:#0f6b5c}.ed .howto ul{margin:0;padding-left:18px}.ed .howto li{margin:2px 0}.ed .howto kbd{font:700 12px system-ui;background:#17201d;color:#fff;border-radius:5px;padding:1px 6px;white-space:nowrap}
    .ed .profilewrap{background:#fff;border:1px solid #cfd6d0;border-radius:10px;overflow:hidden;min-width:0}
    .ed .aside{padding-bottom:46px;display:grid;gap:8px;grid-template-rows:auto auto minmax(0,1fr);align-content:start;min-height:0;overflow:hidden}.ed .helper{position:absolute;right:10px;bottom:10px;z-index:5;width:min(400px,calc(100% - 20px));height:min(330px,calc(100% - 20px));box-sizing:border-box;box-shadow:0 6px 24px #0003;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden}.ed .helper.closed{display:none}.ed .helper:has(#easiertiming:not([hidden]),#appliedtiming) .helper-engines{display:none}.ed .moves{position:absolute;left:10px;top:46px;z-index:5;width:min(380px,calc(100% - 20px));max-height:calc(100% - 56px);overflow:auto;box-sizing:border-box;box-shadow:0 6px 24px #0003;display:grid;gap:6px}.ed .moves.closed{display:none}.ed .moves .mv{display:grid;grid-template-columns:20px 1fr;gap:0 6px;font-size:13px}.ed .moves .mv .need{grid-column:2;color:#5b665f;font-size:12px}.ed .moves .yes{color:#0f6b5c;font-weight:700}.ed .moves .no{color:#a33}.ed .moves .sg{border-top:1px solid #dde3dd;padding-top:4px;font-size:13px}.ed .helper textarea{min-height:56px}.ed .reply{overflow:auto;font-size:13px;min-height:0}.ed textarea{font:inherit;width:100%;box-sizing:border-box;border:1px solid #b9c2bb;border-radius:8px;padding:4px 6px;resize:none}
    .ed .panel{background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:8px;display:grid;gap:5px;align-content:start}
    .ed label{display:grid;gap:1px;font-size:13px}.ed .muted{color:#58635d;font-size:12px}.ed .ok{border-left:4px solid #0f6b5c;padding:3px 6px;background:#f3f7f4;font-weight:600;font-size:13px}.ed .bad{border-left:4px solid #c0392b;padding:3px 6px;background:#fbeeee;font-weight:600;font-size:13px}
    .ed .pvrow{display:flex;gap:6px;align-items:flex-start;font-size:13px;margin:2px 0}.ed .pvrow input{margin-top:2px}
    .ed .piecebar{position:absolute;z-index:6;display:none;gap:4px;align-items:center;padding:4px;background:#fff;border:1px solid #17201d;border-radius:10px;box-shadow:0 2px 8px #0003;white-space:nowrap}
    .ed .piecebar button{white-space:nowrap;min-width:0;padding:4px 9px;font:600 12px system-ui,sans-serif}.ed .piecebar .sep{width:1px;align-self:stretch;background:#cfd6d0}
    .ed .row{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.ed input[type=range]{width:100%;margin:0}.ed input[type=number]{width:100%;box-sizing:border-box}
    @media(max-height:700px){.ed .muted.help{display:none}.ed .panel{gap:2px;padding:4px 7px}.ed .aside{gap:4px;padding-bottom:40px}}
    @media(max-width:800px){.ed{grid-template-columns:minmax(0,1fr) 220px}}`;  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'ed';
  host.appendChild(root);

  const ed = createEditorState();
  const lane = createLane(ed);
  const { coursePieces, ground, currentProfile, barsNow, dronePiece, recoilPiece, machineNow, trebuchetPivot, machineWrap, laneCourseAt, laneCourse, courseNow, xOfPiece, startBefore } = lane;
  const multiOn = pageQuery().get('editorui') !== 'old';
  const { chosen, chooseMany, moveWith, copyChosen, pasteClip, deleteChosen } = createSelection({ ed, multiOn, changed: () => changed(), redraw: () => { drawPanel(); draw(); drawProfile(); } });
  const startAt = () => editorStart(ed, currentProfile());
  const pendingObjects: Saved['pieces'] = []; // saved photo objects, loaded once the list is in

  // a new piece goes just past the last one, on the lane's line, so pieces do not pile up
  const freeSpot = (id: string) => { const m = lib(id).mesh(); const w = size(m).w * (id === 'brick' ? 15 : 1); const right = ed.pieces.reduce((r, p) => Math.max(r, p.x + (size(p.mesh).w * p.scale) / 2), 0); return { x: right + 1.5 + w / 2, z: 0 }; };
  const lib = (id: string) => LIBRARY.find((l) => l.id === id)!;
  const add = (id: string, at = { x: 0, z: 0 }): P => { const p: P = { ...newPiece(lib(id).label, lib(id).mesh(), at), src: id }; if (id === 'brick') p.scale = 15; ed.pieces.push(p); ed.selected = p.id; return p; };
  // the pieces of a saved world, built again from their sources (the photo objects come later, once their list is in)
  const buildPieces = (list: Saved['pieces']): P[] => piecesFromSource(list);
  const stayIds = new Set<number>(); // preset scenery that keeps its saved place
  function restore(s: Saved) {
    s = { ...s, pieces: s.pieces.filter((q) => !isSizeReference(q as P)) };
    ed.start = s.start;
    pendingObjects.push(...s.pieces.filter((q) => q.src.startsWith('obj:') || q.src.startsWith('user:') || isSharedSrc(q.src)));
    ed.pieces = buildPieces(s.pieces);
    ed.angle = s.angle; ed.offset = s.offset; ed.level = levelOfSaved(s);
    ed.floorChoice = (HAZARDS as readonly string[]).includes(s.floor ?? '') ? (s.floor as Hazard) : 'water';
  }
  function load() {
    try {
      restore(JSON.parse(localStorage.getItem(KEY) ?? '') as Saved);
    } catch {
      // a first world made of real objects (no blocks): a short run with one of each kind, loaded once the object list is in
      restore({ pieces: PRESETS[0].pieces, angle: 0, offset: 0, level: DEFAULT_WATER_LEVEL }); // CC-243: the default course has a real hang bar and the Lache, and the simulator swings on both
      ed.selected = null;
    }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pieces: ed.pieces.filter((p) => p.src && !p.src.startsWith('map:')).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale, ...(p.role ? { role: p.role } : {}) })), angle: ed.angle, offset: ed.offset, level: ed.level, floor: ed.floorChoice, ...(ed.start ? { start: ed.start } : {}) } satisfies Saved)); } catch { /* private window */ } };
  load();
  let mapCamera: { heading: number; pitch: number; distance?: number; target?: { x: number; z: number } } | null = null;
  try { // a place built in ?mode=map arrives once, as the whole world or as the buildings the player picked; it is not saved
    const m = JSON.parse(sessionStorage.getItem('cc.map.piece') ?? 'null') as { name: string; positions: number[]; indices: number[]; pieces?: { name: string; positions: number[]; indices: number[]; x: number; z: number }[]; camera?: { heading: number; pitch: number; distance?: number; target?: { x: number; z: number } }; lane?: { angle: number; offset: number; level: number; from: string }; objects?: Saved['pieces'] } | null;
    sessionStorage.removeItem('cc.map.piece');
    if (m) ed.start = undefined; // a new place chooses its own start
    if (m?.lane && [m.lane.angle, m.lane.offset, m.lane.level].every(Number.isFinite)) { ed.angle = m.lane.angle; ed.offset = m.lane.offset; ed.level = m.lane.level; document.documentElement.dataset.laneFrom = m.lane.from; } // CC-91: the lane the map proved, not the editor's own start
    if (m?.pieces?.length) { // picked buildings from the map flight (CC-79): separate pieces, each where it stood
      pendingObjects.length = 0;
      ed.pieces = m.pieces.map((q) => ({ ...newPiece(q.name, { positions: q.positions, indices: q.indices }), x: q.x, z: q.z, src: `map:${q.name}` }));
      ed.selected = ed.pieces[0].id; mapCamera = m.camera ?? null;
    } else if (m) { pendingObjects.length = 0; ed.pieces = [{ ...newPiece(m.name, { positions: m.positions, indices: m.indices }), src: `map:${m.name}` }]; ed.selected = ed.pieces[0].id; mapCamera = m.camera ?? null; }
    if (m?.objects?.length) pendingObjects.push(...m.objects); // CC-238: photo objects that stand on the place (the film's start scene)
  } catch { /* no place waiting */ }
  if (['place', 'slicer', 'slicer-unproved'].includes(document.documentElement.dataset.laneFrom ?? '') && ed.level !== 0 && ed.pieces.length) { for (const q of ed.pieces) q.y -= ed.level; ed.level = 0; } // owner 2026-11-01: the water always starts at 0, whether the lane came from a prepared place or from the Slicer's own cut; the place sinks by the cut height instead, so the proved lane is the same lane
  if (['place', 'slicer', 'slicer-unproved'].includes(document.documentElement.dataset.laneFrom ?? '') && ed.pieces.length) { const lift = liftToRoof(ground(), { angle: ed.angle, offset: ed.offset, level: ed.level }); if (lift > 0) for (const q of ed.pieces) q.y += lift; } // CC-165: a place proved under its cut (Valletta: roofs at 5.62 m, cut 6) must still read in the editor with the roof start
  // CC-80: coming from the Course ("Edit this course", "Make it easier"): the course's own pieces replace the saved world, and "Back to the Course" returns to it
  const handoff = readHandoff();
  if (handoff && !ed.pieces.some((q) => q.src?.startsWith('map:'))) {
    pendingObjects.length = 0;
    restore({ pieces: handoff.course.source!.pieces as Saved['pieces'], angle: handoff.course.source!.angle, offset: handoff.course.source!.offset, level: handoff.course.source!.level, floor: handoff.course.source!.floor, start: handoff.course.source!.start });
    ed.selected = null;
  }
  if (ed.selected === null) { const tr = ed.pieces.find((q) => isTrack(q)); if (tr) ed.selected = tr.id; } // a coaster opens with its dots showing (CC-244)
  let focusId: number | null = null; // the piece nearest the place the player was at (chosen once the lane exists)


  const top = el('div', root, { className: 'top' });
  el('h1', top, { text: 'World Editor' });
  const backLink = el('a', top, { text: 'Back to the Course', href: '?', className: 'btn go', id: 'backcourse' }); // from the Course it returns to that very course (CC-80)
  el('button', top, { text: 'Reset to starter scene', id: 'resetworld', title: 'Discard this saved world and restore the starter bench, box and rail' }).onclick = () => {
    if (!window.confirm('Discard this saved world and restore the starter scene?')) return;
    localStorage.removeItem(KEY);
    sessionStorage.removeItem('cc.map.piece');
    location.reload();
  };
  const addBar = el('div', root, { className: 'top' });
  el('strong', addBar, { text: 'Basic shapes:' });
  for (const l of LIBRARY) el('button', addBar, { text: l.label, id: `add-${l.id}` }).onclick = () => { add(l.id, freeSpot(l.id)); changed(); };
  // undo and redo: a snapshot after every change (pieces are copied shallowly; a crop makes a new mesh, so old meshes stay valid)
  const editHistory = createHistory({
    getPieces: () => ed.pieces, setPieces: (v) => { ed.pieces = v; }, getLane: () => ({ angle: ed.angle, offset: ed.offset, level: ed.level, ...(ed.start ? { start: ed.start } : {}) }), setLane: (v) => { ed.angle = v.angle; ed.offset = v.offset; ed.level = v.level; ed.start = v.start; },
    getSelected: () => ed.selected, setSelected: (v) => { ed.selected = v; }, undoBtn: () => undoBtn, redoBtn: () => redoBtn, changed,
  });
  const { hist, remember, goto } = editHistory;
  const undoBtn = el('button', top, { text: 'Undo (Ctrl+Z)', id: 'undo', title: 'Undo the last change (Ctrl+Z)' });
  const redoBtn = el('button', top, { text: 'Redo (Ctrl+Y)', id: 'redo', title: 'Redo the change you just undid (Ctrl+Y)' });
  undoBtn.disabled = redoBtn.disabled = true;
  undoBtn.onclick = () => goto(editHistory.hi - 1); redoBtn.onclick = () => goto(editHistory.hi + 1);
  // the Courses gallery asks before leaving when there is work to lose: anything past the starting undo step
  (window as unknown as { ccHasUnsavedChanges?: () => boolean }).ccHasUnsavedChanges = () => editHistory.hi > 0;
  // objects lifted from real photos (SAM 3D Objects, CC-38): each is a baked .glb at its real size
  const photoBar = addBar;
  // which photo made which 3D piece (CC-221): the credit shows under the name of the selected piece
  const provOf = new Map<string, Provenance>();
  const rememberUser = (id: string, glb: ArrayBuffer, prov: Provenance) => { userObjectUrls.set(userSrc(id), URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }))); provOf.set(userSrc(id), prov); };
  const addUserPiece = (id: string, glb: ArrayBuffer, prov: Provenance) => {
    rememberUser(id, glb, prov);
    const p: P = { ...newPiece(prov.name, readGlbMesh(glb), freeSpot('bench')), src: userSrc(id) };
    p.x = freeSpot('bench').x + size(p.mesh).w / 2;
    ed.pieces.push(p); ed.selected = p.id; changed();
  };
  void (async () => { try { const r = (await (await fetch('/assets/objects/provenance.json')).json()) as { objects: Provenance[] }; for (const o of r.objects) provOf.set(`obj:${o.glb}`, o); draw(); } catch { /* no provenance file: no credit line */ } })();
  if (uploadObjOn()) {
    el('button', photoBar, { text: 'Make an object from my photo…', id: 'makeobj', title: 'Draw a box round a real thing in your photo and get a 3D piece' }).onclick = () => openPhotoObject(async (r) => { try { await saveUserObject({ id: r.prov.id, glb: r.glb, prov: r.prov }); } catch { /* not kept after this visit */ } addUserPiece(r.prov.id, r.glb, r.prov); });
  }
  // the pieces you made from your own photos are always listed (CC-247), under "My pieces" at the top of Add pieces; this used to need ?uploadobj=1 and had no card in the picture grid
  void (async () => { try {
    const mineIds = await listUserObjects();
    for (const u of mineIds) { const b = el('button', photoBar, { text: `📷 Mine: ${u.prov.name}`, title: `From your photo. ${u.prov.credit.line}` }); b.dataset.object = u.id; b.dataset.fromPhoto = '1'; registerThumbSource(`mine-${u.id}`, async () => u.glb); b.onclick = () => addUserPiece(u.id, u.glb, u.prov); }
    const want = placeParam(pageSearch()); // ?place=<id>: the prize screen's "Open in the World Editor" has the piece ready to place
    const hit = want ? mineIds.find((u) => u.id === want) : undefined;
    if (hit) { addUserPiece(hit.id, hit.glb, hit.prov); try { const u = new URL(location.href); u.searchParams.delete('place'); history.replaceState(null, '', u); } catch { /* the address stays */ } }
  } catch { /* no saved objects */ } })();
  // pieces other players shared, which you added with "Use in my course" in the gallery (CC-247): listed under "Shared pieces", placed like any other
  const addSharedPiece = async (id: string, name: string): Promise<boolean> => {
    try {
      const r = await fetch(sharedGlbUrl(id));
      if (!r.ok) { ed.verdict = 'That shared piece is no longer available.'; draw(); return false; }
      const glb = await r.arrayBuffer(), src = sharedSrc(id);
      userObjectUrls.set(src, URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })));
      const p: P = { ...newPiece(name, readGlbMesh(glb), freeSpot('bench')), src };
      p.x = freeSpot('bench').x + size(p.mesh).w / 2;
      ed.pieces.push(p); ed.selected = p.id; changed(); return true;
    } catch { ed.verdict = 'That shared piece could not be loaded.'; draw(); return false; }
  };
  (window as unknown as { ccAddShared?: (id: string, name: string) => void }).ccAddShared = (id, name) => { void addSharedPiece(id, name).then((ok) => { if (ok) useShared({ id, name }); }); }; // a card found by searching the community in Add pieces
  for (const u of usedShared()) { const b = el('button', photoBar, { text: `🌐 Shared: ${u.name}`, title: 'Made by another player' }); b.dataset.sharedPiece = u.id; b.dataset.object = `shared-${u.id}`; b.onclick = () => { void addSharedPiece(u.id, u.name); }; }
  { const want = placeParam(pageSearch()); if (want.startsWith('shared:')) { const id = want.slice(7), name = usedShared().find((x) => x.id === id)?.name ?? 'Shared piece'; void addSharedPiece(id, name); try { const u = new URL(location.href); u.searchParams.delete('place'); history.replaceState(null, '', u); } catch { /* the address stays */ } } }
  void (async () => {
    try {
      const idx = (await (await fetch('/assets/objects/index.json')).json()) as { objects: { name: string; glb: string; label: string; height_m: number; author: string; hang_m?: number }[] };
      const hangOf = new Map(idx.objects.filter((o) => o.hang_m).map((o) => [`obj:${o.glb}`, o.hang_m as number]));
      el('strong', photoBar, { text: 'From real photos:' });
      for (const o of idx.objects) {
        const b = el('button', photoBar, { text: o.label, title: `Photo by ${o.author}` });
        b.dataset.object = o.name;
        b.onclick = async () => {
          try {
            const p: P = { ...newPiece(o.name, readGlbMesh(await (await fetch(`/assets/objects/${o.glb}`)).arrayBuffer()), freeSpot('bench')), src: `obj:${o.glb}` };
            p.x = freeSpot('bench').x + size(p.mesh).w / 2;
            // a hang bar (CC-110): the frame is scenery turned across the lane, and its crossbar is a hold at the real height, so collision is a bar and never the frame's mesh
            if (o.hang_m) { p.noGround = true; p.yaw = Math.PI / 2; p.x = freeSpot('bench').x + 0.5; ed.pieces.push(p); ed.pieces.push(addBarPiece(p.x, o.hang_m - 0.04, p.z)); ed.selected = p.id; changed(); return; }
            ed.pieces.push(p); ed.selected = p.id; changed();
          } catch { ed.verdict = 'That object could not be loaded.'; draw(); }
        };
      }
      // pieces saved from a past visit
      for (const q of pendingObjects) {
        if (isSizeReference({ src: q.src } as P) && ed.pieces.some(isSizeReference)) continue;
        try {
          const reference = isSizeReference({ src: q.src } as P);
          if (isSharedSrc(q.src)) { // another player's piece, fetched from the community store; skipped if it is gone or not approved
            const r = await fetch(sharedGlbUrl(q.src.slice(7))); if (!r.ok) continue;
            const glb = await r.arrayBuffer(); const name = usedShared().find((x) => sharedSrc(x.id) === q.src)?.name ?? 'Shared piece';
            userObjectUrls.set(q.src, URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })));
            ed.pieces.push({ ...newPiece(name, readGlbMesh(glb), { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: q.scale, ...(q.role ? { role: q.role } : {}) });
            continue;
          }
          const mine = q.src.startsWith('user:') ? await getUserObject(q.src.slice(5)) : undefined; // the player's own object, kept in this browser (CC-221)
          if (q.src.startsWith('user:') && !mine) continue;
          if (mine) rememberUser(mine.id, mine.glb, mine.prov);
          const url = reference ? `/assets/characters/${q.src.slice('obj:../characters/'.length)}` : `/assets/objects/${q.src.slice(4)}`;
          const mesh = readGlbMesh(mine ? mine.glb : await (await fetch(url)).arrayBuffer());
          const p: P = { ...newPiece(reference ? 'Person' : mine ? mine.prov.name : q.src, mesh, { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: reference ? 1 : q.scale, ...(q.role ? { role: q.role } : {}) };
          if (reference) Object.assign(p, scaleToHeight(p, 1.75));
          if (q.stay) stayIds.add(p.id);
          if (q.decor) p.noGround = true; // scenery: seen, but the lane check ignores it (the film's photo box, CC-238)
          if (hangOf.has(q.src)) p.noGround = true; // its crossbar is a saved hold of its own
          ed.pieces.push(p);
        } catch { /* a missing object is skipped */ }
      }
      for (const d of ed.pieces.filter((q) => q.noGround && q.src?.startsWith('obj:') && !hangOf.has(q.src) && !stayIds.has(q.id))) { // scenery sits on the roof under it, not in the air (CC-238)
        const pr = laneProfile(ed.pieces.filter((q) => !q.noGround), { angle: ed.angle, offset: ed.offset, level: ed.level }), u = d.x * Math.cos(ed.angle) + d.z * Math.sin(ed.angle), i0 = Math.floor(u / CELL) - Math.round((pr.origin ?? 0) / CELL);
        const w = Math.min(6, Math.ceil((size(d.mesh).w * d.scale) / 2 / CELL)), nm = pr.cells.length; // the nearest stretch of real roof wide enough to hold it (a street gap has none)
        let best = -1;

        for (let k = 0; k <= 80 && best < 0; k++) for (const j of k ? [i0 - k, i0 + k] : [i0]) { if (best >= 0 || j - w < 0 || j + w >= nm) continue; let ok = true; for (let i = j - w; i <= j + w; i++) if (pr.cells[i] == null) { ok = false; break; } if (ok) best = j; }
        if (best >= 0) { const du = (best - i0) * CELL; d.x += du * Math.cos(ed.angle); d.z += du * Math.sin(ed.angle); d.y = ed.level + Math.max(...pr.cells.slice(best - w, best + w + 1).map((h) => h as number)); }
      }
      if (pendingObjects.length) { pendingObjects.length = 0; changed(false); hist.length = 0; editHistory.hi = -1; remember(); onWorld(); fitAll(); } // the saved or first world is the starting point of the undo list
    } catch { /* no objects on this site */ }
  })();
  // the special pieces (bar, coaster, rope, devices, stacks, plank): each one is a module in editor/tools, mounted in toolbar order
  const tools = createTools({ ed, lane, addBar, changed, focusOn: (d, dist) => { ed.view.cx = d.x; ed.view.cz = d.z; view3d.look(0, 65, { x: d.x, z: d.z }, dist); } });
  const { addBarPiece } = tools;
  tools.mount();
  el('strong', addBar, { text: 'Size references:' });
  const demoScene = el('button', addBar, { text: 'Demo scene' });
  demoScene.dataset.object = 'demo-scene';
  demoScene.onclick = async () => {
    demoScene.disabled = true;
    try {
      const mesh = readGlbMesh(await (await fetch('/assets/demo/demo-scene.glb')).arrayBuffer());
      const p: P = { ...scaleToHeight(newPiece('demo-scene', mesh, { x: ed.view.cx - 3 * Math.sin(ed.angle), z: ed.view.cz + 3 * Math.cos(ed.angle) }), 1.75), src: 'obj:../demo/demo-scene.glb' };
      ed.pieces.push(p); ed.selected = p.id; changed();
    } catch { ed.verdict = 'That reference could not be loaded.'; draw(); }
    finally { demoScene.disabled = false; }
  };
  const file = el('input', addBar, { type: 'file', accept: '.glb' });
  file.hidden = true;
  el('button', addBar, { text: 'Import a .glb…', id: 'import' }).onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try { const p = scaleToHeight(newPiece(f.name.replace(/\.glb$/i, ''), readGlbMesh(await f.arrayBuffer()), { x: ed.view.cx, z: ed.view.cz }), 1); ed.pieces.push(p); p.x = freeSpot('bench').x; ed.selected = p.id; changed(); } catch { ed.verdict = 'That file could not be read as a .glb.'; draw(); }
  };

  const main = el('div', root, { className: 'main' });
  const planWrap = el('div', main, { className: 'planwrap' });
  const plan = el('canvas', planWrap, { width: 900, height: 520, id: 'plan' });
  // the 3D view is the main picture; the flat plan is kept for exact dragging and cropping (button "Top plan")
  const view3d = createView3d(planWrap, {
    pieces: () => ed.pieces, selected: () => ed.selected, lane: () => ({ angle: ed.angle, offset: ed.offset, level: ed.level }),
    start: startAt,
    select: (id) => { if (!(multiOn && id !== null && chosen().length > 1 && chosen().includes(id))) ed.group = []; ed.selected = id; drawPanel(); draw(); drawProfile(); },
    selectedAll: () => { const c = chosen(); return c.length > 1 ? c : []; },
    toggle: (id) => chooseMany(toggleId(chosen(), id)),
    marquee: (ids, additive) => chooseMany(applyMarquee(chosen(), ids, additive)),
    moved: (p, x, z) => { moveWith(p, x, z); draw(); drawProfile(); },
    dropped: () => changed(),
    interactionStart: () => interruptSearch(),
    interactionEnd: () => verify(),
    ghosts: () => ghostData(),
  });
  if (mapCamera) view3d.look(mapCamera.heading, mapCamera.pitch, mapCamera.target ?? { x: 0, z: 0 }, mapCamera.distance); // the 3D view starts where the map flight ended
  const bar = el('div', planWrap, { className: 'piecebar', id: 'piecebar' }); // the selected piece's tools, on the picture next to the piece (CC-94)
  const setView = (plan2d: boolean) => { ed.topPlan = plan2d; plan.style.display = plan2d ? 'block' : 'none'; view3d.show(!plan2d); viewBtn.textContent = plan2d ? '3D view' : 'Top plan'; viewBtn.setAttribute('aria-pressed', String(plan2d)); if (plan2d) fit(); };
  const viewBtn = el('button', top, { text: 'Top plan', id: 'viewmode', title: 'Switch between the 3D view and the flat plan (the plan is for cropping)' });
  viewBtn.onclick = () => setView(!ed.topPlan);
  // CC-177: Fit frames every piece (key F): a short smooth move in the 3D view, an instant zoom in the flat plan
  const fitBtn = el('button', top, { text: 'Fit', id: 'fitview', title: 'Bring the camera to your pieces so they all fit on the picture (key F)' });
  fitBtn.onclick = () => fitAll();
  // CC-243: predesigned courses: one that clears and one that is broken, to try Make it easier and the design partner on
  const presetPick = el('select', top, { id: 'presetpick', title: 'Open a ready-made course in place of the one on the screen' });
  el('option', presetPick, { text: 'Ready-made courses…', value: '' });
  for (const pr of PRESETS) el('option', presetPick, { text: pr.label, value: pr.id, title: pr.note });
  const PICK_KEY = 'cc-presetpick'; // the reload below forgets the choice, so the name of the course opened is kept for the page that comes back
  try { const k = sessionStorage.getItem(PICK_KEY); if (k && PRESETS.some((q) => q.id === k)) presetPick.value = k; } catch { /* private window */ }
  presetPick.onchange = () => {
    const pr = PRESETS.find((q) => q.id === presetPick.value);
    if (!pr) return;
    if (ed.pieces.length > 1 && !confirm('Replace the pieces on the screen with this course? Ctrl+Z will not bring them back.')) { presetPick.value = ''; return; }
    try { sessionStorage.removeItem(EDIT_KEY); } catch { /* the editor was not opened from a course */ } // a hand-off from the Course would put the old pieces back on reload
    try { sessionStorage.setItem(PICK_KEY, pr.id); } catch { /* private window */ }
    try { localStorage.setItem(KEY, JSON.stringify({ pieces: pr.pieces, angle: 0, offset: 0, level: 0, floor: ed.floorChoice } satisfies Saved)); } catch { /* private window */ }
    location.reload();
  };
  const profileWrap = el('div', main, { className: 'profilewrap' });
  const profileCanvas = el('canvas', profileWrap, { width: 900, height: 128, id: 'profile' });
  const aside = el('div', root, { className: 'aside' });
  const howto = el('div', aside, { className: 'howto', id: 'coasterhowto' }); // the coaster's instructions, boxed so they cannot be missed (CC-244)
  howto.innerHTML = '<h2>Shape the coaster</h2><ul><li><kbd>Double-click</kbd> the rail in the side view to add a dot.</li><li><kbd>Drag</kbd> a purple dot to move it.</li><li>Press <kbd>Space</kbd> in the game to jump off the cart any time.</li></ul>';
  const side = el('div', aside, { className: 'panel', id: 'panel' });
  const lanePanel = el('div', aside, { className: 'panel' });
  // CC-243: the Simulator speaks here, first thing in the side panel and always in view; it follows the verdict line and the lane check, whoever sets them
  const simSays = simSaysPanel('editor');
  if (simSays) {
    lanePanel.prepend(simSays.el); // drawLanePanel puts it back first each time it redraws the panel
    const sync = () => { const w = editorWords(lanePanel.querySelector('#verdict')?.textContent ?? '', document.documentElement.dataset.laneState ?? 'idle'); simSays.set(w.state, w.words); };
    new MutationObserver(sync).observe(lanePanel, { childList: true, subtree: true, characterData: true });
    sync();
  }
  const { drawProfile } = createProfile({ ed, profileCanvas, howto, currentProfile, barsNow, draw, drawPanel, changed: () => changed() });
  const proofResults = new Map<string, PresetPlan>();
  const previewSearch = createSearch({ progress: (p) => helperUi.previewProgress(p), results: proofResults, preview: true });
  const helperUi = createHelper({ ed, lane, root, top, aside, draw, drawProfile, changed, handoff, previewSearch, animateApply: (items) => view3d.animateApply(items) });
  const { adviceBox, setSuggest, showAdvice, runEasier, closePreview, ghostData } = helperUi;
  const movesUi = createMoves({ ed, lane, planWrap, addBarPiece, changed, helper: helperUi });

  // when the world is complete (its photo objects are in): open at the obstacle the player was at, and look for an easier way if that was asked
  let worldDone = false;
  function onWorld() {
    if (worldDone || !handoff) return;
    worldDone = true;
    const c0 = courseNow();
    const solid = ed.pieces.filter((q) => isHold(q) || realSize(q).h > 0.05);
    const near = [...(solid.length ? solid : ed.pieces)].sort((a, b) => Math.abs(xOfPiece(a, c0) - handoff.x) - Math.abs(xOfPiece(b, c0) - handoff.x))[0];
    if (near) { focusId = near.id; ed.selected = near.id; view3d.focus(near.x, near.z); drawPanel(); draw(); drawProfile(); }
    document.documentElement.dataset.fromcourse = handoff.intent;
    if (handoff.intent === 'easier') runEasier();
  }

  // the two pictures fill their boxes exactly, so nothing ever scrolls
  const fit = () => {
    plan.width = Math.max(200, planWrap.clientWidth); plan.height = Math.max(120, planWrap.clientHeight);
    profileCanvas.width = Math.max(200, profileWrap.clientWidth); profileCanvas.height = Math.max(60, profileWrap.clientHeight);
    draw(); drawProfile();
  };
  new ResizeObserver(fit).observe(planWrap);
  new ResizeObserver(fit).observe(profileWrap);
  setView(false);

  // ---- several pieces chosen (CC-200): a chip on the picture with the count, Delete and Clear, and a one-line hint for the box
  const selChip = el('div', planWrap, { id: 'selchip' });
  const selCount = el('strong', selChip, { id: 'selcount' });
  el('button', selChip, { text: 'Delete', id: 'seldelete', title: 'Delete every chosen piece (Delete key)' }).onclick = () => deleteChosen();
  el('button', selChip, { text: 'Clear', id: 'selclear', title: 'Choose nothing (Esc)' }).onclick = () => { ed.group = []; ed.selected = null; drawPanel(); draw(); drawProfile(); };
  const selHint = multiOn ? el('div', planWrap, { id: 'selhint', text: 'Shift + drag: choose several. Shift + click: add or drop one.' }) : null;
  const piecePanel = createPiecePanel({ ed, side, bar, planWrap, plan, selChip, selCount, selHint, view3d, tools, provOf, chosen, setView, sx: (x) => sx(x), sz: (z) => sz(z), drawProfile, changed: () => changed() });
  function drawPanel() { piecePanel.drawPanel(); }
  function placeBar() { piecePanel.placeBar(); }

  // ---- the lane
  function drawLanePanel() { lanePanelUi.drawLanePanel(); }

  function syncDeviceState() {
    const tre = ed.pieces.find((p) => p.src?.startsWith('device:trebuchet:'));
    ed.trebuchetKg = tre ? Number(tre.src!.split(':')[2]) || 1200 : null;
    if (!tre) ed.trebuchetExtra = {};
    const recoil = recoilPiece(), parts = recoil?.src?.split(':');
    ed.recoilCfg = recoil && parts ? { kind: parts[1] as 'cannon' | 'bigcannon', ballMass: Number(parts[2]) || 12, muzzle: Number(parts[3]) || 30 } : null;
    const dr = dronePiece(), dparts = dr?.src?.split(':');
    ed.droneCfg = dr && dparts ? { payload: Number(dparts[2]) || 70, battery: Number(dparts[3]) || 50 } : null;
    tools.sync();
  }
  const persistHist = () => editHistory.persist();
  // back to the Course: the same course, rebuilt from the pieces now, at the same obstacle (the Course reads this the way it reads a return from the Dojo)
  async function goToCourse() {
    if (!handoff) return;
    const base = courseNow();
    const course = withProof(base); // the plan of the lane check (stored, or just found) goes with the course: the Course does not search again
    course.scene = sceneFor(ground(), { angle: ed.angle, offset: ed.offset, level: ed.level }, course.uMap ?? []);
    const focus = ed.pieces.find((q) => q.id === ed.selected) ?? ed.pieces.find((q) => q.id === focusId);
    const retryX = focus ? startBefore(course, xOfPiece(focus, course)) : checkpointFor(course, handoff.zone);
    persistHist();
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course, world: null, retryX, facing: handoff.facing, falls: handoff.falls })); sessionStorage.removeItem(EDIT_KEY); } catch { /* the Course starts again */ }
    location.href = location.pathname; // no ?mode: the Course puts itself back from the resume
  }
  backLink.onclick = (e) => { if (handoff) { e.preventDefault(); void goToCourse(); } };
  const { stopSearch, searchClearable, withProof, proofFor } = createSearch({ progress: (p) => laneCheck.progress(p), results: proofResults });
  const launchCourse = (course: CourseData) => {
    // the real objects are drawn in the game instead of blocks (a cropped photo object is drawn whole; its collision is still the cropped lane)
    course.scene = sceneFor(ground(), { angle: ed.angle, offset: ed.offset, level: ed.level }, course.uMap ?? []);
    persistHist();
    root.remove(); style.remove();
    void startCourse(document.body, withProof(course));
  };
  const laneCheck = createLaneCheck({
    course: courseNow,
    stopWorker: stopSearch,
    playAnyway: () => { stopSearch(); launchCourse(courseNow()); }, // no plan goes along: the Course searches in its own worker and shows its own progress
    checkAgain: () => verify(0),
    stopped: (st) => {
      const text = finalText(st)?.line ?? ''; ed.verdict = text;
      delete document.documentElement.dataset.laneClear; document.documentElement.dataset.verdict = text; setSuggest(null);
      const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
      if (v) { v.textContent = text; v.className = 'says-when bad'; }
    },
  });
  const verifyUi = createVerify({ proofFor, ed, lanePanel, laneCheck: () => laneCheck, searchClearable, stopSearch, currentProfile, laneCourse, coursePieces, machineNow, trebuchetPivot, machineWrap, barsNow, adviceBox, setSuggest, showAdvice });
  function interruptSearch() { verifyUi.interruptSearch(); }
  function verify(pause = 800) { verifyUi.verify(pause); }

  // ---- drawing
  const planDraw = createPlanDraw({ ed, plan, view3d, chosen, placeBar, start: startAt, rubber: () => planMouse.rubber() });
  const { sx, sz, wx, wz } = planDraw;
  function draw() { planDraw.draw(); }

  const lanePanelUi = createLanePanel({ ed, lanePanel, root, style, remember, simSays, ground, courseNow, laneCourseAt, barsNow, searchClearable, laneCheck, verifyVersion: () => verifyUi.verifyVersion(), draw, drawProfile, save, verify, interruptSearch, launchCourse, persistHist });
  const planMouse = attachPlanMouse({ ed, plan, multiOn, wx, wz, chosen, chooseMany, moveWith, draw, drawProfile, drawPanel, changed: () => changed() });
  function fitAll() {
    const ps = ed.pieces.filter((q) => !isSizeReference(q) || ed.pieces.length === 1);
    const b = pieceBounds(ps);
    const start = startAt();
    b.x0 = Math.min(b.x0, start.x - 0.6); b.x1 = Math.max(b.x1, start.x + 0.6);
    b.z0 = Math.min(b.z0, start.z - 0.6); b.z1 = Math.max(b.z1, start.z + 0.6);
    b.bottom = Math.min(b.bottom ?? 0, start.y); b.top = Math.max(b.top, start.y + 1.75);
    if (ed.topPlan) {
      ed.view.cx = (b.x0 + b.x1) / 2; ed.view.cz = (b.z0 + b.z1) / 2;
      ed.view.ppm = Math.min(400, Math.max(0.5, Math.min(plan.width / Math.max(2, b.x1 - b.x0 + 2), plan.height / Math.max(2, b.z1 - b.z0 + 2))));
      draw();
    } else view3d.fit(b);
    document.documentElement.dataset.fitted = String(Date.now());
  }
  addEventListener('keydown', (e) => onEditorKey(e, {
    getPieces: () => ed.pieces, setPieces: (v) => { ed.pieces = v; }, getSelected: () => ed.selected, setSelected: (v) => { ed.selected = v; }, setGroup: (v) => { ed.group = v; },
    getHi: () => editHistory.hi, hasProposal: () => !!ed.proposal, hasHandoff: () => !!handoff,
    goto, copyChosen, pasteClip, closePreview, chosen, drawPanel, draw, drawProfile, deleteChosen, fitAll, goToCourse, changed,
    leave: () => { location.href = '?'; },
  }));

  // for the scripted browser checks: where each piece is on the picture, in page pixels (a probe, it changes nothing)
  (window as unknown as { ccPieceScreen?: () => { id: number; x: number; y: number }[] }).ccPieceScreen = () => {
    const host = ed.topPlan ? plan : view3d.el, r = host.getBoundingClientRect();
    return ed.pieces.filter((q) => !isSizeReference(q)).flatMap((q) => {
      const s = ed.topPlan ? { x: (sx(q.x) * r.width) / plan.width, y: (sz(q.z) * r.height) / plan.height } : view3d.project(q.x, q.y + realSize(q).h / 2, q.z);
      return s ? [{ id: q.id, x: r.left + s.x, y: r.top + s.y }] : [];
    });
  };
  function capPieces() { const real = ed.pieces.filter((q) => !isSizeReference(q) && !isDevice(q) && q.src !== 'hold:bar'); if (real.length <= MAX_PIECES) return; const drop = new Set(real.slice(MAX_PIECES).map((q) => q.id)); ed.pieces = ed.pieces.filter((q) => !drop.has(q.id)); if (ed.selected !== null && drop.has(ed.selected)) ed.selected = null; ed.verdict = `The editor keeps up to ${MAX_PIECES} pieces, so the last ones were not added. Delete one to make room.`; document.documentElement.dataset.capped = '1'; }
  function changed(record = true) { capPieces(); helperUi.onChanged(); if (record) remember(); syncDeviceState(); document.documentElement.dataset.pieces = String(ed.pieces.length); document.documentElement.dataset.band = ed.bandK ? String(ed.bandK) : ''; save(); drawPanel(); drawLanePanel(); draw(); drawProfile(); verify(); movesUi.renderMoves(); }
  syncDeviceState();
  drawPanel(); drawLanePanel(); draw(); drawProfile(); verify();
  remember();
  // the undo list from before the trip to the Course comes back when the world is the one it ended with (otherwise it starts again)
  if (handoff && !pendingObjects.length) {
    try {
      const h = JSON.parse(sessionStorage.getItem(HIST_KEY) ?? 'null') as { snaps: Saved[]; hi: number } | null;
      const last = h?.snaps[h.hi];
      const key = (x: { pieces: Saved['pieces']; angle: number; offset: number; level: number }) => JSON.stringify([x.pieces.map((q) => [q.src, q.x, q.z, q.y, q.yaw, q.scale]), x.angle, x.offset, x.level]);
      const mine: Saved = { pieces: ed.pieces.filter((q) => q.src).map((q) => ({ src: q.src as string, x: q.x, z: q.z, y: q.y, yaw: q.yaw, scale: q.scale })), angle: ed.angle, offset: ed.offset, level: ed.level };
      if (h && last && key(last) === key(mine)) {
        const snaps: Snap[] = h.snaps.map((sn) => ({ pieces: buildPieces(sn.pieces), angle: sn.angle, offset: sn.offset, level: sn.level, ...(sn.start ? { start: sn.start } : {}) }));
        hist.length = 0; hist.push(...snaps); editHistory.hi = h.hi;
        ed.pieces = hist[editHistory.hi].pieces.map((q) => ({ ...q })); ed.selected = null;
        undoBtn.disabled = editHistory.hi < 1; redoBtn.disabled = editHistory.hi >= hist.length - 1;
        drawPanel(); drawLanePanel(); draw(); drawProfile(); verify();
      }
    } catch { /* no history to bring back */ }
  }
  organizeEditor(root); // CC-94: the controls in one bar, one add menu, one dock, a command palette
  if (pageQuery().get('editorui') !== 'old') styleEditor(root); // CC-177: button levels, one Fix menu, a glossary (?editorui=old keeps the CC-94 look)
  if (!pendingObjects.length) onWorld(); // else onWorld runs when the saved photo objects are in
  document.documentElement.dataset.pieces = String(ed.pieces.length);
  return { backend: 'webgl2' };
}
