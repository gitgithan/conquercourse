// CC-177: the World editor's button levels. Runs after organizeEditor (CC-94); ?editorui=old skips it.
// What it does:
//  - three levels of button: primary (filled), secondary (outlined), quiet (plain), so the eye finds the important ones first
//  - the side-view designer (the strip under the picture) gets a strong frame and a title: it is where the run is shaped
//  - "Add pieces" is smaller and quiet, on the right: adding things is the less important job
//  - every repair action (Fix it, Make it easier, Look for routes, What should I change?) sits in ONE Fix menu with "when" and "what to expect"
//  - a glossary card, open on the first visit, hidden from its own button or the ? button, remembered in localStorage
// The original buttons keep their ids and stay in the page (hidden), so the Fix menu presses them and nothing else changes.

const CSS = `
  .ed.ux{--primary:#0f6b5c;--primary-ink:#fff;--line2:#9fb0a6}
  .ed.ux button,.ed.ux a.btn{font-weight:600;border-color:var(--line2);box-shadow:0 1px 0 #0001}
  .ed.ux button.go,.ed.ux a.btn.go{background:var(--primary);color:var(--primary-ink);border-color:#0b5a4d;box-shadow:0 2px 6px #0f6b5c55}
  .ed.ux button.go:hover:not(:disabled),.ed.ux a.btn.go:hover{background:#0b5a4d;color:#fff}
  .ed.ux button.quiet,.ed.ux a.btn.quiet{background:transparent;border-color:transparent;box-shadow:none;font-weight:500;color:#33403a}
  .ed.ux button.quiet:hover:not(:disabled),.ed.ux a.btn.quiet:hover{background:#e3e9e4}
  .ed.ux .seg button{border-color:var(--line2);background:#fff;font-weight:500}
  .ed.ux #addpiece{min-height:28px;font-size:12px;padding:2px 9px}
  .ed.ux .top .addwrap .addmenu{left:auto;right:0}
  .ed.ux .top{padding:2px 128px 2px 0} /* the Courses button is fixed in the top right corner: keep the bar clear of it */
  .ed.ux .top .grp{display:inline-flex;gap:6px;align-items:center;flex:0 0 auto}
  .ed.ux .top .div{width:1px;align-self:stretch;background:#cfd6d0;margin:3px 2px}
  .ed.ux #fixmenubtn{font-size:15px;min-height:36px;padding:3px 16px}
  .ed.ux #fixmenubtn .dot{width:9px;height:9px;border-radius:50%;background:#c0392b;box-shadow:0 0 0 2px #fff6;display:none}
  .ed.ux #fixmenubtn[data-state="bad"] .dot{display:inline-block}
  .ed.ux #fixmenubtn[data-state="ok"]::after{content:"✓";font-weight:800}
  .ed.ux .fixmenu{display:none;position:absolute;top:calc(100% + 6px);left:0;width:min(430px,calc(100vw - 24px));z-index:41;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px #0003;padding:8px;box-sizing:border-box}
  .ed.ux .fixmenu.open{display:grid;gap:4px}
  .ed.ux .fixmenu .fixhead{font-size:12px;color:var(--muted);padding:2px 6px 4px}
  .ed.ux .fixmenu button{display:grid;gap:2px;text-align:left;white-space:normal;border-color:transparent;background:transparent;box-shadow:none;padding:7px 9px;border-radius:8px;min-height:0}
  .ed.ux .fixmenu button:hover{background:var(--soft)}
  .ed.ux .fixmenu button b{font-size:14px}.ed.ux .fixmenu button span{font-weight:400;font-size:12px;color:var(--muted);line-height:1.35}
  .ed.ux .fixmenu button.rec{background:#e6f1ed;border-color:#0f6b5c}.ed.ux .fixmenu button.rec b::after{content:"  · try this now";font-weight:600;font-size:11px;color:var(--primary)}
  .ed.ux .main{grid-template-rows:minmax(0,5fr) minmax(0,4fr)}
  .ed.ux .profilewrap{position:relative;border:2px solid var(--primary);box-shadow:0 3px 14px #0f6b5c33;background:#fbfdfb}
  .ed.ux .profilewrap .sdtitle{position:absolute;right:0;top:0;z-index:2;pointer-events:none;background:var(--primary);color:#fff;font:700 12px/1 system-ui,sans-serif;padding:6px 12px;border-bottom-left-radius:10px;letter-spacing:.02em}
  .ed.ux .planwrap{border-color:#b9c2bb}
  #edglossary{position:absolute;right:10px;top:10px;z-index:15;width:min(400px,calc(100% - 20px));max-height:calc(100% - 20px);overflow:auto;background:#fff;border:1px solid #0f6b5c;border-radius:12px;box-shadow:0 8px 28px #0003;padding:0;font-size:13px}
  #edglossary[hidden]{display:none}
  #edglossary .gh{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #cfd6d0;position:sticky;top:0;background:#fff}
  #edglossary .gl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 10px;padding:8px 12px;margin:0}
  #edglossary .gl dt{font-weight:700;white-space:nowrap}#edglossary .gl dd{margin:0;color:#33403a}
  #edglossary .gl dt.sec{grid-column:1/3;margin-top:4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#58635d}
  #edglossary .gf{padding:6px 12px 10px;color:#58635d;font-size:12px}`;

