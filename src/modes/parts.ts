// ?mode=parts: the Parts gallery (docs/parts-gallery.md). Every move and every obstacle as a card; a card plays the REAL Course on that one part,
// in a frame (the real simulator and the real renderer; nothing is faked). Only one frame lives at a time, so the graphics card has one scene to draw.
// A second view, "How a course is made", cuts a shipped course into the same cards in the order you meet them.
import { pageQuery } from '../flags';
import { DEMO_GROUPS, WORD_VALUES } from '../ui/world-picker';
import { GROUP_TITLES, PARTS, partById, partsOfCourse, type Part, type PartGroup } from '../ui/parts-data';
import type { CourseData } from '../course/course';
import { loadCast } from '../characters/cast';

const STYLE = `
.pg{box-sizing:border-box;min-height:100vh;background:#f4f1e8;color:#17201d;font:15px/1.4 system-ui,sans-serif;padding:64px 24px 40px}
.pg *{box-sizing:border-box}
.pg header{max-width:1232px;margin:0 auto 12px}
.pg h1{margin:0 0 4px;font:800 28px system-ui,sans-serif;letter-spacing:-.02em}
.pg header p{margin:0 0 10px;color:#4a5550;max-width:760px}
.pg-tabs{display:flex;gap:8px;margin:8px 0 0}
.pg-tabs button{font:700 14px system-ui,sans-serif;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:6px 14px;cursor:pointer}
.pg-tabs button[aria-pressed=true]{background:#17201d;color:#fff}
.pg main{max-width:1232px;margin:0 auto}
.pg h2{margin:26px 0 4px;font:800 20px system-ui,sans-serif}
.pg h2 small{font:600 13px system-ui,sans-serif;color:#58635d;margin-left:8px}
.pg-grid{display:grid;gap:14px;margin-top:10px}
.pg-grid[data-group=special]{grid-template-columns:repeat(3,minmax(0,1fr))}
.pg-grid[data-group=obstacle]{grid-template-columns:repeat(4,minmax(0,1fr))}
.pg-grid[data-group=move]{grid-template-columns:repeat(4,minmax(0,1fr))}
.pg-card{display:flex;flex-direction:column;background:#fff;border:2px solid #d5d9d2;border-radius:14px;overflow:hidden}
.pg-card[data-group=special]{border-color:#0f6b5c;box-shadow:0 2px 0 #0f6b5c33}
.pg-card.on{border-color:#e8741c;box-shadow:0 0 0 3px #e8741c55}
.pg-view{position:relative;aspect-ratio:16/9;background:#dfe6e0;overflow:hidden;cursor:pointer;border:0;padding:0;display:block;width:100%}
.pg-view img{width:100%;height:100%;object-fit:cover;display:block}
.pg-view iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#dfe6e0}
.pg-play{position:absolute;left:8px;bottom:8px;font:700 12px system-ui,sans-serif;background:#17201dd9;color:#fff;border-radius:8px;padding:3px 9px}
.pg-body{padding:8px 11px 11px;display:flex;flex-direction:column;gap:5px}
.pg-body b{font:800 17px/1.2 system-ui,sans-serif}
.pg-card[data-group=special] .pg-body b{font-size:19px}
.pg-line{margin:0}
.pg-keys{margin:0;font:600 13px/1.3 system-ui,sans-serif;color:#0f6b5c}
.pg-made{margin:0;font:13px/1.35 system-ui,sans-serif;color:#3a4540}
.pg-saying{margin:0;font:italic 600 14px/1.35 Georgia,serif;color:#5a3b00;background:#fff6cf;border-left:4px solid #d8a208;padding:4px 8px;border-radius:4px}
.pg-note{margin:0;font:12px/1.3 system-ui,sans-serif;color:#8c231e}
.pg-char{display:flex;gap:8px;align-items:center;margin:6px 0 0;font:600 14px system-ui,sans-serif}
.pg-char select{font:600 14px system-ui,sans-serif;padding:4px 8px;border:2px solid #17201d;border-radius:8px;background:#fff}
.pg-pick{display:flex;gap:10px;align-items:center;margin:10px 0}
.pg-pick select{font:600 15px system-ui,sans-serif;padding:6px 8px;border:2px solid #17201d;border-radius:8px;background:#fff;max-width:520px}
.pg-pick a{font:700 13px system-ui,sans-serif;color:#0f6b5c}
.pg-stage{width:min(760px,100%);aspect-ratio:16/9;background:#dfe6e0;border-radius:14px;overflow:hidden;position:relative;border:2px solid #17201d}
.pg-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.pg-strip{display:flex;flex-wrap:wrap;gap:6px 0;align-items:stretch;margin-top:14px}
.pg-strip .pg-card{width:220px;cursor:pointer}
.pg-strip .pg-card .pg-body{padding:6px 9px 8px}
.pg-strip .pg-card b{font-size:15px}
.pg-n{display:inline-block;margin-right:6px;background:#17201d;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;font:800 13px/22px system-ui,sans-serif}
.pg-arrow{align-self:center;font:800 24px system-ui,sans-serif;color:#58635d;width:30px;text-align:center}
.pg-empty{padding:16px;color:#58635d}
`;

