import { pageQuery } from '../../flags';
import { type EditorState, type P } from './state';
import { isTrack, TRACK_BLOCK_TEXT, type TrackBlock } from '../../slice/track-world';
import { addTrackPoint, moveTrackPoint, trackDots } from './track';
import { REACH_JUMPING, REACH_STANDING } from '../../slice/holds-world';
import { editorStart } from './start';
import { START_SHORT } from '../../slice/editor-defaults';
import { CELL } from '../../slice/slice';

export interface ProfileEnv {
  ed: EditorState; profileCanvas: HTMLCanvasElement; howto: HTMLElement;
  currentProfile: () => ReturnType<typeof import('../../slice/world').laneProfile>; barsNow: () => { id: number; u: number; y: number }[];
  draw: () => void; drawPanel: () => void; changed: () => void;
}

// The side view of the lane (the ground, the bars, the coaster dots, the reach lines) and the mouse on it.
// Moved out of editor.ts unchanged (CC-133).
export function createProfile(env: ProfileEnv) {
  const { ed, profileCanvas, howto, currentProfile, barsNow, draw, drawPanel, changed } = env;
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
    { // The same start person and gold cone as the 3D picture.
      const st = editorStart(ed, prof);
      if (st) {
        const x = 10 + (st.u - uLo) * ppm, y = base - (st.h - vmin) * ph;
        const glowG = c.createLinearGradient(0, y - 80, 0, y); glowG.addColorStop(0, 'rgba(255,196,0,0)'); glowG.addColorStop(1, 'rgba(255,196,0,.45)'); // a glowing cone over the person
        c.fillStyle = glowG; c.beginPath(); c.moveTo(x, y - 24); c.lineTo(x - 16, y - 80); c.lineTo(x + 16, y - 80); c.fill();
        c.strokeStyle = '#c76a26'; c.fillStyle = '#c76a26'; c.lineWidth = 3; c.lineCap = 'round';
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
      const st0 = a0 ? null : editorStart(ed, prof); // no bar before the skipped ones: the jump starts at the runner's start (CC-133, owner 2026-11-04)
      if (!a0 && !st0) continue;
      const fromU = a0 ? a0.u : st0!.u, fromY = a0 ? a0.y : st0!.h;
      const x0 = 10 + (fromU - uLo) * ppm, y0 = base - (fromY - vmin) * ph, x1 = a1 ? 10 + (a1.u - uLo) * ppm : 10 + (o + prof.length - uLo) * ppm, y1 = a1 ? base - (a1.y - vmin) * ph : base;
      c.save(); c.strokeStyle = '#7a4fd1'; c.fillStyle = '#7a4fd1'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 40, x1, y1); c.stroke(); c.setLineDash([]);
      const a = Math.atan2(y1 - (Math.min(y0, y1) - 20), x1 - (x0 + x1) / 2); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 9 * Math.cos(a - 0.45), y1 - 9 * Math.sin(a - 0.45)); c.lineTo(x1 - 9 * Math.cos(a + 0.45), y1 - 9 * Math.sin(a + 0.45)); c.closePath(); c.fill();
      c.font = '600 12px system-ui'; c.textAlign = 'center'; c.fillText(`kept shortcut: saves ${s.secondsSaved.toFixed(1)} s`, (x0 + x1) / 2, Math.min(y0, y1) - 48); c.restore();
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
  return { drawProfile };
}
