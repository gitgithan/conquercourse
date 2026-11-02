import { realSize, laneProfile } from '../../slice/world';
import { workSeconds } from '../../sim/ideal';
import { type Ghosts } from '../../slice/view3d';
import { isTrack } from '../../slice/track-world';
import { holdsOf, isHold } from '../../slice/holds-world';
import { type Machine } from '../../slice/launch-lane';
import { PARTNER_PREF_KEY, partnerStartsOpen } from '../../slice/editor-defaults';
import { proves } from '../../slice/photo-proof';
import { fixMachine } from '../../slice/fix-launch';
import { fixBars } from '../../slice/fixbars';
import { fixLayout } from '../../slice/fixit';
import { fixCoaster } from '../../slice/fixcoaster';
import { suggestPrompt } from '../../slice/suggest-prompt';
import { type Advice } from '../../slice/advice';
import { sayBadge, saysOn } from '../../ui/says';
import { barsInWorker, fixInWorker, provesInWorker } from '../../slice/proof-client';
import { parseReply, worldBrief } from '../../slice/designer';
import { diffProposal, enabledCount, fromAdvice, fromEdits, resultOf, type Proposal } from '../../slice/preview';
import { shortcutLine, type Shortcut } from '../../sim/shortcuts';
import { closeShortcut } from '../../slice/shortcut-close';
import { makeItEasier } from '../../slice/easier';
import { el } from './dom';
import type { Tools } from './tools';
import { isDevice, isSizeReference, type EditorState, type P } from './state';
import type { EditorLane } from './lane';
import type { EditHandoff } from '../../slice/roundtrip';

// What the helper panel needs from the editor: the state, what is derived from it, and a few things only the editor's closure owns.
export interface HelperEnv {
  ed: EditorState;
  lane: EditorLane;
  root: HTMLElement; top: HTMLElement; aside: HTMLElement;
  chosen: () => number[]; draw: () => void; drawProfile: () => void; changed: () => void;
  handoff: EditHandoff | null; goToCourse: (check?: boolean) => Promise<void>;
  tools: Tools;
}