const FRAME_FLAGS = 'welcome=0&nav=0&music=0&photos=0&hud=old';
/** The demo runner: the Skater (the girl of the starter cast; her arms and legs show the limb fit well). The gallery never reads the player's saved choice. */
export const DEMO_CHAR = '8f72bd8e9c1937ce';
const CHAR_ID = /^[0-9a-f]{16}$/;
let demoChar = DEMO_CHAR;
/** The frame address for a part: the demo runner is named in the address (?char=) and ?nosave=1 keeps the player's own saved choice untouched. */
export function frameSrc(p: Part, char: string = demoChar): string | null {
  if (p.live.how === 'none') return null;
  return `/?course=${p.live.course}&${FRAME_FLAGS}&char=${char}&nosave=1${p.live.how === 'bot' ? '&bot=ideal' : ''}`;
}

let playing: { iframe: HTMLIFrameElement; stop: () => void } | null = null;
/** Put the real Course into `view` (one at a time: the frame that was playing is removed first). Bot runs loop; hand runs wait for the keys. */
function play(view: HTMLElement, p: Part, onStop?: () => void): void {
  const src = frameSrc(p);
  if (!src) return;
  playing?.stop();
  const iframe = document.createElement('iframe');
  iframe.title = `${p.name}: the real Course`; iframe.src = src; iframe.dataset.part = p.id; iframe.allow = 'autoplay';
  let timer = 0, over = 0;
  const stop = () => { clearInterval(timer); iframe.remove(); view.classList.remove('playing'); view.closest('.pg-card')?.classList.remove('on'); onStop?.(); if (playing?.iframe === iframe) playing = null; };
  iframe.addEventListener('load', () => {
    try {
      const doc = iframe.contentDocument!;
      if (p.live.how === 'bot') { const st = doc.createElement('style'); st.textContent = 'body > :not(canvas){display:none!important}'; doc.head.append(st); } // the picture is the world, not the buttons
    } catch { /* a frame we cannot read still plays */ }
    if (p.live.how === 'hand') iframe.focus();
    timer = window.setInterval(() => { // a run that ended starts again after a short pause (bot runs only)
      if (p.live.how !== 'bot') return;
      try { const o = iframe.contentDocument?.documentElement.dataset.outcome; if (o && o !== 'running') over++; else over = 0; if (over >= 6) { over = 0; iframe.src = src; } } catch { /* ignore */ }
    }, 500);
  });
  view.append(iframe); view.classList.add('playing'); view.closest('.pg-card')?.classList.add('on');
  playing = { iframe, stop };
}

function card(p: Part, opts: { n?: number; strip?: boolean } = {}): HTMLElement {
  const el = document.createElement('article');
  el.className = 'pg-card'; el.dataset.group = p.group; el.dataset.part = p.id;
  const view = document.createElement('button');
  view.type = 'button'; view.className = 'pg-view'; view.setAttribute('aria-label', `Play ${p.name}`);
  const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.src = `/assets/parts-thumbs/${p.id}.webp`; img.onerror = () => img.remove();
  const label = document.createElement('span'); label.className = 'pg-play';
  label.textContent = p.live.how === 'bot' ? 'Play' : p.live.how === 'hand' ? 'Try it yourself' : 'No live scene';
  view.append(img, label);
  if (p.live.how !== 'none') {
    view.onclick = () => { if (view.classList.contains('playing')) playing?.stop(); else play(view, p); };
  }
  const body = document.createElement('div'); body.className = 'pg-body';
  const b = document.createElement('b');
  if (opts.n) { const n = document.createElement('span'); n.className = 'pg-n'; n.textContent = String(opts.n); b.append(n); }
  b.append(p.name);
  body.append(b);
  const add = (cls: string, text: string, tag = 'p') => { const e = document.createElement(tag); e.className = cls; e.textContent = text; body.append(e); };
  add('pg-line', p.line);
  add('pg-keys', `Keys: ${p.keys}`);
  if (!opts.strip) {
    if (p.made) add('pg-made', `Made of: ${p.made}`);
    if (p.saying) add('pg-saying', `"${p.saying}"`);
    if (p.live.how === 'hand') add('pg-note', 'No automatic run for this one: click the picture, then play it with the keys.');
    if (p.live.how === 'none') add('pg-note', p.live.why);
  }
  el.append(view, body);
  if (opts.strip) { view.onclick = null; el.onclick = () => el.dispatchEvent(new CustomEvent('pg-pick', { bubbles: true, detail: p.id })); }
  return el;
}

function allParts(main: HTMLElement): void {
  main.replaceChildren();
  for (const g of ['special', 'obstacle', 'move'] as PartGroup[]) {
    const list = PARTS.filter((p) => p.group === g);
    const h = document.createElement('h2'); h.textContent = GROUP_TITLES[g]; const s = document.createElement('small');
    s.textContent = g === 'special' ? `${list.length}: our own inventions, each with its physics saying` : g === 'obstacle' ? `${list.length}: the basic things on a course` : `${list.length}: what the runner can do`;
    h.append(s);
    const grid = document.createElement('div'); grid.className = 'pg-grid'; grid.dataset.group = g;
    for (const p of list) grid.append(card(p));
    main.append(h, grid);
  }
}

