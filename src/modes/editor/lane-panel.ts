import { BLOCKED_LANE_GUIDANCE } from '../../ui/editor-actions';
import { HAZARDS, HAZARD_INFO, type Hazard } from '../../course/hazard';
import { startCourse } from '../course';
import { bestSlices } from '../../slice/slice';
import { laneProfile, worldSamples } from '../../slice/world';
import { sceneFor } from '../../slice/scene';
import { isHold } from '../../slice/holds-world';
import { addBadge } from '../../ui/says';
import { isStopped } from '../../slice/lane-check';
import type { LaneCheck } from '../../slice/lane-check-ui';
import type { CourseData } from '../../course/course';
import type { createLane } from './lane';
import { el } from './dom';
import { turnLane, shiftLane } from './start';
import { isDevice, type EditorState } from './state';

type Lane = ReturnType<typeof createLane>;

// Everything not listed as a value is reached through a callback, because it is made later in editor.ts.
export interface LanePanelEnv {
  ed: EditorState; lanePanel: HTMLElement; root: HTMLElement; style: HTMLElement;
  simSays: { el: HTMLElement } | null | undefined;
  ground: Lane['ground']; courseNow: Lane['courseNow']; laneCourseAt: Lane['laneCourseAt']; barsNow: Lane['barsNow'];
  searchClearable: (course: CourseData) => Promise<boolean | null>;
  laneCheck: LaneCheck; verifyVersion: () => number;
  draw: () => void; drawProfile: () => void; save: () => void; verify: () => void;
  findRepair: () => void;
  remember: () => void; interruptSearch: () => void; launchCourse: (course: CourseData) => void; persistHist: () => void;
}

// The lane panel: the sliders, "Find the best lane", "Play this lane", the floor choice, "Test from the selected piece" and the verdict.
// Moved out of editor.ts unchanged (CC-133).
export function createLanePanel(env: LanePanelEnv) {
  const { ed, lanePanel, root, style, simSays, ground, courseNow, laneCourseAt, barsNow, searchClearable, laneCheck, draw, drawProfile, save, verify, interruptSearch, launchCourse, persistHist } = env;
  function drawLanePanel() {
    lanePanel.replaceChildren();
    if (simSays) lanePanel.prepend(simSays.el);
    el('button', lanePanel, { text: 'Find a repair', id: 'lane-repair-next', className: 'go', title: 'Search for course changes with the simulator, then review them before Apply' }).onclick = () => env.findRepair();
    el('strong', lanePanel, { text: 'The lane the runner takes', title: 'The runner goes left to right along the orange band; the shapes in it are what you see underneath.' }); // the long help line moved here: the panel must fit at 1024 x 640
    const slider = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const l = el('label', lanePanel, { text: `${label}: ${fmt(get())}` });
      const i = el('input', l, { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(get()) });
      i.oninput = () => { set(Number(i.value)); l.firstChild!.textContent = `${label}: ${fmt(get())}`; draw(); drawProfile(); };
      i.onchange = () => { env.remember(); save(); verify(); };
    };
    slider('Turn about the start', 'angle', 0, 180, 5, () => Math.round((ed.angle * 180) / Math.PI), (v) => { turnLane(ed, (v * Math.PI) / 180, laneProfile(ground(), ed)); const sideways = lanePanel.querySelector<HTMLInputElement>('#offset'); if (sideways) { sideways.min = String(Math.min(-30, Math.floor(ed.offset))); sideways.max = String(Math.max(30, Math.ceil(ed.offset))); sideways.value = String(ed.offset); sideways.parentElement!.firstChild!.textContent = `Sideways: ${ed.offset.toFixed(1)} m`; } ed.pieces.filter(isDevice).forEach((p) => { p.yaw = ed.angle; }); }, (v) => `${v}°`);
    slider('Sideways', 'offset', Math.min(-30, Math.floor(ed.offset)), Math.max(30, Math.ceil(ed.offset)), 0.5, () => ed.offset, (v) => shiftLane(ed, v), (v) => `${v.toFixed(1)} m`);
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
      ed.start = undefined; ed.angle = pick.angle; ed.offset = pick.offset; ed.level = pick.level; ed.verdict = '';
      save(); drawLanePanel(); draw(); drawProfile(); verify();
    };
    const play = el('button', lanePanel, { text: 'Play this lane', className: 'go', id: 'play' });
    play.onclick = async () => {
      interruptSearch();
      const version = env.verifyVersion();
      const course = courseNow();
      play.disabled = true; play.textContent = 'Checking this lane…';
      laneCheck.start();
      const clear = await searchClearable(course);
      play.disabled = false; play.textContent = 'Play this lane';
      if (isStopped(laneCheck.state()) || version !== env.verifyVersion()) return; // Cancel, the cap or a newer edit answered for this check
      if (clear === null) { laneCheck.reset(); ed.verdict = 'The lane check could not finish. Try again after editing stops.'; drawLanePanel(); return; }
      laneCheck.done(clear);
      document.documentElement.dataset.laneClear = clear ? '1' : '0';
      if (!clear) { ed.verdict = BLOCKED_LANE_GUIDANCE; drawLanePanel(); return; }
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
    laneCheck.mount(lanePanel, simSays ? simSays.el.nextSibling : lanePanel.firstChild); // Keep active search details above the controls, in view.
  }
  return { drawLanePanel };
}
