// A small "Feedback" button on every page. It asks the questions in public/feedback-questions.json (edit that file to change
// the round) and posts the answers, a random session id, the build id and a few play counters to /api/submit.
declare const __BUILD__: string;

interface Question { id: string; type: 'scale' | 'choice' | 'text'; text: string; options?: string[] }
interface Round { round: string; title: string; intro: string; questions: Question[] }

const counters: Record<string, number> = {};
export const track = (name: string, by = 1): void => { counters[name] = (counters[name] ?? 0) + by; };

function session(): string {
  try {
    let s = localStorage.getItem('cc.session');
    if (!s) { s = crypto.randomUUID(); localStorage.setItem('cc.session', s); }
    return s;
  } catch { return 'no-storage-' + Math.random().toString(36).slice(2, 12); }
}

export function initFeedback(mode: string): void {
  const btn = document.createElement('button');
  btn.textContent = 'Feedback';
  btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:50;font:600 15px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:999px;padding:8px 16px;cursor:pointer;box-shadow:0 2px 10px #0003';
  btn.onclick = () => openForm(mode);
  document.body.appendChild(btn);
}

async function openForm(mode: string): Promise<void> {
  if (document.getElementById('cc-feedback')) return;
  let round: Round;
  try { round = await (await fetch('/feedback-questions.json', { cache: 'no-store' })).json(); } catch { alert('The feedback form could not load. Please try again later.'); return; }
  const wrap = document.createElement('div');
  wrap.id = 'cc-feedback';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:60;background:#0008;display:grid;place-items:center;padding:12px';
  const card = document.createElement('form');
  card.style.cssText = 'background:#fff;color:#17201d;border-radius:12px;max-width:640px;width:100%;max-height:92vh;overflow:auto;padding:18px;font:15px/1.45 system-ui,sans-serif;display:grid;gap:14px';
  card.innerHTML = `<h2 style="margin:0;font-size:20px">${round.title}</h2><p style="margin:0;color:#58635d">${round.intro}</p><p style="margin:0;background:#e6f2ee;border:1px solid #0f6b5c;border-radius:8px;padding:8px 10px;font-weight:600">Every question is optional. Skip any you like; even one answer helps.</p>`;
  const answers: Record<string, string | number> = {};
  for (const q of round.questions) {
    const box = document.createElement('fieldset');
    box.style.cssText = 'border:0;padding:0;margin:0;display:grid;gap:6px';
    const lg = document.createElement('legend'); lg.textContent = q.text; lg.style.cssText = 'font-weight:600;padding:0'; box.appendChild(lg);
    const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'; box.appendChild(row);
    if (q.type === 'scale') {
      for (let n = 1; n <= 5; n++) row.appendChild(chip(String(n), () => { answers[q.id] = n; paint(row, String(n)); }));
      const hint = document.createElement('div'); hint.textContent = '1 = not at all · 5 = completely'; hint.style.cssText = 'font-size:12px;color:#58635d'; box.appendChild(hint);
    } else if (q.type === 'choice') {
      for (const o of q.options ?? []) row.appendChild(chip(o, () => { answers[q.id] = o; paint(row, o); }));
    } else {
      const t = document.createElement('textarea'); t.rows = 2; t.maxLength = 600; t.style.cssText = 'font:inherit;border:1px solid #b9c2bb;border-radius:8px;padding:6px;width:100%';
      t.oninput = () => { if (t.value.trim()) answers[q.id] = t.value.trim(); else delete answers[q.id]; };
      box.appendChild(t);
    }
    card.appendChild(box);
  }
  const trap = document.createElement('input'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.style.cssText = 'position:absolute;left:-9999px'; card.appendChild(trap);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Close'; cancel.style.cssText = btnCss(false); cancel.onclick = () => wrap.remove();
  const send = document.createElement('button'); send.type = 'submit'; send.textContent = 'Send'; send.style.cssText = btnCss(true);
  row.append(cancel, send); card.appendChild(row);
  const note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:#58635d'; card.appendChild(note);
  card.onsubmit = async (e) => {
    e.preventDefault();
    if (!Object.keys(answers).length) { note.textContent = 'Answer any one question, then press Send. All of them are optional.'; return; }
    send.disabled = true; note.textContent = 'Sending…';
    try {
      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ round: round.round, session: session(), build: __BUILD__, mode, answers, website: trap.value, context: { ...counters, w: innerWidth, h: innerHeight, rookie: safe('cc.rookie') } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      card.innerHTML = '<h2 style="margin:0;font-size:20px">Thank you!</h2><p>Your answers were saved. You can keep playing.</p>';
      const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Close'; ok.style.cssText = btnCss(true); ok.onclick = () => wrap.remove(); card.appendChild(ok);
    } catch { note.textContent = 'Sorry, that did not send. Please try again in a minute.'; send.disabled = false; }
  };
  wrap.appendChild(card);
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  document.body.appendChild(wrap);
}

const safe = (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const btnCss = (primary: boolean) => `font:inherit;border:1px solid ${primary ? '#0f6b5c' : '#b9c2bb'};background:${primary ? '#0f6b5c' : '#fff'};color:${primary ? '#fff' : '#17201d'};border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:${primary ? 700 : 400}`;
function chip(label: string, on: () => void): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = label;
  b.style.cssText = 'font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:999px;padding:4px 12px;cursor:pointer';
  b.onclick = on; return b;
}
function paint(row: HTMLElement, value: string): void {
  row.querySelectorAll('button').forEach((b) => { const on = (b as HTMLButtonElement).dataset.v === value; (b as HTMLElement).style.background = on ? '#17201d' : '#fff'; (b as HTMLElement).style.color = on ? '#fff' : '#17201d'; });
}
