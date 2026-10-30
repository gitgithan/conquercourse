import { flag, pageQuery } from '../flags';
import { currentWorld, mayLeaveCourse, mountWorldGallery } from './world-picker';

// One top bar on every page (CC-246): the four features by the same names everywhere, with the one you are on marked.
// Looks only: it never reads a key and never touches the run. ?nav=0 hides it (films and test runs).
export type Feature = 'editor' | 'slicer' | 'courses' | 'community';

export interface FeatureTab { id: Feature; label: string; hint: string; href: string | null } // href null: the tab opens the Courses gallery

export const FEATURES: FeatureTab[] = [
  { id: 'courses', label: 'Courses', hint: 'Pick a course and run it', href: null },
  { id: 'editor', label: 'World Editor', hint: 'Build a course from real objects', href: '?mode=editor&welcome=0' },
  { id: 'slicer', label: 'World Slicer', hint: 'Cut a lane out of a real place', href: '?mode=map&welcome=0' },
  { id: 'community', label: 'Community', hint: 'Wallpapers and 3D objects made from real photos', href: '?mode=communities&welcome=0' },
];

/** Which tab is marked on a page (the Dojo and the rest are not one of the four, so no tab is marked there). */
export function featureOf(mode: string | null): Feature | null {
  switch (mode ?? 'course') {
    case 'course': return 'courses';
    case 'editor': return 'editor';
    case 'map': return 'slicer';
    case 'communities': case 'gallery': case 'park': return 'community';
    default: return null;
  }
}

const BAR_MODES = new Set(['course', 'editor', 'map', 'communities', 'gallery', 'park', 'dojo']);

/** True when the bar is drawn: not for films, bots, demos or ?nav=0, and only on the pages that have the bar. */
export function navOn(params: URLSearchParams): boolean {
  if (params.get('nav') === '0') return false;
  if (params.has('demo') || params.has('bot') || params.has('film')) return false;
  return BAR_MODES.has(params.get('mode') ?? 'course');
}

const STYLE = `
#sitenav{position:fixed;z-index:30;left:50%;top:6px;transform:translateX(-50%);display:flex;gap:2px;align-items:center;padding:3px;border-radius:14px;background:#fffdf7f2;border:1px solid #cfd6d0;box-shadow:0 4px 18px #10182026;font:600 13px system-ui,sans-serif}
#sitenav a,#sitenav button{font:inherit;color:#17201d;background:none;border:0;border-radius:10px;padding:5px 12px;cursor:pointer;text-decoration:none;white-space:nowrap}
#sitenav a:hover,#sitenav button:hover{background:#e8efe9}
#sitenav a:focus-visible,#sitenav button:focus-visible{outline:3px solid #f0a020;outline-offset:1px}
#sitenav [aria-current=page]{background:#0f6b5c;color:#fff}
html[data-sitenav=editor] #sitenav{top:58px}
html[data-sitenav] #courses-btn{display:none}
`;

/** Draws the bar. The Courses tab opens the same gallery the old corner button opened. */
export function mountSiteNav(parent: HTMLElement, mode: string | null = flag('mode')): HTMLElement | null {
  if (!navOn(pageQuery())) return null;
  if (!document.getElementById('sitenav-style')) { const st = document.createElement('style'); st.id = 'sitenav-style'; st.textContent = STYLE; document.head.append(st); }
  document.documentElement.dataset.sitenav = mode ?? 'course';
  const here = featureOf(mode);
  // the Courses tab opens the gallery the page already has; a page without one (the new Dojo) gets its own, hidden
  const own = document.getElementById('courses-btn') ? null : mountWorldGallery(parent, { current: currentWorld(pageQuery()), place: 'display:none' });
  const openGallery = () => { if (own) own.open(); else document.getElementById('courses-btn')?.click(); };
  const bar = document.createElement('nav');
  bar.id = 'sitenav'; bar.setAttribute('aria-label', 'Main features');
  for (const f of FEATURES) {
    const tab = f.href === null ? document.createElement('button') : Object.assign(document.createElement('a'), { href: f.href });
    tab.textContent = f.label; tab.title = f.hint; tab.dataset.feature = f.id;
    if (tab instanceof HTMLButtonElement) tab.type = 'button';
    if (f.id === here) tab.setAttribute('aria-current', 'page');
    if (f.href === null) tab.onclick = openGallery;
    else tab.addEventListener('click', (e) => { if (f.id === here) { e.preventDefault(); return; } if (!mayLeaveCourse()) e.preventDefault(); });
    bar.append(tab);
  }
  parent.append(bar);
  return bar;
}
