import { el } from '../dom';
import { deviceMesh, RECOIL_PAD_LENGTH, TREBUCHET_PIVOT_FROM_CENTRE } from '../../../slice/device';
import { DRONE_PAD_LENGTH } from '../../../slice/drone-lane';
import { size } from '../../../slice/world';
import { fixRecoil } from '../../../slice/fixrecoil';
import { fixBand } from '../../../slice/fixband';
import { fixDrone } from '../../../slice/fixdrone';
import { inRange, knob, type PieceTool, type ToolCtx } from './types';

// The devices on the start deck. Each has a toolbar button, a few number boxes and a place in the fix search.
// The numbers live in the piece's source text (`device:kind:a:b:length`), so the boxes are set from the pieces whenever the world changes.

// a trebuchet at the start: the rider is thrown to the lane; the counterweight is the knob (the proof says whether it reaches)
export const trebuchetTool = (c: ToolCtx): PieceTool => {
  const { ed, lane, addBar, changed } = c;
  let label: HTMLElement, input: HTMLInputElement;
  return {
    id: 'trebuchet',
    mount() {
      el('button', addBar, { text: 'Trebuchet', id: 'addtreb', title: 'Start the lane in a trebuchet: the character is thrown onto it' }).onclick = () => {
        const treMesh = deviceMesh('device:trebuchet:1200');
        const first = !ed.pieces.some((p) => p.src?.startsWith('device:trebuchet:'));
        const centerU = first ? -TREBUCHET_PIVOT_FROM_CENTRE : c.nextLaneU() + size(treMesh).w / 2;
        const device = lane.makeDevice('device:trebuchet:1200', 'Trebuchet', centerU);
        ed.pieces.push(device); ed.selected = device.id;
        changed();
        c.focusOn(device, 22);
      };
      ({ label, input } = knob(addBar, 'Counterweight (kg)', 'trebkg', 300, 4000, 50, 1200));
      label.style.display = 'none';
      input.onchange = () => { const v = Number(input.value); if (inRange(v, 300, 4000)) { lane.updateDeviceSource('device:trebuchet', `device:trebuchet:${v}`); changed(); } };
    },
    sync() { label.style.display = ed.trebuchetKg ? '' : 'none'; input.value = String(ed.trebuchetKg ?? 1200); },
  };
};

// a launcher on the start deck (recoil): the ball goes back, the runner goes forward; the ball's mass and speed are the knobs (the proof says whether it reaches)
export const recoilTool = (c: ToolCtx): PieceTool => {
  const { ed, lane, addBar, changed } = c;
  let knobs: HTMLElement, kg: HTMLInputElement, speed: HTMLInputElement;
  const sync = () => { knobs.style.display = ed.recoilCfg ? '' : 'none'; if (ed.recoilCfg) { kg.value = String(ed.recoilCfg.ballMass); speed.value = String(ed.recoilCfg.muzzle); } };
  return {
    id: 'recoil',
    fixOrder: 2,
    mount() {
      knobs = el('span', addBar, {}); knobs.style.display = 'none';
      kg = knob(knobs, 'Ball (kg)', 'recoilkg', 2, 150, 1, 12).input;
      speed = knob(knobs, 'Speed (m/s)', 'recoilspeed', 3, 60, 1, 30).input;
      for (const [kind, text, id, mass, muzzle, title] of [['bigcannon', 'Cannon', 'addcannon', 80, 45, 'A pad on the start deck with a big wheeled air cannon: aim it with Up and Down, fire it with K; the ball goes back, you fly forward and up (the proof searches the angle)'], ['cannon', 'Launcher', 'addrecoil', 12, 30, 'A pad on the start deck clips on an air launcher: the ball goes back, you go forward (momentum is conserved)']] as const) {
        el('button', addBar, { text, id, title }).onclick = () => {
          const first = !lane.recoilPiece();
          const device = first
            ? lane.makeRecoilDevice(kind, mass, muzzle)
            : lane.makeDevice(`device:${kind}:${mass}:${muzzle}:${RECOIL_PAD_LENGTH}`, kind === 'bigcannon' ? 'Cannon' : 'Launcher', c.nextLaneU() + RECOIL_PAD_LENGTH / 2);
          ed.pieces.push(device); ed.selected = device.id;
          changed(); sync();
          c.focusOn(device, 13);
        };
      }
      const edit = () => {
        const m = Number(kg.value), u = Number(speed.value);
        if (ed.recoilCfg && inRange(m, 2, 150) && inRange(u, 3, 60)) {
          const len = lane.recoilPiece()?.src?.split(':')[4] ?? String(RECOIL_PAD_LENGTH);
          lane.updateDeviceSource(`device:${ed.recoilCfg.kind}`, `device:${ed.recoilCfg.kind}:${m}:${u}:${len}`); changed();
        }
      };
      kg.onchange = edit; speed.onchange = edit;
    },
    sync,
    // the launcher is the first thing to change: a heavier or faster ball
    fix({ reply, changed: done }) {
      if (!ed.recoilCfg || ed.trebuchetKg || ed.verdict.startsWith('The simulator can clear')) return false;
      const fr = fixRecoil(lane.courseNow(), ed.recoilCfg);
      reply.className = fr.ok ? 'reply ok' : 'reply bad';
      reply.textContent = fr.ok ? (fr.steps[0] ?? 'It already works.') : fr.steps.join(' ');
      document.documentElement.dataset.fixed = fr.ok ? '1' : '0';
      if (fr.ok && fr.steps.length) el('button', reply, { text: 'Use it', className: 'go', id: 'userecoil' }).onclick = () => { const len = lane.recoilPiece()?.src?.split(':')[4] ?? String(RECOIL_PAD_LENGTH); lane.updateDeviceSource(`device:${fr.cfg.kind}`, `device:${fr.cfg.kind}:${fr.cfg.ballMass}:${fr.cfg.muzzle}:${len}`); sync(); done(); };
      return true;
    },
  };
};