const FIXES: { id: string; label: string; when: string; expect: string; clear: boolean }[] = [
  { id: 'fixit', label: 'Fix it', when: 'When the check says the runner cannot clear the course.', expect: 'You see the smallest changes drawn as outlines first. Nothing moves until you press Apply.', clear: false },
  { id: 'easier', label: 'Make it easier', when: 'When the course clears but the hardest press is tight.', expect: 'One small change is drawn as an outline. Apply it, or Cancel.', clear: true },
  { id: 'findroutes', label: 'Look for routes you did not plan', when: 'When the course works and you wonder if someone can skip an obstacle.', expect: 'It takes about a minute. You get a list of skips, each with Close it or Keep it.', clear: true },
  { id: 'what', label: 'What should I change?', when: 'When you are not sure what is wrong.', expect: 'The design partner answers in a few words and may offer moves to try.', clear: false },
];

const GLOSSARY: [string, string][] = [
  ['Side view', 'The green strip is the designer. Drag a bar up, down, left or right to shape the run.'],
  ['Fix', 'Repairs. Open it when the check says the runner cannot clear the course.'],
  ['Fit  (F)', 'Brings the camera to all your pieces. Click it when you are lost.'],
  ['Add pieces', 'Puts a new shape, object, bar or machine in the world.'],
  ['Undo / Redo', 'Steps back or forward. Nothing is lost.'],
  ['Top plan', 'A flat map. Use it to crop a piece or place it exactly.'],
  ['Moves', 'Shows which moves your course has and which are missing.'],
  ['Design partner', 'A helper that answers in words. You choose what to apply.'],
  ['Mouse', 'Wheel zooms to the cursor. Right or middle drag slides the view. Left drag on empty ground turns it.'],
];

