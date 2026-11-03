import { editorStart } from './start';
import { HALF_LANE } from '../../slice/slice';
import { size } from '../../slice/world';
import { START_LABEL } from '../../slice/editor-defaults';
import type { View3d } from '../../slice/view3d';
import { isSizeReference, type EditorState } from './state';

export interface PlanDrawEnv {
  ed: EditorState; plan: HTMLCanvasElement; view3d: View3d;
  chosen: () => number[]; placeBar: () => void;
  start?: () => ReturnType<typeof editorStart>;
  rubber: () => { x0: number; z0: number; x1: number; z1: number } | null | undefined;
}

// The plan picture: the world-to-screen helpers and the 2D drawing of the grid, lane band, start flag, pieces, preview arrows and the rubber band.
// Moved out of editor.ts unchanged (CC-133).
export function createPlanDraw(env: PlanDrawEnv) {
  const { ed, plan, view3d, chosen, placeBar } = env;
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
    const start = env.start?.() ?? { x: 0, z: 0 };
    c.fillStyle = '#17201d'; c.beginPath(); c.arc(sx(start.x), sz(start.z), 5, 0, 7); c.fill(); c.fillStyle = '#c69500'; c.beginPath(); c.moveTo(sx(start.x), sz(start.z)); c.lineTo(sx(start.x), sz(start.z) - 22); c.lineTo(sx(start.x) + 16, sz(start.z) - 16); c.lineTo(sx(start.x), sz(start.z) - 10); c.fill(); c.font = '600 11px system-ui'; c.fillText(START_LABEL.replace(/^Start/, 'START'), sx(start.x) + 8, sz(start.z) + 14);
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
    const rubber = env.rubber();
    if (rubber) { c.strokeStyle = '#0f6b5c'; c.setLineDash([5, 4]); c.strokeRect(sx(rubber.x0), sz(rubber.z0), (rubber.x1 - rubber.x0) * ed.view.ppm, (rubber.z1 - rubber.z0) * ed.view.ppm); c.setLineDash([]); }
  }
  return { draw, sx, sz, wx, wz };
}