const COURSES = DEMO_GROUPS.flatMap(([, ds]) => ds).filter(([v]) => v && !WORD_VALUES.includes(v)).map(([v, t]) => ({ path: v, title: t }));

async function howMade(main: HTMLElement, chosen: string): Promise<void> {
  main.replaceChildren();
  const pick = document.createElement('div'); pick.className = 'pg-pick';
  const sel = document.createElement('select'); sel.id = 'pg-course'; sel.setAttribute('aria-label', 'Pick a course');
  for (const c of COURSES) { const o = document.createElement('option'); o.value = c.path; o.textContent = c.title; if (c.path === chosen) o.selected = true; sel.append(o); }
  const open = document.createElement('a'); open.textContent = 'Open the whole course'; open.href = `?course=${chosen}&welcome=0`;
  pick.append('Course: ', sel, open);
  const stage = document.createElement('div'); stage.className = 'pg-stage'; stage.id = 'pg-stage';
  const strip = document.createElement('div'); strip.className = 'pg-strip'; strip.id = 'pg-strip';
  main.append(pick, stage, strip);
  sel.onchange = () => { void howMade(main, sel.value); };
  let course: CourseData;
  try { course = (await (await fetch(chosen)).json()) as CourseData; } catch { strip.textContent = 'This course could not be read.'; return; }
  const ids = partsOfCourse(course).filter((id) => partById(id));
  if (!ids.length) { strip.innerHTML = '<div class="pg-empty">This course is plain ground: only running and jumping.</div>'; }
  ids.forEach((id, i) => {
    if (i) { const a = document.createElement('span'); a.className = 'pg-arrow'; a.textContent = '→'; strip.append(a); }
    strip.append(card(partById(id)!, { n: i + 1, strip: true }));
  });
  strip.onclick = null;
  strip.addEventListener('pg-pick', (e) => {
    const part = partById((e as CustomEvent<string>).detail)!;
    strip.querySelectorAll('.pg-card').forEach((c) => c.classList.toggle('on', (c as HTMLElement).dataset.part === part.id));
    play(stage, part);
  });
  // the stage starts on the whole course, so "this course" is the first thing shown
  const whole: Part = { id: 'whole', group: 'obstacle', name: 'The whole course', line: '', keys: '', covers: {}, live: { how: 'bot', course: chosen } };
  play(stage, whole);
}

export function startParts(root: HTMLElement): { backend: string } {
  if (!document.getElementById('pg-style')) { const st = document.createElement('style'); st.id = 'pg-style'; st.textContent = STYLE; document.head.append(st); }
  document.body.style.overflow = 'auto';
  const page = document.createElement('div'); page.className = 'pg'; page.dataset.testid = 'parts-gallery';
  const specials = PARTS.filter((p) => p.group === 'special').length;
  page.innerHTML = `<header><h1>Parts: moves and obstacles</h1><p>${PARTS.length} parts, ${specials} of them special. Click a picture to watch the real game play just that part. Every course is made of these.</p><div class="pg-tabs"><button type="button" id="pg-tab-all" aria-pressed="true">All parts</button><button type="button" id="pg-tab-course" aria-pressed="false">How a course is made</button></div><label class="pg-char">Runner: <select id="pg-char" aria-label="Pick the runner for the demos"></select><span>(only for this page; your own choice is not changed)</span></label></header><main></main>`;
  root.append(page);
  const main = page.querySelector('main') as HTMLElement;
  const all = page.querySelector('#pg-tab-all') as HTMLButtonElement, how = page.querySelector('#pg-tab-course') as HTMLButtonElement;
  const show = (v: 'all' | 'course', course?: string) => {
    playing?.stop();
    all.setAttribute('aria-pressed', String(v === 'all')); how.setAttribute('aria-pressed', String(v === 'course'));
    if (v === 'all') allParts(main); else void howMade(main, course ?? COURSES.find((c) => c.path.includes('training'))?.path ?? COURSES[0].path);
  };
  all.onclick = () => show('all'); how.onclick = () => show('course');
  const q = pageQuery();
  const asked = q.get('char');
  if (asked && CHAR_ID.test(asked)) demoChar = asked;
  const cs = page.querySelector('#pg-char') as HTMLSelectElement;
  const fill = (items: { id: string; name: string }[]) => {
    cs.replaceChildren();
    for (const c of items) { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; cs.append(o); }
    cs.value = demoChar;
  };
  fill([{ id: demoChar, name: demoChar === DEMO_CHAR ? 'Skater' : 'Chosen runner' }]);
  void loadCast().then((cast) => { if (cast.length) fill(cast.map((c) => ({ id: c.id, name: c.name }))); });
  cs.onchange = () => {
    demoChar = cs.value; playing?.stop();
    try { const u = new URL(location.href); u.searchParams.set('char', demoChar); history.replaceState(null, '', u); } catch { /* the pick still works */ }
  };
  show(q.get('view') === 'course' ? 'course' : 'all', q.get('of') ?? undefined);
  return { backend: 'dom' };
}
