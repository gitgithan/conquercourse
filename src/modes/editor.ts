import { HAZARDS, HAZARD_INFO, type Hazard } from '../course/hazard';
import { styleEditor } from '../ui/editor-ux';
import { applyMarquee, chosenIds, countText, isMarquee, pickInRect, rectFrom, toggleId, withoutIds } from '../ui/selection';
import { organizeEditor } from '../ui/editor-layout';
import { startCourse } from './course';
import { readGlbMesh } from '../slice/glb';
import { creditLine, type Provenance } from '../slice/provenance';
import { getUserObject, listUserObjects, saveUserObject, userObjectUrls, userSrc } from '../slice/user-objects';
import { openPhotoObject, uploadObjOn } from '../ui/photo-object';
import { LIBRARY, box } from '../slice/shapes';
import { bestSlices, describe as describeLane, sliceProfile, CELL, HALF_LANE } from '../slice/slice';
import { crop, centred, duplicate, hits, newPiece, realSize, scaleBy, scaleToHeight, size, worldSamples, laneProfile, type Piece } from '../slice/world';
import type { CourseData } from '../course/course';
import { workSeconds, xWindows, type SearchResult } from '../sim/ideal';
import { searchInput, storedPlanFor, withStoredPlan, type PresetPlan } from '../slice/preset-plans';
import { createView3d, type Ghosts } from '../slice/view3d';
import { sceneFor } from '../slice/scene';
import { isTrack, parseTrackSrc, sectionPoints, trackPiece, trackSrc, trackStartY, TRACK_SHAPES } from '../slice/track-world';
import { barMesh, holdsOf, isHold, REACH_JUMPING, REACH_STANDING } from '../slice/holds-world';
import { DEFAULT_PLANK, isPlankPiece, plankPiece, plankSpecOf, planksOf, setPlank, type PlankSpec } from '../slice/plank-world';
import { fixPlank, plankHolds, worstCase } from '../sim/beam';
import { withTrebuchet, wrapFor, type Machine } from '../slice/launch-lane';
import { withRecoil, type RecoilCfg } from '../slice/recoil-lane';
import { fixRecoil } from '../slice/fixrecoil';
import { withBand } from '../slice/band-lane';
import { fixBand } from '../slice/fixband';
import { DRONE_PAD_LENGTH, withDrone, type DroneCfg } from '../slice/drone-lane';
import { fixDrone } from '../slice/fixdrone';
import { PATTERNS, stackPiece, stackSrc } from '../slice/stack';
import { personStart } from '../slice/person-ref';
import { layoutToPieces, parseLayout } from '../slice/photo-course';
import { proves } from '../slice/photo-proof';
import { adviseMachine, fixMachine } from '../slice/fix-launch';
import { fixBars } from '../slice/fixbars';
import { fixLayout } from '../slice/fixit';
import { PRESETS } from '../slice/presets';
import { fixCoaster } from '../slice/fixcoaster';
import { MAX_PIECES, suggestPrompt } from '../slice/suggest-prompt';
import { adviseLane, type Advice } from '../slice/advice';
import { agentOn, runCourseAgent } from '../ui/course-agent-trace';
import { adviceInWorker, barsInWorker, fixInWorker, provesInWorker } from '../slice/proof-client';
import { parseReply, worldBrief, type Edit } from '../slice/designer';
import { diffProposal, enabledCount, fromAdvice, fromEdits, resultOf, type Proposal } from '../slice/preview';
import { ROLE_NAME, applySuggestion, movesInWorld, roleCourse, suggestRoles, type Role, type RoleSuggestion } from '../slice/roles';
import { deviceMesh, RECOIL_PAD_LENGTH, TREBUCHET_PIVOT_FROM_CENTRE } from '../slice/device';
import { shortcutLine, type Shortcut } from '../sim/shortcuts';
import { closeShortcut } from '../slice/shortcut-close';
import { makeItEasier } from '../slice/easier';
import { EDIT_KEY, HIST_KEY, checkpointFor, piecesFromSource, readHandoff } from '../slice/roundtrip';
import type { CourseSource } from '../course/course';
import { pageQuery, pageSearch } from '../flags';

