import { pageQuery } from '../flags';
import { FEATURES, type Feature } from '../ui/site-nav';
import { browserStore, entranceOn } from '../ui/onboarding-flags';
import { startHref } from '../ui/welcome-flags';
import { saysOn } from '../ui/says';
import { crewCardsOn, openCrewDialog } from '../ui/crew-dialog';
import { mountWorldGallery } from '../ui/world-picker';

// The welcome screen (CC-246): the logo, the two Rookies, and the four features as a 2x2 grid.
// The page is plain HTML and paints at once; the 3D background loads after it (welcome-scene.ts).
// Hover or focus a tile for three highlights; click it to go straight in; any other key or click starts the First Course.

interface Tile { id: Feature; line: string; points: [string, string, string] }

export const TILES: Tile[] = [
  { id: 'courses', line: 'Run, jump, vault and swing.', points: ['Pick a course and race the clock', 'Speed, height and timing all matter', 'New courses to try all the time'] },
  { id: 'editor', line: 'Build a course from real objects.', points: ['Drop benches, rails and walls', 'The game checks the course can be beaten', 'Play it, then share it'] },
  { id: 'slicer', line: 'Cut a lane out of a real place.', points: ['Pick a spot on a real map', 'Slice out one lane of it', 'Run the lane you cut'] },
  { id: 'community', line: 'See what other players made.', points: ['3D objects from real photos', 'Courses built by other players', 'Make an object from your own photo'] },
];

const CSS = `
#welcome{position:fixed;inset:0;overflow:hidden;font:16px/1.4 system-ui,sans-serif;color:#17201d;background:linear-gradient(#7fb4e6,#cfe6f7 55%,#8fc46c 55%,#6aa84f)}
#welcome-scene{position:absolute;inset:0}
#welcome-scene canvas{display:block;width:100%;height:100%}
#welcome-ui{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding-top:18px;height:100%;box-sizing:border-box;pointer-events:none}
#welcome-ui>*{pointer-events:auto}
#welcome-logo{width:320px;height:auto;border-radius:18px;box-shadow:0 8px 28px #10182055}
#welcome-tag{margin:8px 0 14px;font:800 30px system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 #14181f,0 4px 14px #14181f99;letter-spacing:.5px}
#welcome-grid{display:grid;grid-template-columns:repeat(2,420px);gap:16px 20px}
.wtile.wide{grid-column:1 / -1;height:84px}
.wtile.wide img{width:150px;height:78px;border-radius:15px 0 0 15px}
.wtile.wide .wtext{padding:8px 14px;gap:2px}
.wtile.wide .wtext b{font-size:20px}
.wtile{position:relative;display:flex;gap:0;height:170px;padding:0;text-align:left;font:inherit;color:inherit;text-decoration:none;background:#fffdf7;border:3px solid #17201d;border-radius:18px;box-shadow:0 6px 0 #17201d,0 10px 24px #10182040;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
.wtile:hover,.wtile:focus-visible{transform:translateY(-4px) scale(1.04);box-shadow:0 10px 0 #17201d,0 16px 30px #10182055;z-index:5;outline:none}
.wtile:focus-visible{border-color:#f0a020}
.wtile img{width:200px;height:164px;object-fit:cover;border-radius:15px 0 0 15px;background:#cfe6f7;display:block}
.wtext{flex:1;padding:14px 14px 10px;display:flex;flex-direction:column;justify-content:center;gap:6px}
.wtext b{font:800 22px system-ui,sans-serif}
.wtext span{font:15px/1.35 system-ui,sans-serif;color:#3b4943}
.wpop{position:absolute;left:10px;right:10px;top:calc(100% - 4px);margin:0;padding:10px 14px 10px 30px;list-style:disc;background:#fff6d8;border:3px solid #17201d;border-radius:14px;font:600 14px/1.45 system-ui,sans-serif;opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .15s ease,transform .15s ease,visibility .15s}
.wtile:hover .wpop,.wtile:focus-visible .wpop{opacity:1;visibility:visible;transform:none}
#welcome-hint{margin-top:auto;margin-bottom:14px;padding:8px 22px;border-radius:999px;background:#14181fd9;color:#fff;font:700 18px system-ui,sans-serif;animation:wpulse 1.8s ease-in-out infinite}
#welcome-crew{position:absolute;z-index:2;top:18px;right:20px;font:800 16px system-ui,sans-serif;color:#17201d;background:#fffdf7;border:3px solid #17201d;border-radius:999px;padding:7px 18px;box-shadow:0 4px 0 #17201d;cursor:pointer}
#welcome-crew:hover,#welcome-crew:focus-visible{transform:translateY(-2px)}
@keyframes wpulse{50%{transform:scale(1.05)}}
@media (prefers-reduced-motion:reduce){#welcome-hint{animation:none}.wtile{transition:none}}
`;

