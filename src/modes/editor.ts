import { HAZARDS, HAZARD_INFO, type Hazard } from '../course/hazard';
import { styleEditor } from '../ui/editor-ux';
import { applyMarquee, countText, isMarquee, pickInRect, rectFrom, toggleId } from '../ui/selection';
import { organizeEditor } from '../ui/editor-layout';
import { startCourse } from './course';
import { readGlbMesh } from '../slice/glb';
import { creditLine, type Provenance } from '../slice/provenance';
import { getUserObject, listUserObjects, saveUserObject, userObjectUrls, userSrc } from '../slice/user-objects';
import { openPhotoObject, uploadObjOn } from '../ui/photo-object';
import { registerThumbSource } from '../ui/glb-thumb';
import { isSharedSrc, placeParam, sharedGlbUrl, sharedSrc, useShared, usedShared } from '../community/flow';
import { LIBRARY } from '../slice/shapes';
import { bestSlices, describe as describeLane, CELL, HALF_LANE, roofStartOn } from '../slice/slice';
import { crop, duplicate, hits, newPiece, realSize, scaleBy, scaleToHeight, size, worldSamples, laneProfile, liftToRoof } from '../slice/world';
import type { CourseData } from '../course/course';
import { xWindows, type SearchResult } from '../sim/ideal';
import { searchInput, storedPlanFor, withStoredPlan, type PresetPlan } from '../slice/preset-plans';
import { createView3d } from '../slice/view3d';
import { sceneFor } from '../slice/scene';
import { isTrack, TRACK_BLOCK_TEXT, type TrackBlock } from '../slice/track-world';
import { addTrackPoint, moveTrackPoint, trackDots } from './editor/track';
import { isHold, REACH_JUMPING, REACH_STANDING } from '../slice/holds-world';
import { personStart } from '../slice/person-ref';
import { DEFAULT_WATER_LEVEL, START_LABEL, START_SHORT, levelOfSaved, startMarkSide } from '../slice/editor-defaults';
import { createTools } from './editor/tools';
import { adviseMachine } from '../slice/fix-launch';
import { PRESETS } from '../slice/presets';
import { MAX_PIECES } from '../slice/suggest-prompt';
import { adviseLane } from '../slice/advice';
import { addBadge } from '../ui/says';
import { editorWords, simSaysPanel } from '../ui/sim-says';
import { adviceInWorker } from '../slice/proof-client';
import { EDIT_KEY, HIST_KEY, checkpointFor, piecesFromSource, readHandoff } from '../slice/roundtrip';
import { pageQuery, pageSearch } from '../flags';
import { createLaneCheck } from '../slice/lane-check-ui';
import { onEditorKey } from './editor/keys';
import { createHistory, type Snap } from './editor/history';
import { createHelper } from './editor/helper';
import { createMoves } from './editor/moves';
import { el } from './editor/dom';
import { createLane } from './editor/lane';
import { createSelection } from './editor/selection';
import { createEditorState, isDevice, isSizeReference, type P, type Saved } from './editor/state';
import { finalText, isStopped, type LaneProgress } from '../slice/lane-check';

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
    .ed .aside{padding-bottom:46px;display:grid;gap:8px;grid-template-rows:auto auto minmax(0,1fr);align-content:start;min-height:0;overflow:hidden}.ed .helper{position:absolute;right:10px;bottom:10px;z-index:5;width:min(400px,calc(100% - 20px));height:min(330px,calc(100% - 20px));box-sizing:border-box;box-shadow:0 6px 24px #0003;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden}.ed .helper.closed{display:none}.ed .moves{position:absolute;left:10px;top:46px;z-index:5;width:min(380px,calc(100% - 20px));max-height:calc(100% - 56px);overflow:auto;box-sizing:border-box;box-shadow:0 6px 24px #0003;display:grid;gap:6px}.ed .moves.closed{display:none}.ed .moves .mv{display:grid;grid-template-columns:20px 1fr;gap:0 6px;font-size:13px}.ed .moves .mv .need{grid-column:2;color:#5b665f;font-size:12px}.ed .moves .yes{color:#0f6b5c;font-weight:700}.ed .moves .no{color:#a33}.ed .moves .sg{border-top:1px solid #dde3dd;padding-top:4px;font-size:13px}.ed .helper textarea{min-height:56px}.ed .reply{overflow:auto;font-size:13px;min-height:0}.ed textarea{font:inherit;width:100%;box-sizing:border-box;border:1px solid #b9c2bb;border-radius:8px;padding:4px 6px;resize:none}
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
  let personChipReady = false; // the chip is built after the 3D view; the world redraws can run before that
  const personAt = () => personStart(ed.pieces, { angle: ed.angle, offset: ed.offset });
  const pendingObjects: Saved['pieces'] = []; // saved photo objects, loaded once the list is in

  // a new piece goes just past the last one, on the lane's line, so pieces do not pile up
  const freeSpot = (id: string) => { const m = lib(id).mesh(); const w = size(m).w * (id === 'brick' ? 15 : 1); const right = ed.pieces.reduce((r, p) => Math.max(r, p.x + (size(p.mesh).w * p.scale) / 2), 0); return { x: right + 1.5 + w / 2, z: 0 }; };
  const lib = (id: string) => LIBRARY.find((l) => l.id === id)!;
  const add = (id: string, at = { x: 0, z: 0 }): P => { const p: P = { ...newPiece(lib(id).label, lib(id).mesh(), at), src: id }; if (id === 'brick') p.scale = 15; ed.pieces.push(p); ed.selected = p.id; return p; };
  // the pieces of a saved world, built again from their sources (the photo objects come later, once their list is in)
  const buildPieces = (list: Saved['pieces']): P[] => piecesFromSource(list);
  function restore(s: Saved) {
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
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pieces: ed.pieces.filter((p) => p.src && !p.src.startsWith('map:')).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale, ...(p.role ? { role: p.role } : {}) })), angle: ed.angle, offset: ed.offset, level: ed.level, floor: ed.floorChoice } satisfies Saved)); } catch { /* private window */ } };
  load();
  let mapCamera: { heading: number; pitch: number; distance?: number; target?: { x: number; z: number } } | null = null;
  try { // a place built in ?mode=map arrives once, as the whole world or as the buildings the player picked; it is not saved
    const m = JSON.parse(sessionStorage.getItem('cc.map.piece') ?? 'null') as { name: string; positions: number[]; indices: number[]; pieces?: { name: string; positions: number[]; indices: number[]; x: number; z: number }[]; camera?: { heading: number; pitch: number; distance?: number; target?: { x: number; z: number } }; lane?: { angle: number; offset: number; level: number; from: string }; objects?: Saved['pieces'] } | null;
    sessionStorage.removeItem('cc.map.piece');
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
    restore({ pieces: handoff.course.source!.pieces as Saved['pieces'], angle: handoff.course.source!.angle, offset: handoff.course.source!.offset, level: handoff.course.source!.level, floor: handoff.course.source!.floor });
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
    getPieces: () => ed.pieces, setPieces: (v) => { ed.pieces = v; }, getLane: () => ({ angle: ed.angle, offset: ed.offset, level: ed.level }), setLane: (v) => { ed.angle = v.angle; ed.offset = v.offset; ed.level = v.level; },
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
          if (q.decor) p.noGround = true; // scenery: seen, but the lane check ignores it (the film's photo box, CC-238)
          if (hangOf.has(q.src)) p.noGround = true; // its crossbar is a saved hold of its own
          ed.pieces.push(p);
        } catch { /* a missing object is skipped */ }
      }
      for (const d of ed.pieces.filter((q) => q.noGround && q.src?.startsWith('obj:') && !hangOf.has(q.src))) { // scenery sits on the roof under it, not in the air (CC-238)
        const pr = laneProfile(ed.pieces.filter((q) => !q.noGround), { angle: ed.angle, offset: ed.offset, level: ed.level }), u = d.x * Math.cos(ed.angle) + d.z * Math.sin(ed.angle), i0 = Math.floor(u / CELL) - Math.round((pr.origin ?? 0) / CELL);
        const w = Math.min(6, Math.ceil((size(d.mesh).w * d.scale) / 2 / CELL)), nm = pr.cells.length; // the nearest stretch of real roof wide enough to hold it (a street gap has none)
        let best = -1;

        for (let k = 0; k <= 80 && best < 0; k++) for (const j of k ? [i0 - k, i0 + k] : [i0]) { if (best >= 0 || j - w < 0 || j + w >= nm) continue; let ok = true; for (let i = j - w; i <= j + w; i++) if (pr.cells[i] == null) { ok = false; break; } if (ok) best = j; }
        if (best >= 0) { const du = (best - i0) * CELL; d.x += du * Math.cos(ed.angle); d.z += du * Math.sin(ed.angle); d.y = ed.level + Math.max(...pr.cells.slice(best - w, best + w + 1).map((h) => h as number)); }
      }
      if (pendingObjects.length) { pendingObjects.length = 0; changed(false); hist.length = 0; editHistory.hi = -1; remember(); onWorld(); fitAll(); } // the saved or first world is the starting point of the undo list
      await firstVisitPerson(); // a first visit: the person for scale stands at the start of the lane
    } catch { /* no objects on this site */ }
  })();
  // the special pieces (bar, coaster, rope, devices, stacks, plank): each one is a module in editor/tools, mounted in toolbar order
  const tools = createTools({ ed, lane, addBar, changed, focusOn: (d, dist) => { ed.view.cx = d.x; ed.view.cz = d.z; view3d.look(0, 65, { x: d.x, z: d.z }, dist); } });
  const { addBarPiece } = tools;
  tools.mount();
  // size references: a Rookie (1.75 m, T-pose) and the demo scene, so a piece can be judged against a person
  el('strong', addBar, { text: 'Size references:' });
  for (const r of [{ id: 'person', label: 'Person reference (toggle)', url: '', src: '' }, { id: 'demo-scene', label: 'Demo scene', url: '/assets/demo/demo-scene.glb', src: 'obj:../demo/demo-scene.glb' }]) {
    const b = el('button', addBar, { text: r.label });
    b.dataset.object = r.id;
    b.onclick = async () => {
      if (r.id === 'person') {
        const person = ed.pieces.find(isSizeReference);
        if (person) { ed.pieces = ed.pieces.filter((p) => !isSizeReference(p)); if (ed.selected === person.id) ed.selected = null; changed(); return; }
      }
      b.disabled = true;
      try {
        const rookie = localStorage.getItem('cc.rookie') === 'b' ? 'b' : 'a';
        const url = r.id === 'person' ? `/assets/characters/rookie-${rookie}.glb` : r.url;
        const src = r.id === 'person' ? `obj:../characters/rookie-${rookie}.glb` : r.src;
        const at = r.id === 'person' ? personAt() : { x: ed.view.cx - 3 * Math.sin(ed.angle), z: ed.view.cz + 3 * Math.cos(ed.angle) };
        const p: P = { ...scaleToHeight(newPiece(r.id === 'person' ? 'Person' : r.id, readGlbMesh(await (await fetch(url)).arrayBuffer()), at), 1.75), src };
        ed.pieces.push(p); if (r.id !== 'person') ed.selected = p.id; changed();
      } catch { ed.verdict = 'That reference could not be loaded.'; draw(); }
      finally { b.disabled = false; }
    };
  }
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
    start: () => (roofStartOn() ? startMarkSide(currentProfile(), CELL) : null), // CC-200: with the roof start the flag stands on the first roof, at its height
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
  // the person for scale: a chip on the picture (bottom left) that shows them, finds them and hides them (CC-96)
  const personChip = el('div', planWrap, { id: 'personchip' });
  const personFind = el('button', personChip, { text: 'Show a person', id: 'personfind', title: 'Show a person for scale, or find them in the picture' });
  const personHide = el('button', personChip, { text: 'Hide', id: 'personhide', title: 'Hide the person' });
  const personThere = () => ed.pieces.some(isSizeReference);
  const rememberPerson = (on: boolean) => { try { localStorage.setItem('cc.person', on ? '1' : '0'); } catch { /* the chip still works */ } };
  const personButton = () => addBar.querySelector<HTMLElement>('[data-object="person"]');
  const framePerson = () => { const p = ed.pieces.find(isSizeReference); if (!p) return; ed.view.cx = p.x; ed.view.cz = p.z; view3d.look(25, 58, { x: p.x, z: p.z }, 7); view3d.pulse(p.x, p.z); };
  const waitForPerson = async (want: boolean) => { for (let i = 0; i < 60 && personThere() !== want; i++) await new Promise((r) => setTimeout(r, 100)); };
  personFind.onclick = async () => { if (!personThere()) { personButton()?.click(); rememberPerson(true); await waitForPerson(true); } framePerson(); syncPersonChip(); };
  personHide.onclick = async () => { if (personThere()) personButton()?.click(); rememberPerson(false); await waitForPerson(false); syncPersonChip(); };
  function syncPersonChip() {
    if (!personChipReady) return;
    const on = personThere();
    personFind.textContent = on ? 'Find the person' : 'Show a person'; personFind.setAttribute('aria-pressed', String(on)); personHide.style.display = on ? '' : 'none';
  }
  personChipReady = true; syncPersonChip();
  // a first visit: the person stands at the start of the lane until the player hides them (the chip remembers the choice)
  async function firstVisitPerson() {
    let first = false; try { first = localStorage.getItem('cc.person') === null; } catch { /* no storage */ }
    if (first && !personThere()) { personButton()?.click(); await waitForPerson(true); rememberPerson(true); hist.length = 0; editHistory.hi = -1; remember(); onWorld(); }
  }
  const bar = el('div', planWrap, { className: 'piecebar', id: 'piecebar' }); // the selected piece's tools, on the picture next to the piece (CC-94)
  const setView = (plan2d: boolean) => { ed.topPlan = plan2d; plan.style.display = plan2d ? 'block' : 'none'; view3d.show(!plan2d); viewBtn.textContent = plan2d ? '3D view' : 'Top plan'; viewBtn.setAttribute('aria-pressed', String(plan2d)); if (plan2d) fit(); };
  const viewBtn = el('button', top, { text: 'Top plan', id: 'viewmode', title: 'Switch between the 3D view and the flat plan (the plan is for cropping)' });
  viewBtn.onclick = () => setView(!ed.topPlan);
  // CC-177: Fit frames every piece (key F): a short smooth move in the 3D view, an instant zoom in the flat plan
  const fitBtn = el('button', top, { text: 'Fit', id: 'fitview', title: 'Bring the camera to your pieces so they all fit on the picture (key F)' });
  fitBtn.onclick = () => fitAll();
  // CC-243: predesigned courses: one that clears and one that is broken, to try Fix it on
  const presetPick = el('select', top, { id: 'presetpick', title: 'Open a ready-made course in place of the one on the screen' });
  el('option', presetPick, { text: 'Ready-made courses…', value: '' });
  for (const pr of PRESETS) el('option', presetPick, { text: pr.label, value: pr.id, title: pr.note });
  presetPick.onchange = () => {
    const pr = PRESETS.find((q) => q.id === presetPick.value);
    if (!pr) return;
    if (ed.pieces.length > 1 && !confirm('Replace the pieces on the screen with this course? Ctrl+Z will not bring them back.')) { presetPick.value = ''; return; }
    try { sessionStorage.removeItem(EDIT_KEY); } catch { /* the editor was not opened from a course */ } // a hand-off from the Course would put the old pieces back on reload
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
    const sync = () => { const w = editorWords(lanePanel.querySelector('#verdict')?.textContent ?? '', document.documentElement.dataset.laneState ?? 'idle'); simSays.set(w.state, w.state === 'checking' && document.documentElement.dataset.laneProgress ? `${w.words} ${document.documentElement.dataset.laneProgress}.` : w.words); };
    new MutationObserver(sync).observe(lanePanel, { childList: true, subtree: true, characterData: true });
    sync();
  }
  const helperUi = createHelper({ ed, lane, root, top, aside, chosen, draw, drawProfile, changed, handoff, goToCourse, tools });
  const { helper, helperBtn, reply, adviceBox, setSuggest, showAdvice, runEasier, closePreview, ghostData } = helperUi;
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
  function syncSelChip() {
    const n = chosen().length;
    selChip.style.display = n > 1 ? 'flex' : 'none';
    selCount.textContent = countText(n);
    document.documentElement.dataset.selected = String(n);
    if (selHint) selHint.style.display = n > 1 || ed.topPlan ? 'none' : 'block';
  }
  // ---- the selected piece's tools, on the picture (CC-94): turn, scale, copy, crop, delete
  function pieceBar(p: P | null) {
    bar.replaceChildren();
    if (!p || isSizeReference(p)) { bar.style.display = 'none'; return; }
    const b = (text: string, id: string | undefined, title: string, fn: () => void) => { const x = el('button', bar, { text, ...(id ? { id } : {}), title }); x.onclick = fn; return x; };
    if (!isDevice(p)) {
      b('↺ 15°', 'turnleft', 'Turn the piece 15 degrees to the left', () => { p.yaw -= Math.PI / 12; changed(); });
      b('↻ 15°', 'turnright', 'Turn the piece 15 degrees to the right', () => { p.yaw += Math.PI / 12; changed(); });
      el('span', bar, { className: 'sep' });
      for (const [t, k] of [['× 0.5', 0.5], ['× 2', 2], ['× 10', 10]] as const) b(t, undefined, `Make the piece ${k} times its size`, () => { Object.assign(p, scaleBy(p, k)); changed(); });
      el('span', bar, { className: 'sep' });
      b('Copy', 'dup', 'Copy and paste the piece next to itself', () => { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; ed.pieces.push(q); ed.selected = q.id; changed(); });
      const cb = b(ed.cropMode ? 'Drag a box on the plan' : 'Crop', 'crop', 'Cut away what you do not need: drag a box on the flat plan', () => { ed.cropMode = !ed.cropMode; if (ed.cropMode && !ed.topPlan) setView(true); drawPanel(); });
      cb.setAttribute('aria-pressed', String(ed.cropMode));
      el('span', bar, { className: 'sep' });
    }
    b('Delete', 'del', 'Delete the piece (Delete key)', () => { ed.pieces = ed.pieces.filter((q) => q !== p); ed.selected = null; changed(); });
    bar.style.display = 'flex'; placeBar();
  }
  // next to the selected piece: above its top on the 3D picture (below it when there is no room), clamped inside the picture
  function placeBar() {
    const p = ed.pieces.find((q) => q.id === ed.selected && !isSizeReference(q));
    if (!p || bar.style.display === 'none') return;
    const W = planWrap.clientWidth, H = planWrap.clientHeight, bw = bar.offsetWidth, bh = bar.offsetHeight;
    const r = realSize(p);
    let cx: number, top: number, bottom: number;
    if (ed.topPlan) { const k = plan.clientWidth / plan.width, half = (Math.max(r.w, r.d) / 2) * ed.view.ppm * k; cx = sx(p.x) * k; top = sz(p.z) * k - half - bh - 8; bottom = sz(p.z) * k + half + 8; }
    else { const a = view3d.project(p.x, p.y + r.h, p.z), g = view3d.project(p.x, p.y, p.z); if (!a || !g) { bar.style.visibility = 'hidden'; return; } cx = a.x; top = a.y - bh - 10; bottom = g.y + 10; }
    bar.style.visibility = 'visible';
    bar.style.left = `${Math.round(Math.min(Math.max(cx - bw / 2, 4), Math.max(4, W - bw - 4)))}px`;
    bar.style.top = `${Math.round(Math.min(Math.max(top >= 4 ? top : bottom, 4), Math.max(4, H - bh - 4)))}px`;
  }
  view3d.onCamera(placeBar);

  // ---- the selected piece
  function drawPanel() {
    syncPersonChip();
    side.replaceChildren();
    syncSelChip();
    if (chosen().length > 1) { el('strong', side, { text: countText(chosen().length) }); el('div', side, { className: 'muted', text: 'Delete removes them all. Ctrl+C then Ctrl+V copies them. Esc clears the choice. Shift+click adds or drops one.' }); pieceBar(null); return; }
    const p = ed.pieces.find((q) => q.id === ed.selected && !isSizeReference(q));
    el('strong', side, { text: p ? p.name : 'No piece chosen' });
    if (!p) { pieceBar(null); el('div', side, { className: 'muted', text: 'Click a piece on the picture to choose it. Drag it to move it. Scroll to zoom, drag the background to pan.' }); return; }
    if (isDevice(p)) {
      const u = p.x * Math.cos(ed.angle) + p.z * Math.sin(ed.angle);
      const sameKind = ed.pieces.filter((q) => p.src?.startsWith('device:trebuchet:') ? q.src?.startsWith('device:trebuchet:') : p.src?.startsWith('device:drone:') ? q.src?.startsWith('device:drone:') : q.src?.startsWith('device:cannon:'));
      const active = sameKind[0]?.id === p.id;
      el('div', side, { className: 'muted', text: `${active ? 'Active in the course simulation' : 'Extra movable copy; the course currently simulates the first device of this type'} at ${u.toFixed(1)} m along the lane. Drag it in the 3D view or top plan. Size and orientation stay fixed.` });
      pieceBar(p);
      return;
    }
    const prov = p.src ? provOf.get(p.src) : undefined;
    if (prov) { const c = el('div', side, { id: 'credit', className: 'muted', text: prov.credit.line || creditLine(prov.credit, prov.source) }); c.title = `Made from a photo (${prov.photo.width} x ${prov.photo.height}) with ${prov.pipeline.model}; box ${prov.box.join(', ')}; photo fingerprint ${prov.photo.sha256.slice(0, 12)}`; }
    tools.panel(p as P, side);
    const r = realSize(p);
    const sizes = el('details', side, { id: 'sizes' }); el('summary', sizes, { text: 'Size and height' }); // the numbers stay here, folded: the simulator says whether the lane clears
    el('div', sizes, { id: 'realsize', className: 'muted', text: `Real size: ${r.w.toFixed(2)} × ${r.d.toFixed(2)} m, ${r.h.toFixed(2)} m high (scale ×${p.scale.toPrecision(3)})` });
    const lab = el('label', sizes, { text: 'Real height (m): make it this tall' });
    const h = el('input', lab, { type: 'number', min: '0.02', max: '60', step: '0.05', value: r.h.toFixed(2), id: 'realheight' });
    h.onchange = () => { const v = Number(h.value); if (v > 0) { Object.assign(p, scaleToHeight(p, v)); changed(); } };
    const lift = el('label', sizes, { text: `Height off the ground: ${p.y.toFixed(2)} m` });
    const ly = el('input', lift, { type: 'range', min: isTrack(p) ? String(Math.max(0, ed.level)) : '0', max: (isHold(p) || p.role === 'bar') ? '8' : '4', step: '0.05', value: String(p.y), id: 'lift' });
    ly.oninput = () => { p.y = Number(ly.value); lift.firstChild!.textContent = `Height off the ground: ${p.y.toFixed(2)} m`; drawProfile(); };
    ly.onchange = () => changed();
    pieceBar(p);
  }

  // ---- the lane
  function drawLanePanel() {
    lanePanel.replaceChildren();
    if (simSays) lanePanel.prepend(simSays.el);
    el('strong', lanePanel, { text: 'The lane the runner takes', title: 'The runner goes left to right along the orange band; the shapes in it are what you see underneath.' }); // the long help line moved here: the panel must fit at 1024 x 640
    const slider = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const l = el('label', lanePanel, { text: `${label}: ${fmt(get())}` });
      const i = el('input', l, { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(get()) });
      i.oninput = () => { set(Number(i.value)); l.firstChild!.textContent = `${label}: ${fmt(get())}`; draw(); drawProfile(); };
      i.onchange = () => { save(); verify(); };
    };
    slider('Turn about the start', 'angle', 0, 180, 5, () => Math.round((ed.angle * 180) / Math.PI), (v) => { ed.angle = (v * Math.PI) / 180; ed.pieces.filter(isDevice).forEach((p) => { p.yaw = ed.angle; }); }, (v) => `${v}°`);
    slider('Sideways', 'offset', -30, 30, 0.5, () => ed.offset, (v) => (ed.offset = v), (v) => `${v.toFixed(1)} m`);
    slider('Where the water starts (level)', 'level', 0, 4, 0.05, () => ed.level, (v) => (ed.level = v), (v) => `${v.toFixed(2)} m`);
    const bestBtn = el('button', lanePanel, { text: 'Find the best lane for me', id: 'best' });
    bestBtn.onclick = async () => {
      if (document.documentElement.dataset.laneClear === '1') { ed.verdict = 'This lane is already proved by the simulator, so it stays.'; drawLanePanel(); return; } // a fix the simulator just proved is never swapped for a lane it has not
      const s = worldSamples(ground());
      const found = bestSlices({ positions: Array.from(s) }, { top: 8, prove: false, levels: [ed.level], centre: { x: 0, z: 0 }, reprofile: (c) => laneProfile(ground(), c) }); // the editor's rod is the origin, so the lane it finds is the lane it shows
      bestBtn.disabled = true; bestBtn.textContent = 'Checking lanes…';
      let pick: (typeof found)[number] | null = null;
      for (const c of found) { if (await searchClearable(laneCourseAt({ angle: c.angle, offset: c.offset, level: c.level })) === true) { pick = c; break; } } // each is proved on the same course the lane check uses (roles, bars and machines too), so the answer matches what the check says afterwards
      if (!pick) { ed.verdict = 'No lane the simulator can clear was found: try other pieces or levels.'; drawLanePanel(); return; }
      ed.angle = pick.angle; ed.offset = pick.offset; ed.level = pick.level; ed.verdict = '';
      save(); drawLanePanel(); draw(); drawProfile(); verify();
    };
    const play = el('button', lanePanel, { text: 'Play this lane', className: 'go', id: 'play' });
    play.onclick = async () => {
      interruptSearch();
      const version = verifyVersion;
      const course = courseNow();
      play.disabled = true; play.textContent = 'Checking this lane…';
      laneCheck.start();
      const clear = await searchClearable(course);
      play.disabled = false; play.textContent = 'Play this lane';
      if (isStopped(laneCheck.state()) || version !== verifyVersion) return; // Cancel, the cap or a newer edit answered for this check
      if (clear === null) { laneCheck.reset(); ed.verdict = 'The lane check could not finish. Try again after editing stops.'; drawLanePanel(); return; }
      laneCheck.done(clear);
      if (!clear) { ed.verdict = 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; drawLanePanel(); return; }
      // the real objects are drawn in the game instead of blocks (a cropped photo object is drawn whole; its collision is still the cropped lane)
      launchCourse(course); // the plan the check just found goes along: the Course does not search again
    };
    const floorRow = el('label', lanePanel, { className: 'muted', text: 'Floor you must not touch: ' }); floorRow.style.cssText = 'display:flex;align-items:center;gap:6px'; // one line, not two (the panel must fit at 1024 x 640)
    const floorSel = el('select', floorRow, { id: 'floor', title: 'What is painted under the gaps (the run ends the same way on every floor)' });
    for (const h of HAZARDS) floorSel.add(new Option(HAZARD_INFO[h].label, h, false, h === ed.floorChoice));
    floorSel.onchange = () => { ed.floorChoice = floorSel.value as Hazard; document.documentElement.dataset.floor = ed.floorChoice; save(); };
    const testBtn = el('button', lanePanel, { text: 'Test from the selected piece', id: 'testhere', title: 'Start the runner a few metres before the selected piece and play from there' });
    testBtn.onclick = () => {
      const q = ed.pieces.find((x) => x.id === ed.selected);
      const course = courseNow();
      if (!q) { ed.verdict = 'Select a piece first: the test starts just before it.'; drawLanePanel(); return; }
      course.scene = sceneFor(ground(), { angle: ed.angle, offset: ed.offset, level: ed.level }, course.uMap ?? []);
      const gx = isHold(q) ? (course.holds?.[barsNow().findIndex((b) => b.id === q.id)]?.x ?? 0) : sceneFor([q], { angle: ed.angle, offset: ed.offset, level: ed.level }, course.uMap ?? [])[0]?.x ?? 0;
      // start on the ground about 8 m before it (on the nearest ground at or before that spot)
      const want = Math.max(course.startX, gx - 8);
      const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
      const on = ps.find((r) => want >= r.x0 && want <= r.x1);
      course.startX = on ? want : Math.max(course.startX, (ps.filter((r) => r.x1 <= want).pop()?.x1 ?? course.startX) - 1);
      persistHist();
      root.remove(); style.remove();
      void startCourse(document.body, course);
    };
    const verdictEl = el('div', lanePanel, { id: 'verdict', className: `says-when ${ed.verdict.startsWith('The simulator can clear') ? 'ok' : ed.verdict ? 'bad' : 'muted'}`, text: ed.verdict });
    if (!simSays) addBadge(lanePanel, 'simulator', { before: verdictEl }); // CC-243: whose words these are; the live strip above now says it, so this small badge is only for ?says=0 (where it is off too)
    laneCheck.mount(lanePanel); // CC-243: progress line, Cancel and Play anyway under the verdict
  }

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
  // the undo list goes into the session so it survives a trip to the Course (pieces made from photos or maps are not kept: their meshes are too big)
  function persistHist() {
    try {
      const heavy = (q: P) => q.src?.startsWith('obj:') || q.src?.startsWith('user:') || isSharedSrc(q.src) || q.src?.startsWith('map:');
      if (ed.pieces.some(heavy) || hist.some((h) => h.pieces.some(heavy))) { sessionStorage.removeItem(HIST_KEY); return; }
      const start = Math.max(0, hist.length - 25);
      const keep = (h: Snap): Saved => ({ pieces: h.pieces.filter((q) => q.src).map((q) => ({ src: q.src as string, x: q.x, z: q.z, y: q.y, yaw: q.yaw, scale: q.scale, ...(q.role ? { role: q.role } : {}) })), angle: h.angle, offset: h.offset, level: h.level });
      sessionStorage.setItem(HIST_KEY, JSON.stringify({ snaps: hist.slice(start).map(keep), hi: Math.max(0, editHistory.hi - start) }));
    } catch { /* the undo list starts again */ }
  }
  // back to the Course: the same course, rebuilt from the pieces now, at the same obstacle (the Course reads this the way it reads a return from the Dojo)
  // check: wait for the simulator and stay when it proves the lane cannot be cleared ('Apply and try it'); 'Back to the Course' and T never wait and never refuse (CC-147)
  async function goToCourse(check = false) {
    if (!handoff) return;
    const base = courseNow();
    const clear = check ? await searchClearable(base) : null;
    const course = withProof(base); // the plan of the lane check (stored, or just found) goes with the course: the Course does not search again
    // null: no check, or it was cut short (a change in the editor starts a newer one); that is no reason to stay, only a proof that the lane does not clear is
    if (clear === false) { ed.verdict = 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; drawLanePanel(); reply.className = 'reply bad'; reply.textContent = ed.verdict; helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true'); return; }
    course.scene = sceneFor(ground(), { angle: ed.angle, offset: ed.offset, level: ed.level }, course.uMap ?? []);
    const focus = ed.pieces.find((q) => q.id === ed.selected) ?? ed.pieces.find((q) => q.id === focusId);
    const retryX = focus ? startBefore(course, xOfPiece(focus, course)) : checkpointFor(course, handoff.zone);
    persistHist();
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course, world: null, retryX, facing: handoff.facing, falls: handoff.falls })); sessionStorage.removeItem(EDIT_KEY); } catch { /* the Course starts again */ }
    location.href = location.pathname; // no ?mode: the Course puts itself back from the resume
  }
  backLink.onclick = (e) => { if (handoff) { e.preventDefault(); void goToCourse(); } };
  let verifyTimer = 0, adviceRun = 0, verifyVersion = 0, searchVersion = 0;
  let searchWorker: Worker | null = null, finishSearch: ((cleared: PresetPlan | null) => void) | null = null;
  let activeSearch: { key: string; promise: Promise<PresetPlan | null> } | null = null;
  let cachedSearch: { key: string; result: PresetPlan } | null = null;
  // CC-243: the lane check. A ready-made course is answered at once from its stored proof (scripts/preset-plans.ts); an edited one is searched in a worker, and the plan it finds goes with the hand-off to the Course.
  function searchResult(course: CourseData): Promise<PresetPlan | null> {
    const stored = storedPlanFor(course);
    document.documentElement.dataset.laneProof = stored ? 'stored' : 'search'; // for the timing check
    if (stored) return Promise.resolve(stored);
    const key = JSON.stringify(searchInput(course));
    if (cachedSearch?.key === key) return Promise.resolve(cachedSearch.result);
    if (activeSearch?.key === key) return activeSearch.promise;
    stopSearch();
    const id = ++searchVersion;
    let worker: Worker;
    try { worker = new Worker(new URL('../sim/ideal-worker.ts', import.meta.url), { type: 'module' }); }
    catch { return Promise.resolve(null); }
    const promise = new Promise<PresetPlan | null>((resolve) => {
      searchWorker = worker; finishSearch = resolve;
      worker.onmessage = (e: MessageEvent<{ id: number; progress?: LaneProgress } & Pick<SearchResult, 'plan' | 'cleared' | 'windows' | 'routes'>>) => {
        if (e.data.id !== id) return;
        if (e.data.progress) { laneCheck.progress(e.data.progress); return; }
        const result: PresetPlan = { key, cleared: e.data.cleared, ...(e.data.cleared ? { plan: e.data.plan, windows: xWindows(e.data.windows ?? []), ...(e.data.routes ? { routes: e.data.routes } : {}) } : {}) };
        cachedSearch = { key, result };
        searchWorker = null; finishSearch = null; activeSearch = null; worker.terminate(); resolve(result);
      };
      worker.onerror = () => {
        if (id !== searchVersion) return;
        searchWorker = null; finishSearch = null; activeSearch = null; worker.terminate(); resolve(null);
      };
      worker.postMessage({ id, course });
    });
    activeSearch = { key, promise };
    return promise;
  }
  /** Ends the search that is running, if any, at once: its worker is terminated and whoever waits on it gets null. */
  function stopSearch() {
    const done = finishSearch;
    finishSearch = null; activeSearch = null;
    searchWorker?.terminate(); searchWorker = null;
    done?.(null);
  }
  const launchCourse = (course: CourseData) => {
    // the real objects are drawn in the game instead of blocks (a cropped photo object is drawn whole; its collision is still the cropped lane)
    course.scene = sceneFor(ground(), { angle: ed.angle, offset: ed.offset, level: ed.level }, course.uMap ?? []);
    persistHist();
    root.remove(); style.remove();
    void startCourse(document.body, withProof(course));
  };
  const laneCheck = createLaneCheck({
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
  const searchClearable = async (course: CourseData): Promise<boolean | null> => (await searchResult(course))?.cleared ?? null;
  // the proof the lane check already holds for exactly this course, never a new search: the Course then does not search again
  const withProof = (course: CourseData): CourseData => {
    const r = storedPlanFor(course) ?? (cachedSearch?.key === JSON.stringify(searchInput(course)) ? cachedSearch.result : null);
    return withStoredPlan(course, r);
  };
  function interruptSearch() {
    clearTimeout(verifyTimer);
    verifyVersion++;
    // Keep useful work running while the user rotates or drags. The result is
    // version-checked and discarded if the course changed; verify() restarts
    // for the settled course after the debounce.
  }
  function verify(pause = 800) {
    interruptSearch();
    laneCheck.reset(); // CC-243: an edit throws the last verdict away; the new search starts only after the pause, and the old worker is ended when the new one starts
    const version = verifyVersion;
    document.documentElement.dataset.lane = JSON.stringify({ angle: ed.angle, offset: ed.offset, level: ed.level }); // for the checks: the lane being verified
    verifyTimer = window.setTimeout(async () => {
      const p = currentProfile();
      if (p.length < 8) { stopSearch(); ed.verdict = 'Nothing is in the lane: move the lane or the pieces.'; }
      else {
        const r = describeLane(p);
        ed.verdict = 'Checking this lane…';
        const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
        if (v) { v.textContent = ed.verdict; v.className = 'says-when muted'; }
        laneCheck.start();
        const clear = await searchClearable(laneCourse(p));
        if (version !== verifyVersion || isStopped(laneCheck.state())) return; // a newer edit, Cancel or the cap answered for this check
        if (clear === null) { laneCheck.reset(); ed.verdict = 'The lane check could not finish. Try again after editing stops.'; document.documentElement.dataset.verdict = ed.verdict; if (v) { v.textContent = ed.verdict; v.className = 'says-when bad'; } return; }
        laneCheck.done(clear);
        document.documentElement.dataset.laneClear = clear ? '1' : '0'; setSuggest(clear);
        ed.verdict = clear ? `The simulator can clear this lane (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces, ${r.length.toFixed(0)} m).` : 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.';
      }
      const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
      if (v) { v.textContent = ed.verdict; v.className = ed.verdict.startsWith('The simulator can clear') ? 'says-when ok' : 'says-when bad'; }
      document.documentElement.dataset.verdict = ed.verdict;
      // when it cannot be cleared, say what to shift (each suggestion was proved by the simulator)
      ed.adviceList = []; showAdvice();
      if (machineNow() && p.length >= 8) { // a trebuchet at the start: its counterweight and arm come first, and a narrow release window gets a pin
        const mine = ++adviceRun, m = machineNow()!, lane = { angle: ed.angle, offset: ed.offset, level: ed.level }, clear = ed.verdict.startsWith('The simulator can clear');
        setTimeout(() => { if (mine !== adviceRun) return; ed.adviceList = adviseMachine(coursePieces(), lane, m, { budgetMs: 8000, max: 1 }, trebuchetPivot()); if (!clear && !barsNow().length) ed.adviceList.push(...adviseLane(coursePieces(), lane, { wrap: machineWrap(m) })); showAdvice(); if (!ed.adviceList.length) adviceBox.textContent = clear ? '' : 'No single change to the machine or a piece clears it. Press Fix it to look further.'; document.documentElement.dataset.advice = String(ed.adviceList.length); }, 30);
      } else if (!ed.verdict.startsWith('The simulator can clear') && p.length >= 8 && barsNow().length) {
        adviceBox.textContent = 'This lane has bars. Drag them in the side view (position and height), or press Fix it to try small moves of the bars.';
      } else if (!ed.verdict.startsWith('The simulator can clear') && p.length >= 8 && ed.pieces.some((q) => q.role && q.role !== 'ground')) {
        adviceBox.textContent = 'This lane uses roles (wall, rope anchor or trampoline bed). Open Moves to see what each needs, or press Fix it.';
      } else if (!ed.verdict.startsWith('The simulator can clear') && p.length >= 8) {
        const mine = ++adviceRun;
        adviceBox.textContent = 'Working out what to shift…';
        setTimeout(async () => { if (mine !== adviceRun) return; const got = await adviceInWorker(coursePieces() as P[], { angle: ed.angle, offset: ed.offset, level: ed.level }).catch(() => null); if (!got || mine !== adviceRun) return; ed.adviceList = got; showAdvice(); if (!ed.adviceList.length) adviceBox.textContent = 'No single small shift clears it. Press "What should I change?" to think it through together.'; document.documentElement.dataset.advice = String(ed.adviceList.length); }, 30);
      } else document.documentElement.dataset.advice = '0';
    }, pause);
  }

  // ---- drawing
  const sx = (x: number) => plan.width / 2 + (x - ed.view.cx) * ed.view.ppm;
  const sz = (z: number) => plan.height / 2 + (z - ed.view.cz) * ed.view.ppm;
  const wx = (px: number) => (px - plan.width / 2) / ed.view.ppm + ed.view.cx;
  const wz = (py: number) => (py - plan.height / 2) / ed.view.ppm + ed.view.cz;
  const COLORS = ['#c9893b', '#6fa3c9', '#8bb36b', '#b779b0', '#d96a5b', '#7b8f9c'];
  function draw() {
    view3d.sync();
    placeBar();
    const c = plan.getContext('2d')!;
    c.clearRect(0, 0, plan.width, plan.height);
    c.strokeStyle = '#e3e8e4'; c.lineWidth = 1; c.fillStyle = '#58635d'; c.font = '11px system-ui';
    const step = ed.view.ppm > 25 ? 1 : ed.view.ppm > 8 ? 5 : 20;
    for (let x = Math.floor(wx(0) / step) * step; x < wx(plan.width); x += step) { c.beginPath(); c.moveTo(sx(x), 0); c.lineTo(sx(x), plan.height); c.stroke(); if (x % (step * 2) === 0) c.fillText(`${x} m`, sx(x) + 2, 12); }
    for (let z = Math.floor(wz(0) / step) * step; z < wz(plan.height); z += step) { c.beginPath(); c.moveTo(0, sz(z)); c.lineTo(plan.width, sz(z)); c.stroke(); }
    // the lane: a band 2 m wide through the rod's turn and sideways step
    c.save(); c.translate(sx(0), sz(0)); c.rotate(ed.angle);
    c.fillStyle = '#f0a02033'; c.fillRect(-400 * ed.view.ppm, (ed.offset - HALF_LANE) * ed.view.ppm, 800 * ed.view.ppm, 2 * HALF_LANE * ed.view.ppm);
    c.strokeStyle = '#f0a020'; c.lineWidth = 2; c.beginPath(); c.moveTo(-400 * ed.view.ppm, ed.offset * ed.view.ppm); c.lineTo(400 * ed.view.ppm, ed.offset * ed.view.ppm); c.stroke();
    c.restore();
    c.fillStyle = '#17201d'; c.beginPath(); c.arc(sx(0), sz(0), 5, 0, 7); c.fill(); c.fillStyle = '#0f6b5c'; c.beginPath(); c.moveTo(sx(0), sz(0)); c.lineTo(sx(0), sz(0) - 22); c.lineTo(sx(0) + 16, sz(0) - 16); c.lineTo(sx(0), sz(0) - 10); c.fill(); c.font = '600 11px system-ui'; c.fillText(START_LABEL.replace(/^Start/, 'START'), sx(0) + 8, sz(0) + 14);
    ed.pieces.forEach((p, i) => {
      const s = size(p.mesh);
      if (isSizeReference(p)) {
        c.save(); c.translate(sx(p.x), sz(p.z)); c.rotate(p.yaw);
        const k = ed.view.ppm, lw = Math.max(2, 0.07 * k);
        c.strokeStyle = '#8a2d29'; c.fillStyle = '#e65a50'; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.arc(0, -0.34 * k, 0.12 * k, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(0, -0.2 * k); c.lineTo(0, 0.22 * k); c.moveTo(-0.34 * k, -0.12 * k); c.lineTo(0.34 * k, -0.12 * k); c.moveTo(0, 0.22 * k); c.lineTo(-0.22 * k, 0.48 * k); c.moveTo(0, 0.22 * k); c.lineTo(0.22 * k, 0.48 * k); c.stroke();
        c.restore();
        c.fillStyle = '#17201d'; c.font = '700 12px system-ui'; c.fillText('Person', sx(p.x) + 10, sz(p.z) + 4);
        return;
      }
      c.save(); c.translate(sx(p.x), sz(p.z)); c.rotate(p.yaw);
      const w = s.w * p.scale * ed.view.ppm, d = s.d * p.scale * ed.view.ppm;
      c.fillStyle = COLORS[i % COLORS.length] + ((p.id === ed.selected || chosen().includes(p.id)) ? 'dd' : '99'); c.fillRect(-w / 2, -d / 2, w, d);
      { const on = p.id === ed.selected || chosen().includes(p.id); c.strokeStyle = on ? '#0f6b5c' : '#17201d'; c.lineWidth = on ? 3 : 1; } c.strokeRect(-w / 2, -d / 2, w, d);
      c.restore();
      c.fillStyle = '#17201d'; c.font = '12px system-ui'; c.fillText(p.name, sx(p.x) - 28, sz(p.z) + 4);
    });
    if (ed.proposal && ed.preview) { // the preview: grey outline where a piece is now, teal outline where it would be, an arrow between
      const arrow = (x0: number, y0: number, x1: number, y1: number) => {
        const a = Math.atan2(y1 - y0, x1 - x0);
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4)); c.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); c.closePath(); c.fillStyle = '#0f9d84'; c.fill();
      };
      c.lineWidth = 2; c.setLineDash([6, 4]);
      for (const it of ed.proposal.items) {
        if (!it.on || it.kind !== 'piece') continue;
        const mine = ed.pieces.find((q) => q.id === it.id);
        if (!mine) continue;
        const s2 = size(mine.mesh);
        for (const [st, col] of [[it.from, '#7d8a84'], [it.to, '#0f9d84']] as const) {
          c.save(); c.translate(sx(st.x), sz(st.z)); c.rotate(st.yaw);
          c.strokeStyle = col; c.strokeRect((-s2.w * st.scale * ed.view.ppm) / 2, (-s2.d * st.scale * ed.view.ppm) / 2, s2.w * st.scale * ed.view.ppm, s2.d * st.scale * ed.view.ppm);
          c.restore();
        }
        if (Math.hypot(it.to.x - it.from.x, it.to.z - it.from.z) > 0.05) { c.strokeStyle = '#0f9d84'; c.setLineDash([]); arrow(sx(it.from.x), sz(it.from.z), sx(it.to.x), sz(it.to.z)); c.setLineDash([6, 4]); }
      }
      if (ed.proposal.items.some((i) => i.kind === 'lane' && i.on && i.key !== 'level')) { // the lane would turn or step sideways: a dashed line where it would run
        c.save(); c.translate(sx(0), sz(0)); c.rotate(ed.preview.lane.angle); c.strokeStyle = '#0f9d84';
        c.beginPath(); c.moveTo(-400 * ed.view.ppm, ed.preview.lane.offset * ed.view.ppm); c.lineTo(400 * ed.view.ppm, ed.preview.lane.offset * ed.view.ppm); c.stroke(); c.restore();
      }
      c.setLineDash([]);
    }
    if (rubber) { c.strokeStyle = '#0f6b5c'; c.setLineDash([5, 4]); c.strokeRect(sx(rubber.x0), sz(rubber.z0), (rubber.x1 - rubber.x0) * ed.view.ppm, (rubber.z1 - rubber.z0) * ed.view.ppm); c.setLineDash([]); }
  }
  // the side view: the lane's ground, the bars (drag them here), and where a person can reach
  let sideMap = { uMin: 0, ppm: 20, ph: 20, base: 100, vmin: 0 };
  const vzoom = pageQuery().get('vzoom') === '1'; // film: stretch the height so a few metres of real drops are readable
  function drawProfile() {
    howto.style.display = ed.pieces.some((q) => isTrack(q)) ? '' : 'none';
    const c = profileCanvas.getContext('2d')!;
    const W = profileCanvas.width, H = profileCanvas.height;
    c.clearRect(0, 0, W, H);
    const prof = currentProfile();
    const bars = barsNow();
    const o = prof.origin ?? 0;
    const pv = ed.proposal && ed.preview ? { prof: ed.previewProfile!, bars: ed.previewBars } : null;
    const po = pv?.prof?.origin ?? 0;
    const uLo = Math.min(prof.length ? o : 0, ...bars.map((b) => b.u), ...(pv ? [pv.prof.length ? po : Infinity, ...pv.bars.map((b) => b.u)] : []));
    const uHi = Math.max(prof.length ? o + prof.length : -Infinity, ...bars.map((b) => b.u), ...(pv ? [pv.prof.length ? po + pv.prof.length : -Infinity, ...pv.bars.map((b) => b.u)] : []), uLo + 10);
    c.fillStyle = '#58635d'; c.font = '12px system-ui';
    c.fillText('What the runner sees: the lane from the side (water at the bottom, grid every metre). Drag a bar (or a purple coaster dot) to move it; double-click to add a dot.', 8, 14);
    const base = H - 14, ppm = Math.min(30, (W - 40) / Math.max(10, uHi - uLo + 1)), ph0 = Math.max(0.1, (base - 24) / Math.max(1.8, Math.max(0, ...prof.cells.filter((h): h is number => h !== null), ...bars.map((b) => b.y), ...trackDotsNow().map((d) => d.y)) + 0.6)); // fit the tallest thing (the coaster dots too), so low steps are not hairlines
    const hs = prof.cells.filter((h): h is number => h !== null);
    const vmin = vzoom && hs.length ? Math.floor((Math.min(...hs) - 0.3) * 2) / 2 : 0;
    const ph = vzoom && hs.length ? Math.max(ph0, (base - 24) / Math.max(2, Math.max(...hs, ...bars.map((b) => b.y), ...trackDotsNow().map((d) => d.y)) - vmin + 0.6)) : ph0;
    sideMap = { uMin: uLo, ppm, ph, base, vmin };
    c.fillStyle = '#cfe3f5'; c.fillRect(0, base, W, 14);
    c.strokeStyle = '#e3e8e4';
    const gridStep = [1, 2, 5, 10, 20].find((g) => g * ph >= 12) ?? 50; // every metre, or fewer lines when the view is tall (a very high coaster)
    for (let m = 0; base - m * ph > 20; m += gridStep) { c.beginPath(); c.moveTo(0, base - m * ph); c.lineTo(W, base - m * ph); c.stroke(); }
    c.fillStyle = '#58635d'; c.font = '10px system-ui'; c.textAlign = 'left';
    for (let m = 0; base - (m - vmin) * ph > 20; m += gridStep) if (m >= vmin) c.fillText(`${m} m`, 2, base - (m - vmin) * ph - 2);
    // reach guide: what hands can grab standing and with a jump (the simulator's own numbers)
    c.setLineDash([6, 4]); c.lineWidth = 1.5; c.font = '11px system-ui';
    for (const [h, col, label] of ([[REACH_STANDING, '#2f9e5b', 'hands reach standing'], [REACH_JUMPING, '#c9951b', 'hands reach with a jump']] as [number, string, string][]).filter(([h]) => base - (h - vmin) * ph > 18)) {
      c.strokeStyle = col; c.fillStyle = col; c.beginPath(); c.moveTo(0, base - (h - vmin) * ph); c.lineTo(W, base - (h - vmin) * ph); c.stroke(); c.fillText(`${label} (${h} m)`, W - 190, base - (h - vmin) * ph - 3);
    }
    c.setLineDash([]);
    c.fillStyle = '#17201d'; c.strokeStyle = '#17201d'; c.lineWidth = 2;
    c.beginPath();
    let pen = false;
    prof.cells.forEach((h, i) => { if (h === null) { pen = false; return; } const x = 10 + (o - uLo + i * CELL) * ppm, y = base - (h - vmin) * ph; if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); });
    c.stroke();
    { // CC-200: a green Start flag where the runner begins (not the yellow person for scale)
      const st = startMarkSide(prof, CELL);
      if (st) {
        const x = 10 + (st.u - uLo) * ppm, y = base - (st.h - vmin) * ph;
        const glowG = c.createLinearGradient(0, y - 80, 0, y); glowG.addColorStop(0, 'rgba(31,191,159,0)'); glowG.addColorStop(1, 'rgba(31,191,159,.45)'); // a glowing cone over the person
        c.fillStyle = glowG; c.beginPath(); c.moveTo(x, y - 24); c.lineTo(x - 16, y - 80); c.lineTo(x + 16, y - 80); c.fill();
        c.strokeStyle = '#0f6b5c'; c.fillStyle = '#0f6b5c'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.arc(x, y - 22, 3.5, 0, 7); c.fill(); // head
        c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x, y - 8); c.moveTo(x, y - 8); c.lineTo(x - 4, y); c.moveTo(x, y - 8); c.lineTo(x + 4, y); c.moveTo(x - 5, y - 15); c.lineTo(x + 5, y - 15); c.stroke(); c.lineCap = 'butt';
        c.font = '700 12px system-ui'; c.textAlign = 'left'; c.fillText(START_SHORT, x + 8, y - 28);
      }
    }
    for (const b of bars) {
      const x = 10 + (b.u - uLo) * ppm, y = base - (b.y - vmin) * ph, sel = b.id === ed.selected;
      c.strokeStyle = '#c9ced4'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.stroke();
      c.strokeStyle = sel ? '#0f6b5c' : '#f0a020'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke();
      c.fillStyle = '#17201d'; c.fillText(`${b.y.toFixed(2)} m`, x + 12, y - 8);
    }
    document.documentElement.dataset.lineGap = JSON.stringify(trackDotsNow().map((d) => { const k = Math.floor((d.u - o) / CELL); return Math.min(99, ...[k - 1, k, k + 1].map((j) => prof.cells[j]).filter((h): h is number => h != null).map((h) => Math.abs(h - d.y))); })); // for the browser check: how far each dot is from the black line
    document.documentElement.dataset.dotM = JSON.stringify(trackDotsNow().map((d) => d.y)); // for the browser check
    document.documentElement.dataset.dotPx = JSON.stringify(trackDotsNow().map((d) => [10 + (d.u - uLo) * ppm, base - (d.y - vmin) * ph])); // for the browser check
    for (const d of trackDotsNow()) { // the chosen coaster section: a dot at each point of the rail (drag them)
      const x = 10 + (d.u - uLo) * ppm, y = base - (d.y - vmin) * ph;
      c.fillStyle = '#7a4fd1'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.stroke();
      if (dotBlock && dotBlock.id === d.id && dotBlock.i === d.i) { // blocked: amber dot and the reason beside it
        const text = TRACK_BLOCK_TEXT[dotBlock.block];
        c.fillStyle = '#f0a020'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); c.stroke();
        c.font = '600 12px system-ui'; const w = c.measureText(text).width + 12, lx = Math.min(Math.max(4, x + 12), profileCanvas.width - w - 4), ly = Math.max(26, y - 30);
        c.fillStyle = '#7a4a00'; c.fillRect(lx, ly, w, 20); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(text, lx + 6, ly + 14);
        document.documentElement.dataset.dotBlock = dotBlock.block;
      }
    }
    if (!dotBlock) delete document.documentElement.dataset.dotBlock;
    if (flash) { const x = 10 + (flash.u - uLo) * ppm, y = base - (flash.y - vmin) * ph; c.font = '600 12px system-ui'; const w = c.measureText(flash.text).width + 12, lx = Math.min(Math.max(4, x - w / 2), profileCanvas.width - w - 4), ly = Math.max(26, y - 30); c.fillStyle = '#7a4a00'; c.fillRect(lx, ly, w, 20); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(flash.text, lx + 6, ly + 14); document.documentElement.dataset.dotFlash = flash.text; } else delete document.documentElement.dataset.dotFlash;
    for (const s of ed.routes) { // kept shortcuts: a dashed arrow from the bar before the skipped ones to the bar after them (or the end of the lane)
      if (!ed.designed.has(s.id)) continue;
      const ix = s.skipped.map((n) => /^Bar (\d+)$/.exec(n)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]) - 1);
      if (!ix.length) continue;
      const sorted = [...bars].sort((a, b) => a.u - b.u), a0 = sorted[Math.min(...ix) - 1], a1 = sorted[Math.max(...ix) + 1];
      if (!a0) continue;
      const x0 = 10 + (a0.u - uLo) * ppm, y0 = base - (a0.y - vmin) * ph, x1 = a1 ? 10 + (a1.u - uLo) * ppm : 10 + (o + prof.length - uLo) * ppm, y1 = a1 ? base - (a1.y - vmin) * ph : base;
      c.save(); c.strokeStyle = '#7a4fd1'; c.fillStyle = '#7a4fd1'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 40, x1, y1); c.stroke(); c.setLineDash([]);
      const a = Math.atan2(y1 - (Math.min(y0, y1) - 20), x1 - (x0 + x1) / 2); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 9 * Math.cos(a - 0.45), y1 - 9 * Math.sin(a - 0.45)); c.lineTo(x1 - 9 * Math.cos(a + 0.45), y1 - 9 * Math.sin(a + 0.45)); c.closePath(); c.fill(); c.restore();
    }
    if (pv) { // the preview: the ground after the change (dashed teal) and the bars where they would hang, with an arrow from where they are now
      c.save(); c.strokeStyle = '#0f9d84'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath();
      let pen2 = false;
      pv.prof.cells.forEach((h, i) => { if (h === null) { pen2 = false; return; } const x = 10 + (po - uLo + i * CELL) * ppm, y = base - (h - vmin) * ph; if (!pen2) { c.moveTo(x, y); pen2 = true; } else c.lineTo(x, y); });
      c.stroke(); c.setLineDash([]);
      for (const nb of pv.bars) {
        const x = 10 + (nb.u - uLo) * ppm, y = base - (nb.y - vmin) * ph, was = bars.find((b) => b.id === nb.id);
        c.strokeStyle = '#0f9d84'; c.fillStyle = '#0f9d8433'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.stroke();
        if (was) {
          const x0 = 10 + (was.u - uLo) * ppm, y0 = base - (was.y - vmin) * ph;
          if (Math.hypot(x - x0, y - y0) > 4) {
            const a = Math.atan2(y - y0, x - x0), x1 = x - 11 * Math.cos(a), y1 = y - 11 * Math.sin(a);
            c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 11 * Math.cos(a), y0 + 11 * Math.sin(a)); c.lineTo(x1, y1); c.stroke();
            c.fillStyle = '#0f9d84'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 8 * Math.cos(a - 0.45), y1 - 8 * Math.sin(a - 0.45)); c.lineTo(x1 - 8 * Math.cos(a + 0.45), y1 - 8 * Math.sin(a + 0.45)); c.closePath(); c.fill();
          }
        }
      }
      c.restore();
    }
    document.documentElement.dataset.laneLength = String(prof.length.toFixed(1));
    document.documentElement.dataset.bars = String(bars.length);
    document.documentElement.dataset.barPx = JSON.stringify(bars.map((b) => [10 + (b.u - uLo) * ppm, base - (b.y - vmin) * ph]));
    document.documentElement.dataset.barYs = JSON.stringify(bars.map((b) => Number(b.y.toFixed(2))));
  }
  const trackDotsNow = () => trackDots(ed);
  const dotAtPx = (px: number, py: number) => trackDotsNow().find((d) => Math.hypot(10 + (d.u - sideMap.uMin) * sideMap.ppm - px, sideMap.base - (d.y - sideMap.vmin) * sideMap.ph - py) < 11);
  /** Plain feedback at a dot while a drag is stopped (CC-244): the dot turns amber, a label says why, the cursor shows not-allowed; it goes away on release. */
  let dotBlock: { id: number; i: number; block: Exclude<TrackBlock, ''> } | null = null;
  let flash: { text: string; u: number; y: number } | null = null;
  let flashTimer = 0;
  const barAtPx = (px: number, py: number) => barsNow().find((b) => Math.hypot(10 + (b.u - sideMap.uMin) * sideMap.ppm - px, sideMap.base - (b.y - sideMap.vmin) * sideMap.ph - py) < 16);
  let barDrag: { p: P } | null = null;
  let dotDrag: { p: P; i: number } | null = null;
  profileCanvas.addEventListener('pointerdown', (e) => {
    const r = profileCanvas.getBoundingClientRect();
    const dot = dotAtPx(e.clientX - r.left, e.clientY - r.top), tp = dot && ed.pieces.find((q) => q.id === dot.id);
    if (dot && tp) { if (ed.selected !== tp.id) { ed.selected = tp.id; ed.group = []; drawPanel(); } dotDrag = { p: tp, i: dot.i }; profileCanvas.setPointerCapture(e.pointerId); return; }
    const b = barAtPx(e.clientX - r.left, e.clientY - r.top);
    const p = b && ed.pieces.find((q) => q.id === b.id);
    if (!p) return;
    ed.selected = p.id; barDrag = { p }; profileCanvas.setPointerCapture(e.pointerId); drawPanel(); draw(); drawProfile();
  });
  profileCanvas.addEventListener('pointermove', (e) => {
    const r = profileCanvas.getBoundingClientRect();
    if (dotDrag) {
      const u = Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 10) / 10;
      const blk = moveTrackPoint(ed, dotDrag.p, dotDrag.i, u, Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph + sideMap.vmin) * 10) / 10);
      dotBlock = blk ? { id: dotDrag.p.id, i: dotDrag.i, block: blk } : null; profileCanvas.style.cursor = blk ? 'not-allowed' : 'grabbing';
      draw(); drawProfile(); return;
    }
    if (!barDrag) { profileCanvas.style.cursor = dotAtPx(e.clientX - r.left, e.clientY - r.top) ? 'grab' : barAtPx(e.clientX - r.left, e.clientY - r.top) ? 'grab' : 'default'; return; }
    const p = barDrag.p, c = Math.cos(ed.angle), s = Math.sin(ed.angle);
    const u = Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 20) / 20;
    const y = Math.min(4.3, Math.max(0.35, Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph + sideMap.vmin - 0.04) * 20) / 20));
    const v = -p.x * s + p.z * c; // keep the sideways place, move along the run
    p.x = u * c - v * s; p.z = u * s + v * c; p.y = y;
    draw(); drawProfile();
  });
  profileCanvas.addEventListener('dblclick', (e) => {
    const r = profileCanvas.getBoundingClientRect(), x = e.clientX - r.left, gapTo = (d: { u: number }) => Math.abs(10 + (d.u - sideMap.uMin) * sideMap.ppm - x);
    const near = trackDotsNow().reduce<ReturnType<typeof trackDots>[number] | null>((best, d) => (!best || gapTo(d) < gapTo(best) ? d : best), null); // the section whose dots are closest along the run
    const tp = near && ed.pieces.find((q) => q.id === near.id);
    if (!tp || dotAtPx(x, e.clientY - r.top)) return;
    const au = Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 10) / 10, ay = Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph + sideMap.vmin) * 10) / 10;
    const blk = addTrackPoint(ed, tp, au, ay);
    if (blk) { flash = { text: TRACK_BLOCK_TEXT[blk], u: au, y: ay }; window.clearTimeout(flashTimer); flashTimer = window.setTimeout(() => { flash = null; drawProfile(); }, 2500); }
    changed(); drawPanel(); draw(); drawProfile();
  });
  const endBar = () => { if (dotDrag) { dotDrag = null; dotBlock = null; profileCanvas.style.cursor = 'grab'; changed(); return; } if (!barDrag) return; barDrag = null; changed(); };
  profileCanvas.addEventListener('pointerup', endBar); profileCanvas.addEventListener('pointercancel', endBar);

  // ---- the mouse on the picture
  let rubber: { x0: number; z0: number; x1: number; z1: number } | null = null;
  let drag: { kind: 'move' | 'pan' | 'rubber' | 'marq'; p?: P; ox: number; oz: number; sx0: number; sz0: number; cx: number; cz: number } | null = null;
  plan.addEventListener('pointerdown', (e) => {
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    plan.setPointerCapture(e.pointerId);
    if (ed.cropMode && ed.selected !== null) { drag = { kind: 'rubber', ox: x, oz: z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    const hit = [...ed.pieces].reverse().find((p) => !isSizeReference(p) && hits(p, x, z));
    if (multiOn && e.shiftKey && hit) { chooseMany(toggleId(chosen(), hit.id)); drag = null; return; }
    if (multiOn && !hit && e.button === 0 && !e.altKey) { drag = { kind: 'marq', ox: x, oz: z, sx0: px, sz0: py, cx: e.shiftKey ? 1 : 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    if (hit) { if (!(multiOn && chosen().length > 1 && chosen().includes(hit.id))) ed.group = []; ed.selected = hit.id; drag = { kind: 'move', p: hit, ox: x - hit.x, oz: z - hit.z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; }
    else { ed.selected = null; ed.group = []; drag = { kind: 'pan', ox: 0, oz: 0, sx0: px, sz0: py, cx: ed.view.cx, cz: ed.view.cz }; }
    drawPanel(); draw();
  });
  plan.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (drag.kind === 'move' && drag.p) { moveWith(drag.p, Math.round((wx(px) - drag.ox) * 20) / 20, Math.round((wz(py) - drag.oz) * 20) / 20); draw(); drawProfile(); }
    else if (drag.kind === 'pan') { ed.view.cx = drag.cx - (px - drag.sx0) / ed.view.ppm; ed.view.cz = drag.cz - (py - drag.sz0) / ed.view.ppm; draw(); }
    else if ((drag.kind === 'rubber' || drag.kind === 'marq') && rubber) { rubber = { x0: Math.min(drag.ox, wx(px)), z0: Math.min(drag.oz, wz(py)), x1: Math.max(drag.ox, wx(px)), z1: Math.max(drag.oz, wz(py)) }; draw(); }
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'marq') {
      const rb = rubber; rubber = null;
      const px = rb ? (rb.x1 - rb.x0) * ed.view.ppm : 0, py = rb ? (rb.z1 - rb.z0) * ed.view.ppm : 0;
      if (rb && isMarquee(rectFrom(0, 0, px, py))) {
        const items = ed.pieces.filter((q) => !isSizeReference(q)).map((q) => ({ id: q.id, x: q.x, y: q.z, r: Math.max(realSize(q).w, realSize(q).d) / 2 }));
        chooseMany(applyMarquee(chosen(), pickInRect(items, { x0: rb.x0, y0: rb.z0, x1: rb.x1, y1: rb.z1 }), d.cx === 1));
      } else if (!d.cx) { ed.selected = null; ed.group = []; drawPanel(); }
      draw(); return;
    }
    if (d.kind === 'rubber' && rubber && ed.selected !== null) {
      const p = ed.pieces.find((q) => q.id === ed.selected);
      if (p && rubber.x1 - rubber.x0 > 0.05 && rubber.z1 - rubber.z0 > 0.05) {
        // the box in the piece's own units: the four corners turned back, then their bounds
        const c = Math.cos(-p.yaw), s = Math.sin(-p.yaw), xs: number[] = [], zs: number[] = [];
        for (const [x, z] of [[rubber.x0, rubber.z0], [rubber.x1, rubber.z0], [rubber.x1, rubber.z1], [rubber.x0, rubber.z1]]) { const dx = x - p.x, dz = z - p.z; xs.push((dx * c - dz * s) / p.scale); zs.push((dx * s + dz * c) / p.scale); }
        const cut = crop(p, { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) });
        if (cut) { Object.assign(p, cut, { id: p.id }); } else ed.verdict = 'Nothing of the piece is inside that box.';
      }
      rubber = null; ed.cropMode = false; changed(); return;
    }
    changed();
  };
  plan.addEventListener('pointerup', end); plan.addEventListener('pointercancel', end);
  // the flat plan zooms toward the cursor (the point under it stays under it), with room to zoom far out and in
  plan.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = plan.getBoundingClientRect(), k = plan.width / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    ed.view.ppm = Math.min(400, Math.max(0.5, ed.view.ppm * Math.exp(-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 240) * 0.002)));
    ed.view.cx = x - (px - plan.width / 2) / ed.view.ppm; ed.view.cz = z - (py - plan.height / 2) / ed.view.ppm; draw();
  }, { passive: false });
  function fitAll() {
    const ps = ed.pieces.filter((q) => !isSizeReference(q) || ed.pieces.length === 1);
    const b = ps.length ? { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, top: 1 } : { x0: 0, x1: 30, z0: -3, z1: 3, top: 3 };
    for (const q of ps) { const s = size(q.mesh), h = Math.max(s.w, s.d) * q.scale / 2; b.x0 = Math.min(b.x0, q.x - h); b.x1 = Math.max(b.x1, q.x + h); b.z0 = Math.min(b.z0, q.z - h); b.z1 = Math.max(b.z1, q.z + h); b.top = Math.max(b.top, q.y + s.h * q.scale); }
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
  // the person for scale cannot be dragged, so it always stands at the lane start: a world saved with the person on a rod, or far from the pieces, is put right (owner, 2026-11-01)
  function seatPerson() { const who = ed.pieces.find(isSizeReference); if (!who) return; const at = personAt(); if (Math.abs(at.x - who.x) > 0.005 || Math.abs(at.z - who.z) > 0.005) { who.x = at.x; who.z = at.z; } }
  function changed(record = true) { seatPerson(); capPieces(); helperUi.onChanged(); if (record) remember(); syncDeviceState(); document.documentElement.dataset.pieces = String(ed.pieces.length); document.documentElement.dataset.band = ed.bandK ? String(ed.bandK) : ''; save(); drawPanel(); drawLanePanel(); draw(); drawProfile(); verify(); movesUi.renderMoves(); }
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
        const snaps: Snap[] = h.snaps.map((sn) => ({ pieces: buildPieces(sn.pieces), angle: sn.angle, offset: sn.offset, level: sn.level }));
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
