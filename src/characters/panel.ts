// "Latest creations": the newest 24 objects and 24 characters, a picker for the runner, and the form that makes a new character (CC-108).
import { addBadge, saysOn } from '../ui/says';
import { jobProgress } from '../ui/job-progress';
import { CHARACTER_STEPS, type CharacterCard } from './steps';
import { promptProblem, cleanPrompt } from './prompt';
import { refusalWords } from '../slice/stages';

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
#chars form{display:flex;gap:8px;flex-wrap:wrap}#chars input{flex:1;min-width:220px;padding:6px 10px;border:2px solid #b9c2bb;border-radius:8px;font:15px system-ui}
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
  const head = Object.assign(doc.createElement('h2'), { textContent: 'Latest creations' });
  const tabs = doc.createElement('div'); tabs.className = 'tabs'; tabs.setAttribute('role', 'tablist');
  const grid = doc.createElement('div'); grid.className = 'grid';
  const msg = doc.createElement('div'); msg.className = 'msg'; msg.setAttribute('aria-live', 'polite');
  const form = doc.createElement('form'); form.hidden = true;
  const input = Object.assign(doc.createElement('input'), { placeholder: 'Describe a character, like "a calm owl in a scarf"', maxLength: 140, name: 'prompt' });
  input.setAttribute('aria-label', 'Describe your character');
  const go = Object.assign(doc.createElement('button'), { type: 'submit', textContent: 'Make it' });
  const jobs = doc.createElement('div');
  const done = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Close' }); done.onclick = close;
  form.append(input, go);
  box.append(head, tabs, grid, form, jobs, msg, done);
  addBadge(box, 'maker', { after: head }); // CC-243: Muse Image draws, SAM 3.1 cuts out
  (o.parent ?? doc.body).append(root);

  let kind: 'character' | 'object' = 'character', current = o.current;
  const say = (t: string, bad = false) => { msg.textContent = t; msg.className = `msg${bad ? ' bad' : ''}`; };
  const tabBtn = (k: 'character' | 'object', label: string) => {
    const b = Object.assign(doc.createElement('button'), { type: 'button', textContent: label, id: `chars-tab-${k}` });
    b.setAttribute('role', 'tab'); b.onclick = () => { kind = k; load(); }; tabs.append(b); return b;
  };
  const tabObj = tabBtn('object', 'Objects'), tabChr = tabBtn('character', 'Characters');

  async function load() {
    tabObj.setAttribute('aria-selected', String(kind === 'object')); tabChr.setAttribute('aria-selected', String(kind === 'character'));
    grid.replaceChildren(); say('');
    let data: { items: CharacterCard[]; canCreate: boolean };
    try { const r = await f(`/api/character?kind=${kind}`); data = await r.json(); } catch { say('Could not load the list. Try again in a minute.', true); return; }
    form.hidden = !(kind === 'character' && data.canCreate);
    if (!data.items.length) { grid.append(Object.assign(doc.createElement('p'), { textContent: kind === 'character' ? 'No characters yet. Be the first.' : 'No objects yet.' })); }
    if (kind === 'character') grid.append(card(null));
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
      const start = await post({ action: 'create', prompt });
      if (start.body.state === 'done') { bar.fail(); say('Someone already made that one. It is in the list.'); return; }
      if (start.status !== 200 || !start.body.id) { bar.fail(); say(start.body.message || refusalWords(start.body as never) || 'Could not start.', true); return; }
      for (let i = 0; i < 120 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await post({ action: 'status', id: start.body.id });
        if (s.body.state === 'running') bar.update({ index: s.body.index, total: s.body.total, words: s.body.words, seconds: 0 });
        else if (s.body.state === 'done') { bar.finish(); say(s.body.route === 'C' ? 'Your character is ready. The 3D step failed, so it is the Rookie in your picture\'s colours.' : 'Your character is ready.'); setTimeout(() => bar.el.remove(), 2500); input.value = ''; await load(); return; }
        else { bar.fail(); say(`Could not make it: ${s.body.reason ?? 'try again'}. Your try today was given back.`, true); return; }
      }
      bar.fail(); say(cancelled ? 'Stopped. The character may still appear in the list.' : 'That took too long. Check the list in a minute.', true);
    } catch { bar.fail(); say('Something went wrong. Try again.', true); } finally { go.disabled = false; }
  };

  load();
  return { close, el: root };
}
