import { labsOn } from './labs';
import { soundButton, startAudio } from './audio';
import { mountWorldGallery } from './world-picker';

// CC-118: one bar on every Lab page that lists the 12 Labs, marks the one you are in and switches with one click.
// A switch is a plain link, so the browser itself closes the old Lab (workers, listeners, audio) and the Dojo music rule for lab-* modes runs again on the new page.
export const LABS: readonly { mode: string; name: string }[] = [
  { mode: 'lab-search', name: 'Search' },
  { mode: 'lab-optimization', name: 'Optimization' },
  { mode: 'lab-ik', name: 'Posing a character' },
  { mode: 'lab-vision', name: 'Computer vision' },
  { mode: 'lab-camera', name: 'Camera and perspective' },
  { mode: 'lab-integration', name: 'Numerical integration' },
  { mode: 'lab-timing', name: 'Statistics of timing' },
  { mode: 'lab-signal', name: 'Signal processing' },
  { mode: 'lab-gentest', name: 'Generate and test' },
  { mode: 'lab-detector', name: 'Evaluating a detector' },
  { mode: 'lab-hashing', name: 'Verification and hashing' },
  { mode: 'lab-rl', name: 'Reinforcement learning' },
];

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
    #labs-nav .list a{padding:5px 7px}`;
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
  for (const [i, lab] of LABS.entries()) {
    const a = link(`${i + 1}. ${lab.name}`, lab.mode, `Lab ${i + 1}: ${lab.name}`);
    a.dataset.lab = lab.mode;
    if (lab.mode === mode) { a.setAttribute('aria-current', 'page'); a.removeAttribute('href'); }
    list.appendChild(a);
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
