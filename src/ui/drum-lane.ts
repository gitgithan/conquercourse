import type { Drum } from '../sim/drums';

// A taiko-style lane along the bottom of the screen: each drum is a place on the course where the ideal run presses Space.
// Drums slide toward the hit line as the runner closes in, so the line reads like a rhythm game; it shows the way, it never scores.
const PX_PER_M = 46;
const HIT_AT = 0.2; // the hit line sits this far across the lane

const LABEL: Record<Drum['what'], string> = { jump: 'Space', 'let go': 'Let go', bounce: 'Press', vault: 'V', grab: 'Q / E', release: 'Release', roll: 'X' };

export interface DrumLane {
  set(drums: Drum[]): void;
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
  const els: HTMLDivElement[] = [];
  let shown = on;
  root.style.display = shown ? 'block' : 'none';

  const make = (d: Drum): HTMLDivElement => {
    const e = document.createElement('div');
    e.style.cssText = 'position:absolute;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 50% 45%,#fff3d6 0 52%,#c8382a 54% 100%);border:3px solid #7d1f16;display:grid;place-items:center;color:#5a1a10;font:800 11px system-ui,sans-serif;text-align:center;line-height:1';
    e.innerHTML = `<span>${LABEL[d.what]}</span>`;
    root.appendChild(e);
    return e;
  };

  return {
    set(next) {
      for (const e of els) e.remove();
      els.length = 0;
      drums = next;
      for (const d of drums) els.push(make(d));
    },
    update(runnerX) {
      if (!shown) return;
      const w = root.clientWidth;
      let nextUp = -1;
      drums.forEach((d, i) => { if (nextUp < 0 && d.x >= runnerX - 0.05) nextUp = i; });
      drums.forEach((d, i) => {
        const e = els[i];
        const px = w * HIT_AT + (d.x - runnerX) * PX_PER_M;
        const visible = px > -30 && px < w + 30;
        e.style.display = visible ? 'grid' : 'none';
        if (!visible) return;
        e.style.left = `${px}px`;
        const passed = d.x < runnerX - 0.05;
        e.style.opacity = passed ? '0.25' : '1';
        e.style.transform = i === nextUp ? 'scale(1.18)' : 'scale(1)';
      });
    },
    toggle() { shown = !shown; root.style.display = shown ? 'block' : 'none'; return shown; },
    get shown() { return shown; },
  };
}
