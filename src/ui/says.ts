import { pageQuery } from '../flags';
import { closeOnBackdrop } from './backdrop';

// The voice badge (CC-243): every message the main tech produces wears one small header that says WHO is speaking, in its own colour,
// with a one-line "powered by" naming the model in plain words. Only Meta models are named, and only where the code calls them (docs/model-ledger.md).
// The words under a badge stay short facts or hints from the message that was already there; nothing here grades or coaches a person's technique.
// ?says=0 turns every badge and the crew strip off; the messages stay as they were.

export type VoiceId = 'simulator' | 'partner' | 'safety' | 'cutter' | 'builder' | 'maker' | 'ghost' | 'street' | 'pip' | 'juno';

export interface Voice {
  id: VoiceId;
  /** The badge title, for example "Simulator". */
  title: string;
  /** The short name used on a crew card. */
  name: string;
  /** Strong colour: the icon disc and the left edge. */
  accent: string;
  /** Soft background of the badge. */
  tint: string;
  /** What the badge says it runs on, in plain words; null when it is plain code. */
  poweredBy: string;
  /** True when poweredBy names a Meta model (the ledger lists the call). */
  meta: boolean;
  /** One line: what this guy does for the player. */
  job: string;
  /** Where the words under the badge are written (docs/ui-voices.md lists these too). */
  where: string;
  /** 24x24 icon drawing (stroke paths). */
  icon: string;
}

const I = {
  gears: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  flag: '<path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  shield: '<path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  scissors: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.7 8.3L20 18M8.7 15.7L20 6"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  brush: '<path d="M4 20c3 0 5-1 5-3.5 0-1.4-1-2.5-2.3-2.5S4 15 4 17"/><path d="M9 14L19 4l1 1-10 10"/>',
  ghost: '<path d="M6 20V11a6 6 0 0 1 12 0v9l-2.4-2-2.1 2-1.5-2-1.5 2-2.1-2z"/><circle cx="10" cy="11" r="1" fill="currentColor"/><circle cx="14" cy="11" r="1" fill="currentColor"/>',
  photo: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="9" cy="10.5" r="1.6"/><path d="M4 17l5-4 3 2.5 3-3 5 4.5"/>',
  person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.6-4 3-6 6.5-6s5.9 2 6.5 6"/><path d="M8.8 6.6h6.4"/>',
};

