import { pageQuery } from '../flags';
import { shareWaitText, waitFromReply } from '../sim/slow-down';
import { initFeedbackCard } from './feedback-card';
import { turnstileToken } from './turnstile';
import { trackStep as sendStep, visitRef } from './analytics';
// A small "Feedback" button on every page. It asks the questions in public/feedback-questions.json (edit that file to change
// the round) and posts the answers, a random session id, the build id and a few play counters to /api/submit.
declare const __BUILD__: string;

interface Question { id: string; type: 'scale' | 'choice' | 'multi' | 'text' | 'seen'; text: string; options?: string[]; about?: string; href?: string; section?: string; when?: { id: string; values: string[] } }
interface Round { round: string; title: string; intro: string; questions: Question[] }

const counters: Record<string, number> = {};
export const track = (name: string, by = 1): void => { counters[name] = (counters[name] ?? 0) + by; };

export type CourseEvent = 'start' | 'fail' | 'success';
export function trackCourseEvent(event: CourseEvent, courseKey: string, courseName: string, runId: string, mode: string, at = ''): void {
  void fetch('/api/course-event', {
    method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ event, session: session(), build: __BUILD__, courseKey, courseName, runId, mode, source: courseSource(), at, ref: visitRef() }),
  }).catch(() => { /* telemetry must never interrupt a run */ });
}

/** Offers a cleared run to the server, which plays the keys again with the simulator before it counts (CC-149). Nothing is shown and a failure is ignored. A 202 (the server kept it unverified) or a 503 (Cloudflare cut the replay) needs nothing from the browser: the server already wrote the clear down (CC-174). */
export function sendClear(courseKey: string, runId: string, hash: string, keys: string, claimedTicks?: number): void { // counted only: no tag, nothing for the board (CC-108)
  void fetch('/api/course-clear', {
    method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ session: session(), courseKey, runId, hash, keys, claimedTicks }),
  }).catch(() => { /* telemetry must never interrupt a run */ });
}

/** One plain sentence for each reason the server gives when it turns a run down (functions/api/course-clear.ts); the status code is the fallback. */
export function publishErrorText(status: number, reason?: string, code?: string, wait?: number | null): string {
  switch (reason) {
    case 'slow_down': case 'slow-down': return shareWaitText(wait ?? 60); // CC-219: the reply says how long to wait
    case 'course-changed': return 'This course changed since your run. Play the new version, then publish.';
    case 'challenge-gone': return 'This challenge course has expired, so your run cannot be added to it.';
    case 'not-listed': return 'Only runs on the listed courses can be published.';
    case 'server-error': return code === 'db-error' ? 'The leaderboard database did not answer. Try again in a minute.' : 'The server hit a problem with this run. Try again, and if it repeats, play the run again from the start.';
    case 'no-course': return 'Only runs on the listed courses can be published.';
    case 'not-a-clear': return 'That run did not reach the finish, so it cannot be published.';
    case 'not-ready': return 'The leaderboard is not ready yet. Try again later.';
    case 'body-too-big': return 'This run is too long to publish.';
    case 'not-possible': return code === 'too-long' ? 'This run is too long to publish.' : code === 'too-fast' || code === 'too-short' ? 'This time is not possible on this course, so it cannot be published.' : 'The keys of this run do not look like a run a person could play, so it cannot be published.';
    case 'bad-run': return 'This run could not be read. Play it again from the start, then publish.';
  }
  return status === 503 ? 'The leaderboard is not ready yet. Try again later.' : status === 429 ? shareWaitText(wait ?? 60) : status === 409 ? 'This course changed since your run. Play the new version, then publish.' : status === 404 ? 'Only runs on the listed courses can be published.' : status === 413 ? 'This run is too long to publish.' : status === 422 ? 'That run cannot be published.' : 'The server could not take this run. Try again in a minute.';
}

export interface PublishReply { retryAfter?: number; published: boolean; rank?: number | null; players?: number; nick?: string; why?: string; error?: string }
/** CC-219: a run waits in this browser until it is shared or published, so a pause from the server never costs the run (the report also keeps it in memory). */
const HELD = 'cc.unshared';
export function holdRun(courseKey: string, hash: string, keys: string): void { try { localStorage.setItem(HELD, JSON.stringify({ courseKey, hash, keys, at: Date.now() })); } catch { /* keep going */ } }
export function releaseRun(courseKey: string, hash: string): void { try { const h = JSON.parse(localStorage.getItem(HELD) ?? 'null') as { courseKey?: string; hash?: string } | null; if (h && h.courseKey === courseKey && h.hash === hash) localStorage.removeItem(HELD); } catch { /* keep going */ } }
export const heldRun = (): { courseKey: string; hash: string; keys: string; at: number } | null => { try { return JSON.parse(localStorage.getItem(HELD) ?? 'null'); } catch { return null; } };