// The design partner panel: Fix it, Make it easier, routes you did not plan, the partner's advice and chat, and the preview every proposal goes through before it changes anything.
export function createHelper(env: HelperEnv) {
  const { ed, lane, root, top, aside } = env;
  const { updateDeviceSource, barsNow, machineNow, trebuchetPivot, machineWrap, courseNow, courseFor, xOfPiece } = lane;
  const { chosen, drawProfile, draw, changed, handoff, goToCourse, tools } = env;
  // ---- helpers: what to shift when the lane cannot be cleared, and a design partner (Muse Spark Open) to talk it through
  const helper = el('div', aside, { className: 'panel helper', id: 'helper' });
  const head = el('div', helper, { className: 'row' });
  const partnerTitle = el('strong', head, { text: 'Design partner' });
  if (saysOn()) { const line = document.createElement('div'); line.className = 'says-line'; line.style.cssText = 'flex:1 0 100%;margin:0'; line.append(sayBadge('partner')); partnerTitle.replaceWith(line); } // CC-243: the badge names the speaker and its model
  el('button', head, { text: 'Fix it', id: 'fixit', className: 'go', title: 'Show a layout the simulator can clear, before anything changes' }).onclick = () => runFix();
  el('button', head, { text: 'Make it easier', id: 'easier', title: 'Show the smallest change that makes the hardest press easier to land' }).onclick = () => runEasier();
  const closeHelper = el('button', head, { text: '✕', id: 'closehelper', title: 'Hide' });
  const selRow = el('label', helper, { className: 'muted', title: 'Fix it and Suggest Fix move only the pieces you have chosen, and leave the lane where it is' });
  const fixSel = el('input', selRow, { type: 'checkbox', id: 'fixsel' }); selRow.append('Move only the chosen pieces');
  const adviceBox = el('div', helper, { id: 'advice' });
  // CC-243: a ready question for the partner: Suggest Fix when the lane cannot be cleared, Suggest More when it can
  const suggestBtn = el('button', head, { text: 'Suggest More', id: 'suggest', title: 'Ask the design partner, with the question already written' });
  const setSuggest = (clear: boolean | null) => { suggestBtn.textContent = clear === false ? 'Suggest Fix' : 'Suggest More'; suggestBtn.classList.toggle('go', clear === false); suggestBtn.dataset.kind = clear === false ? 'fix' : 'more'; };
  // ---- routes you did not plan (CC-71): the simulator looks for lines that skip an obstacle; Close it previews a change that shuts one, Keep it marks it as meant
  let routesWorker: Worker | null = null;
  const routesHead = el('div', helper, { className: 'row', id: 'routeshead' });
  const findRoutesBtn = el('button', routesHead, { text: 'Look for routes you did not plan', id: 'findroutes', title: 'The simulator tries the course with each bar, wall or rope taken away and tells you which skips are faster' });
  const routesBox = el('div', helper, { id: 'routes' });
  const routesBrief = () => ed.routes.filter((r) => !ed.designed.has(r.id)).map((r) => shortcutLine(r));
  function renderRoutes() {
    routesBox.replaceChildren();
    if (!ed.routes.length) { el('div', routesBox, { className: 'muted', text: 'No route that skips an obstacle is faster than the planned line.' }); return; }
    for (const s of ed.routes) {
      const row = el('div', routesBox, { className: 'row', id: `route-${s.id}` });
      el('span', row, { text: shortcutLine(s) + (ed.designed.has(s.id) ? ' (kept: meant by the designer)' : '') });
      el('button', row, { text: 'Close it', className: 'go', title: 'See a change that shuts this route before anything moves' }).onclick = () => closeRoute(s);
      el('button', row, { text: ed.designed.has(s.id) ? 'Unkeep' : 'Keep it', title: 'Mark this route as meant: it stays, and is drawn as a dashed arrow' }).onclick = () => { if (ed.designed.has(s.id)) ed.designed.delete(s.id); else ed.designed.add(s.id); renderRoutes(); drawProfile(); };
    }
  }
  function lookForRoutes() {
    findRoutesBtn.disabled = true; routesBox.replaceChildren(); el('div', routesBox, { className: 'muted', text: 'Looking for routes (about a minute)…' });
    const done = (list: Shortcut[]) => { ed.routes = list; findRoutesBtn.disabled = false; renderRoutes(); drawProfile(); document.documentElement.dataset.routes = String(list.length); };
    try {
      routesWorker ??= new Worker(new URL('../sim/shortcuts-worker.ts', import.meta.url), { type: 'module' });
      routesWorker.onmessage = (e: MessageEvent) => done((e.data.shortcuts as Shortcut[]) ?? []);
      routesWorker.postMessage({ course: courseNow() });
    } catch { done([]); }
  }
  findRoutesBtn.onclick = lookForRoutes;
  function closeRoute(s: Shortcut) {
    reply.className = 'reply'; reply.textContent = 'Working out a change that closes it… (up to two minutes)'; helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    setTimeout(() => {
      const now = { angle: ed.angle, offset: ed.offset, level: ed.level }, r = closeShortcut(ed.pieces as P[], now, s);
      if (!r.ok) { reply.className = 'reply bad'; reply.textContent = r.steps.join(' '); return; }
      ed.leadText = '';
      showProposal(diffProposal('shortcut', `Close the shortcut: ${s.how}`, ed.pieces, now, r.pieces, now, r.steps, true));
    }, 30);
  }
  const reply = el('div', helper, { className: 'reply muted', id: 'reply', text: 'Ask for a change, or press "What should I change?".' });
  const askRow = el('div', helper, { className: 'row' });
  const ask = el('textarea', askRow, { id: 'ask', rows: 2, placeholder: 'e.g. make the gap easier, or a harder second half' });
  const sendBtn = el('button', askRow, { text: 'Ask', id: 'send', className: 'go' });
  const whatBtn = el('button', askRow, { text: 'What should I change?', id: 'what' });
  suggestBtn.onclick = () => {
    const clear = document.documentElement.dataset.laneClear !== '0';
    ask.value = suggestPrompt(clear, ed.pieces.filter((q) => !isSizeReference(q) && !isDevice(q)).map((q) => ({ name: q.name, x: q.x, heightM: realSize(q).h + q.y })));
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    sendBtn.click();
  };
  const helperBtn = el('button', top, { text: 'Design partner', id: 'helperbtn', title: 'Show or hide the design partner' });
  // CC-243: the partner slides in from the right edge; a tab rides its edge, Esc closes it, and the last choice is remembered
  const partnerTab = el('button', root, { id: 'partnertab', text: 'Design partner', title: 'Show or hide the design partner' });
  const syncPartner = () => {
    const open = !helper.classList.contains('closed');
    helperBtn.setAttribute('aria-pressed', String(open)); partnerTab.classList.toggle('open', open); partnerTab.setAttribute('aria-expanded', String(open));
  };
  // CC-200: hidden by default; only a hand choice (tab, bar button, close, Esc) is remembered, so a partner that opened itself to answer does not stay open next time
  const rememberPartner = () => { try { localStorage.setItem(PARTNER_PREF_KEY, helper.classList.contains('closed') ? '0' : '1'); } catch { /* private window */ } };
  let wasOpen = false; try { wasOpen = partnerStartsOpen(localStorage.getItem(PARTNER_PREF_KEY)); } catch { /* private window */ }
  helper.classList.toggle('closed', !wasOpen); syncPartner();
  new MutationObserver(syncPartner).observe(helper, { attributes: true, attributeFilter: ['class'] });
  helperBtn.onclick = partnerTab.onclick = () => { helper.classList.toggle('closed'); rememberPartner(); };
  closeHelper.onclick = () => { helper.classList.add('closed'); helperBtn.setAttribute('aria-pressed', 'false'); rememberPartner(); };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !helper.classList.contains('closed') && helper.contains(document.activeElement)) { helper.classList.add('closed'); rememberPartner(); } });

  // ---- preview before apply: Fix it, the partner's changes and one piece of advice all become a Proposal that is drawn as outlines first
  const proofs = new Map<string, boolean>();
  const keyOf = (pr: Proposal) => pr.items.map((i) => (i.on ? '1' : '0')).join('');
  const ghostData = (): Ghosts | null => {
    if (!ed.proposal || !ed.preview) return null;
    const items = ed.proposal.items.flatMap((i) => (i.kind === 'piece' && i.on ? [{ id: i.id, from: i.from, to: i.to }] : []));
    const laneMoved = ed.proposal.items.some((i) => i.kind === 'lane' && i.on && i.key !== 'level');
    return { items, lane: laneMoved ? { angle: ed.preview.lane.angle, offset: ed.preview.lane.offset } : null };
  };
  async function computeFix(ps: P[], lane: { angle: number; offset: number; level: number }): Promise<{ ok: boolean; pieces: P[]; lane: { angle: number; offset: number; level: number }; steps: string[]; machine: Machine | null }> {
    const m = machineNow(), wrap = machineWrap(m); // a machine's wrap is a function, which a worker cannot be sent: with a machine the proofs run here, without one they run in a worker
    ps = ps.filter((q) => !isSizeReference(q) && !isDevice(q)); // the machine and the size references are not ground
    if (m) { const mf = fixMachine(ps, lane, m, 40000, trebuchetPivot()); if (mf.ok) return { ok: true, pieces: ps, lane, steps: mf.steps, machine: mf.machine }; } // the machine first: a counterweight or an arm is a smaller change than moving pieces
    if (ps.some(isTrack)) { const fc = fixCoaster(ps, lane); return { ok: fc.ok, pieces: fc.pieces, lane, steps: fc.steps, machine: m }; } // CC-244: a coaster world moves sections and bars, never the lane
    if (ps.some(isHold)) { const rb = m ? fixBars(ps, lane, workSeconds(40), wrap) : await barsInWorker(ps, lane, workSeconds(40)); return { ok: rb.ok, pieces: rb.pieces, lane, steps: rb.steps, machine: m }; }
    const only = fixSel.checked ? chosen().filter((id) => ps.some((q) => q.id === id)) : []; // CC-243: with pieces chosen, only those may move and the lane stays
    const r = m ? fixLayout(ps, lane, workSeconds(12), wrap, only.length ? { movable: only } : {}) : await fixInWorker(ps, lane, only.length ? only : undefined);
    return { ok: r.ok, pieces: r.pieces as P[], lane: r.lane, steps: r.steps, machine: m };
  }
  function runFix(from?: { pieces: P[]; lane: { angle: number; offset: number; level: number } }) {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    reply.className = 'reply'; reply.textContent = 'Working it out…' + (ed.pieces.some(isHold) ? ' (bars take a while: up to 40 seconds)' : '');
    setTimeout(async () => {
      if (tools.fix({ reply, changed })) return; // a plank, drone, launcher or band the proof names: the smallest change is said in words first
      const now = { angle: ed.angle, offset: ed.offset, level: ed.level }, start = from ?? { pieces: ed.pieces, lane: now };
      const r = await computeFix(start.pieces, start.lane).catch(() => null);
      if (!r) { reply.className = 'reply bad'; reply.textContent = 'Fix it was stopped. Try again.'; return; }
      document.documentElement.dataset.fixed = r.ok ? '1' : '0';
      const prop = diffProposal('fixit', from ? 'Fix it, starting from your partner’s changes' : 'Fix it', ed.pieces, now, r.pieces, r.lane, r.steps, r.ok, machineNow(), r.machine);
      if (!prop.items.length) {
        reply.className = r.ok ? 'reply ok' : 'reply bad';
        reply.textContent = r.ok ? 'It already works.' : ed.pieces.some(isHold) ? r.steps.join(' ') : 'I could not find a layout that works. ' + r.steps.join(' ') + ' Try other pieces.';
        return;
      }
      ed.leadText = '';
      showProposal(prop);
    }, 30);
  }
  // Make it easier: the simulator knows the lane clears, but the hardest press is narrow; try the smallest changes near the obstacle and show the first that widens it
  function runEasier() {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    reply.className = 'reply'; reply.textContent = 'Looking for the smallest change that makes the hardest press easier… (up to ' + (ed.pieces.some(isHold) ? '2 minutes' : '40 seconds') + ')';
    setTimeout(async () => {
      const c0 = courseNow(), lane = { angle: ed.angle, offset: ed.offset, level: ed.level };
      const at = ed.pieces.find((q) => q.id === ed.selected);
      const x = at ? xOfPiece(at, c0) : handoff?.x ?? c0.startX;
      const r = await makeItEasier(ed.pieces, lane, x, { courseOf: courseFor, xOf: (q) => xOfPiece(q, c0) }, undefined, (n, total) => { reply.textContent = `Trying change ${n} of ${total}…`; });
      document.documentElement.dataset.easier = r.proposal ? '1' : '0';
      if (!r.proposal) { reply.className = 'reply muted'; reply.textContent = r.note; return; }
      ed.leadText = '';
      showProposal(r.proposal);
    }, 30);
  }
  function showProposal(pr: Proposal) {
    helper.classList.remove('closed'); helperBtn.setAttribute('aria-pressed', 'true');
    ed.proposal = pr; proofs.clear();
    if (pr.known !== undefined) proofs.set(keyOf(pr), pr.known);
    renderProposal(); updatePreview();
    document.documentElement.dataset.previewItems = String(pr.items.length);
  }
  function closePreview(message?: string) {
    ed.proposal = null; ed.preview = null; ed.previewProfile = null; ed.previewBars = []; ed.proofRun++;
    document.documentElement.dataset.preview = '';
    if (message) { reply.className = 'reply muted'; reply.textContent = message; }
    draw(); drawProfile();
  }
  function renderProposal() {
    const pr = ed.proposal;
    if (!pr) return;
    reply.className = 'reply'; reply.replaceChildren();
    if (ed.leadText) el('div', reply, { text: ed.leadText });
    el('strong', reply, { text: pr.title });
    el('div', reply, { className: 'muted', text: 'The outlines show where things would go (grey: now, teal: after). Nothing changes until you press Apply.' });
    if (pr.source === 'easier') for (const st of pr.steps) el('div', reply, { className: 'ok', text: st });
    for (const it of pr.items) {
      const row = el('label', reply, { className: 'pvrow' });
      const cb = el('input', row, { type: 'checkbox', checked: it.on });
      cb.onchange = () => { it.on = cb.checked; updatePreview(); };
      el('span', row, { text: it.words });
    }
    el('div', reply, { id: 'previewverdict', className: 'muted' });
    const row = el('div', reply, { className: 'row', id: 'previewbuttons' });
    el('button', row, { text: 'Apply', id: 'applypreview', className: 'go' }).onclick = applyProposal;
    if (handoff) el('button', row, { text: 'Apply and try it', id: 'applytry', className: 'go', title: 'Apply the changes and play again from the last checkpoint' }).onclick = () => { applyProposal(); void goToCourse(true); };
    el('button', row, { text: 'Cancel', id: 'cancelpreview' }).onclick = () => closePreview('Cancelled: nothing changed.');
  }
  function paintVerdict(state: 'checking' | 'clears' | 'blocked' | 'none') {
    const v = document.getElementById('previewverdict'), apply = document.getElementById('applypreview') as HTMLButtonElement | null, rowEl = document.getElementById('previewbuttons');
    if (!v || !apply || !rowEl) return;
    document.documentElement.dataset.preview = state;
    v.className = state === 'clears' ? 'ok' : state === 'blocked' ? 'bad' : 'muted';
    v.textContent = state === 'checking' ? 'Checking with the simulator…' : state === 'clears' ? 'After this change the lane clears.' : state === 'blocked' ? 'After this change the lane does not clear.' : 'Nothing is switched on.';
    apply.disabled = state === 'none';
    const tryBtn = document.getElementById('applytry') as HTMLButtonElement | null; if (tryBtn) tryBtn.disabled = state === 'none';
    rowEl.querySelector('#fixfromhere')?.remove();
    if (state === 'blocked' && ed.proposal && ed.proposal.source !== 'fixit' && ed.preview) {
      const from = { pieces: ed.preview.pieces, lane: ed.preview.lane };
      el('button', rowEl, { text: 'Fix it from here', id: 'fixfromhere', title: 'Show the smallest further changes that make it clear' }).onclick = () => runFix(from);
    }
  }
  function updatePreview() {
    if (!ed.proposal) { ed.preview = null; ed.previewProfile = null; ed.previewBars = []; return; }
    ed.preview = resultOf(ed.pieces, { angle: ed.angle, offset: ed.offset, level: ed.level }, ed.proposal, machineNow());
    ed.previewProfile = laneProfile(ed.preview.pieces.filter((q) => !isHold(q) && q.role !== 'rope' && q.role !== 'bar'), ed.preview.lane);
    ed.previewBars = holdsOf(ed.preview.pieces, ed.preview.lane);
    draw(); drawProfile();
    const key = keyOf(ed.proposal), mine = ++ed.proofRun;
    if (!enabledCount(ed.proposal)) return paintVerdict('none');
    const known = proofs.get(key);
    if (known !== undefined) return paintVerdict(known ? 'clears' : 'blocked');
    paintVerdict('checking');
    const snapshot = ed.preview;
    setTimeout(async () => { if (mine !== ed.proofRun || !ed.proposal) return; const mp = snapshot.pieces.filter((q) => !isSizeReference(q) && !isDevice(q)); const ok = snapshot.machine ? proves(mp, snapshot.lane, machineWrap(snapshot.machine)) : await provesInWorker(mp, snapshot.lane).catch(() => null); if (ok === null || mine !== ed.proofRun || !ed.proposal) return; proofs.set(key, ok); paintVerdict(ok ? 'clears' : 'blocked'); }, 30);
  }
  function applyProposal() {
    if (!ed.proposal || !ed.preview) return;
    const r = ed.preview, words = ed.proposal.items.filter((i) => i.on).map((i) => i.words).join(' ');
    for (const q of r.pieces) { const mine = ed.pieces.find((x) => x.id === q.id); if (mine) { mine.x = q.x; mine.z = q.z; mine.y = q.y; mine.yaw = q.yaw; mine.scale = q.scale; mine.role = q.role; } }
    ed.angle = r.lane.angle; ed.offset = r.lane.offset; ed.level = r.lane.level;
    if (r.machine && ed.trebuchetKg) { updateDeviceSource('device:trebuchet', `device:trebuchet:${r.machine.counterweight}`); ed.trebuchetExtra = { ...(r.machine.short !== undefined ? { short: r.machine.short } : {}), ...(r.machine.pin !== undefined ? { pin: r.machine.pin } : {}) }; } // the counterweight lives in the machine piece
    ed.proposal = null; ed.preview = null; ed.previewProfile = null; ed.previewBars = []; ed.proofRun++;
    changed(); // one undo step
    reply.className = 'reply ok'; reply.textContent = `Applied. ${words}`;
    document.documentElement.dataset.preview = 'applied';
  }
  const chat: { role: 'user' | 'assistant'; content: string }[] = [];
  const previewAdvice = (a: Advice) => { ed.leadText = ''; showProposal(fromAdvice(ed.pieces, { angle: ed.angle, offset: ed.offset, level: ed.level }, a, machineNow())); };
  function showAdvice() {
    adviceBox.textContent = '';
    for (const a of ed.adviceList) {
      const row = el('div', adviceBox, { className: 'row' });
      el('span', row, { text: a.text });
      el('button', row, { text: 'Show it', className: 'go', title: 'See where it would go before anything changes' }).onclick = () => previewAdvice(a);
    }
  }
  async function askPartner(text: string) {
    chat.push({ role: 'user', content: text });
    reply.className = 'reply'; reply.textContent = 'Thinking…'; sendBtn.disabled = whatBtn.disabled = true;
    try {
      const r = await fetch('/api/designer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: chat.slice(-6), world: worldBrief(ed.pieces, { angle: ed.angle, offset: ed.offset, level: ed.level }, ed.verdict, ed.adviceList.map((a) => a.text), barsNow(), routesBrief()) }) });
      if (r.status === 503) { reply.className = 'reply muted'; reply.textContent = 'The design partner is switched off on this site (no key set).'; return; }
      if (!r.ok) throw new Error(String(r.status));
      const got = parseReply(((await r.json()) as { reply: string }).reply, ed.pieces.map((q) => q.id));
      chat.push({ role: 'assistant', content: got.text });
      reply.textContent = got.text; ed.pendingEdits = got.edits;
      if (got.edits.length) el('button', reply, { text: `Show these ${got.edits.length} change${got.edits.length > 1 ? 's' : ''}`, className: 'go', id: 'applyedits', title: 'See where the pieces would go before anything changes' }).onclick = () => {
        const pr = fromEdits(ed.pieces, { angle: ed.angle, offset: ed.offset, level: ed.level }, ed.pendingEdits);
        if (!pr.items.length) { reply.textContent = got.text + ' (Those changes would not move anything.)'; return; }
        ed.leadText = got.text; showProposal(pr);
      };
    } catch { reply.className = 'reply bad'; reply.textContent = 'The design partner could not answer. Try again.'; }
    finally { sendBtn.disabled = whatBtn.disabled = false; }
  }
  sendBtn.onclick = () => { const t = ask.value.trim(); if (t) { ask.value = ''; void askPartner(t); } };
  whatBtn.onclick = () => void askPartner(ed.verdict.startsWith('The simulator can clear') ? 'The lane clears. Suggest one change that makes it more interesting to run.' : 'The lane does not clear. What should I change?');
  // the editor calls this after every change: a verdict of "cannot" is old now, and an open preview no longer fits
  const onChanged = () => {
    if (reply.textContent?.startsWith('The simulator cannot')) { reply.className = 'reply muted'; reply.textContent = 'You changed the course, so the simulator is checking it again.'; }
    if (ed.proposal) closePreview('The layout changed, so the preview was closed.');
  };
  return { helper, helperBtn, reply, adviceBox, setSuggest, showAdvice, runFix, runEasier, showProposal, closePreview, ghostData, onChanged };
}
export type Helper = ReturnType<typeof createHelper>;
