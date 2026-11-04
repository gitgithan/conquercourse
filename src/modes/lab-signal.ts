import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { mountSignalPanel } from "../labs/signal/panel";

// Lab 8: Signal processing. The panel (all the widgets) lives in src/labs/signal/panel.ts so Lab 13 mounts the same one.

const INK = "#17201d", TEAL = "#0f6b5c";
export function startLabSignal(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-signal";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-signal");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 8: Signal processing</h1><p>Labs are switched off.</p><p><a href="?mode=lab-signal&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-signal .wrap{max-width:1180px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-signal h1{font-size:22px;margin:0}
    #lab-signal .small{color:#52605a;font-size:13px}
    #lab-signal a.back{color:${TEAL};font-weight:600}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1 id="sg-h1">Lab 8: Signal processing</h1>
    <p class="small" style="margin:4px 0 0">The goal: a captured move wobbles a little in every frame. Smooth it enough to calm the wobble, but not so much that the move comes out late or flattened. The game's plausibility gate decides if the result may be shown. Here the wobble is made on purpose (seeded noise added to a clean shipped clip), so the true move is known and every number below is a fact about the filter.</p></div>
  `;
  const panel = mountSignalPanel(wrap, { rookie: true, markPage: true });
  panel.start(() => labDefaultNote(wrap, "live", wrap.querySelector<HTMLElement>("#sg-h1")!)).then(() => labPopulated("lab-signal"));
  return { backend: "canvas2d" };
}
