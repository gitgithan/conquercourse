import { labsOn } from './labs';
import { soundButton, startAudio } from './audio';
import { mountWorldGallery } from './world-picker';
import { LAB_GROUPS, LAB_LIST, TIERS } from './labs-series';
import { mountLabFlow } from './lab-flow';

// CC-118: one bar on every Lab page that lists the 12 Labs, marks the one you are in and switches with one click.
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

const BAR_HEIGHT = 44;

/** Mount the bar on a Lab page; pass the Lab's mode (the same text as its root id). Does nothing when the Labs are switched off. */
export function mountLabsNav(host: HTMLElement, mode: string, labsEnabled: boolean = labsOn()): HTMLElement | null {
  if (!labsEnabled || labNumber(mode) === 0) return null;
  const labRoot = host.querySelector<HTMLElement>('#' + mode);
  if (labRoot) queueMicrotask(() => mountLabFlow(labRoot, mode)); // the Lab builds its page right after this call
  const style = document.createElement('style');
  style.textContent = `
    #labs-nav{position:fixed;top:0;left:0;right:0;height:${BAR_HEIGHT}px;z-index:40;display:flex;gap:6px;align-items:center;padding:0 10px;background:#17201d;color:#fff;font:13px/1.2 system-ui,sans-serif;box-sizing:border-box}
    #labs-nav a{color:#fff;text-decoration:none;border:1px solid #4a5650;border-radius:6px;padding:5px 8px;white-space:nowrap}
    #labs-nav button{font:inherit;color:#fff;background:#0f6b5c;border:1px solid #0f6b5c;border-radius:6px;padding:5px 10px;font-weight:700;cursor:pointer}
    #labs-nav button:hover{background:#12806d}#labs-nav button:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #labs-nav a:hover{background:#2c3833}#labs-nav a:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #labs-nav a[aria-current=page]{background:#0f6b5c;border-color:#0f6b5c;font-weight:700}
    #labs-nav a[aria-disabled=true]{opacity:.4;pointer-events:none}
    #labs-nav .list{display:flex;gap:4px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:thin}
    #labs-nav .list a{padding:5px 7px}
    #labs-nav .group{color:#9fd8c9;font-weight:700;white-space:nowrap;padding:0 4px 0 10px;border-left:1px solid #4a5650;margin-left:4px}#labs-nav .group:first-child{border-left:0;margin-left:0}#labs-nav .group.tier{color:#ffd27a;text-transform:uppercase;letter-spacing:.04em}#labs-nav .group.sub{color:#9fd8c9;font-weight:600}#labs-nav .group.gap{color:#8a958f;font-weight:400}`;
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
  list.className = 'list';
  for (const t of TIERS) { // two tiers (Foundations, Pipelines), each with sub-headers; the numbers stay the stable ids
    const th = document.createElement('span');
    th.className = 'group tier'; th.textContent = t.title; th.dataset.tier = t.id;
    list.appendChild(th);
    for (const g of LAB_GROUPS.filter((x) => x.tier === t.id)) {
      const h = document.createElement('span');
      h.className = 'group sub'; h.textContent = g.title; h.dataset.group = g.id;
      list.appendChild(h);
      if (!g.modes.length) { const gap = document.createElement('span'); gap.className = 'group gap'; gap.textContent = '(no Lab planned)'; list.appendChild(gap); }
      for (const m of g.modes) {
        const lab = LAB_LIST.find((l) => l.mode === m)!, n = LAB_LIST.indexOf(lab) + 1;
        const a = link(`${n}. ${lab.name}`, lab.mode, `Lab ${n}: ${lab.name} (${t.title}: ${g.title})`);
        a.dataset.lab = lab.mode; a.title = `${t.title}: ${g.title}`;
        if (lab.mode === mode) { a.setAttribute('aria-current', 'page'); a.removeAttribute('href'); }
        list.appendChild(a);
      }
    }
  }
  // Courses: the same gallery the other pages open, so a Lab is never a dead end (picking a course leaves the Lab)
  const gallery = mountWorldGallery(host, { current: { value: null }, place: 'display:none' });
  const courses = document.createElement('button');
  courses.id = 'labs-courses'; courses.type = 'button'; courses.textContent = 'Courses'; courses.title = 'Pick a course and go back to the game'; courses.onclick = () => gallery.open();
  nav.append(courses, prevA, list, nextA);
  host.appendChild(nav);
  startAudio(); host.appendChild(soundButton()); // the Dojo loop already plays on Lab pages (src/ui/music.ts); this gives it the Dojo's Sound button and M key
  const root = document.getElementById(mode); // the Lab fills the screen; start it under the bar
  if (root) root.style.top = `${BAR_HEIGHT}px`;
  list.querySelector('[aria-current=page]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  // [ and ] go to the previous and next Lab (not while typing)
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    const go = e.key === '[' ? prev : e.key === ']' ? next : null;
    if (go) location.assign(labHref(go));
  });
  return nav;
}
