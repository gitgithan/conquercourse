import { closeOnBackdrop } from './backdrop';
import { pageQuery } from '../flags';
import { currentWorld } from './world-picker';
import { turnstileToken } from './turnstile';
import {
  KINDS, KIND_INFO, WHY_CHIPS, LIMITS, asksClear, screenLabel, buildContext, buildPayload, canSend, sentLines, emptyState,
  isRunning, onRunningChange, type FormState, type Kind,
} from './feedback-model';

// The new feedback card: one designed card in the same look as the picker and the crew card.
// Step 1 the kind, step 2 where, step 3 one box with a prompt; the context is shown, tickable and sent as shown.
declare const __BUILD__: string;

const STYLE = `
#cc-feedback{position:fixed;inset:0;z-index:960;display:grid;place-items:center;padding:12px;background:#10182099;backdrop-filter:blur(3px);font:14px/1.4 system-ui,sans-serif;color:#17201d}
#cc-feedback .fb{box-sizing:border-box;width:min(560px,100%);max-height:100%;overflow:auto;background:#fffdf7;border-radius:18px;padding:16px 18px 18px;box-shadow:0 24px 80px #0006;display:grid;gap:12px}
#cc-feedback h2{margin:0;font:800 20px system-ui,sans-serif;letter-spacing:-.02em}
#cc-feedback h3{margin:0 0 5px;font:700 12px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#58635d}
#cc-feedback .fb-top{display:flex;gap:8px;align-items:center;justify-content:space-between}
#cc-feedback .fb-sub{margin:2px 0 0;color:#58635d}
#cc-feedback .fb-x{font:700 18px system-ui,sans-serif;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:2px 11px;cursor:pointer}
#cc-feedback .fb-kinds{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#cc-feedback .fb-kind{text-align:left;font:inherit;padding:9px 11px;border:2px solid #d5d9d2;border-radius:12px;background:#fff;color:#17201d;cursor:pointer}
#cc-feedback .fb-kind b{display:block;font:700 14px system-ui,sans-serif}
#cc-feedback .fb-kind span{font-size:12px;color:#58635d}
#cc-feedback .fb-kind[aria-pressed=true]{border-color:#0f6b5c;background:#e6f2ee}
#cc-feedback .fb-chip{font:600 13px system-ui,sans-serif;border:1.5px solid #b9c2bb;background:#fff;color:#17201d;border-radius:999px;padding:4px 12px;cursor:pointer}
#cc-feedback .fb-chip[aria-pressed=true]{background:#17201d;color:#fff;border-color:#17201d}
#cc-feedback .fb-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#cc-feedback input[type=text],#cc-feedback textarea{box-sizing:border-box;width:100%;font:600 14px system-ui,sans-serif;border:2px solid #17201d;border-radius:10px;padding:7px 10px;background:#fff;color:#17201d}
#cc-feedback textarea{font-weight:400;resize:vertical}
#cc-feedback .fb-count{font-size:12px;color:#58635d;text-align:right}
#cc-feedback details{border:2px solid #d5d9d2;border-radius:12px;padding:6px 10px;background:#fff}
#cc-feedback summary{cursor:pointer;font:700 13px system-ui,sans-serif}
#cc-feedback .fb-ctx label{display:flex;gap:8px;align-items:baseline;padding:2px 0}
#cc-feedback .fb-ctx i{font-style:normal;color:#58635d}
#cc-feedback pre{margin:6px 0 0;white-space:pre-wrap;font:12px/1.4 ui-monospace,monospace;color:#3a4540;background:#f3f1ea;border-radius:8px;padding:8px}
#cc-feedback .fb-go{font:700 15px system-ui,sans-serif;border:2px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:10px;padding:7px 20px;cursor:pointer}
#cc-feedback .fb-go:disabled{opacity:.45;cursor:default}
#cc-feedback .fb-note{font-size:12px;color:#58635d}
#cc-feedback button:focus-visible,#cc-feedback input:focus-visible,#cc-feedback textarea:focus-visible,#cc-feedback summary:focus-visible{outline:3px solid #2f74c0;outline-offset:2px}
#cc-feedback-btn{position:fixed;right:16px;bottom:16px;z-index:50;font:700 13px system-ui,sans-serif;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:5px 12px;cursor:pointer;box-shadow:0 4px 16px #0003}
#cc-feedback-btn:focus-visible{outline:3px solid #2f74c0;outline-offset:2px}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (css) e.className = css; if (text) e.textContent = text; return e; };
const safeSession = (): string => { try { let s = localStorage.getItem('cc.session'); if (!s) { s = crypto.randomUUID(); localStorage.setItem('cc.session', s); } return s; } catch { return 'no-storage-' + Math.random().toString(36).slice(2, 12); } };

function addStyle(): void {
  if (document.getElementById('cc-feedback-style')) return;
  const s = el('style'); s.id = 'cc-feedback-style'; s.textContent = STYLE; document.head.appendChild(s);
}

/** One small button on every screen; it hides while a run is going. */
export function initFeedbackCard(mode: string): void {
  addStyle();
  const btn = el('button'); btn.textContent = 'Feedback'; btn.id = 'cc-feedback-btn'; btn.type = 'button';
  btn.title = 'Tell us what broke, what confused you, or what you loved. It takes about a minute.';
  const sync = () => { btn.hidden = isRunning() && !document.getElementById('cc-feedback'); };
  btn.onclick = () => openCard(mode, btn);
  onRunningChange(sync); sync();
  document.body.appendChild(btn);
}

export function openCard(mode: string, opener?: HTMLElement): void {
  if (document.getElementById('cc-feedback')) return;
  addStyle();
  const params = pageQuery();
  const world = currentWorld(params);
  const facts = { mode, params, ua: navigator.userAgent, width: innerWidth, height: innerHeight, worldLabel: world.label };
  const context = buildContext(facts);
  const worldItem = context.find((c) => c.key === 'world');
  const st: FormState = emptyState(context, [screenLabel(mode), worldItem?.value].filter(Boolean).join(': ').slice(0, LIMITS.where));

  const wrap = el('div'); wrap.id = 'cc-feedback';
  const card = el('form', 'fb'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', 'Feedback');
  wrap.appendChild(card);
  const close = () => { wrap.remove(); (opener ?? document.getElementById('cc-feedback-btn'))?.focus?.(); };

  const top = el('div', 'fb-top'); const head = el('div'); head.append(el('h2', '', 'Tell us how it went'), el('p', 'fb-sub', 'Three quick steps. No name or email needed.'));
  const x = el('button', 'fb-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close feedback'); x.onclick = close; top.append(head, x);

  // step 1: the kind
  const s1 = el('div'); s1.append(el('h3', '', '1. What kind is it?'));
  const kinds = el('div', 'fb-kinds'); kinds.setAttribute('role', 'group'); kinds.setAttribute('aria-label', 'What kind of feedback');
  const kindBtns = new Map<Kind, HTMLButtonElement>();
  for (const k of KINDS) {
    const b = el('button', 'fb-kind'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<b></b><span></span>`; b.querySelector('b')!.textContent = KIND_INFO[k].label; b.querySelector('span')!.textContent = KIND_INFO[k].hint;
    b.onclick = () => { st.kind = k; for (const [kk, bb] of kindBtns) bb.setAttribute('aria-pressed', String(kk === k)); refresh(); };
    kindBtns.set(k, b); kinds.appendChild(b);
  }
  s1.appendChild(kinds);

  // step 2: where
  const s2 = el('div'); s2.append(el('h3', '', '2. Where were you?'));
  const where = el('input'); where.type = 'text'; where.maxLength = LIMITS.where; where.value = st.where; where.setAttribute('aria-label', 'Where were you (you can change this)');
  where.oninput = () => { st.where = where.value; refresh(); };
  s2.append(where, el('div', 'fb-note', 'Filled in from your screen. Change it if it is wrong.'));

  // step 3: the words
  const s3 = el('div'); const h3 = el('h3', '', '3. Tell us'); const prompt = el('div', 'fb-note fb-prompt', 'Pick a kind above and a question appears here.'); prompt.style.cssText = 'font-size:14px;color:#17201d;margin-bottom:4px';
  const ta = el('textarea'); ta.rows = 4; ta.maxLength = LIMITS.text; ta.setAttribute('aria-label', 'Your words');
  const count = el('div', 'fb-count', `0 / ${LIMITS.text}`);
  ta.oninput = () => { st.text = ta.value; count.textContent = `${ta.value.length} / ${LIMITS.text}`; refresh(); };
  s3.append(h3, prompt, ta, count, el('div', 'fb-note', 'Please do not type your name, email or other private details.'));

  // optional: clear + rating
  const opt = el('div'); opt.append(el('h3', '', 'Optional'));
  const clearBox = el('div'); const clearRow = el('div', 'fb-row'); clearRow.append(el('b', '', 'Was this clear?'));
  const chipOf = (label: string, on: () => void): HTMLButtonElement => { const b = el('button', 'fb-chip', label); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.onclick = on; return b; };
  const yes = chipOf('Yes', () => { st.clear = 'yes'; st.why = null; paintClear(); }), no = chipOf('Not really', () => { st.clear = 'no'; paintClear(); });
  clearRow.append(yes, no);
  const whyRow = el('div', 'fb-row'); whyRow.style.marginTop = '6px'; whyRow.hidden = true;
  const whyBtns = WHY_CHIPS.map((w) => chipOf(w, () => { st.why = st.why === w ? null : w; paintClear(); }));
  whyRow.append(...whyBtns);
  const paintClear = () => {
    yes.setAttribute('aria-pressed', String(st.clear === 'yes')); no.setAttribute('aria-pressed', String(st.clear === 'no'));
    whyRow.hidden = st.clear !== 'no'; whyBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(st.why === WHY_CHIPS[i]))); refresh();
  };
  clearBox.append(clearRow, whyRow);
  const rateRow = el('div', 'fb-row'); rateRow.style.marginTop = '8px'; rateRow.append(el('b', '', `How is ${screenLabel(mode)} for you?`));
  const stars: HTMLButtonElement[] = [];
  for (let n = 1; n <= 5; n++) {
    const b = chipOf(String(n), () => { st.rating = st.rating === n ? null : n; stars.forEach((s, i) => s.setAttribute('aria-pressed', String(st.rating === i + 1))); refresh(); });
    b.setAttribute('aria-label', `${n} out of 5`); stars.push(b); rateRow.appendChild(b);
  }
  rateRow.append(el('span', 'fb-note', '1 = poor, 5 = great'));
  if (asksClear(mode)) opt.appendChild(clearBox);
  opt.appendChild(rateRow);

  // what gets sent
  const ctxBox = el('details'); ctxBox.append(el('summary', '', 'What gets sent'));
  const ctxList = el('div', 'fb-ctx'); ctxList.style.marginTop = '4px';
  ctxList.append(el('div', 'fb-note', 'Untick any line you do not want to send. Nothing else is attached: no name, no email, no address, no photo.'));
  for (const c of st.context) {
    const l = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = c.on; cb.onchange = () => { c.on = cb.checked; refresh(); };
    const t = el('span'); t.textContent = `${c.label}: `; const v = el('i', '', c.value); l.append(cb, t, v); ctxList.appendChild(l);
  }
  const pre = el('pre'); pre.setAttribute('aria-label', 'Exactly what will be sent');
  ctxBox.append(ctxList, pre);

  const trap = el('input'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true'); trap.style.cssText = 'position:absolute;left:-9999px';
  const foot = el('div', 'fb-row'); foot.style.justifyContent = 'flex-end';
  const note = el('span', 'fb-note'); note.setAttribute('role', 'status');
  const send = el('button', 'fb-go', 'Send'); send.type = 'submit';
  const cancel = el('button', 'fb-chip', 'Close'); cancel.type = 'button'; cancel.onclick = close;
  foot.append(note, cancel, send);

  card.append(top, s1, s2, s3, opt, ctxBox, trap, foot);

  const sendOpts = () => ({ session: safeSession(), build: typeof __BUILD__ === 'string' ? __BUILD__ : 'dev', mode, trap: trap.value });
  function refresh() {
    if (st.kind) { prompt.textContent = KIND_INFO[st.kind].prompt; ta.placeholder = KIND_INFO[st.kind].placeholder; }
    send.disabled = !canSend(st);
    pre.textContent = sentLines(buildPayload(st, sendOpts())).join('\n');
  }
  refresh();

  card.onsubmit = async (e) => {
    e.preventDefault();
    if (!canSend(st)) return;
    send.disabled = true; note.textContent = 'Sending…';
    try {
      const res = await fetch('/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...buildPayload(st, sendOpts()), turnstile: await turnstileToken() }) });
      if (res.status === 429) { note.textContent = 'That is a lot of notes in an hour. Please try again a little later.'; send.disabled = false; return; }
      if (!res.ok) throw new Error(String(res.status));
      card.replaceChildren(el('h2', '', 'Thank you!'), el('p', '', 'We read every one. You can keep playing.'));
      const ok = el('button', 'fb-go', 'Close'); ok.type = 'button'; ok.onclick = close; card.appendChild(ok); ok.focus();
      wrap.dataset.sent = '1';
    } catch { note.textContent = 'Sorry, that did not send. Please try again in a minute.'; send.disabled = !canSend(st); }
  };

  // keys: Esc closes; no game key gets through while the card is open; Ctrl+Enter sends
  wrap.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !send.disabled) { e.preventDefault(); card.requestSubmit(); }
  });
  closeOnBackdrop(wrap, close);
  document.body.appendChild(wrap);
  kindBtns.get('broke')!.focus();
}
