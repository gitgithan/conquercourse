import type { CourseData } from '../../course/course';
import { recoilParams } from '../../sim/world';
import { isAimable } from '../../sim/recoil';
import { backgroundOn, openBackgroundMenu } from '../../ui/background';
import { createGaugeStack } from '../../ui/gauges';
import { HUD, hudOn, keycapCss, panelCss } from '../../ui/hud-style';
import { goldOld, hardestBlock, hardestLabel, hardestOf } from '../../ui/hardest';
import { forkCell, pathsOn } from '../../ui/paths';
import { branchesOf } from '../../sim/branches';
import { ZONE_ICONS } from '../../ui/zone-icons';
import { progressZonesOf } from './zones';
import type { CourseState } from './state';

export interface HudDeps {
  course: CourseData;
  defaultCourse: CourseData;
  params: URLSearchParams;
  st: CourseState;
  paintBackground: () => void;
  openDojo: () => void;
  openEditor: (intent: 'edit' | 'easier') => void;
  showIdeal: (zoneId: string) => void;
  showWholeIdeal: () => void;
  zoneAt: (x: number) => { id: string } | undefined;
}

// What is drawn on top of the picture: the time line, the message, the controls card, the buttons, the gauges and the obstacle strip.
export function createHud(deps: HudDeps) {
  const { course, defaultCourse, params, st } = deps;
  const gaugeStack = createGaugeStack(params.get('gauges') === 'old' ? 'old' : 'bottom-left'); // CC-148: one bottom-left stack for everything about the runner
  const speedGauge = gaugeStack.register({ id: 'speed', label: 'Speed', colour: '#0f6b5c', max: 10 });
  const batteryGauge = course.drone && params.get('gauges') !== 'old' ? gaugeStack.register({ id: 'battery', label: 'Drone battery', colour: '#2a6fb0', max: 100 }) : null;
  const hud = document.createElement('div');
  hud.style.cssText = hudOn(params) ? `font:600 18px system-ui,sans-serif;font-variant-numeric:tabular-nums;min-width:31ch;white-space:nowrap;pointer-events:none;${panelCss('5px 12px')}${params.get('hud') === 'restart' ? ';min-width:25ch;font-size:15px' : ''}` : 'position:fixed;left:16px;top:12px;font:600 18px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none';
  const msg = document.createElement('div');
  msg.id = 'msg';
  msg.style.cssText = hudOn(params) ? `position:fixed;left:50%;top:38%;transform:translateX(-50%);max-width:90vw;text-align:center;font:700 28px system-ui,sans-serif;pointer-events:none;${panelCss('8px 18px')}` : 'position:fixed;left:0;right:0;top:38%;text-align:center;font:700 28px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff;pointer-events:none';
  // the controls, always visible top-left as a card of key caps (collapse with H)
  const help = document.createElement('div');
  help.id = 'keys';
  const KEYS: [string, string][] = [['← →', 'Run (hold)'], ['R', 'Restart (Shift+R: from the very start)'], ['Space / ↑ / W', 'Jump · press on the trampoline'], ['↓ / S', 'Bend your knees (hold, on big drops) · tap while running: slide low under a head-high ball'], ['X', 'Roll: hold it as you land (it counts in the last 0.15 s and about a metre up; a tap earlier does nothing); on the ground it rolls along'], ...(course.recoil ? ([['K', 'Fire the launcher (clip it on at the teal pad): the ball goes back, you go forward'], ...(isAimable(recoilParams(course)) ? [['↑ ↓ (or W)', 'Tilt the cannon barrel while it is loaded (Up does not jump then): it points backward and down, so the push goes forward and up; dots show where you would land']] : [])] as [string, string][]) : []), ...(course.trebuchet ? ([['→ (hold), then Space, ↑ or W', 'Trebuchet: pull the pin, then let the rider go when the hint says LET GO NOW']] as [string, string][]) : []), ...(course !== defaultCourse ? ([['E', 'Hold a bar or the rope in the air (let go to fly on), or at a tall wall: grab its edge and climb'], ['← → on a bar', 'Pump the swing: push the way you swing'], ['V', 'Vault over a step with a hand on top (fast, saves energy)']] as [string, string][]) : []), ...(course.bars?.length ? ([['Q  T', 'Monkey bars: hold E, then Q reaches the left hand and T the right hand, one after the other, as you swing forward; ← → kip the swing']] as [string, string][]) : []), ['F', 'Toggle the Looking ahead inset'], ['N', 'Ghost: a see-through runner that replays the ideal run, to chase (N switches it)'], ...(course.track ? ([['→, Space, ↑ or W', 'Push off at the top of the first hill; Space, ↑ or W while riding jumps you off the cart'], ['↓ / S (hold)', 'Brake']] as [string, string][]) : []), ['I', 'Ideal run of this obstacle (Shift+I: the whole course, any key stops it)'], ...(course.band ? ([['←, then →', 'Elastic band: hold ← to stretch it, then turn round (hold →) and it throws you']] as [string, string][]) : []), ...(course.drone ? ([['E (on the pad)', 'Board the drone; let go to step off'], ['← → in the drone', 'Lean: the drone flies that way'], ['↑ ↓ in the drone', 'Climb, or come down']] as [string, string][]) : []), ['G', 'Drums: where the ideal run presses Space'], ['Mouse', 'Drag to turn the view, wheel to zoom (all the way in shows the face), double-click to reset']]; // retry, ideal run and Dojo are on the fall panel and the buttons
  const newHud = hudOn(params);
  help.style.cssText = newHud ? `position:fixed;left:16px;top:56px;width:290px;font:500 14px system-ui,sans-serif;pointer-events:none;display:grid;gap:5px;${panelCss('8px 10px')}` : 'position:fixed;left:16px;top:48px;width:290px;background:#fffffff0;border:1px solid #cfd6d0;border-radius:12px;padding:8px 10px;font:500 14px system-ui,sans-serif;color:#17201d;box-shadow:0 2px 10px #0002;pointer-events:none;display:grid;gap:5px';
  const MINOR: Record<string, string> = { F: 'inset', N: 'ghost', I: 'ideal run', G: 'drums', Mouse: 'view' }; // CC-156: the card keeps the keys you need to run; the rest sit in one line below
  const paintKeys = (open: boolean) => {
    gaugeStack.dock(open);
    const row = ([k, d]: [string, string]) => `<div style="display:grid;grid-template-columns:${newHud ? '104px' : '78px'} 1fr;gap:8px;align-items:center"><kbd style="${newHud ? keycapCss.replace('white-space:nowrap', 'white-space:normal') : 'font:700 13px ui-monospace,monospace;background:#eef1ec;border:1px solid #b9c2bb;border-bottom-width:3px;border-radius:6px;padding:1px 6px;text-align:center'}">${k}</kbd><span>${d}</span></div>`;
    const head = `<div style="font-weight:700;display:flex;justify-content:space-between">Controls <span style="font-weight:400;color:${newHud ? HUD.soft : '#58635d'}">H ${open ? 'hides' : 'shows'}</span></div>`;
    if (!open) { help.innerHTML = head; return; }
    const main = newHud ? KEYS.filter(([k]) => !(k in MINOR)) : KEYS, rest = newHud ? KEYS.filter(([k]) => k in MINOR) : [];
    help.innerHTML = head + main.map(row).join('') + (rest.length ? `<div style="color:${HUD.soft};font-size:13px;line-height:1.9;margin-top:2px">Also: ${rest.map(([k]) => `<kbd style="${keycapCss}">${k}</kbd> ${MINOR[k]}`).join(' &nbsp; ')}</div>` : '');
  };
  paintKeys(true);
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,94vw);max-height:88vh;overflow:auto;z-index:40;box-sizing:border-box;background:#fff;border:1px solid #cfd6d0;border-radius:12px;padding:16px;font:15px/1.4 system-ui,sans-serif;color:#17201d;display:none;gap:10px;box-shadow:0 8px 30px #0003';
  const hint = document.createElement('div');
  hint.style.cssText = `order:0;max-width:100%;box-sizing:border-box;text-align:center;font:600 20px system-ui,sans-serif;pointer-events:none;${hudOn(params) ? panelCss('8px 16px') : 'color:#10141c;background:#fffc;border-radius:10px;padding:8px 16px'}`;
  const dojoBtn = document.createElement('button');
  dojoBtn.id = 'dojobtn'; dojoBtn.textContent = 'Dojo (L)';
  dojoBtn.style.cssText = 'position:fixed;right:16px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer';
  dojoBtn.onclick = () => deps.openDojo();
  const idealBtn = document.createElement('button');
  idealBtn.id = 'idealbtn'; idealBtn.textContent = 'Ideal run (I)';
  idealBtn.style.cssText = 'position:fixed;right:120px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 14px;cursor:pointer';
  idealBtn.title = 'Watch the ideal run of this obstacle (I)';
  idealBtn.onclick = () => deps.showIdeal(deps.zoneAt(st.world.runner.x)?.id ?? 'gap');
  // CC-80: from here back to the editor (the same pieces), at the obstacle the runner is at
  const editBtn = document.createElement('button');
  editBtn.id = 'editcourse'; editBtn.textContent = 'Edit this course';
  editBtn.title = 'Open this course in the World Editor, at this obstacle; "Back to the Course" brings you back here';
  editBtn.style.cssText = 'font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap';
  editBtn.onclick = () => { editBtn.blur(); deps.openEditor('edit'); };
  const wholeBtn = document.createElement('button');
  wholeBtn.id = 'wholeideal'; wholeBtn.textContent = 'Whole course (Shift+I)';
  wholeBtn.title = 'Watch one ideal run through every obstacle; a move key stops it (the camera keys do not)';
  wholeBtn.style.cssText = 'font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap';
  wholeBtn.onclick = () => { wholeBtn.blur(); deps.showWholeIdeal(); };
  // the two small buttons share one row, so they cannot overlap whatever their text widths are
  const rowBtns = document.createElement('div');
  rowBtns.id = 'coursebtns'; rowBtns.style.cssText = 'position:fixed;right:158px;top:56px;display:flex;gap:8px;align-items:center';
  const bgBtn = document.createElement('button');
  bgBtn.id = 'custombg'; bgBtn.textContent = 'Customize background';
  bgBtn.title = 'Put your own picture behind every course. It stays in this browser only.';
  bgBtn.style.cssText = editBtn.style.cssText;
  bgBtn.onclick = () => { bgBtn.blur(); openBackgroundMenu(bgBtn, deps.paintBackground); };
  rowBtns.append(editBtn, wholeBtn);
  if (backgroundOn(params)) rowBtns.append(bgBtn);
  // the obstacle strip: one icon per obstacle; cleared ones dim, the next one is biggest; gold marks only the obstacle you fell at most (CC-183; ?gold=old: the rest glow gold)
  const strip = document.createElement('div');
  strip.id = 'strip';
  strip.style.cssText = 'position:fixed;left:50%;top:92px;transform:translateX(-50%);display:flex;gap:10px;align-items:flex-end;pointer-events:none';
  const sstyle = document.createElement('style');
  const oldGold = goldOld(); // ?gold=old: every obstacle still to do glows gold (before CC-183)
  sstyle.textContent = oldGold ? `@keyframes ccwave{0%,100%{filter:drop-shadow(0 0 2px #e8b43a88);opacity:.72}50%{filter:drop-shadow(0 0 9px #ffd24a);opacity:1}}
    #strip .ob{display:grid;justify-items:center;gap:1px;font:600 11px system-ui,sans-serif;color:#7a5a00;transition:transform .3s,opacity .3s}
    #strip .ob svg{width:34px;height:34px;padding:5px;border-radius:12px;background:#fff8dc;border:2px solid #d9a521;color:#b07d00;box-sizing:content-box}
    #strip .ob.todo svg{animation:ccwave 2.2s ease-in-out infinite}
    #strip .ob.next{transform:scale(1.25);color:#5b4200}#strip .ob.next svg{background:#ffe38a;border-color:#f0b400;color:#6b4a00}
    #strip .ob.done{opacity:.35;filter:grayscale(1)}#strip .ob.done svg{animation:none;background:#eef1ec;border-color:#9aa59e;color:#58635d}`
  : `#strip .ob{display:grid;justify-items:center;gap:1px;font:600 11px system-ui,sans-serif;color:#17201d;transition:transform .3s,opacity .3s}
    #strip .ob svg{width:34px;height:34px;padding:5px;border-radius:12px;background:#fff;border:2px solid #9aa59e;color:#58635d;box-sizing:content-box}
    #strip .ob.next{transform:scale(1.25)}#strip .ob.next svg{border-color:#0f6b5c;color:#0f6b5c}
    #strip .ob.done{opacity:.35;filter:grayscale(1)}#strip .ob.done svg{background:#eef1ec}
    #strip .ob.hard{opacity:1;filter:none}#strip .ob.hard svg{background:#ffe38a;border-color:#d9a521;color:#6b4a00}`; // gold only on the obstacle you fell at most
  const ICONS = ZONE_ICONS;
  const progressZones = course.zones?.length ? course.zones : progressZonesOf(course);
  const fallLog: string[] = []; // CC-183: one zone id per failed try this session; gold marks the zone with the most
  const hardestNow = () => { const h = hardestOf(fallLog); const z = h && progressZones.find((q) => q.id === h.id); return h && z ? { ...h, name: z.name } : null; };
  const hardBand = () => { const h = goldOld() ? null : hardestNow(); const z = h && progressZones.find((q) => q.id === h.id); return h && z ? { x0: z.x0, x1: z.x1, name: h.name, falls: h.falls } : null; }; // CC-183: the band on the report map
  const addHardest = (body: HTMLElement) => { const h = goldOld() ? null : hardestNow(); if (h) (body.querySelector('#report-ghost-slot') ?? body.lastElementChild)?.before(hardestBlock(h.name, h.falls)); };
  const VIEW_KEYS = ['KeyC', 'KeyF', 'KeyG'];
  const stripKey = { v: '' };
  function paintStrip(x: number) {
    const zs = progressZones;
    const firstTodo = zs.findIndex((z) => x < z.x1);
    const hard = goldOld() ? null : hardestNow();
    const key = zs.map((_, i) => (firstTodo === -1 || i < firstTodo ? 'd' : i === firstTodo ? 'n' : 't')).join('') + (hard ? `|${hard.id}|${hard.falls}` : '');
    if (key === stripKey.v) return;
    stripKey.v = key;
    strip.innerHTML = '';
    zs.forEach((z, i) => {
      const st = key[i];
      const d = document.createElement('div');
      d.className = 'ob ' + (st === 'd' ? 'done' : st === 'n' ? 'todo next' : 'todo') + (hard?.id === z.id ? ' hard' : '');
      d.style.animationDelay = `${i * 0.35}s`;
      d.title = `${z.name}${st === 'd' ? ' (cleared)' : ''}${hard?.id === z.id ? ` - ${hardestLabel(z.name, hard.falls)}` : ''}`;
      const fork = pathsOn(params) ? branchesOf(course).find((q) => q.id === z.id) : undefined; // CC-225: a fork shows both ways side by side
      if (fork) { d.innerHTML = forkCell(fork); strip.appendChild(d); return; }
      d.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation-delay:${(i * 0.35).toFixed(2)}s">${ICONS[z.id.replace(/-\d+$/, '')] ?? '<circle cx="16" cy="16" r="6"/>'}</svg><span>${st === 'n' ? z.name : ''}</span>`;
      strip.appendChild(d);
    });
  }
  document.body.append(sstyle, strip);
  return { VIEW_KEYS, paintStrip, gaugeStack, speedGauge, batteryGauge, hud, msg, help, panel, hint, dojoBtn, idealBtn, rowBtns, paintKeys, strip, progressZones, fallLog, hardBand, addHardest };
}
