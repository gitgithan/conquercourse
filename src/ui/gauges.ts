// Character gauges (CC-148): everything that says something about the runner (speed, drone battery, later energy, grip, stamina, rope tension)
// lives in one stack at the bottom left. Register a gauge, set its value each frame; hidden gauges take no room.

import { HUD, panelCss } from './hud-style';

export interface GaugeSpec { id: string; label: string; colour: string; max: number }
export interface GaugeUpdate { value?: number; max?: number; text?: string; note?: string; mark?: number | null; colour?: string; visible?: boolean }
export interface Gauge { set: (u: GaugeUpdate) => void; el: HTMLElement }
export interface GaugeStack { el: HTMLElement; register: (spec: GaugeSpec) => Gauge; lift: (px: number) => void; dock: (cardOpen: boolean) => void }

/** Fill width in percent, kept inside 0..100 (a bad number is an empty bar). */
export function gaugePercent(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

const BASE_BOTTOM = 64; // clears the 44 px speaker button (bottom 10 px) with a gap

/** `where: 'old'` keeps the pre-CC-148 look (top centre) for ?gauges=old. */
export function createGaugeStack(where: 'bottom-left' | 'old' = 'bottom-left'): GaugeStack {
  const el = document.createElement('div');
  el.id = 'gauge-stack';
  const old = where === 'old';
  el.style.cssText = old
    ? 'position:fixed;left:50%;top:10px;transform:translateX(-50%);width:min(420px,60vw);display:flex;flex-direction:column;gap:8px;text-align:center;font:600 15px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none'
    : `position:fixed;left:12px;bottom:calc(${BASE_BOTTOM}px + var(--gl,0px));width:min(230px,30vw);min-width:150px;display:flex;flex-direction:column-reverse;gap:10px;font:600 14px system-ui,sans-serif;color:${HUD.text};pointer-events:none;z-index:6`;
  if (!old) { const st = document.createElement('style'); st.textContent = '@media (max-width:1100px){#gauge-stack{--gd:54px}}#gauge-stack{margin-bottom:var(--gd,0px)}'; el.append(st); } // narrow screens: step over the drum lane (G)
  const register = (spec: GaugeSpec): Gauge => {
    const g = document.createElement('div');
    g.dataset.gauge = spec.id;
    const p = 'g'; // the speed gauge keeps the old ids gtext/gfill/gneed/gnext; others add their id
    const key = spec.id === 'speed' ? '' : spec.id;
    if (!old) g.style.cssText = panelCss('7px 10px 8px'); // CC-156: each gauge is its own bright-on-dark panel, so a hidden gauge leaves no empty box
    g.innerHTML = `<div id="${p}text${key}">${spec.label}</div><div style="position:relative;height:14px;background:${old ? '#10141c33' : HUD.track};border-radius:7px;margin-top:3px"><div id="${p}fill${key}" style="height:100%;width:0;background:${spec.colour};border-radius:7px"></div><div id="${p}need${key}" style="position:absolute;top:-4px;width:3px;height:22px;background:${old ? '#c4572a' : HUD.mark};display:none"></div></div><div id="${p}next${key}" style="margin-top:4px;font-weight:500"></div>`;
    el.append(g);
    const q = (n: string) => g.querySelector(`#${p}${n}${key}`) as HTMLElement;
    const [text, fill, need, next] = [q('text'), q('fill'), q('need'), q('next')];
    let max = spec.max;
    return {
      el: g,
      set: (u) => {
        if (u.max !== undefined) max = u.max;
        if (u.visible !== undefined) g.style.display = u.visible ? '' : 'none';
        if (u.text !== undefined) text.textContent = u.text;
        if (u.value !== undefined) fill.style.width = `${gaugePercent(u.value, max)}%`;
        if (u.colour !== undefined) fill.style.background = u.colour;
        if (u.mark !== undefined) { need.style.display = u.mark ? 'block' : 'none'; need.style.left = `${gaugePercent(u.mark ?? 0, max)}%`; }
        if (u.note !== undefined) { next.textContent = u.note; next.style.display = u.note ? '' : 'none'; }
      },
    };
  };
  const lift = (px: number) => { if (!old) el.style.setProperty('--gl', `${px}px`); };
  const dock = (cardOpen: boolean) => { if (!old) el.style.left = cardOpen ? '318px' : '12px'; }; // the keys card (left 16, 290 wide) is tall: step to its right while it is open
  return { el, register, lift, dock };
}
