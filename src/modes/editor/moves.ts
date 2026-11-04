import { rolesInWorker } from '../../slice/roles-client';
import { isHold } from '../../slice/holds-world';
import { diffProposal, type Proposal } from '../../slice/preview';
import { ROLE_NAME, applySuggestion, movesInWorld, type RoleProgress, type Role, type RoleSuggestion } from '../../slice/roles';
import { el } from './dom';
import { isDevice, isSizeReference, type EditorState, type P } from './state';
import type { EditorLane } from './lane';
import type { Helper } from './helper';

export interface MovesEnv { ed: EditorState; lane: EditorLane; planWrap: HTMLElement; addBarPiece: (x: number, y: number, z?: number) => P; changed: () => void; helper: Helper }

// The Moves window: which moves this world has and lacks, what each piece could be; every suggestion is proved by the simulator and goes through the shared preview.
export function createMoves(env: MovesEnv) {
  const { ed, planWrap, helper } = env;
  const { coursePieces } = env.lane;
  const { addBarPiece, changed } = env;
  const { showProposal } = helper;
  // ---- the Moves window (CC-43): which moves this world has and lacks, and what each piece could be; every suggestion is proved by the simulator and goes through the shared preview
  const movesBox = el('div', planWrap, { className: 'panel moves closed', id: 'moves' });
  const movesBtn = el('button', planWrap, { text: 'Moves', id: 'movesbtn', title: 'Which moves this world has, what each needs, and what your pieces could be' }); // a chip on the picture, so the top bar does not grow a line
  movesBtn.style.cssText = 'position:absolute;left:10px;top:10px;z-index:6';
  movesBtn.setAttribute('aria-pressed', 'false');
  movesBtn.onclick = () => { document.documentElement.dataset.dock = ''; const closed = movesBox.classList.toggle('closed'); movesBtn.setAttribute('aria-pressed', String(!closed)); if (!closed) renderMoves(); else stop('Search cancelled.'); };
  const laneNow = () => ({ angle: ed.angle, offset: ed.offset, level: ed.level });
  function roleProposal(sg: RoleSuggestion): Proposal {
    const next = applySuggestion(ed.pieces, sg);
    return diffProposal('role', 'A way to use a piece', ed.pieces, laneNow(), next, laneNow(), [sg.words], sg.proved === true ? true : undefined);
  }
  let task: ReturnType<typeof rolesInWorker> | null = null, generation = 0;
  let progress: RoleProgress | null = null, message = '', started = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  function clearHeartbeat() { if (heartbeat !== undefined) clearInterval(heartbeat); heartbeat = undefined; }
  function stop(reason: string, redraw = true) {
    generation++; task?.cancel(); task = null; clearHeartbeat();
    if (ed.movesBusy) { ed.movesBusy = ''; progress = null; message = reason; if (redraw) renderMoves(); }
  }
  function paintProgress() {
    const text = movesBox.querySelector<HTMLElement>('#moves-search-status');
    const bar = movesBox.querySelector<HTMLProgressElement>('#moves-search-progress');
    if (!text || !bar) return;
    const elapsed = Math.floor((performance.now() - started) / 1000);
    text.textContent = progress
      ? `Trying change ${progress.index} of ${progress.total}: ${progress.candidate.words} (${progress.verified.length} simulator-verified so far; ${elapsed}s elapsed)`
      : `Preparing suggestions for ${ed.movesBusy}… ${elapsed}s elapsed`;
    if (progress?.total) { bar.max = progress.total; bar.value = Math.max(0, progress.index - 1); }
    else bar.removeAttribute('value');
  }
  async function findWays(only?: number) {
    if (ed.movesBusy) return;
    const token = ++generation;
    ed.movesBusy = only === undefined ? 'the world' : ed.pieces.find((p) => p.id === only)?.name ?? 'this piece';
    ed.movesList = null; message = ''; progress = null; started = performance.now(); renderMoves();
    heartbeat = setInterval(paintProgress, 500);
    task = rolesInWorker(coursePieces(), laneNow(), { budgetMs: 40000, ...(only !== undefined ? { only } : {}), progress: (p) => { if (generation === token) { progress = p; paintProgress(); } } });
    try {
      const result = await task.promise;
      if (generation !== token) return;
      ed.movesList = { label: 'Ways to add a move (each shown result checked by the simulator)', items: result.items };
      message = result.limited ? 'Time limit reached. Only completed, simulator-verified results are shown; other possibilities remain unchecked.' : '';
      document.documentElement.dataset.roleSuggestions = String(result.items.length);
    } catch (error) {
      if (generation !== token) return;
      message = error instanceof Error ? error.message : 'The simulator search failed. Try again.';
    } finally {
      if (generation === token) { task = null; ed.movesBusy = ''; clearHeartbeat(); progress = null; renderMoves(); }
    }
  }
  const dispose = () => { stop('Search cancelled.', false); observer.disconnect(); window.removeEventListener('pagehide', dispose); };
  const observer = new MutationObserver(() => { if (!movesBox.isConnected) dispose(); });
  observer.observe(document.body, { childList: true });
  window.addEventListener('pagehide', dispose);
  function renderMoves() {
    if (movesBox.classList.contains('closed')) return;
    movesBox.replaceChildren();
    const hd = el('div', movesBox, { className: 'row' });
    el('strong', hd, { text: 'Moves in this world' });
    el('button', hd, { text: '✕', id: 'closemoves', title: 'Hide' }).onclick = () => { document.documentElement.dataset.dock = ''; movesBox.classList.add('closed'); stop('Search cancelled.'); movesBtn.setAttribute('aria-pressed', 'false'); };
    const status = movesInWorld(coursePieces(), laneNow(), { trebuchet: !!ed.trebuchetKg });
    document.documentElement.dataset.moves = JSON.stringify(Object.fromEntries(status.map((m) => [m.id, m.have])));
    for (const m of status) {
      const row = el('div', movesBox, { className: 'mv' });
      el('span', row, { className: `mvicon ${m.have === 'yes' ? 'yes' : m.have === 'no' ? 'no' : 'muted'}`, text: m.have === 'yes' ? '✓' : m.have === 'no' ? '+' : '↗', title: m.have === 'yes' ? 'This world has it' : m.have === 'no' ? 'Missing: it can be added' : 'Built somewhere else' });
      el('span', row, { className: 'mvtext', text: `${m.name}: ${m.detail}` });
      if (m.have !== 'yes') el('span', row, { className: 'need', text: m.need });
      if (m.have === 'no' && m.id === 'lache') el('button', row, { text: 'Add two bars', id: 'addbars', className: 'go' }).onclick = () => { addBarPiece(ed.view.cx - 1.6, 2.9); addBarPiece(ed.view.cx + 1.6, 2.9); changed(); };
      if (m.have === 'no' && m.id === 'trebuchet') el('button', row, { text: 'Start in a trebuchet', id: 'movestreb' }).onclick = () => document.getElementById('addtreb')?.click();
      if (m.have === 'elsewhere') { const a = el('a', row, { text: 'Open the coaster builder', href: '?mode=coaster' }); a.className = 'btn'; }
    }
    const sel = ed.pieces.find((q) => q.id === ed.selected);
    if (sel && !isHold(sel) && !isSizeReference(sel) && !isDevice(sel)) {
      const row = el('div', movesBox, { className: 'sg' });
      el('div', row, { text: `Selected piece: ${sel.name}` });
      const lab = el('label', row, { text: 'Use it as ' });
      const pick = el('select', lab, { id: 'rolepick' });
      for (const r of ['ground', 'wall', 'rope', 'trampoline', 'bar'] as Role[]) el('option', pick, { value: r, text: ROLE_NAME[r] });
      pick.value = sel.role ?? 'ground';
      pick.onchange = () => { sel.role = pick.value === 'ground' ? undefined : (pick.value as Role); changed(); };
      const what = el('button', row, { text: 'What could this be?', id: 'whatcould' }); what.disabled = !!ed.movesBusy; what.onclick = () => void findWays(sel.id);
    }
    el('button', movesBox, { text: ed.movesBusy ? `Checking ${ed.movesBusy} with the simulator…` : 'Find ways to add the missing moves', id: 'findways', className: 'go' }).onclick = () => findWays();
    if (ed.movesBusy) {
      (movesBox.querySelector('#findways') as HTMLButtonElement).disabled = true;
      const box = el('div', movesBox, { className: 'sg' });
      const status = el('div', box, { id: 'moves-search-status' }); status.setAttribute('role', 'status');
      const bar = el('progress', box, { id: 'moves-search-progress' }); bar.style.width = '100%'; bar.setAttribute('aria-label', 'Changes tried');
      el('div', box, { className: 'muted', text: 'You can keep editing. Editing or closing Moves cancels this search; nothing changes until Preview and Apply.' });
      el('button', box, { id: 'moves-search-cancel', text: 'Cancel search' }).onclick = () => stop('Search cancelled. No changes made.');
      paintProgress();
    }
    if (message) el('div', movesBox, { className: 'sg', text: message });
    if (ed.movesList) {
      el('strong', movesBox, { text: ed.movesList.label });
      if (!ed.movesList.items.length) el('div', movesBox, { className: 'muted', text: 'No verified suggestion was found in this search. Try one piece, or adjust a piece by hand.' });
      for (const sg of ed.movesList.items) {
        const row = el('div', movesBox, { className: 'sg' });
        el('div', row, { text: sg.words });
        const btns = el('div', row, { className: 'row' });
        // Show it keeps this list open, so the next suggestion is one click away; Apply is on the preview card once the simulator has checked it
        el('button', btns, { text: 'Show it', className: 'go', title: 'See where it would go before anything changes' }).onclick = () => { ed.leadText = ''; document.documentElement.dataset.dock = 'both'; showProposal(roleProposal(sg)); };
      }
    }
  }
  return { renderMoves, dispose, onChanged: () => { const busy = !!ed.movesBusy; ed.movesList = null; stop('The world changed. Search again to check the new layout.', false); if (!busy) message = ''; renderMoves(); } };
}