export function startWelcome(host: HTMLElement): void {
  if (!document.getElementById('welcome-style')) { const st = document.createElement('style'); st.id = 'welcome-style'; st.textContent = CSS; document.head.append(st); }
  const root = document.createElement('main');
  root.id = 'welcome';
  const scene = document.createElement('div'); scene.id = 'welcome-scene'; scene.setAttribute('aria-hidden', 'true');
  const ui = document.createElement('div'); ui.id = 'welcome-ui';
  ui.innerHTML = `<img id="welcome-logo" src="/brand/conquercourse-logo.svg" alt="ConquerCourse" width="360" height="113"><h1 id="welcome-tag">Train slow. Run fast.</h1>`;
  const grid = document.createElement('nav'); grid.id = 'welcome-grid'; grid.setAttribute('aria-label', 'Main features');
  for (const t of TILES) {
    const f = FEATURES.find((x) => x.id === t.id)!;
    const el: HTMLElement = f.href === null ? Object.assign(document.createElement('button'), { type: 'button' }) : Object.assign(document.createElement('a'), { href: f.href });
    el.className = 'wtile'; el.dataset.feature = f.id;
    el.innerHTML = `<img src="/assets/welcome/${f.id}.webp" alt="" width="200" height="164" loading="eager" decoding="async"><span class="wtext"><b></b><span></span></span><ul class="wpop"></ul>`;
    el.querySelector('b')!.textContent = f.label;
    el.querySelector('.wtext span')!.textContent = t.line;
    el.querySelector('.wpop')!.append(...t.points.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
    el.querySelector('img')!.addEventListener('error', (e) => { (e.target as HTMLElement).style.visibility = 'hidden'; });
    if (f.href === null) el.onclick = () => mountWorldGallery(document.body, { current: { value: null }, place: 'display:none' }).open();
    grid.append(el);
  }
  if (entranceOn(pageQuery(), location.hostname)) { // the fifth tile: the Making Of tunnel (CC-133)
    const a = Object.assign(document.createElement('a'), { href: '/making-of/timeline.html', className: 'wtile wide' });
    a.dataset.feature = 'entrance';
    a.innerHTML = `<img src="/assets/thumbs/making-timeline.webp" alt="" width="150" height="78" loading="eager" decoding="async"><span class="wtext"><b>The Grand Entrance</b><span>Walk the story of how this game was made.</span></span>`;
    a.querySelector('img')!.addEventListener('error', (e) => { (e.target as HTMLElement).style.visibility = 'hidden'; });
    grid.append(a);
  }
  const hint = document.createElement('div'); hint.id = 'welcome-hint'; hint.textContent = 'Press any key or click to start the first course';
  ui.append(grid, hint);
  if (saysOn() || crewCardsOn()) { // the ten built-in characters (old look: CC-243, who speaks in the game)
    const crew = Object.assign(document.createElement('button'), { type: 'button', id: 'welcome-crew', textContent: 'Meet the crew' });
    crew.onclick = () => openCrewDialog();
    root.append(crew);
  }
  root.append(scene, ui);
  host.append(root);

  let started = false;
  const start = () => { if (started) return; started = true; location.href = startHref(browserStore); };
  const overlayOpen = () => !!document.getElementById('world-gallery') || !!document.getElementById('crew-dialog') || !!document.getElementById('cc-feedback');
  const interactive = (t: EventTarget | null) => t instanceof Element && !!t.closest('a,button,input,textarea,select,[role=dialog]');
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab' || e.key === 'Shift' || e.key === 'Escape') return;
    if (overlayOpen() || (interactive(e.target) && (e.key === 'Enter' || e.key === ' '))) return;
    start();
  });
  addEventListener('click', (e) => { if (overlayOpen() || interactive(e.target)) return; start(); });

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the heavy part comes after the first paint
  const load = () => import('./welcome-scene').then((m) => m.mountWelcomeScene(scene, still)).catch(() => { /* the gradient stays */ });
  if ('requestIdleCallback' in window) (window as unknown as { requestIdleCallback(f: () => void, o: { timeout: number }): void }).requestIdleCallback(load, { timeout: 800 }); else setTimeout(load, 100);
}
