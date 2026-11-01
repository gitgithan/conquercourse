// "Latest creations": the newest 24 characters (objects lifted from photos live in Community, not here), a picker for the runner, and the form that makes a new character (CC-108).
import { addBadge, saysOn } from '../ui/says';
import { closeOnBackdrop } from '../ui/backdrop';
import { jobProgress } from '../ui/job-progress';
import { CHARACTER_STEPS, PRIVATE_DAYS, type CharacterCard } from './steps';
import { promptProblem, cleanPrompt } from './prompt';
import { refusalWords } from '../slice/stages';
import { castOn, loadCast } from './cast';
import { turnstileToken } from '../ui/turnstile';

const STYLE = `
#chars{position:fixed;inset:0;background:rgba(23,32,29,.55);display:grid;place-items:center;z-index:50;font:15px system-ui,sans-serif}
#chars .box{background:#fff;color:#17201d;border-radius:14px;width:min(880px,94vw);max-height:88vh;overflow:auto;padding:18px 20px;display:grid;gap:12px}
#chars h2{margin:0;font-size:20px}#chars .tabs{display:flex;gap:8px}
#chars .tabs button{border:2px solid #b9c2bb;background:#fff;border-radius:999px;padding:4px 14px;cursor:pointer;font:600 14px system-ui}
#chars .tabs button[aria-selected=true]{background:#0f6b5c;border-color:#0f6b5c;color:#fff}
#chars .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
#chars .card{border:2px solid #cfd6d0;border-radius:10px;padding:6px;display:grid;gap:4px;text-align:center;background:#f6f8f5}
#chars .card[data-on=true]{border-color:#0f6b5c;background:#e4f1ec}
#chars .card img{width:96px;height:96px;object-fit:contain;margin:0 auto;background:#e1e7e2;border-radius:6px}
#chars .card b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#chars .card button{font:600 13px system-ui;border:1px solid #17201d;background:#fff;border-radius:6px;padding:3px 6px;cursor:pointer}
#chars [hidden]{display:none!important}#chars form{display:flex;gap:8px;flex-wrap:wrap}#chars input{flex:1;min-width:220px;padding:6px 10px;border:2px solid #b9c2bb;border-radius:8px;font:15px system-ui}
#chars .tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#chars .tools input{flex:0 1 200px;min-width:120px}#chars .tools button,#chars .pager button{border:1px solid #17201d;background:#fff;border-radius:6px;padding:3px 10px;cursor:pointer;font:600 13px system-ui}#chars .tools button[aria-pressed=true]{background:#0f6b5c;border-color:#0f6b5c;color:#fff}#chars .pager{display:flex;gap:8px;align-items:center}
#chars .only{font-size:12px;color:#7a4a00}#chars h3{margin:0;font-size:15px}#chars .left{font-size:13px;color:#4a554f;align-self:center}#chars .ask{font-size:12px;display:grid;gap:3px}
#chars .msg{min-height:1.2em;font-size:14px}#chars .msg.bad{color:#9b2c1d}`;

export interface PanelOptions { current: string | null; onPick: (card: CharacterCard | null) => void; fetcher?: typeof fetch; parent?: HTMLElement }