export const VOICES: Record<VoiceId, Voice> = {
  simulator: { id: 'simulator', title: 'Simulator', name: 'Simulator', accent: '#0f6b5c', tint: '#e6f4ee', poweredBy: 'Our own physics, not an AI. It plays the same way every time.', meta: false, job: 'Plays a course with real physics and tells you if it can be cleared.', where: 'src/ui/sim-says.ts, src/modes/editor.ts, src/modes/map.ts, src/ui/run-report.ts, src/slice/lane-check-ui.ts', icon: I.gears },
  partner: { id: 'partner', title: 'Design partner', name: 'Design partner', accent: '#b4510a', tint: '#fdeede', poweredBy: 'Powered by Muse Spark Open', meta: true, job: 'Explains why a course cannot be cleared and offers one change the Simulator proved.', where: 'src/modes/editor.ts', icon: I.pencil },
  safety: { id: 'safety', title: 'Safety check', name: 'Safety check', accent: '#b3261e', tint: '#fbe9e7', poweredBy: 'Powered by Muse Spark Open', meta: true, job: 'Looks at every upload and every share before anyone else sees it.', where: 'src/modes/community-flow.ts', icon: I.shield },
  cutter: { id: 'cutter', title: 'Cutter', name: 'Cutter', accent: '#1565c0', tint: '#e5effb', poweredBy: 'Powered by SAM 3', meta: true, job: 'Cuts the things in your photo out, one outline each.', where: 'src/modes/community-flow.ts', icon: I.scissors },
  builder: { id: 'builder', title: 'Builder', name: 'Builder', accent: '#8a6a00', tint: '#fbf3d6', poweredBy: 'Powered by SAM 3D Objects', meta: true, job: 'Turns a cut-out into a solid 3D piece you can place and run over.', where: 'src/modes/community-flow.ts, src/ui/prize.ts', icon: I.cube },
  maker: { id: 'maker', title: 'Character maker', name: 'Character maker', accent: '#ad1457', tint: '#fbe6ef', poweredBy: 'Powered by Muse Image, SAM 3.1 and SAM 3D Objects', meta: true, job: 'Draws a new character from your words and rigs it so it can run.', where: 'src/characters/panel.ts', icon: I.brush },
  ghost: { id: 'ghost', title: 'Ghost', name: 'Ghost', accent: '#b86e00', tint: '#fff1d6', poweredBy: 'A replay of a real run, not an AI', meta: false, job: 'Runs your best try, or a friend’s, beside you.', where: 'src/ui/ghost.ts', icon: I.ghost },
  street: { id: 'street', title: 'Street photos', name: 'Street photos', accent: '#2e7d32', tint: '#e6f3e7', poweredBy: 'Mapillary photos, faces and plates blurred by Mapillary', meta: false, job: 'Shows real photos taken along the place you built.', where: 'src/ui/live-photos.ts', icon: I.photo },
  pip: { id: 'pip', title: 'Pip', name: 'Pip', accent: '#e8710a', tint: '#fff0e0', poweredBy: 'Rookie A: orange top, teal headband', meta: false, job: 'The first Rookie. Runs, jumps, vaults and climbs the Course.', where: 'src/characters/panel.ts', icon: I.person },
  juno: { id: 'juno', title: 'Juno', name: 'Juno', accent: '#7b3fbf', tint: '#f1e8fb', poweredBy: 'Rookie B: violet top, bun and orange headband', meta: false, job: 'The second Rookie, drawn in Pip’s style.', where: 'src/characters/panel.ts', icon: I.person },
};

/** The order of the crew strip: tech first, then the characters. */
export const CREW: VoiceId[] = ['simulator', 'partner', 'safety', 'cutter', 'builder', 'maker', 'ghost', 'street', 'pip', 'juno'];

// Where each voice shows up (CC-243, owner request 2026-11-01). One source of truth: the crew cards and the legend both read it.
// Derived from the code that mounts each badge; docs/ui-voices.md has the same table and the test checks they agree.
export type ScreenId = 'editor' | 'slicer' | 'course' | 'coaster' | 'report' | 'make' | 'characters';

export interface Screen {
  id: ScreenId;
  /** The name a player sees on screen, used in the legend, the tooltip and the aria-label. */
  name: string;
  /** 24x24 stroke drawing; each screen has its own SHAPE, so colour is never the only signal. */
  icon: string;
}

