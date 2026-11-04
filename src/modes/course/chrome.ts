import { hudOn, keycapCss, panelCss } from '../../ui/hud-style';
import { toastBand } from '../../ui/toast-band';
import type { createHud } from './hud';

// The top-left row and the buttons round the picture are put on the page (the pieces themselves are made in hud.ts).
export function mountChrome(d: { params: URLSearchParams; hud: ReturnType<typeof createHud>; pick: HTMLElement; camButton: HTMLElement; restart: () => void }) {
  const { params } = d;
  const dbgBtn = document.createElement('button');
  dbgBtn.id = 'debugbtn'; dbgBtn.textContent = 'Debug (B)'; dbgBtn.title = 'Show the collision boxes and where a jump right now would go';
  dbgBtn.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'; dbgBtn.tabIndex = -1; dbgBtn.setAttribute('aria-hidden', 'true'); // CC-246: no label on the screen; B still toggles it, and the tests use this node as the "course is ready" mark
  // CC-159: how to start again is on the screen all the time, as a key cap you can also press with a finger or the mouse
  const restartChip = document.createElement('button');
  restartChip.type = 'button'; restartChip.id = 'restart-chip';
  restartChip.innerHTML = `<kbd style="${keycapCss}">R</kbd> Restart`;
  restartChip.title = 'R starts again where you last began; Shift+R starts from the very start';
  restartChip.style.cssText = `font:700 13px system-ui,sans-serif;cursor:pointer;white-space:nowrap;display:flex;gap:7px;align-items:center;${panelCss('4px 10px 4px 6px')}`;
  restartChip.onclick = () => { restartChip.blur(); d.restart(); };
  const hudRow = document.createElement('div');
  hudRow.id = 'hudrow'; hudRow.style.cssText = 'position:fixed;left:16px;top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 32px);pointer-events:none';
  hudRow.append(d.hud.hud); // CC-165: the time has a fixed width so nothing beside it moves; the R Restart chip is only there with ?hud=restart (a fall already shows R, and phones have the touch Restart button)
  if (params.get('hud') === 'restart') { hudRow.append(restartChip); restartChip.style.pointerEvents = 'auto'; }
  // CC-163: on a phone-width screen the top-right buttons used to sit on the time line and the Restart chip: they move to a second row, and the rarely used ones (runner pick, edit, whole course, debug) step aside (their keys still work; Ideal run is on the fall panel too)
  const narrow = document.createElement('style');
  narrow.textContent = '@media (max-width:700px){#hudrow>div{font-size:14px!important}#pickrunner,#coursebtns,#debugbtn,#idealbtn,#community{display:none!important}#dojobtn{top:52px!important;right:12px!important;font-size:13px!important;padding:5px 10px!important}#ghost-hud{left:12px!important;top:52px!important;transform:none!important}#cam{top:92px!important;right:12px!important}#strip{top:160px!important}#keys{top:225px!important}}';
  document.head.append(narrow);
  const hudBox = hudOn(params) ? hudRow : d.hud.hud;
  toastBand().append(d.hud.hint); // CC-133: the hint lives in the sky band with the other short messages, never over the runner
  document.body.append(hudBox, d.hud.msg, d.hud.help, d.hud.panel, d.hud.gaugeStack.el, d.hud.dojoBtn, d.hud.idealBtn, d.hud.rowBtns, d.pick, d.camButton, dbgBtn);
  return { dbgBtn };
}