export function openCharacterPanel(o: PanelOptions): { close(): void; el: HTMLElement } {
  const doc = document, f = o.fetcher ?? fetch;
  if (!doc.getElementById('chars-style')) doc.head.append(Object.assign(doc.createElement('style'), { id: 'chars-style', textContent: STYLE }));
  const root = Object.assign(doc.createElement('div'), { id: 'chars' });
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Latest creations');
  const box = doc.createElement('div'); box.className = 'box'; root.append(box);
  const close = () => { root.remove(); doc.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  doc.addEventListener('keydown', onKey);
  closeOnBackdrop(root, close); // click outside the panel = Esc: same close, nothing changes
  const head = Object.assign(doc.createElement('h2'), { textContent: 'Latest creations' });
  const tabs = doc.createElement('div'); tabs.className = 'tabs'; tabs.setAttribute('role', 'tablist');
  const grid = doc.createElement('div'); grid.className = 'grid';
  const msg = doc.createElement('div'); msg.className = 'msg'; msg.setAttribute('aria-live', 'polite');
  const form = doc.createElement('form'); form.hidden = true;
  const input = Object.assign(doc.createElement('input'), { placeholder: 'Describe a character, like "a calm owl in a scarf"', maxLength: 140, name: 'prompt' });
  input.setAttribute('aria-label', 'Describe your character');
  const go = Object.assign(doc.createElement('button'), { type: 'submit', textContent: 'Make it' });
  const left = Object.assign(doc.createElement('span'), { className: 'left' }); form.append(left);
  const tools = doc.createElement('div'); tools.className = 'tools';
  const search = Object.assign(doc.createElement('input'), { type: 'search', placeholder: 'Search by name', maxLength: 40, name: 'q' }); search.setAttribute('aria-label', 'Search by name');
  const sortBtn = (v: 'newest' | 'picked', label: string) => { const b = Object.assign(doc.createElement('button'), { type: 'button', textContent: label, id: `chars-sort-${v}` }); b.onclick = () => { sort = v; page = 0; load(); }; return b; };
  const sNew = sortBtn('newest', 'Newest'), sPick = sortBtn('picked', 'Most picked');
  tools.append(search, sNew, sPick);
  const mineBox = doc.createElement('div'); mineBox.hidden = true; mineBox.id = 'chars-mine';
  const pager = doc.createElement('div'); pager.className = 'pager';
  const prev = Object.assign(doc.createElement('button'), { type: 'button', textContent: '← Newer page', id: 'chars-prev' }), next = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Next page →', id: 'chars-next' }), pageNo = doc.createElement('span');
  prev.onclick = () => { page = Math.max(0, page - 1); load(); }; next.onclick = () => { page++; load(); }; pager.append(prev, pageNo, next);
  let sort: 'newest' | 'picked' = 'newest', page = 0, timer = 0;
  search.oninput = () => { clearTimeout(timer); timer = window.setTimeout(() => { page = 0; load(); }, 300); };
  const jobs = doc.createElement('div');
  const done = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Close' }); done.onclick = close;
  form.append(input, go);
  box.append(head, tabs, form, jobs, mineBox, tools, grid, pager, msg, done);
  addBadge(box, 'maker', { after: head }); // CC-243: Muse Image draws, SAM 3.1 cuts out
  (o.parent ?? doc.body).append(root);

  let kind: 'character' | 'object' = 'character', current = o.current;
  const say = (t: string, bad = false) => { msg.textContent = t; msg.className = `msg${bad ? ' bad' : ''}`; };
  const tabBtn = (k: 'character' | 'object', label: string) => {
    const b = Object.assign(doc.createElement('button'), { type: 'button', textContent: label, id: `chars-tab-${k}` });
    b.setAttribute('role', 'tab'); b.onclick = () => { kind = k; page = 0; load(); }; tabs.append(b); return b;
  };
  const tabChr = tabBtn('character', 'Characters');

  async function load() {
    tabChr.setAttribute('aria-selected', String(kind === 'character'));
    grid.replaceChildren(); mineBox.replaceChildren(); say('');
    sNew.setAttribute('aria-pressed', String(sort === 'newest')); sPick.setAttribute('aria-pressed', String(sort === 'picked'));
    let data: { items: CharacterCard[]; mine?: CharacterCard[]; more?: boolean; left?: number; limit?: number; canCreate: boolean } = { items: [], canCreate: false };
    const starter = kind === 'character' && castOn() && page === 0 && !search.value.trim() ? await loadCast(f) : [];
    try { const r = await f(`/api/character?kind=${kind}&sort=${sort}&page=${page}&q=${encodeURIComponent(search.value.trim())}`); data = await r.json(); } catch { if (!starter.length) { say('Could not load the list. Try again in a minute.', true); return; } say('Could not load the newest creations. The starter characters are here.', true); }
    form.hidden = !(kind === 'character' && data.canCreate);
    left.textContent = data.limit ? `${data.left ?? 0} of ${data.limit} left today` : ''; go.disabled = data.left === 0;
    if (data.mine?.length) { // the maker's own private ones: nobody else sees them, they stay 30 days unused
      mineBox.hidden = false;
      mineBox.append(Object.assign(doc.createElement('h3'), { textContent: 'Yours, not shared yet' }), Object.assign(doc.createElement('div'), { className: 'only', textContent: `Only you can see these. A private character is kept ${PRIVATE_DAYS} days without use, then it is removed.` }));
      const g = Object.assign(doc.createElement('div'), { className: 'grid' }); for (const c of data.mine) g.append(card(c)); mineBox.append(g);
    } else mineBox.hidden = true;
    if (!data.items.length && !starter.length) { grid.append(Object.assign(doc.createElement('p'), { textContent: search.value.trim() ? 'Nothing with that name.' : kind === 'character' ? 'No characters shared yet. Make one, then press Publish.' : 'No objects yet.' })); }
    if (kind === 'character' && page === 0 && !search.value.trim()) grid.append(card(null));
    prev.disabled = page === 0; next.disabled = !data.more; pageNo.textContent = `Page ${page + 1}`; pager.hidden = page === 0 && !data.more;
    for (const c of starter) grid.append(card(c));
    for (const c of data.items) grid.append(card(c));
  }

  function card(c: CharacterCard | null): HTMLElement {
    const el = doc.createElement('div'); el.className = 'card'; el.dataset.on = String((c?.id ?? null) === current); el.dataset.id = c?.id ?? 'rookie';
    if (c) el.append(Object.assign(doc.createElement('img'), { src: c.thumb, alt: c.name, width: 96, height: 96 }));
    el.append(Object.assign(doc.createElement('b'), { textContent: c ? c.name : saysOn() ? 'Pip, the Rookie' : 'The Rookie', title: c?.prompt ?? '' }));
    const use = Object.assign(doc.createElement('button'), { type: 'button', textContent: (c?.id ?? null) === current ? 'Running as' : kind === 'object' ? 'Look' : 'Play as' });
    use.disabled = !!c && c.kind === 'object';
    use.onclick = () => { current = c?.id ?? null; o.onPick(c); load(); };
    el.append(use);
    if (c?.private) {
      el.append(Object.assign(doc.createElement('span'), { className: 'only', textContent: 'Only you can see this' }));
      const pub = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Publish' }); pub.dataset.publish = c.id;
      pub.onclick = () => { // one line to read before the press, the same as challenge courses
        const ask = Object.assign(doc.createElement('div'), { className: 'ask' }); ask.append(Object.assign(doc.createElement('span'), { textContent: `Everyone will see this and its name: ${c.name}` }));
        const yes = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Yes, publish' }), no = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Cancel' });
        yes.onclick = async () => { yes.disabled = true; const r = await post({ action: 'publish', id: c.id }); if (r.status !== 200) { say('Could not publish it. Try again.', true); yes.disabled = false; return; } await load(); say('Published. Everyone can see it now.'); };
        no.onclick = () => { ask.remove(); pub.hidden = false; }; ask.append(yes, no); pub.hidden = true; el.append(ask);
      };
      el.append(pub);
    }
    if (c?.mine) {
      const del = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Delete' });
      del.onclick = async () => { await f('/api/character', { method: 'POST', body: JSON.stringify({ action: 'delete', id: c.id }) }); if (current === c.id) { current = null; o.onPick(null); } load(); };
      el.append(del);
    }
    return el;
  }

  async function post(b: unknown) { const r = await f('/api/character', { method: 'POST', body: JSON.stringify(b) }); return { status: r.status, body: await r.json() as Record<string, any> }; }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const prompt = cleanPrompt(input.value), why = promptProblem(prompt);
    if (why) { say(why, true); return; }
    go.disabled = true; say('');
    let cancelled = false;
    const bar = jobProgress(jobs, CHARACTER_STEPS, () => { cancelled = true; });
    try {
      const start = await post({ action: 'create', prompt, turnstile: await turnstileToken(f) });
      if (start.body.state === 'done') { bar.fail(); say('That one is already made. Look for it in the list.'); return; }
      if (start.status !== 200 || !start.body.id) { bar.fail(); say(start.body.message || refusalWords(start.body as never) || 'Could not start.', true); return; }
      for (let i = 0; i < 120 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await post({ action: 'status', id: start.body.id });
        if (s.body.state === 'running') bar.update({ index: s.body.index, total: s.body.total, words: s.body.words, seconds: 0 });
        else if (s.body.state === 'done') { bar.finish(); say(s.body.route === 'C' ? 'Your character is ready. The 3D step failed, so it is the Rookie in your picture\'s colours.' : 'Your character is ready. Only you can see this until you press Publish.'); setTimeout(() => bar.el.remove(), 2500); input.value = ''; const note = msg.textContent; await load(); say(note ?? ''); return; }
        else { bar.fail(); say(`Could not make it: ${s.body.reason ?? 'try again'}. Your try today was given back.`, true); return; }
      }
      bar.fail(); say(cancelled ? 'Stopped. The character may still appear in the list.' : 'That took too long. Check the list in a minute.', true);
    } catch { bar.fail(); say('Something went wrong. Try again.', true); } finally { go.disabled = (left.textContent ?? '').startsWith('0 '); }
  };

  load();
  return { close, el: root };
}