export const SCREENS: Record<ScreenId, Screen> = {
  editor: { id: 'editor', name: 'World Editor', icon: '<rect x="4" y="14" width="5" height="6"/><rect x="9.5" y="9" width="5" height="11"/><rect x="15" y="4" width="5" height="16"/>' },
  slicer: { id: 'slicer', name: 'World Slicer', icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M3 16l18-8"/>' },
  course: { id: 'course', name: 'Course', icon: '<path d="M3 20h18"/><path d="M7 20V5l9 3.5L7 12"/>' },
  coaster: { id: 'coaster', name: 'Coaster builder', icon: '<path d="M3 18C7 5 11 5 13 13s5 5 8-7"/><circle cx="3.5" cy="18" r="1.3"/><circle cx="20.5" cy="6" r="1.3"/>' },
  report: { id: 'report', name: 'End report', icon: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>' },
  make: { id: 'make', name: 'Make your own', icon: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>' },
  characters: { id: 'characters', name: 'Characters', icon: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.6-4 3-6 6.5-6s5.9 2 6.5 6"/>' },
};

/** The order of the legend. */
export const SCREEN_ORDER: ScreenId[] = ['editor', 'slicer', 'course', 'coaster', 'report', 'make', 'characters'];

export const VOICE_SCREENS: Record<VoiceId, ScreenId[]> = {
  simulator: ['editor', 'slicer', 'course', 'coaster'], // sim-says in editor and map; Graph Studio verdict in the Course; coaster verdict (the end report has no badge since CC-97)
  partner: ['editor'],
  safety: ['make'], // the Share step
  cutter: ['make'],
  builder: ['make'], // Step 4 and the prize screen
  maker: ['characters'],
  ghost: ['report'], // the ghost line in the end report
  street: ['course', 'slicer'], // live photo strip in the Course; place photos in the World Slicer
  pip: ['course', 'characters'], // Rookie A button in the Course; the first card in Characters
  juno: ['course'], // Rookie B button in the Course
};

export const saysOn = (params: URLSearchParams = pageQuery()): boolean => params.get('says') !== '0';

/** Words a badge may never carry: formulas, grades or coaching. The copy test runs these over every voice line. */
export const BANNED_IN_COPY = /[=×÷√]|\b(you should|you must|your form|your technique|good job|well done|score of|grade)\b/i;

const CSS = `
.says{--a:#0f6b5c;--t:#e6f4ee;display:inline-flex;align-items:center;gap:10px;max-width:100%;box-sizing:border-box;padding:5px 14px 5px 5px;border-radius:999px;background:var(--t);border:2px solid var(--a);color:#17201d;font-family:system-ui,sans-serif;line-height:1.15;animation:says-in .35s cubic-bezier(.2,.9,.3,1.2) both}
.says .says-ico{flex:none;width:34px;height:34px;border-radius:50%;background:var(--a);color:#fff;display:grid;place-items:center}
.says .says-ico svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.says .says-tx{display:grid;gap:2px;min-width:0}
.says .says-title{font-weight:800;font-size:17px;letter-spacing:.01em}
.says .says-by{font-weight:600;font-size:12px;color:#44504a}
.says.says-meta .says-by::before{content:'\\2605\\00a0';color:var(--a)}
.says.says-small{padding:2px 10px 2px 2px;border-width:1px;gap:6px}.says.says-small .says-ico{width:22px;height:22px}.says.says-small .says-ico svg{width:14px;height:14px}.says.says-small .says-title{font-size:13px}.says.says-small .says-by{font-size:11px}
.says-line{display:flex;margin:0 0 8px}
.says-line:has(+ .says-when:empty){display:none}
.says-dock{border-left:5px solid var(--a);background:var(--t);border-radius:10px;padding:8px 10px;display:grid;gap:6px}
.says-name{display:inline-flex;align-items:center;gap:6px;font:800 14px system-ui,sans-serif;color:#17201d}
.says-name .says-ico{width:26px;height:26px;border-radius:50%;background:var(--a);color:#fff;display:grid;place-items:center}
.says-name .says-ico svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@keyframes says-in{from{opacity:0;transform:translateY(8px) scale(.94)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.says{animation:none}}
.crew{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:0;padding:0;list-style:none}
.crew>li{display:grid;gap:6px;align-content:start;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #d6ddd6;border-top:5px solid var(--a);font-family:system-ui,sans-serif;color:#17201d}
.crew .crew-job{font-size:14px;line-height:1.35}
.crew .says{animation:none;align-self:start}
.crew-wrap{display:grid;gap:10px}
.crew-legend{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0;padding:8px 12px;list-style:none;border-radius:10px;background:#fff;border:1px solid #d6ddd6;font:600 13px system-ui,sans-serif;color:#17201d;background-clip:padding-box}
#crew-dialog .crew-wrap{min-height:0;grid-template-rows:auto minmax(0,1fr)}
#crew-dialog .crew{overflow:auto;min-height:0;align-content:start;padding:2px}
.crew-legend .cl-h{font-weight:800;margin-right:2px}
.crew-legend li,.crew-rail li{display:inline-flex;align-items:center;gap:5px}
.crew-legend svg,.crew-rail svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.crew-rail{display:flex;flex-direction:column;gap:6px;margin:0;padding:0 0 0 8px;list-style:none;border-left:1px solid #d6ddd6;align-self:stretch;justify-content:flex-start}
.crew-rail li{width:30px;height:30px;justify-content:center;border:1.5px solid #17201d;border-radius:8px;background:#f6f8f5;color:#17201d}
.crew .crew-body{display:grid;gap:6px;align-content:start;min-width:0}
.crew li.crew-card{grid-template-columns:1fr auto}
`;

export function ensureSaysStyle(doc: Document = document): void {
  if (doc.getElementById('says-style')) return;
  const st = doc.createElement('style'); st.id = 'says-style'; st.textContent = CSS; doc.head.append(st);
}

const svg = (doc: Document, d: string): SVGSVGElement => {
  const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = d; return s;
};

/** The badge: icon disc, big title, and the "powered by" line. `sub` swaps the powered-by line (for example a model that was not used this time). */
export function sayBadge(id: VoiceId, o: { doc?: Document; sub?: string | null } = {}): HTMLElement {
  const doc = o.doc ?? document, v = VOICES[id];
  ensureSaysStyle(doc);
  const b = doc.createElement('div'); b.className = `says${v.meta ? ' says-meta' : ''}`; b.dataset.voice = id;
  b.style.setProperty('--a', v.accent); b.style.setProperty('--t', v.tint);
  const ico = doc.createElement('span'); ico.className = 'says-ico'; ico.append(svg(doc, v.icon));
  const tx = doc.createElement('span'); tx.className = 'says-tx';
  const title = doc.createElement('span'); title.className = 'says-title'; title.textContent = v.title;
  tx.append(title);
  const sub = o.sub === undefined ? v.poweredBy : o.sub;
  if (sub) { const by = doc.createElement('span'); by.className = 'says-by'; by.textContent = sub; tx.append(by); }
  b.append(ico, tx);
  return b;
}

/** Put a badge at the top of `parent` (once). Does nothing when ?says=0. Returns the badge, or null. */
export function addBadge(parent: HTMLElement, id: VoiceId, o: { sub?: string | null; params?: URLSearchParams; after?: Element | null; before?: Element | null } = {}): HTMLElement | null {
  if (!saysOn(o.params)) return null;
  const old = parent.querySelector(`:scope > .says-line > .says[data-voice="${id}"]`);
  if (old) { const by = old.querySelector('.says-by'); if (o.sub && by) by.textContent = o.sub; return old as HTMLElement; }
  const doc = parent.ownerDocument, line = doc.createElement('div'); line.className = 'says-line';
  const b = sayBadge(id, { doc, sub: o.sub }); line.append(b);
  if (o.after) o.after.after(line); else if (o.before) o.before.before(line); else parent.prepend(line);
  return b;
}

/** A small name tag (icon and name) for a character or a speaker in a list. */
export function nameTag(id: VoiceId, doc: Document = document): HTMLElement {
  ensureSaysStyle(doc);
  const v = VOICES[id], t = doc.createElement('span'); t.className = 'says-name'; t.dataset.voice = id;
  t.style.setProperty('--a', v.accent);
  const ico = doc.createElement('span'); ico.className = 'says-ico'; ico.append(svg(doc, v.icon));
  t.append(ico, doc.createTextNode(v.name));
  return t;
}

const screenIcon = (doc: Document, id: ScreenId): SVGSVGElement => {
  const s = svg(doc, SCREENS[id].icon); s.setAttribute('role', 'img'); s.setAttribute('aria-label', SCREENS[id].name); s.removeAttribute('aria-hidden'); return s;
};

/** The legend: one row per game screen, icon and name. It lists only screens that some voice uses. */
export function crewLegend(doc: Document = document): HTMLElement {
  ensureSaysStyle(doc);
  const used = new Set(Object.values(VOICE_SCREENS).flat());
  const ul = doc.createElement('ul'); ul.className = 'crew-legend'; ul.id = 'crew-legend'; ul.setAttribute('aria-label', 'Legend: the icon on the side of a card is a game screen where that guy speaks');
  const h = doc.createElement('li'); h.className = 'cl-h'; h.textContent = 'Shows up in:'; ul.append(h);
  for (const id of SCREEN_ORDER) {
    if (!used.has(id)) continue;
    const li = doc.createElement('li'); li.dataset.screen = id; li.title = SCREENS[id].name;
    const ic = svg(doc, SCREENS[id].icon); li.append(ic, doc.createTextNode(SCREENS[id].name)); ul.append(li);
  }
  return ul;
}

/** Meet the crew: the legend, then one card per main guy with a one-line job, the powered-by line and a side rail of screen icons. The cards are `ul#crew`. */
export function meetTheCrew(doc: Document = document): HTMLElement {
  ensureSaysStyle(doc);
  const wrap = doc.createElement('div'); wrap.className = 'crew-wrap'; wrap.append(crewLegend(doc));
  const ul = doc.createElement('ul'); ul.className = 'crew'; ul.id = 'crew';
  for (const id of CREW) {
    const v = VOICES[id], li = doc.createElement('li'); li.className = 'crew-card'; li.dataset.voice = id; li.style.setProperty('--a', v.accent);
    const badge = sayBadge(id, { doc, sub: v.poweredBy });
    if (id === 'pip' || id === 'juno') badge.querySelector('.says-title')!.textContent = v.name;
    const job = doc.createElement('div'); job.className = 'crew-job'; job.textContent = v.job;
    const body = doc.createElement('div'); body.className = 'crew-body'; body.append(badge, job);
    const rail = doc.createElement('ul'); rail.className = 'crew-rail'; rail.setAttribute('aria-label', `${v.name} shows up in: ${VOICE_SCREENS[id].map((s) => SCREENS[s].name).join(', ')}`);
    for (const sc of VOICE_SCREENS[id]) { const r = doc.createElement('li'); r.dataset.screen = sc; r.title = SCREENS[sc].name; r.append(screenIcon(doc, sc)); rail.append(r); }
    li.append(body, rail); ul.append(li);
  }
  wrap.append(ul);
  return wrap;
}

/** A dialog with the crew strip (welcome page). Esc or the Close button shuts it. Returns the dialog. */
export function openCrewDialog(doc: Document = document): HTMLElement {
  const old = doc.getElementById('crew-dialog'); if (old) return old;
  ensureSaysStyle(doc);
  const shade = doc.createElement('div'); shade.id = 'crew-dialog'; shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-label', 'Meet the crew');
  shade.style.cssText = 'position:fixed;inset:0;z-index:90;background:#0e1412b8;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
  const card = doc.createElement('div'); card.style.cssText = 'background:#f6f8f5;color:#17201d;border-radius:18px;padding:16px 18px;width:min(1000px,94vw);max-height:88vh;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:10px;box-shadow:0 20px 60px #0006';
  const h = doc.createElement('h2'); h.textContent = 'Meet the crew'; h.style.cssText = 'margin:0;font-size:24px';
  const p = doc.createElement('p'); p.textContent = 'Every message in the game says who is speaking. These are the guys behind them.'; p.style.cssText = 'margin:0;color:#44504a;font-size:15px';
  const close = doc.createElement('button'); close.type = 'button'; close.id = 'crew-close'; close.textContent = 'Close';
  close.style.cssText = 'justify-self:end;font:700 15px system-ui,sans-serif;border:0;border-radius:10px;padding:8px 18px;background:#0f6b5c;color:#fff;cursor:pointer';
  const shut = () => { shade.remove(); doc.removeEventListener('keydown', onKey, true); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
  doc.addEventListener('keydown', onKey, true); close.onclick = shut; closeOnBackdrop(shade, shut);
  card.append(h, p, meetTheCrew(doc), close); shade.append(card); doc.body.append(shade); close.focus();
  return shade;
}