/** The player clicked Publish to Leaderboard: the same run is sent again with the tag, the server plays it again, and the reply says the place. */
export async function publishClear(courseKey: string, runId: string, hash: string, keys: string, claimedTicks: number, nick: string): Promise<PublishReply> {
  holdRun(courseKey, hash, keys);
  try {
    const res = await fetch('/api/course-clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: session(), courseKey, runId, hash, keys, claimedTicks, nick, publish: true }) });
    const d = await res.json().catch(() => ({})) as Partial<PublishReply> & { verified?: boolean; reason?: string; code?: string };
    if (res.status === 202) return { published: false, error: 'The server is busy. Try again in a minute.' };
    if (!res.ok) { const wait = waitFromReply(res.status, d, res.headers.get('retry-after')); return { published: false, error: publishErrorText(res.status, d.reason, d.code, wait), retryAfter: wait ?? undefined }; }
    releaseRun(courseKey, hash);
    return { published: !!d.published, rank: d.rank, players: d.players, nick: d.nick, why: d.why };
  } catch { return { published: false, error: 'No connection. Try again.' }; }
}

function courseSource(): string {
  const p = pageQuery();
  if (p.has('generate')) return 'generated';
  if (p.has('coaster')) return 'coaster-builder';
  const path = p.get('course');
  if (path) return path.startsWith('/assets/experiments/osm/') ? 'real-place' : path.startsWith('/assets/demo/') ? 'demo' : 'course-file';
  return 'default';
}

export function courseKey(name: string): string {
  const p = pageQuery();
  if (p.has('generate')) return `generated-${p.get('generate')}`;
  if (p.has('coaster')) return 'coaster-custom';
  const path = p.get('course');
  if (path) return path.replace(/^\/assets\//, '').replace(/\.course\.json$/, '').replace(/[^a-zA-Z0-9_/-]/g, '-').slice(0, 100); // the slash stays: the server and the cards name a course 'demo/training' (a dash here dropped every start event)
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'unnamed-course';
}

/** CC-108: one funnel step for this visitor (once per page load; the server keeps one per day). */
export const trackStep = (step: string): void => sendStep(step, session());

export function session(): string {
  try {
    let s = localStorage.getItem('cc.session');
    if (!s) { s = crypto.randomUUID(); localStorage.setItem('cc.session', s); }
    return s;
  } catch { return 'no-storage-' + Math.random().toString(36).slice(2, 12); }
}

export function initFeedback(mode: string): void {
  if (pageQuery().get('feedback') !== 'old') { initFeedbackCard(mode); return; } // the new card; ?feedback=old brings the old round form back
  const btn = document.createElement('button');
  btn.textContent = 'Feedback';
  btn.id = 'cc-feedback-btn';
  btn.title = 'Tell us what you think. Every field is optional, and you can send at any time.';
  btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:50;font:700 15px system-ui,sans-serif;border:2px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:999px;padding:9px 18px;cursor:pointer;box-shadow:0 4px 16px #0005';
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
  card.innerHTML = `<h2 style="margin:0;font-size:20px">${round.title}</h2><p style="margin:0;color:#58635d">${round.intro}</p><p style="margin:0;background:#e6f2ee;border:1px solid #0f6b5c;border-radius:8px;padding:8px 10px;font-weight:600">Every field is optional. You can press Send at any time, even with nothing filled in, and keep playing.</p>`;
  const answers: Record<string, string | number> = {};
  // Send sits at the top as well as the bottom, so the form can be sent at any moment without scrolling.
  const note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:#58635d';
  const topRow = document.createElement('div'); topRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;align-items:center';
  const topSend = document.createElement('button'); topSend.type = 'submit'; topSend.textContent = 'Send now'; topSend.style.cssText = btnCss(true);
  topRow.append(note, topSend); card.appendChild(topRow);
  const conditional: { q: Question; box: HTMLElement }[] = [];
  const refresh = () => {
    for (const { q, box } of conditional) {
      const show = !!q.when && q.when.values.includes(String(answers[q.when.id] ?? ''));
      box.hidden = !show;
      box.style.display = show ? 'grid' : 'none'; // the box carries an inline display:grid, which would beat the hidden attribute
      if (!show) delete answers[q.id];
    }
  };
  for (const q of round.questions) {
    if (q.section) {
      const h = document.createElement('h3');
      h.textContent = q.section; h.style.cssText = 'margin:6px 0 0;font-size:16px';
      card.appendChild(h);
      if (q.section.startsWith('Part 2')) {
        const hint = document.createElement('p');
        hint.textContent = 'More questions appear here for the features you ticked in Part 1.';
        hint.style.cssText = 'margin:0;color:#58635d;font-size:13px';
        card.appendChild(hint);
      }
    }
    const box = document.createElement('fieldset');
    box.style.cssText = 'border:0;padding:0;margin:0;display:grid;gap:6px';
    const lg = document.createElement('legend'); lg.textContent = q.text; lg.style.cssText = 'font-weight:600;padding:0'; box.appendChild(lg);
    if (q.about) {
      const about = document.createElement('div');
      about.textContent = q.about; about.style.cssText = 'color:#58635d';
      box.appendChild(about);
    }
    const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center'; box.appendChild(row);
    if (q.type === 'scale') {
      for (let n = 1; n <= 5; n++) row.appendChild(chip(String(n), () => { answers[q.id] = n; paint(row, String(n)); refresh(); }));
      const hint = document.createElement('div'); hint.textContent = '1 = not at all · 5 = completely'; hint.style.cssText = 'font-size:12px;color:#58635d'; box.appendChild(hint);
    } else if (q.type === 'choice' || q.type === 'seen') {
      for (const o of q.options ?? []) row.appendChild(chip(o, () => { answers[q.id] = o; paint(row, o); refresh(); }));
      if (q.type === 'seen' && q.href) {
        const open = document.createElement('a');
        open.textContent = 'Open →'; open.href = q.href; open.target = '_blank'; open.rel = 'noopener';
        open.style.cssText = 'font:600 14px system-ui,sans-serif;color:#0f6b5c';
        row.appendChild(open);
      }
    } else if (q.type === 'multi') {
      // several chips can be on; the answer is the ticked options joined with a comma (the server stores text, so the database does not change)
      const on = new Set<string>();
      for (const o of q.options ?? []) row.appendChild(chip(o, () => {
        if (on.has(o)) on.delete(o); else on.add(o);
        if (on.size) answers[q.id] = [...on].join(', '); else delete answers[q.id];
        paintMany(row, on);
      }));
    } else {
      const t = document.createElement('textarea'); t.rows = 2; t.maxLength = 600; t.style.cssText = 'font:inherit;border:1px solid #b9c2bb;border-radius:8px;padding:6px;width:100%';
      t.oninput = () => { if (t.value.trim()) answers[q.id] = t.value.trim(); else delete answers[q.id]; };
      box.appendChild(t);
    }
    if (q.when) conditional.push({ q, box });
    card.appendChild(box);
  }
  refresh();
  const trap = document.createElement('input'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.style.cssText = 'position:absolute;left:-9999px'; card.appendChild(trap);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
  const close = () => { wrap.remove(); };
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Close'; cancel.style.cssText = btnCss(false); cancel.onclick = close;
  const send = document.createElement('button'); send.type = 'submit'; send.textContent = 'Send'; send.style.cssText = btnCss(true);
  row.append(cancel, send); card.appendChild(row);
  card.onsubmit = async (e) => {
    e.preventDefault();
    // Every field is optional, so an empty form sends too: it still tells us someone looked.
    send.disabled = true; topSend.disabled = true; note.textContent = 'Sending…';
    try {
      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstile: await turnstileToken(), round: round.round, session: session(), build: __BUILD__, mode, answers, website: trap.value, context: { ...counters, w: innerWidth, h: innerHeight, rookie: safe('cc.rookie'), where: whereNow(mode) } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      card.innerHTML = '<h2 style="margin:0;font-size:20px">Thank you!</h2><p>Your answers were saved. You can keep playing.</p>';
      const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Close'; ok.style.cssText = btnCss(true); ok.onclick = () => wrap.remove(); card.appendChild(ok);
    } catch { note.textContent = 'Sorry, that did not send. Please try again in a minute.'; send.disabled = false; topSend.disabled = false; }
  };
  wrap.appendChild(card);
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  document.body.appendChild(wrap);
}

// Where the player was when they opened the form (a course file, a generated seed, a place, or the mode), so an answer like "the second bar" can be placed.
function whereNow(mode: string): string {
  const p = pageQuery();
  const c = p.get('course') ?? (p.has('generate') ? `generate-${p.get('generate')}` : p.has('coaster') ? 'coaster' : '');
  return (c ? `${mode}:${c}` : mode).replace(/^\/assets\//, '').slice(0, 60);
}
const safe = (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const btnCss = (primary: boolean) => `font:inherit;border:1px solid ${primary ? '#0f6b5c' : '#b9c2bb'};background:${primary ? '#0f6b5c' : '#fff'};color:${primary ? '#fff' : '#17201d'};border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:${primary ? 700 : 400}`;
function chip(label: string, on: () => void): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = label;
  b.style.cssText = 'font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:999px;padding:4px 12px;cursor:pointer';
  b.onclick = on; return b;
}
function paintMany(row: HTMLElement, values: Set<string>): void {
  row.querySelectorAll('button').forEach((b) => { const on = values.has((b as HTMLButtonElement).dataset.v ?? ''); (b as HTMLElement).style.background = on ? '#17201d' : '#fff'; (b as HTMLElement).style.color = on ? '#fff' : '#17201d'; });
}
function paint(row: HTMLElement, value: string): void {
  row.querySelectorAll('button').forEach((b) => { const on = (b as HTMLButtonElement).dataset.v === value; (b as HTMLElement).style.background = on ? '#17201d' : '#fff'; (b as HTMLElement).style.color = on ? '#fff' : '#17201d'; });
}
