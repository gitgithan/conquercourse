import { labsOn } from './labs';
import { soundButton, startAudio } from './audio';
import { mountWorldGallery } from './world-picker';
import { LAB_GROUPS, LAB_LIST, TIERS } from './labs-series';
import { mountLabFlow } from './lab-flow';

// CC-118: one bar on every Lab page that lists the Labs, marks the one you are in and switches with one click.
// A switch is a plain link, so the browser itself closes the old Lab (workers, listeners, audio) and the Dojo music rule for lab-* modes runs again on the new page.
export const LABS: readonly { mode: string; name: string }[] = LAB_LIST; // number = place in the list (stable); the sections come from labs-series.ts

export const labNumber = (mode: string): number => LABS.findIndex((l) => l.mode === mode) + 1; // 0 when it is not a Lab
export const labHref = (mode: string): string => `?mode=${mode}&labs=1&welcome=0`;

/** The Labs either side of this one; the ends do not wrap, so the buttons switch off there. */
export function labNeighbours(mode: string): { prev: string | null; next: string | null } {
  const i = labNumber(mode) - 1;
  if (i < 0) return { prev: null, next: null };
  return { prev: LABS[i - 1]?.mode ?? null, next: LABS[i + 1]?.mode ?? null };
}

export interface NavTier { id: string; title: string; groups: { id: string; title: string; labs: { n: number; mode: string; name: string }[] }[] }
/** The strip's layout as data: one block per tier, one run of chips per sub-header (empty ones left out), every Lab once, in number order inside its sub-header. */
export function navLayout(): NavTier[] {
  return TIERS.map((t) => ({
    id: t.id, title: t.title,
    groups: LAB_GROUPS.filter((g) => g.tier === t.id && g.modes.length).map((g) => ({
      id: g.id, title: g.title,
      labs: [...g.modes].map((m) => ({ n: labNumber(m), mode: m, name: LAB_LIST.find((l) => l.mode === m)!.name })).sort((x, y) => x.n - y.n),
    })),
  })).filter((t) => t.groups.length);
}

/** The strip is a few short wrapped rows, not one line; its height is measured and shared as --labs-nav-h, which every Lab's top offset reads. */
const FALLBACK_HEIGHT = 96;

/** Mount the bar on a Lab page; pass the Lab's mode (the same text as its root id). Does nothing when the Labs are switched off. */
export function mountLabsNav(host: HTMLElement, mode: string, labsEnabled: boolean = labsOn()): HTMLElement | null {
  if (!labsEnabled || labNumber(mode) === 0) return null;
  const labRoot = host.querySelector<HTMLElement>('#' + mode);
  if (labRoot) queueMicrotask(() => mountLabFlow(labRoot, mode)); // the Lab builds its page right after this call
  document.documentElement.style.setProperty('--labs-nav-h', `${FALLBACK_HEIGHT}px`);
  const style = document.createElement('style');
  style.textContent = `
    #labs-nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;gap:8px;align-items:flex-start;padding:4px 10px;background:#17201d;color:#fff;font:12px/1.2 system-ui,sans-serif;box-sizing:border-box}
    #labs-nav a{color:#fff;text-decoration:none;border:1px solid #4a5650;border-radius:5px;padding:2px 6px;white-space:nowrap}
    #labs-nav button{font:inherit;color:#fff;background:#0f6b5c;border:1px solid #0f6b5c;border-radius:5px;padding:2px 8px;font-weight:700;cursor:pointer}
    #labs-nav button:hover{background:#12806d}#labs-nav button:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #labs-nav a:hover{background:#2c3833}#labs-nav a:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #labs-nav a[aria-current=page]{background:#0f6b5c;border-color:#0f6b5c;font-weight:700}
    #labs-nav a[aria-disabled=true]{opacity:.4;pointer-events:none}
    #labs-nav .ctl{display:flex;flex-direction:column;gap:3px;align-items:stretch;text-align:center}
    #labs-nav .tiers{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
    #labs-nav .tier{display:flex;gap:8px;align-items:flex-start}
    #labs-nav .tier-name{flex:0 0 84px;color:#ffd27a;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding-top:3px}
    #labs-nav .chips{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:3px 12px}
    #labs-nav .group{display:flex;flex-wrap:wrap;align-items:center;gap:3px}
    #labs-nav .group-name{color:#9fd8c9;font-weight:600;padding-right:2px}`;
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
  const list = document.createElement('div');
  list.className = 'tiers';
  for (const t of navLayout()) { // a labelled row (wrapping) per tier; the numbers stay the stable ids
    const row = document.createElement('div');
    row.className = 'tier'; row.dataset.tier = t.id;
    const tn = document.createElement('span');
    tn.className = 'tier-name'; tn.textContent = t.title;
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const g of t.groups) {
      const box = document.createElement('div');
      box.className = 'group'; box.dataset.group = g.id;
      const h = document.createElement('span');
      h.className = 'group-name'; h.textContent = g.title;
      box.appendChild(h);
      for (const lab of g.labs) {
        const a = link(`${lab.n}. ${lab.name}`, lab.mode, `Lab ${lab.n}: ${lab.name} (${t.title}: ${g.title})`);
        a.dataset.lab = lab.mode; a.title = `${t.title}: ${g.title}`;
        if (lab.mode === mode) { a.setAttribute('aria-current', 'page'); a.removeAttribute('href'); }
        box.appendChild(a);
      }
      chips.appendChild(box);
    }
    row.append(tn, chips);
    list.appendChild(row);
  }
  // Courses: the same gallery the other pages open, so a Lab is never a dead end (picking a course leaves the Lab)
  const gallery = mountWorldGallery(host, { current: { value: null }, place: 'display:none' });
  const courses = document.createElement('button');
  courses.id = 'labs-courses'; courses.type = 'button'; courses.textContent = 'Courses'; courses.title = 'Pick a course and go back to the game'; courses.onclick = () => gallery.open();
  const ctl = document.createElement('div');
  ctl.className = 'ctl';
  ctl.append(courses, prevA, nextA);
  nav.append(ctl, list);
  host.appendChild(nav);
  startAudio(); host.appendChild(soundButton()); // the Dojo loop already plays on Lab pages (src/ui/music.ts); this gives it the Dojo's Sound button and M key
  const root = document.getElementById(mode); // the Lab fills the screen; start it under the bar (one shared variable, measured, so a taller strip pushes every Lab down)
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