export function styleEditor(root: HTMLElement): void {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
  const top = q('.top'), main = q('.main'), planWrap = q('.planwrap'), profileWrap = q('.profilewrap');
  if (!top || !planWrap || !profileWrap || !main) return;
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}) => Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  const style = mk('style', { textContent: CSS });
  document.head.appendChild(style);
  root.classList.add('ux');

  const back = q('#backcourse'), title = q('.top h1'), seg = q('.seg'), view = q('#viewmode'), moves = q('#movesbtn'), partner = q('#helperbtn'), fit = q('#fitview');
  const addWrap = q('.menuwrap'), moreWrap = q('#overflow')?.closest('.menuwrap') as HTMLElement | null, sp = q('.top .sp');
  addWrap?.classList.add('addwrap');
  const addBtn0 = q('#addpiece'); if (addBtn0) addBtn0.textContent = 'Add pieces ▾';
  for (const b of [back, seg?.querySelectorAll('button')[0], seg?.querySelectorAll('button')[1], q('#addpiece'), q('#overflow')]) (b as HTMLElement | null)?.classList.add('quiet');
  back?.classList.remove('go');

  // ---- the Fix menu
  const helper = q('#helper');
  const fixWrap = mk('div', { className: 'menuwrap' });
  const fixBtn = mk('button', { id: 'fixmenubtn', className: 'go', title: 'Repairs: fix the course, make it easier, look for skips, or ask what to change' });
  fixBtn.innerHTML = '<span class="dot"></span><span>Fix</span><span aria-hidden="true">▾</span>';
  fixBtn.setAttribute('aria-haspopup', 'true'); fixBtn.setAttribute('aria-expanded', 'false');
  const menu = mk('div', { className: 'fixmenu', id: 'fixmenu' });
  menu.append(mk('div', { className: 'fixhead', textContent: 'Pick one. Each shows a preview first; nothing changes until you say so.' }));
  const items = new Map<string, HTMLButtonElement>();
  for (const f of FIXES) {
    const b = mk('button', { id: `fixmenu-${f.id}`, title: `${f.when} ${f.expect}` });
    b.dataset.proxy = '1';
    b.innerHTML = `<b></b><span class="w"></span><span class="e"></span>`;
    (b.querySelector('b') as HTMLElement).textContent = f.label;
    (b.querySelector('.w') as HTMLElement).textContent = f.when;
    (b.querySelector('.e') as HTMLElement).textContent = 'Expect: ' + f.expect;
    b.onclick = () => {
      close();
      if (helper?.classList.contains('closed')) partner?.click();
      q<HTMLElement>(`#${f.id}`)?.click();
    };
    items.set(f.id, b); menu.append(b);
  }
  fixWrap.append(fixBtn, menu);
  const close = () => { menu.classList.remove('open'); fixBtn.setAttribute('aria-expanded', 'false'); };
  fixBtn.onclick = (e) => { e.stopPropagation(); const open = !menu.classList.contains('open'); root.querySelectorAll('.open').forEach((m) => m !== menu && m.classList.remove('open')); menu.classList.toggle('open', open); fixBtn.setAttribute('aria-expanded', String(open)); };
  root.addEventListener('click', (e) => { if (menu.classList.contains('open') && !menu.contains(e.target as Node)) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const syncFix = () => {
    const s = document.documentElement.dataset.laneClear; // '1' clears, '0' does not, unset not checked yet
    fixBtn.dataset.state = s === '1' ? 'ok' : s === '0' ? 'bad' : '';
    for (const f of FIXES) items.get(f.id)?.classList.toggle('rec', s === '0' ? f.id === 'fixit' : s === '1' ? f.id === 'easier' : false);
  };
  new MutationObserver(syncFix).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lane-clear'] });
  syncFix();
  const style2 = mk('style', { textContent: FIXES.map((f) => `.ed.ux #${f.id}`).join(',') + '{display:none!important}' });
  document.head.appendChild(style2);

  // ---- the side-view designer gets a title
  profileWrap.append(mk('div', { className: 'sdtitle', textContent: 'SIDE-VIEW DESIGNER · drag a bar' }));

  // ---- the glossary
  const KEY = 'cc.editor.glossary';
  const read = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* it still works for this visit */ } };
  const gloss = mk('div', { id: 'edglossary' }); gloss.setAttribute('role', 'region'); gloss.setAttribute('aria-label', 'What these buttons do');
  const gh = mk('div', { className: 'gh' }); gh.append(mk('strong', { textContent: 'What these buttons do' }));
  const hide = mk('button', { id: 'glossaryhide', textContent: 'Hide', title: 'Hide this list. The ? button brings it back.' }); hide.className = 'quiet';
  gh.append(hide);
  const dl = mk('dl', { className: 'gl' });
  for (const [t, d] of GLOSSARY) { dl.append(mk('dt', { textContent: t }), mk('dd', { textContent: d })); }
  dl.append(mk('dt', { className: 'sec', textContent: 'The Fix menu' }));
  for (const f of FIXES) dl.append(mk('dt', { textContent: f.label.replace(' you did not plan', '') }), mk('dd', { textContent: f.when + ' ' + f.expect }));
  gloss.append(gh, dl, mk('div', { className: 'gf', textContent: 'Hover any button for a short reminder.' }));
  planWrap.append(gloss);
  const help = mk('button', { id: 'glossarybtn', textContent: '?', title: 'What these buttons do', className: 'quiet' }); help.setAttribute('aria-label', 'What these buttons do'); help.setAttribute('aria-expanded', 'false');
  const show = (on: boolean, remember = true) => { gloss.hidden = !on; help.setAttribute('aria-expanded', String(on)); help.setAttribute('aria-pressed', String(on)); if (remember) write(on ? 'shown' : 'hidden'); };
  show(read() !== 'hidden', false);
  hide.onclick = () => show(false);
  help.onclick = () => show(gloss.hidden);

  // the design partner card starts closed: open, it sat over the right half of the picture and swallowed the wheel and the drags there (CC-177)
  if (partner && helper && !helper.classList.contains('closed')) partner.click();

  // ---- the bar: [title Back] | [Fix] [Fit] [view] [Moves] [Design partner] ...... [Undo Redo] [Add pieces] [?] [...]
  const known = new Set<Element | null>([title, back, seg, view, moves, partner, fit, addWrap, moreWrap, sp]);
  const strays = [...top.children].filter((c) => !known.has(c));
  const div = () => mk('span', { className: 'div' });
  top.replaceChildren(...([title, back, ...strays, div(), fixWrap, fit, view, moves, partner, sp, seg, addWrap, help, moreWrap].filter(Boolean) as HTMLElement[]));
  if (fit) fit.classList.remove('quiet');
}
