import { labsOn } from './labs';
import { soundButton, startAudio } from './audio';
import { mountWorldGallery } from './world-picker';
import { LAB_LIST } from './labs-series';
import { mountLabFlow } from './lab-flow';
import { labHref, labNeighbours, labNumber } from './labs-nav-data';
import { labIconSvg } from './labs-icons';
import { mountLabsPanel } from './labs-panel';

export { LABS, labNumber, labHref, labNeighbours, navLayout, type NavTier } from './labs-nav-data';

// CC-118 / CC-133: a slim bar on every Lab page: the Lab you are in, a Labs button that slides the whole map down from the top, Previous, Next and Courses.
// A switch is a plain link, so the browser itself closes the old Lab (workers, listeners, audio) and the Dojo music rule for lab-* modes runs again on the new page.
/** The slim bar's height; it is measured and shared as --labs-nav-h, which every Lab's top offset reads. */
const FALLBACK_HEIGHT = 34;

/** Mount the bar on a Lab page; pass the Lab's mode (the same text as its root id). Does nothing when the Labs are switched off. */
export function mountLabsNav(host: HTMLElement, mode: string, labsEnabled: boolean = labsOn()): HTMLElement | null {
  if (!labsEnabled || labNumber(mode) === 0) return null;
  const labRoot = host.querySelector<HTMLElement>('#' + mode);
  if (labRoot) queueMicrotask(() => mountLabFlow(labRoot, mode)); // the Lab builds its page right after this call
  document.documentElement.style.setProperty('--labs-nav-h', `${FALLBACK_HEIGHT}px`);
  const style = document.createElement('style');
  style.textContent = `
    #labs-nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;gap:8px;align-items:center;height:${FALLBACK_HEIGHT}px;padding:0 10px;background:#17201d;color:#fff;font:13px/1.2 system-ui,sans-serif;box-sizing:border-box}
    #labs-nav a{color:#fff;text-decoration:none;border:1px solid #4a5650;border-radius:5px;padding:2px 8px;white-space:nowrap}
    #labs-nav button{font:inherit;color:#fff;background:#0f6b5c;border:1px solid #0f6b5c;border-radius:5px;padding:2px 10px;font-weight:700;cursor:pointer}
    #labs-nav button:hover{background:#12806d}#labs-nav button:focus-visible,#labs-nav a:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #labs-nav a:hover{background:#2c3833}
    #labs-nav a[aria-disabled=true]{opacity:.4;pointer-events:none}
    #labs-nav .now{display:flex;gap:8px;align-items:center;min-width:0;font-weight:700}#labs-nav .now svg{flex:0 0 auto;width:24px;height:24px;border-radius:5px}
    #labs-nav .now span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #labs-nav .sp{flex:1}`;
  document.head.appendChild(style);
  const nav = document.createElement('nav');
  nav.id = 'labs-nav';
  nav.setAttribute('aria-label', 'Labs');
  const { prev, next } = labNeighbours(mode);
  const link = (text: string, target: string | null, label: string): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.textContent = text;
    a.setAttribute('aria-label', label);
    if (target) a.href = labHref(target); else a.setAttribute('aria-disabled', 'true');
    return a;
  };
  const prevA = link('Previous', prev, 'Previous Lab');
  prevA.id = 'labs-prev';
  const nextA = link('Next', next, 'Next Lab');
  nextA.id = 'labs-next';
  const now = document.createElement('div');
  now.className = 'now'; now.id = 'labs-now';
  now.innerHTML = `${labIconSvg(mode, 24)}<span>${LAB_LIST.find((l) => l.mode === mode)!.name}</span>`;
  // Courses: the same gallery the other pages open, so a Lab is never a dead end (picking a course leaves the Lab)
  const gallery = mountWorldGallery(host, { current: { value: null }, place: 'display:none' });
  const courses = document.createElement('button');
  courses.id = 'labs-courses'; courses.type = 'button'; courses.textContent = 'Courses'; courses.title = 'Pick a course and go back to the game'; courses.onclick = () => gallery.open();
  const panel = mountLabsPanel(host, mode, (open) => labsBtn.setAttribute('aria-expanded', String(open)));
  const labsBtn = document.createElement('button');
  labsBtn.id = 'labs-open'; labsBtn.type = 'button'; labsBtn.textContent = 'Labs'; labsBtn.title = 'All the Labs on one page'; labsBtn.setAttribute('aria-expanded', 'false'); labsBtn.setAttribute('aria-controls', 'labs-panel');
  labsBtn.onclick = () => panel.toggle();
  const sp = document.createElement('span'); sp.className = 'sp';
  nav.append(now, labsBtn, sp, prevA, nextA, courses);
  host.appendChild(nav);
  if (/[?&]panel=1(?:&|$)/.test(location.search)) panel.open(); // the old ?mode=labs-map link lands here
  (window as unknown as { __labsPanel?: unknown }).__labsPanel = panel;
  startAudio(); host.appendChild(soundButton()); // the Dojo loop already plays on Lab pages (src/ui/music.ts); this gives it the Dojo's Sound button and M key
  const root = document.getElementById(mode); // the Lab fills the screen; start it under the bar (one shared variable, measured, so a taller bar pushes every Lab down)
  if (root) root.style.top = 'var(--labs-nav-h)';
  const fit = () => document.documentElement.style.setProperty('--labs-nav-h', `${nav.offsetHeight}px`);
  fit(); addEventListener('resize', fit);
  // [ and ] go to the previous and next Lab (not while typing)
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    const go = e.key === '[' ? prev : e.key === ']' ? next : null;
    if (go) location.assign(labHref(go));
  });
  return nav;
}
