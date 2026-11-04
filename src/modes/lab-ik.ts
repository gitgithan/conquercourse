import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { mountIkPanel } from "../labs/ik/panel";

// Posing a character (inverse kinematics). The player drags a hand target (a bar or a ledge) and the Rookie's arm bends to reach it
// with the game's own two-bone reach and neck rule; an iterative solver is there to compare. Numbers and a picture; nothing talks or grades.
// Behind the labs switch (?labs=1). The equations are in a box that stays closed until opened.
const INK = "#17201d", TEAL = "#0f6b5c";
export async function startLabIk(host: HTMLElement): Promise<{ backend: "canvas2d" }> {
  const root = document.createElement("div");
  root.id = "lab-ik";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-ik");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Posing a character</h1><p>Labs are switched off.</p><p><a href="?mode=lab-ik&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-ik .wrap{max-width:1240px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-ik h1{font-size:22px;margin:0}
    #lab-ik .small{color:#52605a;font-size:13px}
    #lab-ik a.back{color:${TEAL};font-weight:600}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1 id="ik-h1">Posing a character</h1>
    <p class="small" style="margin:4px 0 0">The goal: put the Rookie's hand on a bar or a ledge, and find the exact place where the pose breaks. Drag the bar in the picture, or use the arrow keys. The arm is solved by the same code the game uses to put hands on a ledge.</p></div>
  `;
  const ok = await mountIkPanel(wrap);
  if (!ok) return { backend: "canvas2d" };
  labDefaultNote(wrap, "live", wrap.querySelector<HTMLElement>("#ik-h1")!); // the game's own solver, limits and neck rule on the first bar: solved at once, no Run in this Lab
  labPopulated("lab-ik");
  document.documentElement.dataset.labReady = "true";
  return { backend: "canvas2d" };
}
