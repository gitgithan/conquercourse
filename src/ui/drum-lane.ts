import type { Drum } from '../sim/drums';

// A taiko-style lane along the bottom of the screen: each drum is a place on the course where the ideal run presses Space.
// Drums slide toward the hit line as the runner closes in, so the line reads like a rhythm game; it shows the way, it never scores.
const PX_PER_M = 46;
const HIT_AT = 0.2; // the hit line sits this far across the lane

const LABEL: Record<Drum['what'], string> = { jump: 'Space', 'let go': 'Let go', bounce: 'Press', vault: 'V', grab: 'E', release: 'Release', roll: 'X', fire: 'K', aim: '↑↓', turn: 'Turn →', board: 'E' };

export interface DrumLane {
  set(drums: Drum[], marks?: { x: number; label: string }[]): void; // marks: the fork and the join (CC-225), drawn as dashed lines across the lane
  update(runnerX: number): void;
  toggle(): boolean;
  readonly shown: boolean;
}

export function createDrumLane(parent: HTMLElement, on: boolean): DrumLane {
  const root = document.createElement('div');
  root.id = 'drums';
  root.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);width:min(760px,92vw);height:86px;background:#1b1410d8;border:2px solid #5a3a22;border-radius:14px;overflow:hidden;pointer-events:none;font:600 12px system-ui,sans-serif;color:#f6e7cf;box-shadow:0 4px 16px #0005';
  const hit = document.createElement('div');
  hit.style.cssText = `position:absolute;left:${HIT_AT * 100}%;top:6px;bottom:6px;width:3px;margin-left:-1.5px;background:#ffd24a;box-shadow:0 0 10px #ffd24a`;
  const ring = document.createElement('div');
  ring.style.cssText = `position:absolute;left:${HIT_AT * 100}%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border:3px dashed #ffd24a88;border-radius:50%`;
  const tag = document.createElement('div');
  tag.textContent = 'Drums (G)';
  tag.style.cssText = 'position:absolute;right:10px;top:6px;color:#c9b393;font-weight:500';
  root.append(ring, hit, tag);
  parent.appendChild(root);

  let drums: Drum[] = [];
  let marks: { x: number; label: string }[] = [];
  const els: HTMLDivElement[] = [], markEls: HTMLDivElement[] = [];
  const ways: string[] = []; // the ways named by the drums, in order: the first sits in the top row, the second in the bottom row
  let shown = on;
  root.style.display = shown ? 'block' : 'none';

  const make = (d: Drum): HTMLDivElement => {
    const e = document.createElement('div');
    const row = d.route ? ways.indexOf(d.route) : -1; // a drum of one way sits in its own row (CC-225); a shared drum stays in the middle
    const size = row >= 0 ? 38 : 54;
    e.style.cssText = `position:absolute;top:${row < 0 ? 50 : row === 0 ? 27 : 73}%;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;`+'border-radius:50%;background:radial-gradient(circle at 50% 45%,#fff3d6 0 52%,#c8382a 54% 100%);border:3px solid #7d1f16;display:grid;place-items:center;color:#5a1a10;font:800 11px system-ui,sans-serif;text-align:center;line-height:1';
    const long = !!d.note && d.note.length > 8; // a sentence on a drum (the pole's "Hold E to climb the pole") gets a small card of two lines, not a circle
    if (long) { e.style.width = '92px'; e.style.borderRadius = '14px'; e.style.padding = '0 3px'; e.style.background = '#fff3d6'; e.style.font = '800 10.5px/1.05 system-ui,sans-serif'; e.style.zIndex = '2'; } // two short lines, about as wide as two drums, so the drums beside it stay readable
    e.innerHTML = long ? `<span>${d.note}</span>` : `<span>${LABEL[d.what]}${d.note ? `<br><small>${d.note}</small>` : ''}</span>`;
    root.appendChild(e);
    return e;
  };

  return {
    set(next, nextMarks = []) {
      for (const e of [...els, ...markEls]) e.remove();
      els.length = 0; markEls.length = 0; ways.length = 0;
      drums = next; marks = nextMarks;
      for (const d of drums) if (d.route && !ways.includes(d.route)) ways.push(d.route);
      for (const m of marks) {
        const e = document.createElement('div');
        e.className = 'drum-mark';
        e.style.cssText = 'position:absolute;top:4px;bottom:4px;width:0;border-left:2px dashed #c9b393;color:#c9b393;font:600 10px system-ui,sans-serif';
        e.innerHTML = `<span style="position:absolute;left:4px;top:0;white-space:nowrap">${m.label}</span>`;
        root.appendChild(e); markEls.push(e);
      }
      for (const d of drums) els.push(make(d));
    },
    update(runnerX) {
      if (!shown) return;
      const w = root.clientWidth;
      marks.forEach((m, i) => {
        const px = w * HIT_AT + (m.x - runnerX) * PX_PER_M;
        markEls[i].style.display = px > -30 && px < w + 30 ? 'block' : 'none';
        markEls[i].style.left = `${px}px`;
      });
      let nextUp = -1;
      drums.forEach((d, i) => { if (nextUp < 0 && d.x >= runnerX - 0.05) nextUp = i; });
      drums.forEach((d, i) => {
        const e = els[i];
        const px = w * HIT_AT + (d.x - runnerX) * PX_PER_M;
        const visible = px > -30 && px < w + 30;
        e.style.display = visible ? 'grid' : 'none';
        if (!visible) return;
        e.style.left = `${px}px`;
        const passed = d.what === 'turn' ? runnerX < d.x - 0.05 : d.x < runnerX - 0.05; // the turn drum is met running left: it is passed once the runner is beyond it
        e.style.opacity = passed ? '0.25' : '1';
        e.style.transform = i === nextUp ? 'scale(1.18)' : 'scale(1)';
      });
    },
    toggle() { shown = !shown; root.style.display = shown ? 'block' : 'none'; return shown; },
    get shown() { return shown; },
  };
}