// The World editor: build a world from pieces on a plan view, scale them (a toy brick becomes a block), turn, copy, crop and move them,
// choose the lane the runner takes (turn about the start, sideways, level), and play it. Everything is in metres.
const KEY = 'cc.world.v1';
interface Saved { pieces: { src: string; x: number; z: number; y: number; yaw: number; scale: number; role?: Role; decor?: boolean }[]; angle: number; offset: number; level: number; floor?: string }
type P = Piece & { src?: string };
const isSizeReference = (p: P) => p.src === 'obj:../characters/rookie-a.glb' || p.src === 'obj:../characters/rookie-b.glb';
const isDevice = (p: P) => p.src?.startsWith('device:') ?? false;

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

  let pieces: P[] = [];
  let selected: number | null = null;
  // CC-200: several pieces chosen at once (Shift+click, a box dragged on the picture). `selected` stays the main one; the group counts while it is in it.
  const multiOn = pageQuery().get('editorui') !== 'old';
  let group: number[] = [];
  const chosen = (): number[] => (multiOn ? chosenIds(group, selected, (id) => pieces.some((q) => q.id === id && !isSizeReference(q))) : selected !== null ? [selected] : []);
  const chooseMany = (ids: number[]) => { group = ids; selected = ids.length ? ids[ids.length - 1] : null; drawPanel(); draw(); drawProfile(); };
  // dragging one piece of a chosen group moves the whole group by the same step
  const moveWith = (p: P, x: number, z: number) => { const dx = x - p.x, dz = z - p.z, ids = chosen(); if (ids.length > 1 && ids.includes(p.id)) for (const q of pieces) if (q !== p && ids.includes(q.id)) { q.x += dx; q.z += dz; } p.x = x; p.z = z; };
  // Ctrl+C keeps the chosen pieces, Ctrl+V puts copies beside them (a group stays a group); pasting again goes one step further along
  let clip: P[] = [], pastes = 0;
  const copyChosen = () => { const ids = chosen(); if (!ids.length) return false; clip = pieces.filter((q) => ids.includes(q.id)).map((q) => ({ ...q })); pastes = 0; return true; };
  const pasteClip = () => {
    if (!clip.length) return;
    pastes++;
    const w = Math.max(...clip.map((q) => q.x + (size(q.mesh).w * q.scale) / 2)) - Math.min(...clip.map((q) => q.x - (size(q.mesh).w * q.scale) / 2)), dx = (w + 0.5) * pastes;
    const made = clip.map((q) => duplicate(q, dx, 0) as P);
    pieces.push(...made); selected = made[made.length - 1].id; group = made.length > 1 ? made.map((q) => q.id) : [];
    changed();
  };
  const deleteChosen = () => { const ids = chosen(); if (!ids.length) return; pieces = withoutIds(pieces, ids); selected = null; group = []; changed(); };
  let angle = 0, offset = 0, level = 0; // the lane: turn about the rod (radians), sideways (m), level (m)
  let view = { cx: 8, cz: 0, ppm: 36 }; // plan view: the world point in the middle, pixels per metre
  let personChipReady = false; // the chip is built after the 3D view; the world redraws can run before that
  const personAt = () => personStart(pieces, { angle, offset });
  let cropMode = false;
  let verdict = '';
  let helperReady = false; // the design partner's reply box exists
  let movesReady = false; // the Moves window exists (changed() may run before it is built)
  const pendingObjects: Saved['pieces'] = []; // saved photo objects, loaded once the list is in

  // a new piece goes just past the last one, on the lane's line, so pieces do not pile up
  const freeSpot = (id: string) => { const m = lib(id).mesh(); const w = size(m).w * (id === 'brick' ? 15 : 1); const right = pieces.reduce((r, p) => Math.max(r, p.x + (size(p.mesh).w * p.scale) / 2), 0); return { x: right + 1.5 + w / 2, z: 0 }; };
  const lib = (id: string) => LIBRARY.find((l) => l.id === id)!;
  const add = (id: string, at = { x: 0, z: 0 }): P => { const p: P = { ...newPiece(lib(id).label, lib(id).mesh(), at), src: id }; if (id === 'brick') p.scale = 15; pieces.push(p); selected = p.id; return p; };
  // the pieces of a saved world, built again from their sources (the photo objects come later, once their list is in)
  const buildPieces = (list: Saved['pieces']): P[] => piecesFromSource(list);
  let startFloor: Hazard = 'water'; // the floor of a restored world (applied where it is declared)
  function restore(s: Saved) {
    pendingObjects.push(...s.pieces.filter((q) => q.src.startsWith('obj:') || q.src.startsWith('user:')));
    pieces = buildPieces(s.pieces);
    angle = s.angle; offset = s.offset; level = s.level;
    startFloor = (HAZARDS as readonly string[]).includes(s.floor ?? '') ? (s.floor as Hazard) : 'water';
  }
  function load() {
    try {
      restore(JSON.parse(localStorage.getItem(KEY) ?? '') as Saved);
    } catch {
      // a first world made of real objects (no blocks): a short run with one of each kind, loaded once the object list is in
      restore({ pieces: PRESETS[0].pieces, angle: 0, offset: 0, level: 0 }); // CC-243: the default course has a real hang bar and the Lache, and the simulator swings on both
      selected = null;
    }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pieces: pieces.filter((p) => p.src && !p.src.startsWith('map:')).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale, ...(p.role ? { role: p.role } : {}) })), angle, offset, level, floor: floorChoice } satisfies Saved)); } catch { /* private window */ } };
  load();
  let mapCamera: { heading: number; pitch: number; distance?: number; target?: { x: number; z: number } } | null = null;
  try { // a place built in ?mode=map arrives once, as the whole world or as the buildings the player picked; it is not saved
    const m = JSON.parse(sessionStorage.getItem('cc.map.piece') ?? 'null') as { name: string; positions: number[]; indices: number[]; pieces?: { name: string; positions: number[]; indices: number[]; x: number; z: number }[]; camera?: { heading: number; pitch: number; distance?: number; target?: { x: number; z: number } }; lane?: { angle: number; offset: number; level: number; from: string }; objects?: Saved['pieces'] } | null;
    sessionStorage.removeItem('cc.map.piece');
    if (m?.lane && [m.lane.angle, m.lane.offset, m.lane.level].every(Number.isFinite)) { angle = m.lane.angle; offset = m.lane.offset; level = m.lane.level; document.documentElement.dataset.laneFrom = m.lane.from; } // CC-91: the lane the map proved, not the editor's own start
    if (m?.pieces?.length) { // picked buildings from the map flight (CC-79): separate pieces, each where it stood
      pendingObjects.length = 0;
      pieces = m.pieces.map((q) => ({ ...newPiece(q.name, { positions: q.positions, indices: q.indices }), x: q.x, z: q.z, src: `map:${q.name}` }));
      selected = pieces[0].id; mapCamera = m.camera ?? null;
    } else if (m) { pendingObjects.length = 0; pieces = [{ ...newPiece(m.name, { positions: m.positions, indices: m.indices }), src: `map:${m.name}` }]; selected = pieces[0].id; mapCamera = m.camera ?? null; }
    if (m?.objects?.length) pendingObjects.push(...m.objects); // CC-238: photo objects that stand on the place (the film's start scene)
  } catch { /* no place waiting */ }
  // CC-80: coming from the Course ("Edit this course", "Make it easier"): the course's own pieces replace the saved world, and "Back to the Course" returns to it
  const handoff = readHandoff();
  if (handoff && !pieces.some((q) => q.src?.startsWith('map:'))) {
    pendingObjects.length = 0;
    restore({ pieces: handoff.course.source!.pieces as Saved['pieces'], angle: handoff.course.source!.angle, offset: handoff.course.source!.offset, level: handoff.course.source!.level, floor: handoff.course.source!.floor });
    selected = null;
  }
  if (selected === null) { const tr = pieces.find((q) => isTrack(q)); if (tr) selected = tr.id; } // a coaster opens with its dots showing (CC-244)
  let focusId: number | null = null; // the piece nearest the place the player was at (chosen once the lane exists)

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, props: Partial<HTMLElementTagNameMap[K]> & { text?: string } = {}) => { const { text, ...rest } = props as Record<string, unknown> & { text?: string }; const e = Object.assign(document.createElement(tag), rest); if (text) e.textContent = text; parent.appendChild(e); return e as HTMLElementTagNameMap[K]; };

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
  interface Snap { pieces: P[]; angle: number; offset: number; level: number }
  const hist: Snap[] = [];
  let hi = -1;
  const snapNow = (): Snap => ({ pieces: pieces.map((q) => ({ ...q })), angle, offset, level });
  const same = (a: Snap, b: Snap) => a.angle === b.angle && a.offset === b.offset && a.level === b.level && a.pieces.length === b.pieces.length && a.pieces.every((q, i) => { const r = b.pieces[i]; return q.id === r.id && q.x === r.x && q.z === r.z && q.y === r.y && q.yaw === r.yaw && q.scale === r.scale && q.mesh === r.mesh && q.role === r.role; });
  const remember = () => { const n = snapNow(); if (hi >= 0 && same(hist[hi], n)) return; hist.splice(hi + 1); hist.push(n); if (hist.length > 80) hist.shift(); hi = hist.length - 1; undoBtn.disabled = hi < 1; redoBtn.disabled = true; };
  const goto = (k: number) => { const t = hist[k]; if (!t) return; hi = k; pieces = t.pieces.map((q) => ({ ...q })); angle = t.angle; offset = t.offset; level = t.level; if (!pieces.some((q) => q.id === selected)) selected = null; undoBtn.disabled = hi < 1; redoBtn.disabled = hi >= hist.length - 1; changed(false); };
  const undoBtn = el('button', top, { text: 'Ctrl+Z', id: 'undo', title: 'Undo' });
  const redoBtn = el('button', top, { text: 'Ctrl+Y', id: 'redo', title: 'Redo' });
  undoBtn.disabled = redoBtn.disabled = true;
  undoBtn.onclick = () => goto(hi - 1); redoBtn.onclick = () => goto(hi + 1);
  // the Courses gallery asks before leaving when there is work to lose: anything past the starting undo step
  (window as unknown as { ccHasUnsavedChanges?: () => boolean }).ccHasUnsavedChanges = () => hi > 0;
  // objects lifted from real photos (SAM 3D Objects, CC-38): each is a baked .glb at its real size
  const photoBar = addBar;
  // which photo made which 3D piece (CC-221): the credit shows under the name of the selected piece
  const provOf = new Map<string, Provenance>();
  const rememberUser = (id: string, glb: ArrayBuffer, prov: Provenance) => { userObjectUrls.set(userSrc(id), URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }))); provOf.set(userSrc(id), prov); };
  const addUserPiece = (id: string, glb: ArrayBuffer, prov: Provenance) => {
    rememberUser(id, glb, prov);
    const p: P = { ...newPiece(prov.name, readGlbMesh(glb), freeSpot('bench')), src: userSrc(id) };
    p.x = freeSpot('bench').x + size(p.mesh).w / 2;
    pieces.push(p); selected = p.id; changed();
  };
  void (async () => { try { const r = (await (await fetch('/assets/objects/provenance.json')).json()) as { objects: Provenance[] }; for (const o of r.objects) provOf.set(`obj:${o.glb}`, o); draw(); } catch { /* no provenance file: no credit line */ } })();
  if (uploadObjOn()) {
    el('button', photoBar, { text: 'Make an object from my photo…', id: 'makeobj', title: 'Draw a box round a real thing in your photo and get a 3D piece' }).onclick = () => openPhotoObject(async (r) => { try { await saveUserObject({ id: r.prov.id, glb: r.glb, prov: r.prov }); } catch { /* not kept after this visit */ } addUserPiece(r.prov.id, r.glb, r.prov); });
    void (async () => { try { for (const u of await listUserObjects()) { const b = el('button', photoBar, { text: `📷 Mine: ${u.prov.name}`, title: `From your photo. ${u.prov.credit.line}` }); b.dataset.object = u.id; b.dataset.fromPhoto = '1'; b.onclick = () => addUserPiece(u.id, u.glb, u.prov); } } catch { /* no saved objects */ } })();
  }
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
            if (o.hang_m) { p.noGround = true; p.yaw = Math.PI / 2; p.x = freeSpot('bench').x + 0.5; pieces.push(p); pieces.push(addBarPiece(p.x, o.hang_m - 0.04, p.z)); selected = p.id; changed(); return; }
            pieces.push(p); selected = p.id; changed();
          } catch { verdict = 'That object could not be loaded.'; draw(); }
        };
      }
      // pieces saved from a past visit
      for (const q of pendingObjects) {
        if (isSizeReference({ src: q.src } as P) && pieces.some(isSizeReference)) continue;
        try {
          const reference = isSizeReference({ src: q.src } as P);
          const mine = q.src.startsWith('user:') ? await getUserObject(q.src.slice(5)) : undefined; // the player's own object, kept in this browser (CC-221)
          if (q.src.startsWith('user:') && !mine) continue;
          if (mine) rememberUser(mine.id, mine.glb, mine.prov);
          const url = reference ? `/assets/characters/${q.src.slice('obj:../characters/'.length)}` : `/assets/objects/${q.src.slice(4)}`;
          const mesh = readGlbMesh(mine ? mine.glb : await (await fetch(url)).arrayBuffer());
          const p: P = { ...newPiece(reference ? 'Person' : mine ? mine.prov.name : q.src, mesh, { x: q.x, z: q.z }), src: q.src, y: q.y, yaw: q.yaw, scale: reference ? 1 : q.scale, ...(q.role ? { role: q.role } : {}) };
          if (reference) Object.assign(p, scaleToHeight(p, 1.75));
          if (q.decor) p.noGround = true; // scenery: seen, but the lane check ignores it (the film's photo box, CC-238)
          if (hangOf.has(q.src)) p.noGround = true; // its crossbar is a saved hold of its own
          pieces.push(p);
        } catch { /* a missing object is skipped */ }
      }
      for (const d of pieces.filter((q) => q.noGround && q.src?.startsWith('obj:') && !hangOf.has(q.src))) { // scenery sits on the roof under it, not in the air (CC-238)
        const pr = laneProfile(pieces.filter((q) => !q.noGround), { angle, offset, level }), u = d.x * Math.cos(angle) + d.z * Math.sin(angle), i0 = Math.floor(u / CELL) - Math.round((pr.origin ?? 0) / CELL);
        const w = Math.min(6, Math.ceil((size(d.mesh).w * d.scale) / 2 / CELL)), nm = pr.cells.length; // the nearest stretch of real roof wide enough to hold it (a street gap has none)
        let best = -1;

        for (let k = 0; k <= 80 && best < 0; k++) for (const j of k ? [i0 - k, i0 + k] : [i0]) { if (best >= 0 || j - w < 0 || j + w >= nm) continue; let ok = true; for (let i = j - w; i <= j + w; i++) if (pr.cells[i] == null) { ok = false; break; } if (ok) best = j; }
        if (best >= 0) { const du = (best - i0) * CELL; d.x += du * Math.cos(angle); d.z += du * Math.sin(angle); d.y = level + Math.max(...pr.cells.slice(best - w, best + w + 1).map((h) => h as number)); }
      }
      if (pendingObjects.length) { pendingObjects.length = 0; changed(false); hist.length = 0; hi = -1; remember(); onWorld(); fitAll(); } // the saved or first world is the starting point of the undo list
      await firstVisitPerson(); // a first visit: the person for scale stands at the start of the lane
    } catch { /* no objects on this site */ }
  })();
  // overhead: bars hanging in the air (a game, not real: they need no frame); the side view is where they are dragged
  el('strong', addBar, { text: 'Overhead:' });
  const nextX = () => pieces.reduce((r, q) => Math.max(r, q.x + (size(q.mesh).w * q.scale) / 2), 0) + 3;
  const nextLaneU = () => { const c = Math.cos(angle), s = Math.sin(angle); return pieces.reduce((r, p) => Math.max(r, p.x * c + p.z * s + (size(p.mesh).w * p.scale) / 2), 0) + 3; };
  const addBarPiece = (x: number, y: number, z = 0): P => { const q: P = { ...newPiece('Bar', barMesh(), { x, z }), src: 'hold:bar', y }; pieces.push(q); selected = q.id; return q; };
  el('button', addBar, { text: 'Bar', id: 'addbar' }).onclick = () => { addBarPiece(nextX(), 2.86); changed(); };
  // coaster sections (CC-244): rails the rider rides; leave a short gap between two sections and the rider flies across it (bars and ropes can catch them)
  const coasterOn = pageQuery().get('coaster') !== '0'; // on by default; ?coaster=0 hides the piece
  const trackShape = el('select', addBar, { id: 'trackshape', title: 'The shape of the next coaster section' }) as HTMLSelectElement;
  for (const t of TRACK_SHAPES) el('option', trackShape, { text: t.name, value: t.id });
  trackShape.style.display = coasterOn ? '' : 'none';
  const coasterBtn = el('button', addBar, { text: 'Coaster', id: 'addcoaster', title: 'A stretch of rail the character rides in a cart. The ride starts at the first section; a gap of about 3 m between sections is a flight.' });
  coasterBtn.onclick = () => {
    const shape = TRACK_SHAPES.find((t) => t.id === trackShape.value) ?? TRACK_SHAPES[0];
    const q = trackPiece(shape.pts, { x: 0, z: 0 });
    const w = size(q.mesh).w;
    const sections = pieces.filter(isTrack);
    q.y = trackStartY(sections.sort((m, n) => m.x - n.x)[sections.length - 1], shape.pts);
    q.x = sections.length ? Math.max(...sections.map((o) => o.x + (size(o.mesh).w * o.scale) / 2)) + 3 + w / 2 : w / 2;
    pieces.push(q); selected = q.id; changed();
  };
  coasterBtn.style.display = coasterOn ? '' : 'none';
  el('button', addBar, { text: 'Lache pair', id: 'addlache', title: 'Two bars to swing between' }).onclick = () => { const x = nextX(); addBarPiece(x, 2.86); addBarPiece(x + 3.5, 2.86); changed(); };
  // a rope swing: a post whose top is the rope anchor (role rope); put it over a gap and the simulator checks the swing
  el('button', addBar, { text: 'Rope swing', id: 'addrope', title: 'A post with a rope on top: put it over a gap between two pieces of ground and swing across' }).onclick = () => { const q: P = { ...newPiece('Rope anchor', box(0.5, 6.6, 0.5), { x: nextX() + 3, z: 0 }), role: 'rope' }; pieces.push(q); selected = q.id; changed(); };
  // a trebuchet at the start: the rider is thrown to the lane; the counterweight is the knob (the proof says whether it reaches)
  el('button', addBar, { text: 'Trebuchet', id: 'addtreb', title: 'Start the lane in a trebuchet: the character is thrown onto it' }).onclick = () => {
    const treMesh = deviceMesh('device:trebuchet:1200');
    const first = !pieces.some((p) => p.src?.startsWith('device:trebuchet:'));
    const centerU = first ? -TREBUCHET_PIVOT_FROM_CENTRE : nextLaneU() + size(treMesh).w / 2;
    const device = makeDevice('device:trebuchet:1200', 'Trebuchet', centerU);
    pieces.push(device); selected = device.id;
    changed();
    view.cx = device.x; view.cz = device.z; view3d.look(0, 65, { x: device.x, z: device.z }, 22);
  };
  const trebLabel = el('label', addBar, { text: 'Counterweight (kg) ' }); trebLabel.style.display = 'none';
  const trebInput = el('input', trebLabel, { type: 'number', min: '300', max: '4000', step: '50', value: '1200', id: 'trebkg' });
  trebInput.onchange = () => { const v = Number(trebInput.value); if (v >= 300 && v <= 4000) { updateDeviceSource('device:trebuchet', `device:trebuchet:${v}`); changed(); } };
  // a launcher on the start deck (recoil): the ball goes back, the runner goes forward; the ball's mass and speed are the knobs (the proof says whether it reaches)
  const recoilKnobs = el('span', addBar, {}); recoilKnobs.style.display = 'none';
  const recoilKg = el('input', el('label', recoilKnobs, { text: 'Ball (kg) ' }), { type: 'number', min: '2', max: '150', step: '1', value: '12', id: 'recoilkg' });
  const recoilSpeed = el('input', el('label', recoilKnobs, { text: 'Speed (m/s) ' }), { type: 'number', min: '3', max: '60', step: '1', value: '30', id: 'recoilspeed' });
  const syncRecoil = () => { recoilKnobs.style.display = recoilCfg ? '' : 'none'; if (recoilCfg) { recoilKg.value = String(recoilCfg.ballMass); recoilSpeed.value = String(recoilCfg.muzzle); } };
  for (const [kind, text, id, mass, speed, title] of [['bigcannon', 'Cannon', 'addcannon', 80, 45, 'A pad on the start deck with a big wheeled air cannon: aim it with Up and Down, fire it with K; the ball goes back, you fly forward and up (the proof searches the angle)'], ['cannon', 'Launcher', 'addrecoil', 12, 30, 'A pad on the start deck clips on an air launcher: the ball goes back, you go forward (momentum is conserved)']] as const) {
    el('button', addBar, { text, id, title }).onclick = () => {
      const first = !recoilPiece();
      const device = first
        ? makeRecoilDevice(kind, mass, speed)
        : makeDevice(`device:${kind}:${mass}:${speed}:${RECOIL_PAD_LENGTH}`, kind === 'bigcannon' ? 'Cannon' : 'Launcher', nextLaneU() + RECOIL_PAD_LENGTH / 2);
      pieces.push(device); selected = device.id;
      changed(); syncRecoil();
      view.cx = device.x; view.cz = device.z; view3d.look(0, 65, { x: device.x, z: device.z }, 13);
    };
  }
  const recoilEdit = () => { const m = Number(recoilKg.value), u = Number(recoilSpeed.value); if (recoilCfg && m >= 2 && m <= 150 && u >= 3 && u <= 60) { const p = recoilPiece(), len = p?.src?.split(':')[4] ?? String(RECOIL_PAD_LENGTH); updateDeviceSource(`device:${recoilCfg.kind}`, `device:${recoilCfg.kind}:${m}:${u}:${len}`); changed(); } };
  recoilKg.onchange = recoilEdit; recoilSpeed.onchange = recoilEdit;
  // an elastic band at the start: stretch it by running away from the post, turn round, and be thrown to the lane; the stiffness is the knob (the proof says whether it reaches)
  el('button', addBar, { text: 'Band', id: 'addband', title: 'Start the lane at an elastic band: stretch it, turn round, and it throws you onto the lane' }).onclick = () => { bandK = bandK ? null : 35; bandLabel.style.display = bandK ? '' : 'none'; bandInput.value = String(bandK ?? 35); changed(); };
  const bandLabel = el('label', addBar, { text: 'Stiffness (N/m) ' }); bandLabel.style.display = 'none';
  const bandInput = el('input', bandLabel, { type: 'number', min: '20', max: '300', step: '5', value: '35', id: 'bandk' });
  bandInput.onchange = () => { const v = Number(bandInput.value); if (v >= 20 && v <= 300) { bandK = v; changed(); } };
  // a drone pad (CC-87): hold E on it to board a cargo drone; the rider's weight and the battery are the knobs (the proof says whether it reaches)
  const droneKnobs = el('span', addBar, {}); droneKnobs.style.display = 'none';
  const droneKg = el('input', el('label', droneKnobs, { text: 'Rider (kg) ' }), { type: 'number', min: '30', max: '250', step: '5', value: '70', id: 'dronekg' });
  const droneWh = el('input', el('label', droneKnobs, { text: 'Battery (Wh) ' }), { type: 'number', min: '10', max: '1000', step: '10', value: '50', id: 'dronewh' });
  const syncDrone = () => { droneKnobs.style.display = droneCfg ? '' : 'none'; if (droneCfg) { droneKg.value = String(droneCfg.payload); droneWh.value = String(droneCfg.battery); } };
  el('button', addBar, { text: 'Drone', id: 'adddrone', title: 'A pad with a cargo drone: hold E on it to board and fly across (thrust against weight, battery, lean)' }).onclick = () => {
    if (dronePiece()) return;
    const device = makeDroneDevice(70, 50);
    pieces.push(device); selected = device.id;
    changed(); syncDrone();
    view.cx = device.x; view.cz = device.z; view3d.look(0, 65, { x: device.x, z: device.z }, 13);
  };
  const droneEdit = () => { const m = Number(droneKg.value), b = Number(droneWh.value); if (droneCfg && m >= 30 && m <= 250 && b >= 10 && b <= 1000) { const len = dronePiece()?.src?.split(':')[4] ?? String(DRONE_PAD_LENGTH); updateDeviceSource('device:drone', `device:drone:${m}:${b}:${len}`); changed(); } };
  droneKg.onchange = droneEdit; droneWh.onchange = droneEdit;
  // stacks: sport-stacking cups (mouth down, pyramids) as obstacle shapes; the piece scale makes a 9 cm cup runner-sized
  el('strong', addBar, { text: 'Stacks:' });
  for (const pt of PATTERNS) {
    el('button', addBar, { text: pt.label, id: `addstack-${pt.id}`, title: `Sport-stacking cups piled ${pt.label}: climb the steps they make` }).onclick = () => {
      const q = stackPiece(stackSrc(pt.id), { x: nextX() + 1, z: 0 })!; pieces.push(q); selected = q.id; changed();
    };
  }
  // a plank bridge: lay it across a gap between two pieces of ground; it sags and can break (the knobs are in the piece panel)
  el('button', addBar, { text: 'Plank', id: 'addplank', title: 'A plank bridge laid across a gap: it sags under the runner and breaks if it is too thin or too long' }).onclick = () => { const q = plankPiece(DEFAULT_PLANK, { x: nextX() + 1, z: 0 }); pieces.push(q); selected = q.id; changed(); };
  // size references: a Rookie (1.75 m, T-pose) and the demo scene, so a piece can be judged against a person
  el('strong', addBar, { text: 'Size references:' });
  for (const r of [{ id: 'person', label: 'Person reference (toggle)', url: '', src: '' }, { id: 'demo-scene', label: 'Demo scene', url: '/assets/demo/demo-scene.glb', src: 'obj:../demo/demo-scene.glb' }]) {
    const b = el('button', addBar, { text: r.label });
    b.dataset.object = r.id;
    b.onclick = async () => {
      if (r.id === 'person') {
        const person = pieces.find(isSizeReference);
        if (person) { pieces = pieces.filter((p) => !isSizeReference(p)); if (selected === person.id) selected = null; changed(); return; }
      }
      b.disabled = true;
      try {
        const rookie = localStorage.getItem('cc.rookie') === 'b' ? 'b' : 'a';
        const url = r.id === 'person' ? `/assets/characters/rookie-${rookie}.glb` : r.url;
        const src = r.id === 'person' ? `obj:../characters/rookie-${rookie}.glb` : r.src;
        const at = r.id === 'person' ? personAt() : { x: view.cx - 3 * Math.sin(angle), z: view.cz + 3 * Math.cos(angle) };
        const p: P = { ...scaleToHeight(newPiece(r.id === 'person' ? 'Person' : r.id, readGlbMesh(await (await fetch(url)).arrayBuffer()), at), 1.75), src };
        pieces.push(p); if (r.id !== 'person') selected = p.id; changed();
      } catch { verdict = 'That reference could not be loaded.'; draw(); }
      finally { b.disabled = false; }
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
    select: (id) => { selected = id; group = []; drawPanel(); draw(); drawProfile(); },
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
  const personThere = () => pieces.some(isSizeReference);
  const rememberPerson = (on: boolean) => { try { localStorage.setItem('cc.person', on ? '1' : '0'); } catch { /* the chip still works */ } };
  const personButton = () => addBar.querySelector<HTMLElement>('[data-object="person"]');
  const framePerson = () => { const p = pieces.find(isSizeReference); if (!p) return; view.cx = p.x; view.cz = p.z; view3d.look(25, 58, { x: p.x, z: p.z }, 7); view3d.pulse(p.x, p.z); };
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
    if (first && !personThere()) { personButton()?.click(); await waitForPerson(true); rememberPerson(true); hist.length = 0; hi = -1; remember(); onWorld(); }
  }
  const bar = el('div', planWrap, { className: 'piecebar', id: 'piecebar' }); // the selected piece's tools, on the picture next to the piece (CC-94)
  let topPlan = false;
  const setView = (plan2d: boolean) => { topPlan = plan2d; plan.style.display = plan2d ? 'block' : 'none'; view3d.show(!plan2d); viewBtn.textContent = plan2d ? '3D view' : 'Top plan'; viewBtn.setAttribute('aria-pressed', String(plan2d)); if (plan2d) fit(); };
  const viewBtn = el('button', top, { text: 'Top plan', id: 'viewmode', title: 'Switch between the 3D view and the flat plan (the plan is for cropping)' });
  viewBtn.onclick = () => setView(!topPlan);
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
    if (pieces.length > 1 && !confirm('Replace the pieces on the screen with this course? Ctrl+Z will not bring them back.')) { presetPick.value = ''; return; }
    try { sessionStorage.removeItem(EDIT_KEY); } catch { /* the editor was not opened from a course */ } // a hand-off from the Course would put the old pieces back on reload
    try { localStorage.setItem(KEY, JSON.stringify({ pieces: pr.pieces, angle: 0, offset: 0, level: 0, floor: floorChoice } satisfies Saved)); } catch { /* private window */ }
    location.reload();
  };
  const profileWrap = el('div', main, { className: 'profilewrap' });
  const profileCanvas = el('canvas', profileWrap, { width: 900, height: 128, id: 'profile' });
  const aside = el('div', root, { className: 'aside' });
  const howto = el('div', aside, { className: 'howto', id: 'coasterhowto' }); // the coaster's instructions, boxed so they cannot be missed (CC-244)
  howto.innerHTML = '<h2>Shape the coaster</h2><ul><li><kbd>Double-click</kbd> the rail in the side view to add a dot.</li><li><kbd>Drag</kbd> a purple dot to move it.</li><li>Press <kbd>Space</kbd> in the game to jump off the cart any time.</li></ul>';
  const side = el('div', aside, { className: 'panel', id: 'panel' });
  const lanePanel = el('div', aside, { className: 'panel' });
  // ---- helpers: what to shift when the lane cannot be cleared, and a design partner (Muse Spark Open) to talk it through
  const helper = el('div', aside, { className: 'panel helper', id: 'helper' });
  const head = el('div', helper, { className: 'row' });
  el('strong', head, { text: 'Design partner' });
  el('button', head, { text: 'Fix it', id: 'fixit', className: 'go', title: 'Show a layout the simulator can clear, before anything changes' }).onclick = () => runFix();
  el('button', head, { text: 'Make it easier', id: 'easier', title: 'Show the smallest change that makes the hardest press easier to land' }).onclick = () => runEasier();
  el('button', head, { text: '✕', id: 'closehelper', title: 'Hide' }).onclick = () => { helper.classList.add('closed'); helperBtn.setAttribute('aria-pressed', 'false'); };
  const selRow = el('label', helper, { className: 'muted', title: 'Fix it and Suggest Fix move only the pieces you have chosen, and leave the lane where it is' });
  const fixSel = el('input', selRow, { type: 'checkbox', id: 'fixsel' }); selRow.append('Move only the chosen pieces');
  const adviceBox = el('div', helper, { id: 'advice' });
  // CC-243: a ready question for the partner: Suggest Fix when the lane cannot be cleared, Suggest More when it can
  const suggestBtn = el('button', head, { text: 'Suggest More', id: 'suggest', title: 'Ask the design partner, with the question already written' });
  const setSuggest = (clear: boolean | null) => { suggestBtn.textContent = clear === false ? 'Suggest Fix' : 'Suggest More'; suggestBtn.classList.toggle('go', clear === false); suggestBtn.dataset.kind = clear === false ? 'fix' : 'more'; };
  // ---- routes you did not plan (CC-71): the simulator looks for lines that skip an obstacle; Close it previews a change that shuts one, Keep it marks it as meant
  const designed = new Set<string>();
  let routes: Shortcut[] = [], routesWorker: Worker | null = null;
  const routesHead = el('div', helper, { className: 'row', id: 'routeshead' });
  const findRoutesBtn = el('button', routesHead, { text: 'Look for routes you did not plan', id: 'findroutes', title: 'The simulator tries the course with each bar, wall or rope taken away and tells you which skips are faster' });
  const routesBox = el('div', helper, { id: 'routes' });
  const routesBrief = () => routes.filter((r) => !designed.has(r.id)).map((r) => shortcutLine(r));
  function renderRoutes() {
    routesBox.replaceChildren();
    if (!routes.length) { el('div', routesBox, { className: 'muted', text: 'No route that skips an obstacle is faster than the planned line.' }); return; }
    for (const s of routes) {
      const row = el('div', routesBox, { className: 'row', id: `route-${s.id}` });
      el('span', row, { text: shortcutLine(s) + (designed.has(s.id) ? ' (kept: meant by the designer)' : '') });
      el('button', row, { text: 'Close it', className: 'go', title: 'See a change that shuts this route before anything moves' }).onclick = () => closeRoute(s);
      el('button', row, { text: designed.has(s.id) ? 'Unkeep' : 'Keep it', title: 'Mark this route as meant: it stays, and is drawn as a dashed arrow' }).onclick = () => { if (designed.has(s.id)) designed.delete(s.id); else designed.add(s.id); renderRoutes(); drawProfile(); };
    }
  }
  function lookForRoutes() {
    findRoutesBtn.disabled = true; routesBox.replaceChildren(); el('div', routesBox, { className: 'muted', text: 'Looking for routes (about a minute)…' });
    const done = (list: Shortcut[]) => { routes = list; findRoutesBtn.disabled = false; renderRoutes(); drawProfile(); document.documentElement.dataset.routes = String(list.length); };
    try {
      routesWorker ??= new Worker(new URL('../sim/shortcuts-worker.ts', import.meta.url), { type: 'module' });
      routesWorker.onmessage = (e: MessageEvent) => done((e.data.shortcuts as Shortcut[]) ?? []);
      routesWorker.postMessage({ course: courseNow() });
    } catch { done([]); }
  }
  findRoutesBtn.onclick = lookForRoutes;
  function closeRoute(s: Shortcut) {
    reply.className = 'reply'; reply.textContent = 'Working out a change that closes it… (up to two minutes)'; helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    setTimeout(() => {
      const now = { angle, offset, level }, r = closeShortcut(pieces as P[], now, s);
      if (!r.ok) { reply.className = 'reply bad'; reply.textContent = r.steps.join(' '); return; }
      leadText = '';
      showProposal(diffProposal('shortcut', `Close the shortcut: ${s.how}`, pieces, now, r.pieces, now, r.steps, true));
    }, 30);
  }
  const reply = el('div', helper, { className: 'reply muted', id: 'reply', text: 'Ask for a change, or press "What should I change?".' });
  const askRow = el('div', helper, { className: 'row' });
  const ask = el('textarea', askRow, { id: 'ask', rows: 2, placeholder: 'e.g. make the gap easier, or a harder second half' });
  const sendBtn = el('button', askRow, { text: 'Ask', id: 'send', className: 'go' });
  const whatBtn = el('button', askRow, { text: 'What should I change?', id: 'what' });
  helperReady = true;
  suggestBtn.onclick = () => {
    const clear = document.documentElement.dataset.laneClear !== '0';
    ask.value = suggestPrompt(clear, pieces.filter((q) => !isSizeReference(q) && !isDevice(q)).map((q) => ({ name: q.name, x: q.x, heightM: realSize(q).h + q.y })));
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    sendBtn.click();
  };
  const helperBtn = el('button', top, { text: 'Design partner', id: 'helperbtn', title: 'Show or hide the design partner' });
  // CC-243: the partner slides in from the right edge; a tab rides its edge, Esc closes it, and the last choice is remembered
  const PARTNER_KEY = 'cc.partner.open';
  const partnerTab = el('button', root, { id: 'partnertab', text: 'Design partner', title: 'Show or hide the design partner' });
  const syncPartner = () => {
    const open = !helper.classList.contains('closed');
    helperBtn.setAttribute('aria-pressed', String(open)); partnerTab.classList.toggle('open', open); partnerTab.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(PARTNER_KEY, open ? '1' : '0'); } catch { /* private window */ }
  };
  let wasOpen = false; try { wasOpen = localStorage.getItem(PARTNER_KEY) === '1'; } catch { /* private window */ }
  helper.classList.toggle('closed', !wasOpen); syncPartner();
  new MutationObserver(syncPartner).observe(helper, { attributes: true, attributeFilter: ['class'] });
  helperBtn.onclick = partnerTab.onclick = () => helper.classList.toggle('closed');
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !helper.classList.contains('closed') && helper.contains(document.activeElement)) { helper.classList.add('closed'); } });

  // ---- the Moves window (CC-43): which moves this world has and lacks, and what each piece could be; every suggestion is proved by the simulator and goes through the shared preview
  const movesBox = el('div', planWrap, { className: 'panel moves closed', id: 'moves' });
  const movesBtn = el('button', planWrap, { text: 'Moves', id: 'movesbtn', title: 'Which moves this world has, what each needs, and what your pieces could be' }); // a chip on the picture, so the top bar does not grow a line
  movesBtn.style.cssText = 'position:absolute;left:10px;top:10px;z-index:6';
  movesBtn.setAttribute('aria-pressed', 'false');
  movesBtn.onclick = () => { const closed = movesBox.classList.toggle('closed'); movesBtn.setAttribute('aria-pressed', String(!closed)); if (!closed) renderMoves(); };
  let movesBusy = '', movesList: { label: string; items: RoleSuggestion[] } | null = null;
  const laneNow = () => ({ angle, offset, level });
  function roleProposal(sg: RoleSuggestion): Proposal {
    const next = applySuggestion(pieces, sg);
    return diffProposal('role', 'A way to use a piece', pieces, laneNow(), next, laneNow(), [sg.words], sg.proved === true ? true : undefined);
  }
  function findWays(only?: number) {
    if (movesBusy) return;
    movesBusy = only === undefined ? 'the world' : 'this piece'; renderMoves();
    setTimeout(() => {
      const items = suggestRoles(coursePieces(), laneNow(), { budgetMs: 40000, ...(only !== undefined ? { only } : {}) }).filter((x) => x.proved);
      movesList = { label: only === undefined ? 'Ways to add a missing move (each one checked by the simulator)' : 'What this piece could be (each one checked by the simulator)', items };
      movesBusy = ''; document.documentElement.dataset.roleSuggestions = String(items.length); renderMoves();
    }, 30);
  }
  function renderMoves() {
    if (!movesReady || movesBox.classList.contains('closed')) return;
    movesBox.replaceChildren();
    const hd = el('div', movesBox, { className: 'row' });
    el('strong', hd, { text: 'Moves in this world' });
    el('button', hd, { text: '✕', id: 'closemoves', title: 'Hide' }).onclick = () => { movesBox.classList.add('closed'); movesBtn.setAttribute('aria-pressed', 'false'); };
    const status = movesInWorld(coursePieces(), laneNow(), { trebuchet: !!trebuchetKg });
    document.documentElement.dataset.moves = JSON.stringify(Object.fromEntries(status.map((m) => [m.id, m.have])));
    for (const m of status) {
      const row = el('div', movesBox, { className: 'mv' });
      el('span', row, { className: `mvicon ${m.have === 'yes' ? 'yes' : m.have === 'no' ? 'no' : 'muted'}`, text: m.have === 'yes' ? '✓' : m.have === 'no' ? '+' : '↗', title: m.have === 'yes' ? 'This world has it' : m.have === 'no' ? 'Missing: it can be added' : 'Built somewhere else' });
      el('span', row, { className: 'mvtext', text: `${m.name}: ${m.detail}` });
      if (m.have !== 'yes') el('span', row, { className: 'need', text: m.need });
      if (m.have === 'no' && m.id === 'lache') el('button', row, { text: 'Add two bars', id: 'addbars', className: 'go' }).onclick = () => { addBarPiece(view.cx - 1.6, 2.9); addBarPiece(view.cx + 1.6, 2.9); changed(); };
      if (m.have === 'no' && m.id === 'trebuchet') el('button', row, { text: 'Start in a trebuchet', id: 'movestreb' }).onclick = () => document.getElementById('addtreb')?.click();
      if (m.have === 'elsewhere') { const a = el('a', row, { text: 'Open the coaster builder', href: '?mode=coaster' }); a.className = 'btn'; }
    }
    const sel = pieces.find((q) => q.id === selected);
    if (sel && !isHold(sel) && !isSizeReference(sel) && !isDevice(sel)) {
      const row = el('div', movesBox, { className: 'sg' });
      el('div', row, { text: `Selected piece: ${sel.name}` });
      const lab = el('label', row, { text: 'Use it as ' });
      const pick = el('select', lab, { id: 'rolepick' });
      for (const r of ['ground', 'wall', 'rope', 'trampoline', 'bar'] as Role[]) el('option', pick, { value: r, text: ROLE_NAME[r] });
      pick.value = sel.role ?? 'ground';
      pick.onchange = () => { sel.role = pick.value === 'ground' ? undefined : (pick.value as Role); changed(); };
      el('button', row, { text: 'What could this be?', id: 'whatcould' }).onclick = () => findWays(sel.id);
    }
    el('button', movesBox, { text: movesBusy ? `Checking ${movesBusy} with the simulator…` : 'Find ways to add the missing moves', id: 'findways', className: 'go' }).onclick = () => findWays();
    if (movesBusy) (document.getElementById('findways') as HTMLButtonElement).disabled = true;
    if (movesList) {
      el('strong', movesBox, { text: movesList.label });
      if (!movesList.items.length) el('div', movesBox, { className: 'muted', text: 'No single change gives a missing move here. Try other pieces, or scale one by hand.' });
      for (const sg of movesList.items) {
        const row = el('div', movesBox, { className: 'sg' });
        el('div', row, { text: sg.words });
        el('button', row, { text: 'Show it', className: 'go', title: 'See where it would go before anything changes' }).onclick = () => { leadText = ''; showProposal(roleProposal(sg)); };
      }
    }
  }
  movesReady = true;
  // ---- labs (?labs=1, or ?photo=<url>): a park photo becomes a first draft of a course; the simulator checks it and Fix it repairs it
  // the photo-to-course lab: the file picker exists everywhere (the add browser's "Use my own photo" opens it); the button in the More menu shows with ?labs=1 or ?photo=<url>
  const fileIn = el('input', top, { type: 'file', accept: 'image/jpeg,image/png', id: 'photofile' }) as HTMLInputElement;
  fileIn.style.display = 'none';
  fileIn.onchange = () => { const f = fileIn.files?.[0]; if (f) void draftFrom(f); fileIn.value = ''; };
  (window as unknown as { ccPickPhoto?: () => void }).ccPickPhoto = () => fileIn.click();
  if (/[?&](labs|photo)\b/.test(pageSearch())) {
    el('button', top, { text: 'Photo to course (labs)', id: 'photobtn', title: 'Pick a park photo: the design partner drafts a course from it, then the simulator checks it' }).onclick = () => fileIn.click();
    const url = pageQuery().get('photo');
    if (url) void fetch(url).then((r) => r.blob()).then(draftFrom).catch(() => { reply.className = 'reply bad'; reply.textContent = 'I could not read that photo.'; });
  }
  // the Course Agent (labs, ?agent=1): propose from a photo, test with the simulator, repair from its report, stop when proven; the steps show as a list
  if (agentOn()) {
    const agentIn = el('input', top, { type: 'file', accept: 'image/jpeg,image/png', id: 'agentfile' }) as HTMLInputElement;
    agentIn.style.display = 'none';
    const trace = Object.assign(document.createElement('ol'), { id: 'agenttrace', className: 'agent-trace' });
    trace.style.cssText = 'margin:0;padding-left:18px;display:grid;gap:4px;font-size:13px';
    agentIn.onchange = () => {
      const f = agentIn.files?.[0]; agentIn.value = '';
      if (!f) return;
      helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
      reply.className = 'reply'; reply.replaceChildren(trace);
      void runCourseAgent(f, { trace, apply: (layout) => { pieces = layoutToPieces(layout); angle = 0; offset = 0; level = 0; selected = null; changed(); } });
    };
    el('button', top, { text: 'Course Agent (labs)', id: 'agentbtn', title: 'Pick a park photo: the agent proposes a course, tests it with the simulator, repairs it, and stops when it is proven' }).onclick = () => agentIn.click();
  }
  async function draftFrom(file: Blob) {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    const done = (state: string, text: string, ok = false) => { document.documentElement.dataset.photoDraft = state; reply.className = ok ? 'reply ok' : 'reply bad'; reply.textContent = text; };
    reply.className = 'reply'; reply.textContent = 'Looking at the photo…'; document.documentElement.dataset.photoDraft = 'asking';
    try {
      const bmp = await createImageBitmap(file), k = Math.min(1, 768 / bmp.width);
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const r = await fetch('/api/photo-course', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: c.toDataURL('image/jpeg', 0.8) }) });
      const d = (await r.json()) as { reply?: string; error?: string };
      if (!r.ok || !d.reply) return done('error', d.error ?? 'No draft this time.');
      const parsed = parseLayout(d.reply);
      if (!parsed.layout) return done('unreadable', `I could not read a layout from the answer (${parsed.problems.join(', ')}). Try again.`);
      pieces = layoutToPieces(parsed.layout); angle = 0; offset = 0; level = 0; selected = null; changed();
      reply.className = 'reply'; reply.textContent = `${parsed.text} Checking the draft with the simulator…`;
      setTimeout(() => {
        if (proves(pieces as P[], { angle, offset, level })) return done('cleared', `${parsed.text} The simulator can clear this draft as it is.`, true);
        document.documentElement.dataset.photoDraft = 'fixing'; runFixDirect();
        const wait = window.setInterval(() => {
          if (reply.textContent === 'Working it out…') return;
          clearInterval(wait);
          if (!proves(pieces as P[], { angle, offset, level }) && pieces.some((q) => isHold(q as P))) { // the photo had nothing to hang from? take the bars out and try the ground alone
            pieces = pieces.filter((q) => !isHold(q as P)); changed(); reply.className = 'reply'; reply.textContent = 'Took out the bars (the photo may have nothing to hang from). Working it out again…';
            if (!proves(pieces as P[], { angle, offset, level })) runFixDirect();
            const again = window.setInterval(() => {
              if (reply.textContent === 'Working it out…' || reply.textContent?.startsWith('Took out the bars')) return;
              clearInterval(again); document.documentElement.dataset.photoDraft = proves(pieces as P[], { angle, offset, level }) ? 'fixed' : 'unfixed';
            }, 300);
            if (proves(pieces as P[], { angle, offset, level })) { clearInterval(again); done('fixed', 'Took out the bars (the photo may have nothing to hang from): the simulator can clear what is left.', true); }
          } else document.documentElement.dataset.photoDraft = proves(pieces as P[], { angle, offset, level }) ? 'fixed' : 'unfixed';
        }, 300);
      }, 50);
    } catch { done('error', 'The photo helper is not available here.'); }
  }
  // the photo draft changes the layout at once (it is a first draft, not the player's own layout)
  function runFixDirect() {
    reply.className = 'reply'; reply.textContent = 'Working it out…';
    setTimeout(async () => {
      if (barsNow().length) {
        const rb = await barsInWorker(pieces as P[], { angle, offset, level }, workSeconds(6));
        for (const q of rb.pieces) { const mine = pieces.find((x) => x.id === q.id); if (mine) { mine.x = q.x; mine.z = q.z; mine.y = q.y; } }
        changed();
        reply.className = rb.ok ? 'reply ok' : 'reply bad';
        reply.textContent = rb.ok ? (rb.steps.length ? 'Fixed. ' + rb.steps.join(' ') : 'It already works.') : rb.steps.join(' ');
        document.documentElement.dataset.fixed = rb.ok ? '1' : '0';
        return;
      }
      const r = await fixInWorker(pieces as P[], { angle, offset, level });
      for (const q of r.pieces) { const mine = pieces.find((x) => x.id === q.id); if (mine) { mine.x = q.x; mine.z = q.z; mine.y = q.y; mine.yaw = q.yaw; mine.scale = q.scale; } }
      angle = r.lane.angle; offset = r.lane.offset; level = r.lane.level;
      changed();
      reply.className = r.ok ? 'reply ok' : 'reply bad';
      reply.textContent = r.ok ? (r.steps.length ? 'Fixed. ' + r.steps.join(' ') : 'It already works.') : 'I could not find a layout that works. ' + r.steps.join(' ') + ' Try other pieces.';
      document.documentElement.dataset.fixed = r.ok ? '1' : '0';
    }, 30);
  }

  // ---- preview before apply: Fix it, the partner's changes and one piece of advice all become a Proposal that is drawn as outlines first
  let proposal: Proposal | null = null;
  let preview: { pieces: P[]; lane: { angle: number; offset: number; level: number }; machine: Machine | null } | null = null;
  let previewProfile: ReturnType<typeof sliceProfile> | null = null;
  let previewBars: ReturnType<typeof holdsOf> = [];
  let proofRun = 0, leadText = '';
  const proofs = new Map<string, boolean>();
  const keyOf = (pr: Proposal) => pr.items.map((i) => (i.on ? '1' : '0')).join('');
  const ghostData = (): Ghosts | null => {
    if (!proposal || !preview) return null;
    const items = proposal.items.flatMap((i) => (i.kind === 'piece' && i.on ? [{ id: i.id, from: i.from, to: i.to }] : []));
    const laneMoved = proposal.items.some((i) => i.kind === 'lane' && i.on && i.key !== 'level');
    return { items, lane: laneMoved ? { angle: preview.lane.angle, offset: preview.lane.offset } : null };
  };
  async function computeFix(ps: P[], lane: { angle: number; offset: number; level: number }): Promise<{ ok: boolean; pieces: P[]; lane: { angle: number; offset: number; level: number }; steps: string[]; machine: Machine | null }> {
    const m = machineNow(), wrap = machineWrap(m); // a machine's wrap is a function, which a worker cannot be sent: with a machine the proofs run here, without one they run in a worker
    ps = ps.filter((q) => !isSizeReference(q) && !isDevice(q)); // the machine and the size references are not ground
    if (m) { const mf = fixMachine(ps, lane, m, 40000, trebuchetPivot()); if (mf.ok) return { ok: true, pieces: ps, lane, steps: mf.steps, machine: mf.machine }; } // the machine first: a counterweight or an arm is a smaller change than moving pieces
    if (ps.some(isTrack)) { const fc = fixCoaster(ps, lane); return { ok: fc.ok, pieces: fc.pieces, lane, steps: fc.steps, machine: m }; } // CC-244: a coaster world moves sections and bars, never the lane
    if (ps.some(isHold)) { const rb = m ? fixBars(ps, lane, workSeconds(40), wrap) : await barsInWorker(ps, lane, workSeconds(40)); return { ok: rb.ok, pieces: rb.pieces, lane, steps: rb.steps, machine: m }; }
    const only = fixSel.checked ? chosen().filter((id) => ps.some((q) => q.id === id)) : []; // CC-243: with pieces chosen, only those may move and the lane stays
    const r = m ? fixLayout(ps, lane, workSeconds(12), wrap, only.length ? { movable: only } : {}) : await fixInWorker(ps, lane, only.length ? only : undefined);
    return { ok: r.ok, pieces: r.pieces as P[], lane: r.lane, steps: r.steps, machine: m };
  }
  function runFix(from?: { pieces: P[]; lane: { angle: number; offset: number; level: number } }) {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    reply.className = 'reply'; reply.textContent = 'Working it out…' + (pieces.some(isHold) ? ' (bars take a while: up to 40 seconds)' : '');
    setTimeout(async () => {
      const pf = plankFixNow(); // a plank that would snap: the smallest change is a thicker plank or a post, said in words first
      if (pf) {
        reply.className = 'reply bad'; reply.textContent = 'The plank would snap. ' + pf.steps.join(' ') + ' ';
        const mk = el('button', reply, { text: 'Make it so', className: 'go', id: 'plankfix' });
        mk.onclick = () => { pf.apply(); changed(); reply.className = 'reply ok'; reply.textContent = 'Done: the plank is stronger now.'; };
        document.documentElement.dataset.fixed = '0';
        return;
      }
      if (droneCfg && !trebuchetKg && !verdict.startsWith('The simulator can clear')) { // the drone is the first thing to change: a bigger battery or a lighter rider
        const fd = fixDrone(courseNow(), droneCfg, droneRange());
        reply.className = fd.ok ? 'reply ok' : 'reply bad';
        reply.textContent = fd.ok ? (fd.steps[0] ?? 'It already works.') : fd.steps.join(' ');
        document.documentElement.dataset.fixed = fd.ok ? '1' : '0';
        if (fd.ok && fd.steps.length) el('button', reply, { text: 'Use it', className: 'go', id: 'usedrone' }).onclick = () => { const len = dronePiece()?.src?.split(':')[4] ?? String(DRONE_PAD_LENGTH); updateDeviceSource('device:drone', `device:drone:${fd.cfg.payload}:${fd.cfg.battery}:${len}`); changed(); };
        return;
      }
      if (recoilCfg && !trebuchetKg && !verdict.startsWith('The simulator can clear')) { // the launcher is the first thing to change: a heavier or faster ball
        const fr = fixRecoil(courseNow(), recoilCfg);
        reply.className = fr.ok ? 'reply ok' : 'reply bad';
        reply.textContent = fr.ok ? (fr.steps[0] ?? 'It already works.') : fr.steps.join(' ');
        document.documentElement.dataset.fixed = fr.ok ? '1' : '0';
        if (fr.ok && fr.steps.length) el('button', reply, { text: 'Use it', className: 'go', id: 'userecoil' }).onclick = () => { const len = recoilPiece()?.src?.split(':')[4] ?? String(RECOIL_PAD_LENGTH); updateDeviceSource(`device:${fr.cfg.kind}`, `device:${fr.cfg.kind}:${fr.cfg.ballMass}:${fr.cfg.muzzle}:${len}`); syncRecoil(); changed(); };
        return;
      }
      if (bandK) { // the band: the only thing Fix it can change is its stiffness; it says so and waits for Apply
        const bf = fixBand(laneCourse(currentProfile()));
        document.documentElement.dataset.fixed = bf.ok ? '1' : '0';
        reply.className = bf.ok ? 'reply ok' : 'reply bad';
        reply.textContent = bf.ok ? (bf.steps.length ? bf.steps.join(' ') : 'It already works.') : bf.steps.join(' ');
        if (bf.ok && bf.steps.length) el('button', reply, { text: 'Apply', id: 'applyband', className: 'go' }).onclick = () => { bandK = bf.k; bandInput.value = String(bf.k); changed(); reply.textContent = 'Applied.'; };
        return;
      }
      const now = { angle, offset, level }, start = from ?? { pieces, lane: now };
      const r = await computeFix(start.pieces, start.lane).catch(() => null);
      if (!r) { reply.className = 'reply bad'; reply.textContent = 'Fix it was stopped. Try again.'; return; }
      document.documentElement.dataset.fixed = r.ok ? '1' : '0';
      const prop = diffProposal('fixit', from ? 'Fix it, starting from your partner’s changes' : 'Fix it', pieces, now, r.pieces, r.lane, r.steps, r.ok, machineNow(), r.machine);
      if (!prop.items.length) {
        reply.className = r.ok ? 'reply ok' : 'reply bad';
        reply.textContent = r.ok ? 'It already works.' : pieces.some(isHold) ? r.steps.join(' ') : 'I could not find a layout that works. ' + r.steps.join(' ') + ' Try other pieces.';
        return;
      }
      leadText = '';
      showProposal(prop);
    }, 30);
  }
  // Make it easier: the simulator knows the lane clears, but the hardest press is narrow; try the smallest changes near the obstacle and show the first that widens it
  function runEasier() {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    reply.className = 'reply'; reply.textContent = 'Looking for the smallest change that makes the hardest press easier… (up to ' + (pieces.some(isHold) ? '2 minutes' : '40 seconds') + ')';
    setTimeout(async () => {
      const c0 = courseNow(), lane = { angle, offset, level };
      const at = pieces.find((q) => q.id === selected);
      const x = at ? xOfPiece(at, c0) : handoff?.x ?? c0.startX;
      const r = await makeItEasier(pieces, lane, x, { courseOf: courseFor, xOf: (q) => xOfPiece(q, c0) }, undefined, (n, total) => { reply.textContent = `Trying change ${n} of ${total}…`; });
      document.documentElement.dataset.easier = r.proposal ? '1' : '0';
      if (!r.proposal) { reply.className = 'reply muted'; reply.textContent = r.note; return; }
      leadText = '';
      showProposal(r.proposal);
    }, 30);
  }
  // when the world is complete (its photo objects are in): open at the obstacle the player was at, and look for an easier way if that was asked
  let worldDone = false;
  function onWorld() {
    if (worldDone || !handoff) return;
    worldDone = true;
    const c0 = courseNow();
    const solid = pieces.filter((q) => isHold(q) || realSize(q).h > 0.05);
    const near = [...(solid.length ? solid : pieces)].sort((a, b) => Math.abs(xOfPiece(a, c0) - handoff.x) - Math.abs(xOfPiece(b, c0) - handoff.x))[0];
    if (near) { focusId = near.id; selected = near.id; view3d.focus(near.x, near.z); drawPanel(); draw(); drawProfile(); }
    document.documentElement.dataset.fromcourse = handoff.intent;
    if (handoff.intent === 'easier') runEasier();
  }
  function showProposal(pr: Proposal) {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    proposal = pr; proofs.clear();
    if (pr.known !== undefined) proofs.set(keyOf(pr), pr.known);
    renderProposal(); updatePreview();
    document.documentElement.dataset.previewItems = String(pr.items.length);
  }
  function closePreview(message?: string) {
    proposal = null; preview = null; previewProfile = null; previewBars = []; proofRun++;
    document.documentElement.dataset.preview = '';
    if (message) { reply.className = 'reply muted'; reply.textContent = message; }
    draw(); drawProfile();
  }
  function renderProposal() {
    const pr = proposal;
    if (!pr) return;
    reply.className = 'reply'; reply.replaceChildren();
    if (leadText) el('div', reply, { text: leadText });
    el('strong', reply, { text: pr.title });
    el('div', reply, { className: 'muted', text: 'The outlines show where things would go (grey: now, teal: after). Nothing changes until you press Apply.' });
    if (pr.source === 'easier') for (const st of pr.steps) el('div', reply, { className: 'ok', text: st });
    for (const it of pr.items) {
      const row = el('label', reply, { className: 'pvrow' });
      const cb = el('input', row, { type: 'checkbox', checked: it.on });
      cb.onchange = () => { it.on = cb.checked; updatePreview(); };
      el('span', row, { text: it.words });
    }
    el('div', reply, { id: 'previewverdict', className: 'muted' });
    const row = el('div', reply, { className: 'row', id: 'previewbuttons' });
    el('button', row, { text: 'Apply', id: 'applypreview', className: 'go' }).onclick = applyProposal;
    if (handoff) el('button', row, { text: 'Apply and try it', id: 'applytry', className: 'go', title: 'Apply the changes and play again from the last checkpoint' }).onclick = () => { applyProposal(); void goToCourse(true); };
    el('button', row, { text: 'Cancel', id: 'cancelpreview' }).onclick = () => closePreview('Cancelled: nothing changed.');
  }
  function paintVerdict(state: 'checking' | 'clears' | 'blocked' | 'none') {
    const v = document.getElementById('previewverdict'), apply = document.getElementById('applypreview') as HTMLButtonElement | null, rowEl = document.getElementById('previewbuttons');
    if (!v || !apply || !rowEl) return;
    document.documentElement.dataset.preview = state;
    v.className = state === 'clears' ? 'ok' : state === 'blocked' ? 'bad' : 'muted';
    v.textContent = state === 'checking' ? 'Checking with the simulator…' : state === 'clears' ? 'After this change the lane clears.' : state === 'blocked' ? 'After this change the lane does not clear.' : 'Nothing is switched on.';
    apply.disabled = state === 'none';
    const tryBtn = document.getElementById('applytry') as HTMLButtonElement | null; if (tryBtn) tryBtn.disabled = state === 'none';
    rowEl.querySelector('#fixfromhere')?.remove();
    if (state === 'blocked' && proposal && proposal.source !== 'fixit' && preview) {
      const from = { pieces: preview.pieces, lane: preview.lane };
      el('button', rowEl, { text: 'Fix it from here', id: 'fixfromhere', title: 'Show the smallest further changes that make it clear' }).onclick = () => runFix(from);
    }
  }
  function updatePreview() {
    if (!proposal) { preview = null; previewProfile = null; previewBars = []; return; }
    preview = resultOf(pieces, { angle, offset, level }, proposal, machineNow());
    previewProfile = laneProfile(preview.pieces.filter((q) => !isHold(q) && q.role !== 'rope' && q.role !== 'bar'), preview.lane);
    previewBars = holdsOf(preview.pieces, preview.lane);
    draw(); drawProfile();
    const key = keyOf(proposal), mine = ++proofRun;
    if (!enabledCount(proposal)) return paintVerdict('none');
    const known = proofs.get(key);
    if (known !== undefined) return paintVerdict(known ? 'clears' : 'blocked');
    paintVerdict('checking');
    const snapshot = preview;
    setTimeout(async () => { if (mine !== proofRun || !proposal) return; const mp = snapshot.pieces.filter((q) => !isSizeReference(q) && !isDevice(q)); const ok = snapshot.machine ? proves(mp, snapshot.lane, machineWrap(snapshot.machine)) : await provesInWorker(mp, snapshot.lane).catch(() => null); if (ok === null || mine !== proofRun || !proposal) return; proofs.set(key, ok); paintVerdict(ok ? 'clears' : 'blocked'); }, 30);
  }
  function applyProposal() {
    if (!proposal || !preview) return;
    const r = preview, words = proposal.items.filter((i) => i.on).map((i) => i.words).join(' ');
    for (const q of r.pieces) { const mine = pieces.find((x) => x.id === q.id); if (mine) { mine.x = q.x; mine.z = q.z; mine.y = q.y; mine.yaw = q.yaw; mine.scale = q.scale; mine.role = q.role; } }
    angle = r.lane.angle; offset = r.lane.offset; level = r.lane.level;
    if (r.machine && trebuchetKg) { updateDeviceSource('device:trebuchet', `device:trebuchet:${r.machine.counterweight}`); trebuchetExtra = { ...(r.machine.short !== undefined ? { short: r.machine.short } : {}), ...(r.machine.pin !== undefined ? { pin: r.machine.pin } : {}) }; } // the counterweight lives in the machine piece
    proposal = null; preview = null; previewProfile = null; previewBars = []; proofRun++;
    changed(); // one undo step
    reply.className = 'reply ok'; reply.textContent = `Applied. ${words}`;
    document.documentElement.dataset.preview = 'applied';
  }
  let adviceList: Advice[] = [];
  let pendingEdits: Edit[] = [];
  const chat: { role: 'user' | 'assistant'; content: string }[] = [];
  const previewAdvice = (a: Advice) => { leadText = ''; showProposal(fromAdvice(pieces, { angle, offset, level }, a, machineNow())); };
  function showAdvice() {
    adviceBox.textContent = '';
    for (const a of adviceList) {
      const row = el('div', adviceBox, { className: 'row' });
      el('span', row, { text: a.text });
      el('button', row, { text: 'Show it', className: 'go', title: 'See where it would go before anything changes' }).onclick = () => previewAdvice(a);
    }
  }
  async function askPartner(text: string) {
    chat.push({ role: 'user', content: text });
    reply.className = 'reply'; reply.textContent = 'Thinking…'; sendBtn.disabled = whatBtn.disabled = true;
    try {
      const r = await fetch('/api/designer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: chat.slice(-6), world: worldBrief(pieces, { angle, offset, level }, verdict, adviceList.map((a) => a.text), barsNow(), routesBrief()) }) });
      if (r.status === 503) { reply.className = 'reply muted'; reply.textContent = 'The design partner is switched off on this site (no key set).'; return; }
      if (!r.ok) throw new Error(String(r.status));
      const got = parseReply(((await r.json()) as { reply: string }).reply, pieces.map((q) => q.id));
      chat.push({ role: 'assistant', content: got.text });
      reply.textContent = got.text; pendingEdits = got.edits;
      if (got.edits.length) el('button', reply, { text: `Show these ${got.edits.length} change${got.edits.length > 1 ? 's' : ''}`, className: 'go', id: 'applyedits', title: 'See where the pieces would go before anything changes' }).onclick = () => {
        const pr = fromEdits(pieces, { angle, offset, level }, pendingEdits);
        if (!pr.items.length) { reply.textContent = got.text + ' (Those changes would not move anything.)'; return; }
        leadText = got.text; showProposal(pr);
      };
    } catch { reply.className = 'reply bad'; reply.textContent = 'The design partner could not answer. Try again.'; }
    finally { sendBtn.disabled = whatBtn.disabled = false; }
  }
  sendBtn.onclick = () => { const t = ask.value.trim(); if (t) { ask.value = ''; void askPartner(t); } };
  whatBtn.onclick = () => void askPartner(verdict.startsWith('The simulator can clear') ? 'The lane clears. Suggest one change that makes it more interesting to run.' : 'The lane does not clear. What should I change?');

  // the two pictures fill their boxes exactly, so nothing ever scrolls
  const fit = () => {
    plan.width = Math.max(200, planWrap.clientWidth); plan.height = Math.max(120, planWrap.clientHeight);
    profileCanvas.width = Math.max(200, profileWrap.clientWidth); profileCanvas.height = Math.max(60, profileWrap.clientHeight);
    draw(); drawProfile();
  };
  new ResizeObserver(fit).observe(planWrap);
  new ResizeObserver(fit).observe(profileWrap);
  setView(false);

  function plankFixNow(): { steps: string[]; apply: () => void } | null {
    const c = courseNow(), laid = planksOf(pieces as P[], { angle, offset, level });
    const fixes: { piece: P; spec: PlankSpec; fix: ReturnType<typeof fixPlank> }[] = [];
    (c.planks ?? []).forEach((pk, i) => { const pc = laid[i] ? (pieces.find((q) => q.id === laid[i].id) as P | undefined) : undefined; if (pc && !plankHolds(pk)) fixes.push({ piece: pc, spec: plankSpecOf(pc.src)!, fix: fixPlank(pk) }); });
    if (!fixes.length) return null;
    return { steps: fixes.flatMap((f) => f.fix.steps), apply: () => fixes.forEach((f) => { if (f.fix.ok) setPlank(f.piece, { ...f.spec, thickness: f.fix.plank.thickness, support: !!f.fix.plank.support }); }) };
  }

  // ---- a plank bridge's knobs: material, thickness, width, a post in the middle (the length is the gap it lies across)
  function plankKnobs(p: P) {
    const spec = plankSpecOf(p.src)!;
    const set = (patch: Partial<PlankSpec>) => { setPlank(p, { ...spec, ...patch }); changed(); };
    const mat = el('label', side, { text: 'Material ' });
    const sel = el('select', mat, { id: 'plankmat' }) as HTMLSelectElement;
    for (const [v, t] of [['wood', 'Pine plank'], ['steel', 'Steel plate']] as const) { const o = el('option', sel, { text: t }); o.value = v; if (v === spec.material) o.selected = true; }
    sel.onchange = () => set({ material: sel.value === 'steel' ? 'steel' : 'wood' });
    const num = (label: string, id: string, v: number, min: number, max: number, step: number, apply: (n: number) => Partial<PlankSpec>) => {
      const l = el('label', side, { text: label }); const i = el('input', l, { type: 'number', id, min: String(min), max: String(max), step: String(step), value: String(v) });
      i.onchange = () => { const n = Number(i.value); if (n >= min && n <= max) set(apply(n)); };
    };
    num('Thickness (cm) ', 'plankthick', Math.round(spec.thickness * 1000) / 10, 0.5, 20, 0.5, (n) => ({ thickness: n / 100 }));
    num('Width (cm) ', 'plankwidth', Math.round(spec.width * 100), 20, 200, 5, (n) => ({ width: n / 100 }));
    num('Length (m, drawing only: the gap decides) ', 'plankspan', spec.span, 1, 20, 0.5, (n) => ({ span: n }));
    const post = el('label', side, { text: 'Post under the middle ' }); const cb = el('input', post, { type: 'checkbox', id: 'plankpost' }) as HTMLInputElement; cb.checked = spec.support; cb.onchange = () => set({ support: cb.checked });
    const span = spec.span * p.scale, w = worstCase({ x0: 0, x1: span, y: 0, thickness: spec.thickness, width: spec.width, material: spec.material, ...(spec.support ? { support: true } : {}) });
    el('div', side, { id: 'plankinfo', className: w.ratio >= 1 ? 'bad' : 'muted', text: w.ratio >= 1 ? `Over ${span.toFixed(1)} m it would snap (${(w.sag * 100).toFixed(0)} cm of sag at the worst place).` : `Over ${span.toFixed(1)} m it holds: ${(w.sag * 100).toFixed(0)} cm of sag at the worst place, ${(w.ratio * 100).toFixed(0)}% of what it can take.` });
  }

  // ---- several pieces chosen (CC-200): a chip on the picture with the count, Delete and Clear, and a one-line hint for the box
  const selChip = el('div', planWrap, { id: 'selchip' });
  const selCount = el('strong', selChip, { id: 'selcount' });
  el('button', selChip, { text: 'Delete', id: 'seldelete', title: 'Delete every chosen piece (Delete key)' }).onclick = () => deleteChosen();
  el('button', selChip, { text: 'Clear', id: 'selclear', title: 'Choose nothing (Esc)' }).onclick = () => { group = []; selected = null; drawPanel(); draw(); drawProfile(); };
  const selHint = multiOn ? el('div', planWrap, { id: 'selhint', text: 'Shift + drag: choose several. Shift + click: add or drop one.' }) : null;
  function syncSelChip() {
    const n = chosen().length;
    selChip.style.display = n > 1 ? 'flex' : 'none';
    selCount.textContent = countText(n);
    document.documentElement.dataset.selected = String(n);
    if (selHint) selHint.style.display = n > 1 || topPlan ? 'none' : 'block';
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
      b('Copy', 'dup', 'Copy and paste the piece next to itself', () => { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; pieces.push(q); selected = q.id; changed(); });
      const cb = b(cropMode ? 'Drag a box on the plan' : 'Crop', 'crop', 'Cut away what you do not need: drag a box on the flat plan', () => { cropMode = !cropMode; if (cropMode && !topPlan) setView(true); drawPanel(); });
      cb.setAttribute('aria-pressed', String(cropMode));
      el('span', bar, { className: 'sep' });
    }
    b('Delete', 'del', 'Delete the piece (Delete key)', () => { pieces = pieces.filter((q) => q !== p); selected = null; changed(); });
    bar.style.display = 'flex'; placeBar();
  }
  // next to the selected piece: above its top on the 3D picture (below it when there is no room), clamped inside the picture
  function placeBar() {
    const p = pieces.find((q) => q.id === selected && !isSizeReference(q));
    if (!p || bar.style.display === 'none') return;
    const W = planWrap.clientWidth, H = planWrap.clientHeight, bw = bar.offsetWidth, bh = bar.offsetHeight;
    const r = realSize(p);
    let cx: number, top: number, bottom: number;
    if (topPlan) { const k = plan.clientWidth / plan.width, half = (Math.max(r.w, r.d) / 2) * view.ppm * k; cx = sx(p.x) * k; top = sz(p.z) * k - half - bh - 8; bottom = sz(p.z) * k + half + 8; }
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
    const p = pieces.find((q) => q.id === selected && !isSizeReference(q));
    el('strong', side, { text: p ? p.name : 'No piece chosen' });
    if (!p) { pieceBar(null); el('div', side, { className: 'muted', text: 'Click a piece on the picture to choose it. Drag it to move it. Scroll to zoom, drag the background to pan.' }); return; }
    if (isDevice(p)) {
      const u = p.x * Math.cos(angle) + p.z * Math.sin(angle);
      const sameKind = pieces.filter((q) => p.src?.startsWith('device:trebuchet:') ? q.src?.startsWith('device:trebuchet:') : p.src?.startsWith('device:drone:') ? q.src?.startsWith('device:drone:') : q.src?.startsWith('device:cannon:'));
      const active = sameKind[0]?.id === p.id;
      el('div', side, { className: 'muted', text: `${active ? 'Active in the course simulation' : 'Extra movable copy; the course currently simulates the first device of this type'} at ${u.toFixed(1)} m along the lane. Drag it in the 3D view or top plan. Size and orientation stay fixed.` });
      pieceBar(p);
      return;
    }
    const prov = p.src ? provOf.get(p.src) : undefined;
    if (prov) { const c = el('div', side, { id: 'credit', className: 'muted', text: prov.credit.line || creditLine(prov.credit, prov.source) }); c.title = `Made from a photo (${prov.photo.width} x ${prov.photo.height}) with ${prov.pipeline.model}; box ${prov.box.join(', ')}; photo fingerprint ${prov.photo.sha256.slice(0, 12)}`; }
    if (isPlankPiece(p as P)) plankKnobs(p as P);
    const r = realSize(p);
    const sizes = el('details', side, { id: 'sizes' }); el('summary', sizes, { text: 'Size and height' }); // the numbers stay here, folded: the simulator says whether the lane clears
    el('div', sizes, { id: 'realsize', className: 'muted', text: `Real size: ${r.w.toFixed(2)} × ${r.d.toFixed(2)} m, ${r.h.toFixed(2)} m high (scale ×${p.scale.toPrecision(3)})` });
    const lab = el('label', sizes, { text: 'Real height (m): make it this tall' });
    const h = el('input', lab, { type: 'number', min: '0.02', max: '60', step: '0.05', value: r.h.toFixed(2), id: 'realheight' });
    h.onchange = () => { const v = Number(h.value); if (v > 0) { Object.assign(p, scaleToHeight(p, v)); changed(); } };
    const lift = el('label', sizes, { text: `Height off the ground: ${p.y.toFixed(2)} m` });
    const ly = el('input', lift, { type: 'range', min: '0', max: (isHold(p) || p.role === 'bar') ? '8' : '4', step: '0.05', value: String(p.y), id: 'lift' });
    ly.oninput = () => { p.y = Number(ly.value); lift.firstChild!.textContent = `Height off the ground: ${p.y.toFixed(2)} m`; drawProfile(); };
    ly.onchange = () => changed();
    pieceBar(p);
  }

  // ---- the lane
  function drawLanePanel() {
    lanePanel.replaceChildren();
    el('strong', lanePanel, { text: 'The lane the runner takes', title: 'The runner goes left to right along the orange band; the shapes in it are what you see underneath.' }); // the long help line moved here: the panel must fit at 1024 x 640
    const slider = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const l = el('label', lanePanel, { text: `${label}: ${fmt(get())}` });
      const i = el('input', l, { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(get()) });
      i.oninput = () => { set(Number(i.value)); l.firstChild!.textContent = `${label}: ${fmt(get())}`; draw(); drawProfile(); };
      i.onchange = () => { save(); verify(); };
    };
    slider('Turn about the start', 'angle', 0, 180, 5, () => Math.round((angle * 180) / Math.PI), (v) => { angle = (v * Math.PI) / 180; pieces.filter(isDevice).forEach((p) => { p.yaw = angle; }); }, (v) => `${v}°`);
    slider('Sideways', 'offset', -30, 30, 0.5, () => offset, (v) => (offset = v), (v) => `${v.toFixed(1)} m`);
    slider('Where the water starts (level)', 'level', 0, 4, 0.05, () => level, (v) => (level = v), (v) => `${v.toFixed(2)} m`);
    el('button', lanePanel, { text: 'Find the best lane for me', id: 'best' }).onclick = () => {
      const s = worldSamples(ground());
      const found = bestSlices({ positions: Array.from(s) }, { top: 1, levels: [level], centre: { x: 0, z: 0 }, reprofile: (c) => laneProfile(ground(), c) }); // the editor's rod is the origin, so the lane it finds is the lane it shows
      if (!found.length) { verdict = 'No lane the runner can clear was found: try other pieces or levels.'; drawLanePanel(); return; }
      angle = found[0].angle; offset = found[0].offset; level = found[0].level; verdict = '';
      save(); drawLanePanel(); draw(); drawProfile(); verify();
    };
    const play = el('button', lanePanel, { text: 'Play this lane', className: 'go', id: 'play' });
    play.onclick = async () => {
      interruptSearch();
      const version = verifyVersion;
      const course = courseNow();
      play.disabled = true; play.textContent = 'Checking this lane…';
      const clear = await searchClearable(course);
      if (version !== verifyVersion) { play.disabled = false; play.textContent = 'Play this lane'; return; }
      play.disabled = false; play.textContent = 'Play this lane';
      if (clear === null) { verdict = 'The lane check could not finish. Try again after editing stops.'; drawLanePanel(); return; }
      if (!clear) { verdict = 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; drawLanePanel(); return; }
      // the real objects are drawn in the game instead of blocks (a cropped photo object is drawn whole; its collision is still the cropped lane)
      course.scene = sceneFor(ground(), { angle, offset, level }, course.uMap ?? []);
      persistHist();
      root.remove(); style.remove();
      void startCourse(document.body, withProof(course)); // the plan the check just found goes along: the Course does not search again
    };
    const floorRow = el('label', lanePanel, { className: 'muted', text: 'Floor you must not touch: ' }); floorRow.style.cssText = 'display:flex;align-items:center;gap:6px'; // one line, not two (the panel must fit at 1024 x 640)
    const floorSel = el('select', floorRow, { id: 'floor', title: 'What is painted under the gaps (the run ends the same way on every floor)' });
    for (const h of HAZARDS) floorSel.add(new Option(HAZARD_INFO[h].label, h, false, h === floorChoice));
    floorSel.onchange = () => { floorChoice = floorSel.value as Hazard; document.documentElement.dataset.floor = floorChoice; save(); };
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
      persistHist();
      root.remove(); style.remove();
      void startCourse(document.body, course);
    };
    el('div', lanePanel, { id: 'verdict', className: verdict.startsWith('The simulator can clear') ? 'ok' : verdict ? 'bad' : 'muted', text: verdict });
  }

  const coursePieces = () => pieces.filter((q) => !isSizeReference(q) && !isDevice(q));
  const makeDevice = (src: string, name: string, u: number): P => {
    const c = Math.cos(angle), s = Math.sin(angle), x = u * c - offset * s, z = u * s + offset * c;
    return { ...newPiece(name, deviceMesh(src), { x, z }), src, yaw: angle };
  };
  const makeRecoilDevice = (kind: 'cannon' | 'bigcannon', mass: number, muzzle: number): P => {
    const cfg = { kind, ballMass: mass, muzzle }, base = roleCourse(coursePieces(), { angle, offset, level }, 'My world').course, withPad = withRecoil(base, cfg);
    const pad = withPad.recoil, x0 = pad?.x0 ?? base.startX + 1.5, x1 = pad?.x1 ?? base.startX + 4;
    const len = Math.max(0.8, x1 - x0), src = `device:${kind}:${mass}:${muzzle}:${len}`;
    return makeDevice(src, kind === 'bigcannon' ? 'Cannon' : 'Launcher', (x0 + x1) / 2);
  };
  const makeDroneDevice = (payload: number, battery: number): P => {
    const base = roleCourse(coursePieces(), { angle, offset, level }, 'My world').course, withPad = withDrone(base, { payload, battery });
    const pad = withPad.drone, x0 = pad?.x0 ?? base.startX + 1.5, x1 = pad?.x1 ?? base.startX + 1.5 + DRONE_PAD_LENGTH;
    return makeDevice(`device:drone:${payload}:${battery}:${Math.max(2, x1 - x0)}`, 'Drone', (x0 + x1) / 2);
  };
  const updateDeviceSource = (prefix: string, src: string) => {
    const p = pieces.find((q) => q.src?.startsWith(prefix));
    if (p) { p.src = src; p.mesh = centred(deviceMesh(src)); }
  };
  const ground = () => coursePieces().filter((q) => !isHold(q) && q.role !== 'rope' && q.role !== 'bar' && !isPlankPiece(q)); // references, bars, rope anchors and planks are not ground
  const currentProfile = () => laneProfile(ground(), { angle, offset, level });
  const barsNow = () => holdsOf(pieces, { angle, offset, level });
  let floorChoice: Hazard = startFloor; // the floor you must not touch (saved in the course)
  let bandK: number | null = null; // the lane starts at an elastic band (its stiffness in N/m)
  let trebuchetKg: number | null = null; // the lane starts in a trebuchet (the counterweight in kg), or on a plain deck
  let recoilCfg: RecoilCfg | null = null; // the start deck carries a launcher pad (CC-66), or not
  let droneCfg: DroneCfg | null = null; // the lane has a drone pad (CC-87), or not
  const dronePiece = () => pieces.find((p) => p.src?.startsWith('device:drone:'));
  const droneRange = () => { const p = dronePiece(); if (!p) return undefined; const u = p.x * Math.cos(angle) + p.z * Math.sin(angle), length = Number(p.src?.split(':')[4]) || DRONE_PAD_LENGTH; return { x0: u - length / 2, x1: u + length / 2 }; };
  const recoilPiece = () => pieces.find((p) => p.src?.startsWith('device:cannon:') || p.src?.startsWith('device:bigcannon:'));
  const recoilRange = () => { const p = recoilPiece(); if (!p) return undefined; const u = p.x * Math.cos(angle) + p.z * Math.sin(angle), length = Number(p.src?.split(':')[4]) || RECOIL_PAD_LENGTH; return { x0: u - length / 2, x1: u + length / 2 }; };
  function syncDeviceState() {
    const tre = pieces.find((p) => p.src?.startsWith('device:trebuchet:'));
    trebuchetKg = tre ? Number(tre.src!.split(':')[2]) || 1200 : null;
    if (!tre) trebuchetExtra = {};
    const recoil = recoilPiece(), parts = recoil?.src?.split(':');
    recoilCfg = recoil && parts ? { kind: parts[1] as 'cannon' | 'bigcannon', ballMass: Number(parts[2]) || 12, muzzle: Number(parts[3]) || 30 } : null;
    const dr = dronePiece(), dparts = dr?.src?.split(':');
    droneCfg = dr && dparts ? { payload: Number(dparts[2]) || 70, battery: Number(dparts[3]) || 50 } : null;
    trebLabel.style.display = trebuchetKg ? '' : 'none'; trebInput.value = String(trebuchetKg ?? 1200);
    syncRecoil(); syncDrone();
  }
  let trebuchetExtra: { short?: number; pin?: number } = {}; // the arm's short end (m) and the pin angle (degrees), when Fix it or advice changed them
  const machineNow = (): Machine | null => (trebuchetKg ? { counterweight: trebuchetKg, ...trebuchetExtra } : null);
  const trebuchetPivot = (): number => { const p = pieces.find((q) => q.src?.startsWith('device:trebuchet:')); return p ? p.x * Math.cos(angle) + p.z * Math.sin(angle) + TREBUCHET_PIVOT_FROM_CENTRE * p.scale : 0; };
  const machineWrap = (m: Machine | null) => wrapFor(m, trebuchetPivot());
  const laneCourse = (_p?: ReturnType<typeof currentProfile>) => {
    const c = roleCourse(coursePieces(), { angle, offset, level }, 'My world').course;
    const m = machineNow();
    if (m) return withTrebuchet(c, m, trebuchetPivot());
    if (droneCfg) return withDrone(c, droneCfg, droneRange());
    return recoilCfg ? withRecoil(c, recoilCfg, recoilRange()) : bandK ? withBand(c, bandK) : c;
  };
  // what this course was cut from, so the Course can open the same pieces again (CC-80); a world with a map piece cannot be kept: its mesh is too big
  const sourceNow = (): CourseSource | undefined => pieces.some((p) => p.src?.startsWith('map:')) ? undefined : { kind: 'editor', pieces: pieces.filter((p) => p.src).map((p) => ({ src: p.src as string, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale, ...(p.role ? { role: p.role } : {}) })), angle, offset, level, floor: floorChoice };
  const courseNow = () => { const c = laneCourse(currentProfile()); if (floorChoice !== 'water') c.hazard = floorChoice; if (designed.size) c.designedShortcuts = [...designed]; const src = sourceNow(); if (src) c.source = src; return c; };
  // the same lane for other pieces (Make it easier tries many small changes): ground, roles, bars, a trebuchet or a launcher if the world has one
  const courseFor = (ps: P[], ln: { angle: number; offset: number; level: number }) => {
    let c = roleCourse(ps.filter((q) => !isSizeReference(q) && !isDevice(q)), ln, 'My world').course;
    const tre = ps.find((q) => q.src?.startsWith('device:trebuchet:')), rec = ps.find((q) => q.src?.startsWith('device:cannon:'));
    if (tre) c = withTrebuchet(c, Number(tre.src!.split(':')[2]) || 1200, tre.x * Math.cos(ln.angle) + tre.z * Math.sin(ln.angle) + TREBUCHET_PIVOT_FROM_CENTRE * tre.scale);
    else if (rec) {
      const parts = rec.src!.split(':'), u = rec.x * Math.cos(ln.angle) + rec.z * Math.sin(ln.angle), length = Number(parts[4]) || RECOIL_PAD_LENGTH;
      c = withRecoil(c, { kind: parts[1] as 'cannon', ballMass: Number(parts[2]) || 12, muzzle: Number(parts[3]) || 30 }, { x0: u - length / 2, x1: u + length / 2 });
    }
    if (floorChoice !== 'water') c.hazard = floorChoice;
    return c;
  };
  // where along the run a piece is in the game (a bar by its place among the bars)
  const xOfPiece = (q: P, c: ReturnType<typeof courseNow>) => (isHold(q) ? c.holds?.[barsNow().findIndex((b) => b.id === q.id)]?.x : sceneFor([q], { angle, offset, level }, c.uMap ?? [])[0]?.x) ?? 0;
  // the runner starts on the ground about 8 m before a place (the nearest ground at or before that spot)
  const startBefore = (c: ReturnType<typeof courseNow>, gx: number) => {
    const want = Math.max(c.startX, gx - 8);
    const ps = [...c.terrain.platforms].sort((a, b) => a.x0 - b.x0);
    const on = ps.find((r) => want >= r.x0 && want <= r.x1);
    return on ? want : Math.max(c.startX, (ps.filter((r) => r.x1 <= want).pop()?.x1 ?? c.startX) - 1);
  };
  // the undo list goes into the session so it survives a trip to the Course (pieces made from photos or maps are not kept: their meshes are too big)
  function persistHist() {
    try {
      const heavy = (q: P) => q.src?.startsWith('obj:') || q.src?.startsWith('user:') || q.src?.startsWith('map:');
      if (pieces.some(heavy) || hist.some((h) => h.pieces.some(heavy))) { sessionStorage.removeItem(HIST_KEY); return; }
      const start = Math.max(0, hist.length - 25);
      const keep = (h: Snap): Saved => ({ pieces: h.pieces.filter((q) => q.src).map((q) => ({ src: q.src as string, x: q.x, z: q.z, y: q.y, yaw: q.yaw, scale: q.scale, ...(q.role ? { role: q.role } : {}) })), angle: h.angle, offset: h.offset, level: h.level });
      sessionStorage.setItem(HIST_KEY, JSON.stringify({ snaps: hist.slice(start).map(keep), hi: Math.max(0, hi - start) }));
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
    if (clear === false) { verdict = 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.'; drawLanePanel(); reply.className = 'reply bad'; reply.textContent = verdict; helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true'); return; }
    course.scene = sceneFor(ground(), { angle, offset, level }, course.uMap ?? []);
    const focus = pieces.find((q) => q.id === selected) ?? pieces.find((q) => q.id === focusId);
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
    finishSearch?.(null); searchWorker?.terminate();
    const id = ++searchVersion;
    let worker: Worker;
    try { worker = new Worker(new URL('../sim/ideal-worker.ts', import.meta.url), { type: 'module' }); }
    catch { return Promise.resolve(null); }
    const promise = new Promise<PresetPlan | null>((resolve) => {
      searchWorker = worker; finishSearch = resolve;
      worker.onmessage = (e: MessageEvent<{ id: number } & Pick<SearchResult, 'plan' | 'cleared' | 'windows' | 'routes'>>) => {
        if (e.data.id !== id) return;
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
  function verify() {
    interruptSearch();
    const version = verifyVersion;
    document.documentElement.dataset.lane = JSON.stringify({ angle, offset, level }); // for the checks: the lane being verified
    verifyTimer = window.setTimeout(async () => {
      const p = currentProfile();
      if (p.length < 8) { verdict = 'Nothing is in the lane: move the lane or the pieces.'; }
      else {
        const r = describeLane(p);
        verdict = 'Checking this lane…';
        const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
        if (v) { v.textContent = verdict; v.className = 'muted'; }
        const clear = await searchClearable(laneCourse(p));
        if (version !== verifyVersion) return;
        if (clear === null) { verdict = 'The lane check could not finish. Try again after editing stops.'; document.documentElement.dataset.verdict = verdict; if (v) { v.textContent = verdict; v.className = 'bad'; } return; }
        document.documentElement.dataset.laneClear = clear ? '1' : '0'; setSuggest(clear);
        verdict = clear ? `The simulator can clear this lane (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces, ${r.length.toFixed(0)} m).` : 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.';
      }
      const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
      if (v) { v.textContent = verdict; v.className = verdict.startsWith('The simulator can clear') ? 'ok' : 'bad'; }
      document.documentElement.dataset.verdict = verdict;
      // when it cannot be cleared, say what to shift (each suggestion was proved by the simulator)
      adviceList = []; showAdvice();
      if (machineNow() && p.length >= 8) { // a trebuchet at the start: its counterweight and arm come first, and a narrow release window gets a pin
        const mine = ++adviceRun, m = machineNow()!, lane = { angle, offset, level }, clear = verdict.startsWith('The simulator can clear');
        setTimeout(() => { if (mine !== adviceRun) return; adviceList = adviseMachine(coursePieces(), lane, m, { budgetMs: 8000, max: 1 }, trebuchetPivot()); if (!clear && !barsNow().length) adviceList.push(...adviseLane(coursePieces(), lane, { wrap: machineWrap(m) })); showAdvice(); if (!adviceList.length) adviceBox.textContent = clear ? '' : 'No single change to the machine or a piece clears it. Press Fix it to look further.'; document.documentElement.dataset.advice = String(adviceList.length); }, 30);
      } else if (!verdict.startsWith('The simulator can clear') && p.length >= 8 && barsNow().length) {
        adviceBox.textContent = 'This lane has bars. Drag them in the side view (position and height), or press Fix it to try small moves of the bars.';
      } else if (!verdict.startsWith('The simulator can clear') && p.length >= 8 && pieces.some((q) => q.role && q.role !== 'ground')) {
        adviceBox.textContent = 'This lane uses roles (wall, rope anchor or trampoline bed). Open Moves to see what each needs, or press Fix it.';
      } else if (!verdict.startsWith('The simulator can clear') && p.length >= 8) {
        const mine = ++adviceRun;
        adviceBox.textContent = 'Working out what to shift…';
        setTimeout(async () => { if (mine !== adviceRun) return; const got = await adviceInWorker(coursePieces() as P[], { angle, offset, level }).catch(() => null); if (!got || mine !== adviceRun) return; adviceList = got; showAdvice(); if (!adviceList.length) adviceBox.textContent = 'No single small shift clears it. Press "What should I change?" to think it through together.'; document.documentElement.dataset.advice = String(adviceList.length); }, 30);
      } else document.documentElement.dataset.advice = '0';
    }, 800);
  }

  // ---- drawing
  const sx = (x: number) => plan.width / 2 + (x - view.cx) * view.ppm;
  const sz = (z: number) => plan.height / 2 + (z - view.cz) * view.ppm;
  const wx = (px: number) => (px - plan.width / 2) / view.ppm + view.cx;
  const wz = (py: number) => (py - plan.height / 2) / view.ppm + view.cz;
  const COLORS = ['#c9893b', '#6fa3c9', '#8bb36b', '#b779b0', '#d96a5b', '#7b8f9c'];
  function draw() {
    view3d.sync();
    placeBar();
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
    c.fillStyle = '#17201d'; c.beginPath(); c.arc(sx(0), sz(0), 5, 0, 7); c.fill(); c.fillStyle = '#0f6b5c'; c.beginPath(); c.moveTo(sx(0), sz(0)); c.lineTo(sx(0), sz(0) - 22); c.lineTo(sx(0) + 16, sz(0) - 16); c.lineTo(sx(0), sz(0) - 10); c.fill(); c.font = '600 11px system-ui'; c.fillText('START: the runner begins here', sx(0) + 8, sz(0) + 14);
    pieces.forEach((p, i) => {
      const s = size(p.mesh);
      if (isSizeReference(p)) {
        c.save(); c.translate(sx(p.x), sz(p.z)); c.rotate(p.yaw);
        const k = view.ppm, lw = Math.max(2, 0.07 * k);
        c.strokeStyle = '#8a2d29'; c.fillStyle = '#e65a50'; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.arc(0, -0.34 * k, 0.12 * k, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(0, -0.2 * k); c.lineTo(0, 0.22 * k); c.moveTo(-0.34 * k, -0.12 * k); c.lineTo(0.34 * k, -0.12 * k); c.moveTo(0, 0.22 * k); c.lineTo(-0.22 * k, 0.48 * k); c.moveTo(0, 0.22 * k); c.lineTo(0.22 * k, 0.48 * k); c.stroke();
        c.restore();
        c.fillStyle = '#17201d'; c.font = '700 12px system-ui'; c.fillText('Person', sx(p.x) + 10, sz(p.z) + 4);
        return;
      }
      c.save(); c.translate(sx(p.x), sz(p.z)); c.rotate(p.yaw);
      const w = s.w * p.scale * view.ppm, d = s.d * p.scale * view.ppm;
      c.fillStyle = COLORS[i % COLORS.length] + ((p.id === selected || chosen().includes(p.id)) ? 'dd' : '99'); c.fillRect(-w / 2, -d / 2, w, d);
      { const on = p.id === selected || chosen().includes(p.id); c.strokeStyle = on ? '#0f6b5c' : '#17201d'; c.lineWidth = on ? 3 : 1; } c.strokeRect(-w / 2, -d / 2, w, d);
      c.restore();
      c.fillStyle = '#17201d'; c.font = '12px system-ui'; c.fillText(p.name, sx(p.x) - 28, sz(p.z) + 4);
    });
    if (proposal && preview) { // the preview: grey outline where a piece is now, teal outline where it would be, an arrow between
      const arrow = (x0: number, y0: number, x1: number, y1: number) => {
        const a = Math.atan2(y1 - y0, x1 - x0);
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4)); c.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); c.closePath(); c.fillStyle = '#0f9d84'; c.fill();
      };
      c.lineWidth = 2; c.setLineDash([6, 4]);
      for (const it of proposal.items) {
        if (!it.on || it.kind !== 'piece') continue;
        const mine = pieces.find((q) => q.id === it.id);
        if (!mine) continue;
        const s2 = size(mine.mesh);
        for (const [st, col] of [[it.from, '#7d8a84'], [it.to, '#0f9d84']] as const) {
          c.save(); c.translate(sx(st.x), sz(st.z)); c.rotate(st.yaw);
          c.strokeStyle = col; c.strokeRect((-s2.w * st.scale * view.ppm) / 2, (-s2.d * st.scale * view.ppm) / 2, s2.w * st.scale * view.ppm, s2.d * st.scale * view.ppm);
          c.restore();
        }
        if (Math.hypot(it.to.x - it.from.x, it.to.z - it.from.z) > 0.05) { c.strokeStyle = '#0f9d84'; c.setLineDash([]); arrow(sx(it.from.x), sz(it.from.z), sx(it.to.x), sz(it.to.z)); c.setLineDash([6, 4]); }
      }
      if (proposal.items.some((i) => i.kind === 'lane' && i.on && i.key !== 'level')) { // the lane would turn or step sideways: a dashed line where it would run
        c.save(); c.translate(sx(0), sz(0)); c.rotate(preview.lane.angle); c.strokeStyle = '#0f9d84';
        c.beginPath(); c.moveTo(-400 * view.ppm, preview.lane.offset * view.ppm); c.lineTo(400 * view.ppm, preview.lane.offset * view.ppm); c.stroke(); c.restore();
      }
      c.setLineDash([]);
    }
    if (rubber) { c.strokeStyle = '#0f6b5c'; c.setLineDash([5, 4]); c.strokeRect(sx(rubber.x0), sz(rubber.z0), (rubber.x1 - rubber.x0) * view.ppm, (rubber.z1 - rubber.z0) * view.ppm); c.setLineDash([]); }
  }
  // the side view: the lane's ground, the bars (drag them here), and where a person can reach
  let sideMap = { uMin: 0, ppm: 20, ph: 20, base: 100, vmin: 0 };
  const vzoom = pageQuery().get('vzoom') === '1'; // film: stretch the height so a few metres of real drops are readable
  function drawProfile() {
    howto.style.display = pieces.some((q) => isTrack(q)) ? '' : 'none';
    const c = profileCanvas.getContext('2d')!;
    const W = profileCanvas.width, H = profileCanvas.height;
    c.clearRect(0, 0, W, H);
    const prof = currentProfile();
    const bars = barsNow();
    const o = prof.origin ?? 0;
    const pv = proposal && preview ? { prof: previewProfile!, bars: previewBars } : null;
    const po = pv?.prof?.origin ?? 0;
    const uLo = Math.min(prof.length ? o : 0, ...bars.map((b) => b.u), ...(pv ? [pv.prof.length ? po : Infinity, ...pv.bars.map((b) => b.u)] : []));
    const uHi = Math.max(prof.length ? o + prof.length : -Infinity, ...bars.map((b) => b.u), ...(pv ? [pv.prof.length ? po + pv.prof.length : -Infinity, ...pv.bars.map((b) => b.u)] : []), uLo + 10);
    c.fillStyle = '#58635d'; c.font = '12px system-ui';
    c.fillText('What the runner sees: the lane from the side (water at the bottom, grid every metre). Drag a bar (or a purple coaster dot) to move it; double-click to add a dot.', 8, 14);
    const base = H - 14, ppm = Math.min(30, (W - 40) / Math.max(10, uHi - uLo + 1)), ph0 = Math.max(14, (base - 24) / Math.max(1.8, Math.max(0, ...prof.cells.filter((h): h is number => h !== null), ...bars.map((b) => b.y)) + 0.4)); // fit the tallest thing, so low steps are not hairlines
    const hs = prof.cells.filter((h): h is number => h !== null);
    const vmin = vzoom && hs.length ? Math.floor((Math.min(...hs) - 0.3) * 2) / 2 : 0;
    const ph = vzoom && hs.length ? Math.max(ph0, (base - 24) / Math.max(2, Math.max(...hs, ...bars.map((b) => b.y)) - vmin + 0.6)) : ph0;
    sideMap = { uMin: uLo, ppm, ph, base, vmin };
    c.fillStyle = '#cfe3f5'; c.fillRect(0, base, W, 14);
    c.strokeStyle = '#e3e8e4';
    for (let m = 0; base - m * ph > 20; m++) { c.beginPath(); c.moveTo(0, base - m * ph); c.lineTo(W, base - m * ph); c.stroke(); }
    c.fillStyle = '#58635d'; c.font = '10px system-ui'; c.textAlign = 'left';
    for (let m = 0; base - (m - vmin) * ph > 20; m++) if (m >= vmin) c.fillText(`${m} m`, 2, base - (m - vmin) * ph - 2);
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
    for (const b of bars) {
      const x = 10 + (b.u - uLo) * ppm, y = base - (b.y - vmin) * ph, sel = b.id === selected;
      c.strokeStyle = '#c9ced4'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.stroke();
      c.strokeStyle = sel ? '#0f6b5c' : '#f0a020'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke();
      c.fillStyle = '#17201d'; c.fillText(`${b.y.toFixed(2)} m`, x + 12, y - 8);
    }
    document.documentElement.dataset.dotPx = JSON.stringify(trackDots().map((d) => [10 + (d.u - uLo) * ppm, base - (d.y - vmin) * ph])); // for the browser check
    for (const d of trackDots()) { // the chosen coaster section: a dot at each point of the rail (drag them)
      const x = 10 + (d.u - uLo) * ppm, y = base - (d.y - vmin) * ph;
      c.fillStyle = '#7a4fd1'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.stroke();
    }
    for (const s of routes) { // kept shortcuts: a dashed arrow from the bar before the skipped ones to the bar after them (or the end of the lane)
      if (!designed.has(s.id)) continue;
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
  /** The points of the chosen coaster section in the side view: u along the run, y above the lane's level. */
  const trackDots = (): { id: number; i: number; u: number; y: number }[] => {
    // every coaster section shows its dots, chosen or not: a click on the 3D picture (to turn the camera) clears the choice and must not hide them
    return pieces.filter((q) => isTrack(q)).flatMap((p) => {
      const pts = parseTrackSrc(p.src ?? '');
      return pts ? sectionPoints(p, pts, p.x * Math.cos(angle) + p.z * Math.sin(angle), level).map(([u, y], i) => ({ id: p.id, i, u, y })) : [];
    });
  };
  const dotAtPx = (px: number, py: number) => trackDots().find((d) => Math.hypot(10 + (d.u - sideMap.uMin) * sideMap.ppm - px, sideMap.base - (d.y - sideMap.vmin) * sideMap.ph - py) < 11);
  /** Move point i of a section to (u, y) in the side view and keep every other point where it is. */
  function moveTrackPoint(p: P, i: number, u: number, y: number) {
    const pts = parseTrackSrc(p.src ?? ''); if (!pts) return;
    const c = Math.cos(angle), s = Math.sin(angle), uc0 = p.x * c + p.z * s;
    const mid0 = (pts[0][0] + pts[pts.length - 1][0]) / 2, low0 = Math.min(...pts.map((q) => q[1]));
    const nx = (u - uc0) / p.scale + mid0, ny = (y - p.y + level) / p.scale + low0;
    const lo = i > 0 ? pts[i - 1][0] + 0.5 : -Infinity, hi = i < pts.length - 1 ? pts[i + 1][0] - 0.5 : Infinity;
    pts[i] = [Math.min(hi, Math.max(lo, nx)), Math.min(14, Math.max(0, ny))];
    const mid1 = (pts[0][0] + pts[pts.length - 1][0]) / 2, low1 = Math.min(...pts.map((q) => q[1]));
    const du = (mid1 - mid0) * p.scale, v = -p.x * s + p.z * c, uc1 = uc0 + du;
    p.x = uc1 * c - v * s; p.z = uc1 * s + v * c; p.y += (low1 - low0) * p.scale;
    p.src = trackSrc(pts); p.mesh = trackPiece(pts, { x: 0, z: 0 }).mesh;
  }
  /** Add a point to a section at (u, y) in the side view; the ends and every other point stay where they are. */
  function addTrackPoint(p: P, u: number, y: number) {
    const pts = parseTrackSrc(p.src ?? ''); if (!pts) return;
    const c = Math.cos(angle), uc0 = p.x * c + p.z * Math.sin(angle);
    const mid0 = (pts[0][0] + pts[pts.length - 1][0]) / 2, low0 = Math.min(...pts.map((q) => q[1]));
    const nx = (u - uc0) / p.scale + mid0, ny = Math.min(14, Math.max(0, (y - p.y + level) / p.scale + low0));
    const k = pts.findIndex((q) => q[0] > nx);
    if (k <= 0 || nx - pts[k - 1][0] < 0.5 || pts[k][0] - nx < 0.5) return;
    pts.splice(k, 0, [nx, ny]);
    p.y += (Math.min(...pts.map((q) => q[1])) - low0) * p.scale;
    p.src = trackSrc(pts); p.mesh = trackPiece(pts, { x: 0, z: 0 }).mesh;
  }
  const barAtPx = (px: number, py: number) => barsNow().find((b) => Math.hypot(10 + (b.u - sideMap.uMin) * sideMap.ppm - px, sideMap.base - (b.y - sideMap.vmin) * sideMap.ph - py) < 16);
  let barDrag: { p: P } | null = null;
  let dotDrag: { p: P; i: number } | null = null;
  profileCanvas.addEventListener('pointerdown', (e) => {
    const r = profileCanvas.getBoundingClientRect();
    const dot = dotAtPx(e.clientX - r.left, e.clientY - r.top), tp = dot && pieces.find((q) => q.id === dot.id);
    if (dot && tp) { if (selected !== tp.id) { selected = tp.id; group = []; drawPanel(); } dotDrag = { p: tp, i: dot.i }; profileCanvas.setPointerCapture(e.pointerId); return; }
    const b = barAtPx(e.clientX - r.left, e.clientY - r.top);
    const p = b && pieces.find((q) => q.id === b.id);
    if (!p) return;
    selected = p.id; barDrag = { p }; profileCanvas.setPointerCapture(e.pointerId); drawPanel(); draw(); drawProfile();
  });
  profileCanvas.addEventListener('pointermove', (e) => {
    const r = profileCanvas.getBoundingClientRect();
    if (dotDrag) {
      const u = Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 10) / 10;
      moveTrackPoint(dotDrag.p, dotDrag.i, u, Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph + sideMap.vmin) * 10) / 10);
      draw(); drawProfile(); return;
    }
    if (!barDrag) { profileCanvas.style.cursor = dotAtPx(e.clientX - r.left, e.clientY - r.top) ? 'grab' : barAtPx(e.clientX - r.left, e.clientY - r.top) ? 'grab' : 'default'; return; }
    const p = barDrag.p, c = Math.cos(angle), s = Math.sin(angle);
    const u = Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 20) / 20;
    const y = Math.min(4.3, Math.max(0.35, Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph + sideMap.vmin - 0.04) * 20) / 20));
    const v = -p.x * s + p.z * c; // keep the sideways place, move along the run
    p.x = u * c - v * s; p.z = u * s + v * c; p.y = y;
    draw(); drawProfile();
  });
  profileCanvas.addEventListener('dblclick', (e) => {
    const r = profileCanvas.getBoundingClientRect(), x = e.clientX - r.left, gapTo = (d: { u: number }) => Math.abs(10 + (d.u - sideMap.uMin) * sideMap.ppm - x);
    const near = trackDots().reduce<ReturnType<typeof trackDots>[number] | null>((best, d) => (!best || gapTo(d) < gapTo(best) ? d : best), null); // the section whose dots are closest along the run
    const tp = near && pieces.find((q) => q.id === near.id);
    if (!tp || dotAtPx(x, e.clientY - r.top)) return;
    addTrackPoint(tp, Math.round((sideMap.uMin + (e.clientX - r.left - 10) / sideMap.ppm) * 10) / 10, Math.round(((sideMap.base - (e.clientY - r.top)) / sideMap.ph + sideMap.vmin) * 10) / 10);
    changed(); drawPanel(); draw(); drawProfile();
  });
  const endBar = () => { if (dotDrag) { dotDrag = null; changed(); return; } if (!barDrag) return; barDrag = null; changed(); };
  profileCanvas.addEventListener('pointerup', endBar); profileCanvas.addEventListener('pointercancel', endBar);

  // ---- the mouse on the picture
  let rubber: { x0: number; z0: number; x1: number; z1: number } | null = null;
  let drag: { kind: 'move' | 'pan' | 'rubber' | 'marq'; p?: P; ox: number; oz: number; sx0: number; sz0: number; cx: number; cz: number } | null = null;
  plan.addEventListener('pointerdown', (e) => {
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    plan.setPointerCapture(e.pointerId);
    if (cropMode && selected !== null) { drag = { kind: 'rubber', ox: x, oz: z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    const hit = [...pieces].reverse().find((p) => !isSizeReference(p) && hits(p, x, z));
    if (multiOn && e.shiftKey && hit) { chooseMany(toggleId(chosen(), hit.id)); drag = null; return; }
    if (multiOn && !hit && e.button === 0 && !e.altKey) { drag = { kind: 'marq', ox: x, oz: z, sx0: px, sz0: py, cx: e.shiftKey ? 1 : 0, cz: 0 }; rubber = { x0: x, z0: z, x1: x, z1: z }; return; }
    if (hit) { if (!(multiOn && chosen().length > 1 && chosen().includes(hit.id))) group = []; selected = hit.id; drag = { kind: 'move', p: hit, ox: x - hit.x, oz: z - hit.z, sx0: 0, sz0: 0, cx: 0, cz: 0 }; }
    else { selected = null; group = []; drag = { kind: 'pan', ox: 0, oz: 0, sx0: px, sz0: py, cx: view.cx, cz: view.cz }; }
    drawPanel(); draw();
  });
  plan.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = plan.getBoundingClientRect(), k = plan.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (drag.kind === 'move' && drag.p) { moveWith(drag.p, Math.round((wx(px) - drag.ox) * 20) / 20, Math.round((wz(py) - drag.oz) * 20) / 20); draw(); drawProfile(); }
    else if (drag.kind === 'pan') { view.cx = drag.cx - (px - drag.sx0) / view.ppm; view.cz = drag.cz - (py - drag.sz0) / view.ppm; draw(); }
    else if ((drag.kind === 'rubber' || drag.kind === 'marq') && rubber) { rubber = { x0: Math.min(drag.ox, wx(px)), z0: Math.min(drag.oz, wz(py)), x1: Math.max(drag.ox, wx(px)), z1: Math.max(drag.oz, wz(py)) }; draw(); }
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'marq') {
      const rb = rubber; rubber = null;
      const px = rb ? (rb.x1 - rb.x0) * view.ppm : 0, py = rb ? (rb.z1 - rb.z0) * view.ppm : 0;
      if (rb && isMarquee(rectFrom(0, 0, px, py))) {
        const items = pieces.filter((q) => !isSizeReference(q)).map((q) => ({ id: q.id, x: q.x, y: q.z, r: Math.max(realSize(q).w, realSize(q).d) / 2 }));
        chooseMany(applyMarquee(chosen(), pickInRect(items, { x0: rb.x0, y0: rb.z0, x1: rb.x1, y1: rb.z1 }), d.cx === 1));
      } else if (!d.cx) { selected = null; group = []; drawPanel(); }
      draw(); return;
    }
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
  // the flat plan zooms toward the cursor (the point under it stays under it), with room to zoom far out and in
  plan.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = plan.getBoundingClientRect(), k = plan.width / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), z = wz(py);
    view.ppm = Math.min(400, Math.max(0.5, view.ppm * Math.exp(-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 240) * 0.002)));
    view.cx = x - (px - plan.width / 2) / view.ppm; view.cz = z - (py - plan.height / 2) / view.ppm; draw();
  }, { passive: false });
  function fitAll() {
    const ps = pieces.filter((q) => !isSizeReference(q) || pieces.length === 1);
    const b = ps.length ? { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, top: 1 } : { x0: 0, x1: 30, z0: -3, z1: 3, top: 3 };
    for (const q of ps) { const s = size(q.mesh), h = Math.max(s.w, s.d) * q.scale / 2; b.x0 = Math.min(b.x0, q.x - h); b.x1 = Math.max(b.x1, q.x + h); b.z0 = Math.min(b.z0, q.z - h); b.z1 = Math.max(b.z1, q.z + h); b.top = Math.max(b.top, q.y + s.h * q.scale); }
    if (topPlan) {
      view.cx = (b.x0 + b.x1) / 2; view.cz = (b.z0 + b.z1) / 2;
      view.ppm = Math.min(400, Math.max(0.5, Math.min(plan.width / Math.max(2, b.x1 - b.x0 + 2), plan.height / Math.max(2, b.z1 - b.z0 + 2))));
      draw();
    } else view3d.fit(b);
    document.documentElement.dataset.fitted = String(Date.now());
  }
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); goto(e.shiftKey ? hi + 1 : hi - 1); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); goto(hi + 1); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { copyChosen(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); pasteClip(); return; }
    if (e.code === 'Escape' && proposal) { closePreview('Cancelled: nothing changed.'); return; }
    if (e.code === 'Escape' && chosen().length) { group = []; selected = null; drawPanel(); draw(); drawProfile(); return; }
    if ((e.code === 'Delete' || e.code === 'Backspace') && chosen().length > 1) { e.preventDefault(); deleteChosen(); return; }
    if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) { fitAll(); return; }
    if (e.code === 'KeyT') { if (handoff) void goToCourse(); else location.href = '?'; }
    const p = pieces.find((q) => q.id === selected);
    if (!p) return;
    if (e.code === 'Delete' || e.code === 'Backspace') { pieces = pieces.filter((q) => q !== p); selected = null; changed(); }
    if (e.code === 'KeyD') { const q = duplicate(p, size(p.mesh).w * p.scale + 0.5, 0) as P; q.src = p.src; pieces.push(q); selected = q.id; changed(); }
  });

  // for the scripted browser checks: where each piece is on the picture, in page pixels (a probe, it changes nothing)
  (window as unknown as { ccPieceScreen?: () => { id: number; x: number; y: number }[] }).ccPieceScreen = () => {
    const host = topPlan ? plan : view3d.el, r = host.getBoundingClientRect();
    return pieces.filter((q) => !isSizeReference(q)).flatMap((q) => {
      const s = topPlan ? { x: (sx(q.x) * r.width) / plan.width, y: (sz(q.z) * r.height) / plan.height } : view3d.project(q.x, q.y + realSize(q).h / 2, q.z);
      return s ? [{ id: q.id, x: r.left + s.x, y: r.top + s.y }] : [];
    });
  };
  function capPieces() { const real = pieces.filter((q) => !isSizeReference(q) && !isDevice(q) && q.src !== 'hold:bar'); if (real.length <= MAX_PIECES) return; const drop = new Set(real.slice(MAX_PIECES).map((q) => q.id)); pieces = pieces.filter((q) => !drop.has(q.id)); if (selected !== null && drop.has(selected)) selected = null; verdict = `The editor keeps up to ${MAX_PIECES} pieces, so the last ones were not added. Delete one to make room.`; document.documentElement.dataset.capped = '1'; }
  function changed(record = true) { capPieces(); if (helperReady && reply.textContent?.startsWith('The simulator cannot')) { reply.className = 'reply muted'; reply.textContent = 'You changed the course, so the simulator is checking it again.'; }  if (proposal) closePreview('The layout changed, so the preview was closed.'); if (record) remember(); syncDeviceState(); document.documentElement.dataset.pieces = String(pieces.length); document.documentElement.dataset.band = bandK ? String(bandK) : ''; save(); drawPanel(); drawLanePanel(); draw(); drawProfile(); verify(); renderMoves(); }
  syncDeviceState();
  drawPanel(); drawLanePanel(); draw(); drawProfile(); verify();
  remember();
  // the undo list from before the trip to the Course comes back when the world is the one it ended with (otherwise it starts again)
  if (handoff && !pendingObjects.length) {
    try {
      const h = JSON.parse(sessionStorage.getItem(HIST_KEY) ?? 'null') as { snaps: Saved[]; hi: number } | null;
      const last = h?.snaps[h.hi];
      const key = (x: { pieces: Saved['pieces']; angle: number; offset: number; level: number }) => JSON.stringify([x.pieces.map((q) => [q.src, q.x, q.z, q.y, q.yaw, q.scale]), x.angle, x.offset, x.level]);
      const mine: Saved = { pieces: pieces.filter((q) => q.src).map((q) => ({ src: q.src as string, x: q.x, z: q.z, y: q.y, yaw: q.yaw, scale: q.scale })), angle, offset, level };
      if (h && last && key(last) === key(mine)) {
        const snaps: Snap[] = h.snaps.map((sn) => ({ pieces: buildPieces(sn.pieces), angle: sn.angle, offset: sn.offset, level: sn.level }));
        hist.length = 0; hist.push(...snaps); hi = h.hi;
        pieces = hist[hi].pieces.map((q) => ({ ...q })); selected = null;
        undoBtn.disabled = hi < 1; redoBtn.disabled = hi >= hist.length - 1;
        drawPanel(); drawLanePanel(); draw(); drawProfile(); verify();
      }
    } catch { /* no history to bring back */ }
  }
  organizeEditor(root); // CC-94: the controls in one bar, one add menu, one dock, a command palette
  if (pageQuery().get('editorui') !== 'old') styleEditor(root); // CC-177: button levels, one Fix menu, a glossary (?editorui=old keeps the CC-94 look)
  if (!pendingObjects.length) onWorld(); // else onWorld runs when the saved photo objects are in
  document.documentElement.dataset.pieces = String(pieces.length);
  return { backend: 'webgl2' };
}
