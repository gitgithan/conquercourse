// The first-visit tour, the Help chip and the "What next" card (CC-100). Plain words, no formulas, no grading.
// The Course keeps its own keys: while the tour is open the game waits (the same event the Courses gallery uses),
// the camera keys still work so the first step can be tried, and every other key only lights up its chip.
import type { CourseData } from '../course/course';
import { FALL_SEEN, NEXT_SEEN, TOUR_DONE, TOUR_STEP_S, onboardingOn, type Store } from './onboarding-flags';

export interface Move { keys: string[]; label: string; codes: string[] }

/** The keys this course can use, read from its shape (a step up needs V, a bar or a drone needs E, a big drop needs X, a launcher needs K). */
export function movesFor(course: CourseData): Move[] {
  const out: Move[] = [
    { keys: ['← →'], label: 'Run', codes: ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'] },
    { keys: ['Space'], label: 'Jump', codes: ['Space', 'ArrowUp', 'KeyW'] },
  ];
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  let vault = false, drop = false, climb = false;
  ps.forEach((p, i) => {
    const n = ps[i + 1]; if (!n) return;
    const rise = n.top - p.top, gap = n.x0 - p.x1;
    if (gap <= 0.15 && rise >= 0.35 && rise <= 1.3) vault = true;
    if (gap <= 0.15 && rise > 1.3) climb = true;
    if (rise < -1.8) drop = true;
  });
  if (course.holds?.length || course.drone || climb) out.push({ keys: ['E'], label: 'Hold on', codes: ['KeyE'] });
  if (vault) out.push({ keys: ['V'], label: 'Vault', codes: ['KeyV'] });
  if (drop) out.push({ keys: ['X'], label: 'Roll', codes: ['KeyX'] });
  if (course.recoil) out.push({ keys: ['K'], label: 'Fire', codes: ['KeyK'] });
  return out;
}

export interface OnboardingEnv {
  params: URLSearchParams; store: Store; course: CourseData;
  tour: boolean; // the decision from tourDecision: open the tour now
  openCourses(): void; toggleKeys(): void;
  resetRun?(): void; // the run clock starts again when the tour closes (the tour's seconds are not the player's time)
}
export interface Onboarding { onCleared(panel: HTMLElement | null): void; onFall(panel?: HTMLElement | null): void; replay(): void; destroy(): void }

const CSS = `
#tour,#ccnext,#ccfirstfall,#helpmenu{font:500 15px/1.4 system-ui,sans-serif;color:#17201d;box-sizing:border-box}
#tour{position:fixed;z-index:900;left:clamp(340px,34vw,440px);top:164px;width:clamp(340px,calc(100vw - 770px),460px);background:#fffffff7;border:1px solid #cfd6d0;border-radius:16px;box-shadow:0 8px 30px #0003;padding:14px 16px 12px;display:grid;gap:8px}
#tour h2{margin:0;font:800 20px/1.15 system-ui,sans-serif;letter-spacing:-.02em}
#tour p,#ccnext p{margin:0}
#tour .dots{display:flex;gap:5px;align-items:center;color:#58635d;font-size:13px}
#tour .dots i{width:8px;height:8px;border-radius:50%;background:#cfd6d0}#tour .dots i.on{background:#0f6b5c}
#tour .chips,#ccnext .chips{display:flex;flex-wrap:wrap;gap:6px}
.ccchip{display:inline-flex;align-items:center;gap:6px;border:1px solid #cfd6d0;border-radius:10px;padding:3px 8px 3px 4px;background:#f6f8f5;white-space:nowrap}
.ccchip kbd{font:700 13px ui-monospace,monospace;border:1px solid #9aa59e;border-bottom-width:2px;border-radius:6px;padding:1px 6px;background:#fff}
.ccchip.lit{background:#ffe38a;border-color:#f0b400}
#tour .bar{height:3px;border-radius:2px;background:#e3e8e3;overflow:hidden}
#tour .bar b{display:block;height:100%;width:0;background:#0f6b5c;animation:ccbar var(--s,4.5s) linear forwards}
#tour:hover .bar b,#tour:focus-within .bar b{animation-play-state:paused}
@keyframes ccbar{to{width:100%}}
#tour .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ccbtn{font:600 14px system-ui,sans-serif;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:9px;padding:6px 12px;cursor:pointer;white-space:nowrap}
.ccbtn.main{background:#0f6b5c;border-color:#0f6b5c;color:#fff}
.ccbtn:focus-visible{outline:3px solid #f0b400;outline-offset:2px}
#tour .places{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#tour .place{display:grid;grid-template-columns:34px 1fr;gap:2px 8px;align-items:center;border:1px solid #cfd6d0;border-radius:12px;padding:8px;text-align:left;background:#fff;color:inherit;font:inherit;cursor:pointer}
#tour .place:hover,#tour .place:focus-visible{border-color:#0f6b5c;background:#f0f8f5}
#tour .place svg{grid-row:span 2;width:34px;height:34px;color:#0f6b5c}
#tour .place b{font:700 14px system-ui,sans-serif}#tour .place span{font-size:12.5px;color:#58635d;line-height:1.25}
#tour .hop{width:100%;height:42px}
#chelp{position:fixed;z-index:60;right:16px;top:236px;width:36px;height:36px;border-radius:50%;border:2px solid #17201d;background:#fff;color:#17201d;font:800 18px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px #0003}
#chelp:focus-visible{outline:3px solid #f0b400;outline-offset:2px}
#helpmenu{position:fixed;z-index:61;right:16px;top:280px;width:210px;background:#fffffff7;border:1px solid #cfd6d0;border-radius:12px;box-shadow:0 6px 24px #0003;padding:6px;display:grid;gap:4px}
#helpmenu button{text-align:left}
#ccnext{display:grid;gap:10px;border-top:1px solid #d7ddd8;padding-top:10px;margin-top:10px}
#ccnext.modal{position:fixed;z-index:950;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,94vw);max-height:88vh;overflow:auto;background:#fffffff7;border:1px solid #cfd6d0;border-radius:16px;box-shadow:0 8px 30px #0004;padding:16px;margin:0}
#ccnext h3{margin:0;font:800 18px system-ui,sans-serif}
#ccnext h4{margin:0 0 4px;font:700 13px system-ui,sans-serif;color:#58635d;text-transform:uppercase;letter-spacing:.06em}
#ccnext .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
#ccnext .grp{display:grid;gap:6px;align-content:start}
#ccnext .item{display:grid;gap:4px;justify-items:start}
#ccnext .item span{font-size:13.5px;line-height:1.3}
#ccnext .ccchip{padding:2px 6px 2px 3px;font-size:13px}
#ccfirstfall.inpanel p{margin:0}#ccfirstfall.inpanel button{width:auto;justify-self:start;padding:4px 14px}#ccfirstfall.inpanel{gap:2px;position:static;width:auto;box-shadow:none;border-radius:10px;background:#f1f6f3;padding:8px 12px;margin-bottom:8px;z-index:auto}
#ccfirstfall{position:fixed;z-index:900;left:clamp(340px,34vw,440px);top:164px;width:clamp(300px,calc(100vw - 770px),420px);background:#fffffff7;border:1px solid #cfd6d0;border-radius:14px;box-shadow:0 6px 24px #0003;padding:12px 14px;display:grid;gap:6px}
@media (prefers-reduced-motion:reduce){#tour .bar b{animation-duration:.01s}}
`;

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { cls?: string } = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); const { cls, ...rest } = props as { cls?: string }; if (cls) e.className = cls; Object.assign(e, rest); e.append(...kids); return e;
};
const chip = (key: string, label: string): HTMLElement => h('span', { cls: 'ccchip' }, h('kbd', {}, key), label);
const btn = (text: string, onclick: () => void, main = false): HTMLButtonElement => { const b = h('button', { cls: 'ccbtn' + (main ? ' main' : ''), type: 'button', textContent: text }); b.onclick = onclick; return b; };
const svgIcon = (inner: string): SVGSVGElement => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner; return s; };
const ICON = {
  courses: '<rect x="4" y="4" width="10" height="10" rx="2"/><rect x="18" y="4" width="10" height="10" rx="2"/><rect x="4" y="18" width="10" height="10" rx="2"/><rect x="18" y="18" width="10" height="10" rx="2"/>',
  editor: '<path d="M5 27 H27 M9 27 V15 H15 V27 M17 27 V9 H23 V27 M16 4 V8 M14 6 H18"/>',
  explorer: '<circle cx="16" cy="16" r="11"/><path d="M5 16 H27 M16 5 C10 11 10 21 16 27 M16 5 C22 11 22 21 16 27"/>',
  community: '<rect x="5" y="9" width="16" height="12" rx="2"/><rect x="11" y="13" width="16" height="12" rx="2" fill="#fffffff0"/><path d="M15 19 H23"/>',
};
const labelOf = (code: string): string => (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' ? 'Space' : /^Arrow(Left|Right)$|^Key[AD]$/.test(code) ? '← →' : code.replace(/^Key/, ''));
const typingTarget = (e: Event): boolean => { const t = e.target as HTMLElement | null; return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };

const goTo = (store: Store, href: string): void => { store.set(TOUR_DONE, '1'); location.href = href; };

/** The "What next" card: your controls, what you can build, what you can do and share. Used under the end report and as the Help menu's tips. */
export function buildNextCard(env: Pick<OnboardingEnv, 'store' | 'course'>, title: string, onDismiss: () => void): HTMLElement {
  const card = h('section', { id: 'ccnext' }); card.setAttribute('aria-label', 'What next');
  const controls = h('div', { cls: 'chips' });
  for (const [k, l] of [['← →', 'Run'], ['Space', 'Jump'], ['E', 'Hold on'], ['V', 'Vault'], ['X', 'Roll'], ['R', 'Retry'], ['I', 'Best line'], ['C', 'Camera'], ['F', 'Corner view'], ['G', 'Drums'], ['H', 'Controls']]) controls.append(chip(k, l));
  const item = (text: string, label: string, go: () => void) => h('div', { cls: 'item' }, h('span', {}, text), btn(label, go));
  const feedback = () => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Feedback')?.click(); };
  card.append(
    h('h3', {}, title),
    h('div', { cls: 'cols' },
      h('div', { cls: 'grp' }, h('h4', {}, 'Your controls'), controls),
      h('div', { cls: 'grp' }, h('h4', {}, 'Build'),
        item('Course editor: place real objects, bars, stacks and machines, or lift an obstacle from your own photo (no people, please).', 'Open the editor', () => goTo(env.store, '?mode=editor')),
        item('World explorer: turn a real street into a course.', 'Explore a place', () => goTo(env.store, '?mode=map')),
        item('Coaster builder: draw a track and ride it.', 'Build a coaster', () => goTo(env.store, '?mode=coaster'))),
      h('div', { cls: 'grp' }, h('h4', {}, 'Do and share'),
        item('Community: play courses other players built.', 'Community courses', () => goTo(env.store, '?mode=gallery')),
        item('Tell us what you liked and what confused you.', 'Send feedback', feedback))),
    h('div', {}, btn('Got it', onDismiss, true)));
  return card;
}

/** Everything the player sees on a first visit. */
export function startOnboarding(env: OnboardingEnv): Onboarding {
  const noop: Onboarding = { onCleared() {}, onFall() {}, replay() {}, destroy() {} };
  if (!onboardingOn(env.params)) return noop;
  const style = h('style', { textContent: CSS }); document.head.append(style);
  const stepS = Number(env.params.get('tourstep')) || TOUR_STEP_S; // ?tourstep=600 holds each step (for checks)
  const moves = movesFor(env.course);
  let tourEl: HTMLElement | null = null, step = 0, timer = 0, menuEl: HTMLElement | null = null, tipsEl: HTMLElement | null = null, fallEl: HTMLElement | null = null;

  interface Step { title: string; lines: string[]; chips: [string, string][]; codes: string[]; pass: boolean; extra?: 'hop' | 'places' }
  const STEPS: Step[] = [
    { title: 'Look around', lines: ['Drag the picture to turn the view.', 'Scroll to zoom in and out.'], chips: [['C', 'Switch view'], ['F', 'Corner view']], codes: ['KeyC', 'KeyF'], pass: true },
    { title: 'Run, jump and more', lines: ['Hold a key to run. Tap another to jump.'], chips: moves.map((m) => [m.keys.join(' '), m.label] as [string, string]), codes: moves.flatMap((m) => m.codes), pass: false, extra: 'hop' },
    { title: 'Fell? Try again', lines: ['Press R to start over, as often as you like.', 'Shift+R starts the whole course again.'], chips: [['R', 'Try again']], codes: ['KeyR'], pass: true },
    { title: 'See the best line', lines: ['Press I to watch the best way over the next obstacle.', 'Shift+I shows the whole course.', 'Try it after the tour.'], chips: [['I', 'Best line']], codes: ['KeyI'], pass: false },
    { title: 'More to explore', lines: [], chips: [], codes: [], pass: false, extra: 'places' },
    { title: 'Need this again?', lines: ['Press H to hide or show the controls.', 'The ? button replays this tour and shows tips.'], chips: [['H', 'Controls'], ['?', 'Help menu']], codes: ['KeyH'], pass: true },
  ];

  const finish = () => {
    if (!tourEl) return;
    clearTimeout(timer); tourEl.remove(); tourEl = null; env.store.set(TOUR_DONE, '1'); env.resetRun?.();
  };
  const show = (i: number) => {
    step = i; clearTimeout(timer);
    const s = STEPS[i], last = i === STEPS.length - 1;
    const card = tourEl!; card.innerHTML = '';
    const dots = h('div', { cls: 'dots' }, ...STEPS.map((_, j) => h('i', { cls: j === i ? 'on' : '' })), `  ${i + 1} of ${STEPS.length}`);
    card.append(dots, h('h2', {}, s.title), ...s.lines.map((l) => h('p', {}, l)));
    if (s.extra === 'hop') { const hop = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); hop.setAttribute('viewBox', '0 0 160 60'); hop.setAttribute('class', 'hop'); hop.setAttribute('aria-hidden', 'true'); hop.innerHTML = '<path d="M2 44 H52 M108 44 H158" stroke="#58635d" stroke-width="3" stroke-linecap="round"/><circle r="5" fill="#0f6b5c"><animateMotion dur="2.2s" repeatCount="indefinite" path="M8 38 L52 38 Q80 -8 108 38 L152 38"/></circle>'; card.append(hop); }
    if (s.chips.length) { const row = h('div', { cls: 'chips' }); s.chips.forEach(([k, l]) => { const c = chip(k, l); c.dataset.keys = k; row.append(c); }); card.append(row); }
    if (s.extra === 'places') {
      const place = (icon: string, name: string, line: string, go: () => void) => { const b = h('button', { cls: 'place', type: 'button' }, svgIcon(icon), h('b', {}, name), h('span', {}, line)); b.onclick = go; return b; };
      card.append(h('div', { cls: 'places' },
        place(ICON.courses, 'Courses', 'Pick any course by picture.', () => { finish(); env.openCourses(); }),
        place(ICON.editor, 'Course editor', 'Build your own course.', () => goTo(env.store, '?mode=editor')),
        place(ICON.explorer, 'World explorer', 'Any real place becomes a course.', () => goTo(env.store, '?mode=map')),
        place(ICON.community, 'Community', 'Play what others built.', () => goTo(env.store, '?mode=gallery'))));
    }
    const bar = h('div', { cls: 'bar' }, h('b', {})); bar.style.setProperty('--s', `${stepS}s`);
    const next = btn(last ? "Let's go" : 'Next', () => (last ? finish() : show(i + 1)), true); next.id = 'tour-next';
    const skip = btn('Skip (Esc)', () => finish()); skip.id = 'tour-skip';
    card.append(bar, h('div', { cls: 'row' }, skip, next));
    timer = window.setTimeout(() => (last ? finish() : show(i + 1)), stepS * 1000);
    // hovering or focusing the card holds the clock; leaving it starts the step's time again
    card.onmouseleave = () => { clearTimeout(timer); timer = window.setTimeout(() => (last ? finish() : show(i + 1)), stepS * 1000); };
    card.onmouseenter = () => clearTimeout(timer);
  };
  const onKey = (e: KeyboardEvent) => { // while the tour or the tips card is open, only the keys the tour names reach the game, so nothing starts the run
    if (!tourEl && !tipsEl) return;
    if (e.code === 'Escape') { e.stopImmediatePropagation(); if (tourEl) finish(); else closeTips(); return; }
    if (!tourEl) { if (!typingTarget(e) && !tipsEl!.contains(e.target as Node) && e.code !== 'Tab' && !/^(Shift|Control|Alt|Meta)/.test(e.code)) { e.stopImmediatePropagation(); e.preventDefault(); } return; }
    if (typingTarget(e) || (tourEl.contains(e.target as Node) && (e.code === 'Enter' || e.code === 'Space')) || e.code === 'Tab' || /^(Shift|Control|Alt|Meta)/.test(e.code)) return;
    const s = STEPS[step];
    const label = labelOf(e.code);
    document.querySelectorAll<HTMLElement>('#tour .ccchip').forEach((c) => { if (c.dataset.keys === label) c.classList.add('lit'); });
    if (e.code === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); if (step === STEPS.length - 1) finish(); else show(step + 1); return; }
    if (s.codes.includes(e.code)) setTimeout(() => { if (tourEl && step === STEPS.indexOf(s)) { if (step === STEPS.length - 1) finish(); else show(step + 1); } }, 450);
    if (!s.pass || !s.codes.includes(e.code)) { e.stopImmediatePropagation(); e.preventDefault(); } // only the step's own camera, restart and controls keys reach the game
  };
  const start = () => {
    if (tourEl) return;
    closeMenu(); closeTips();
    tourEl = h('section', { id: 'tour' }); tourEl.setAttribute('role', 'dialog'); tourEl.setAttribute('aria-label', 'Quick tour');
    document.body.append(tourEl);
    show(0); (document.getElementById('tour-next') as HTMLElement | null)?.focus({ preventScroll: true });
  };

  // the Help chip: always there, replays the tour and shows the tips
  const chipEl = h('button', { id: 'chelp', type: 'button', textContent: '?', title: 'Help: controls, the tour, tips' }); chipEl.setAttribute('aria-haspopup', 'true'); chipEl.setAttribute('aria-expanded', 'false');
  const keysCard = () => document.getElementById('keys'); // the controls card makes way while the menu is open (the menu's first item shows it again)
  const closeMenu = () => { menuEl?.remove(); menuEl = null; chipEl.setAttribute('aria-expanded', 'false'); const k = keysCard(); if (k) k.style.visibility = ''; };
  const openMenu = () => {
    if (menuEl) { closeMenu(); return; }
    menuEl = h('div', { id: 'helpmenu' }); menuEl.setAttribute('role', 'menu');
    const it = (t: string, go: () => void) => { const b = btn(t, () => { closeMenu(); go(); }); b.setAttribute('role', 'menuitem'); return b; };
    menuEl.append(it('Controls (H)', env.toggleKeys), it('Replay the tour', start), it('What can I do?', showTips), it('Courses', env.openCourses));
    document.body.append(menuEl); { const k = keysCard(); if (k) k.style.visibility = 'hidden'; } chipEl.setAttribute('aria-expanded', 'true'); (menuEl.firstChild as HTMLElement).focus({ preventScroll: true });
  };
  chipEl.onclick = openMenu;
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && menuEl) closeMenu(); });
  document.body.append(chipEl);

  const closeTips = () => { tipsEl?.remove(); tipsEl = null; };
  function showTips() { if (tipsEl) return; tipsEl = buildNextCard(env, 'What you can do', closeTips); tipsEl.classList.add('modal'); document.body.append(tipsEl); }

  addEventListener('keydown', onKey, true);
  if (env.tour) start();

  return {
    onCleared(panel) {
      if (env.store.get(NEXT_SEEN) === '1') return;
      const card = buildNextCard(env, 'You cleared a course! What next?', () => { env.store.set(NEXT_SEEN, '1'); card.remove(); });
      if (panel) panel.prepend(card); else { card.classList.add('modal'); document.body.append(card); }
      if (panel) panel.scrollTop = 0; // the report opens scrolled to its buttons; the card sits at the top, so show the top
    },
    onFall(panel) {
      if (env.store.get(FALL_SEEN) === '1' || env.store.get(NEXT_SEEN) === '1' || tourEl || fallEl) return;
      env.store.set(FALL_SEEN, '1');
      fallEl = h('section', { id: 'ccfirstfall' }, h('b', {}, 'Fell? That is how everyone starts.'), h('p', {}, 'Press R to try again.'), h('p', {}, 'Press I to watch the best line.'), btn('Got it', () => { fallEl?.remove(); fallEl = null; }, true));
      if (panel) { fallEl.classList.add('inpanel'); panel.prepend(fallEl); } else document.body.append(fallEl); // CC-191: in the report, not on top of it
      setTimeout(() => { fallEl?.remove(); fallEl = null; }, 12000);
    },
    replay: start,
    destroy() { finish(); closeMenu(); closeTips(); removeEventListener('keydown', onKey, true); chipEl.remove(); style.remove(); },
  };
}