// an elastic band at the start: stretch it by running away from the post, turn round, and be thrown to the lane; the stiffness is the knob (the proof says whether it reaches)
// The band is not a piece, so its stiffness is state of its own and is not set again when the world changes.
export const bandTool = (c: ToolCtx): PieceTool => {
  const { ed, lane, addBar, changed } = c;
  let label: HTMLElement, input: HTMLInputElement;
  return {
    id: 'band',
    fixOrder: 3,
    mount() {
      el('button', addBar, { text: 'Band', id: 'addband', title: 'Start the lane at an elastic band: stretch it, turn round, and it throws you onto the lane' }).onclick = () => { ed.bandK = ed.bandK ? null : 35; label.style.display = ed.bandK ? '' : 'none'; input.value = String(ed.bandK ?? 35); changed(); };
      ({ label, input } = knob(addBar, 'Stiffness (N/m)', 'bandk', 20, 300, 5, 35));
      label.style.display = 'none';
      input.onchange = () => { const v = Number(input.value); if (inRange(v, 20, 300)) { ed.bandK = v; changed(); } };
    },
    // the band: the only thing the fix search can change is its stiffness; it says so and waits for Apply
    fix({ reply, changed: done }) {
      if (!ed.bandK) return false;
      const bf = fixBand(lane.laneCourse(lane.currentProfile()));
      document.documentElement.dataset.fixed = bf.ok ? '1' : '0';
      reply.className = bf.ok ? 'reply ok' : 'reply bad';
      reply.textContent = bf.ok ? (bf.steps.length ? bf.steps.join(' ') : 'It already works.') : bf.steps.join(' ');
      if (bf.ok && bf.steps.length) el('button', reply, { text: 'Apply', id: 'applyband', className: 'go' }).onclick = () => { ed.bandK = bf.k; input.value = String(bf.k); done(); reply.textContent = 'Applied.'; };
      return true;
    },
  };
};

// a drone pad (CC-87): hold E on it to board a cargo drone; the rider's weight and the battery are the knobs (the proof says whether it reaches)
export const droneTool = (c: ToolCtx): PieceTool => {
  const { ed, lane, addBar, changed } = c;
  let knobs: HTMLElement, kg: HTMLInputElement, wh: HTMLInputElement;
  const sync = () => { knobs.style.display = ed.droneCfg ? '' : 'none'; if (ed.droneCfg) { kg.value = String(ed.droneCfg.payload); wh.value = String(ed.droneCfg.battery); } };
  return {
    id: 'drone',
    fixOrder: 1,
    mount() {
      knobs = el('span', addBar, {}); knobs.style.display = 'none';
      kg = knob(knobs, 'Rider (kg)', 'dronekg', 30, 250, 5, 70).input;
      wh = knob(knobs, 'Battery (Wh)', 'dronewh', 10, 1000, 10, 50).input;
      el('button', addBar, { text: 'Drone', id: 'adddrone', title: 'A pad with a cargo drone: hold E on it to board and fly across (thrust against weight, battery, lean)' }).onclick = () => {
        if (lane.dronePiece()) return;
        const device = lane.makeDroneDevice(70, 50);
        ed.pieces.push(device); ed.selected = device.id;
        changed(); sync();
        c.focusOn(device, 13);
      };
      const edit = () => {
        const m = Number(kg.value), b = Number(wh.value);
        if (ed.droneCfg && inRange(m, 30, 250) && inRange(b, 10, 1000)) {
          const len = lane.dronePiece()?.src?.split(':')[4] ?? String(DRONE_PAD_LENGTH);
          lane.updateDeviceSource('device:drone', `device:drone:${m}:${b}:${len}`); changed();
        }
      };
      kg.onchange = edit; wh.onchange = edit;
    },
    sync,
    // the drone is the first thing to change: a bigger battery or a lighter rider
    fix({ reply, changed: done }) {
      if (!ed.droneCfg || ed.trebuchetKg || ed.verdict.startsWith('The simulator can clear')) return false;
      const fd = fixDrone(lane.courseNow(), ed.droneCfg, lane.droneRange());
      reply.className = fd.ok ? 'reply ok' : 'reply bad';
      reply.textContent = fd.ok ? (fd.steps[0] ?? 'It already works.') : fd.steps.join(' ');
      document.documentElement.dataset.fixed = fd.ok ? '1' : '0';
      if (fd.ok && fd.steps.length) el('button', reply, { text: 'Use it', className: 'go', id: 'usedrone' }).onclick = () => { const len = lane.dronePiece()?.src?.split(':')[4] ?? String(DRONE_PAD_LENGTH); lane.updateDeviceSource('device:drone', `device:drone:${fd.cfg.payload}:${fd.cfg.battery}:${len}`); done(); };
      return true;
    },
  };
};
