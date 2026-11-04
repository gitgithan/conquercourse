import { isHold } from '../../slice/holds-world';
import { diffProposal, type Proposal } from '../../slice/preview';
import { ROLE_NAME, applySuggestion, movesInWorld, suggestRoles, type Role, type RoleSuggestion } from '../../slice/roles';
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
  movesBtn.onclick = () => { document.documentElement.dataset.dock = ''; const closed = movesBox.classList.toggle('closed'); movesBtn.setAttribute('aria-pressed', String(!closed)); if (!closed) renderMoves(); };
  const laneNow = () => ({ angle: ed.angle, offset: ed.offset, level: ed.level });
  function roleProposal(sg: RoleSuggestion): Proposal {
    const next = applySuggestion(ed.pieces, sg);
    return diffProposal('role', 'A way to use a piece', ed.pieces, laneNow(), next, laneNow(), [sg.words], sg.proved === true ? true : undefined);
  }
  function findWays(only?: number) {
    if (ed.movesBusy) return;
    ed.movesBusy = only === undefined ? 'the world' : 'this piece'; renderMoves();
    setTimeout(() => {
      const items = suggestRoles(coursePieces(), laneNow(), { budgetMs: 40000, ...(only !== undefined ? { only } : {}) }).filter((x) => x.proved);
      ed.movesList = { label: only === undefined ? 'Ways to add a missing move (each one checked by the simulator)' : 'What this piece could be (each one checked by the simulator)', items };
      ed.movesBusy = ''; document.documentElement.dataset.roleSuggestions = String(items.length); renderMoves();
    }, 30);
  }
  function renderMoves() {
    if (movesBox.classList.contains('closed')) return;
    movesBox.replaceChildren();
    const hd = el('div', movesBox, { className: 'row' });
    el('strong', hd, { text: 'Moves in this world' });
    el('button', hd, { text: '✕', id: 'closemoves', title: 'Hide' }).onclick = () => { document.documentElement.dataset.dock = ''; movesBox.classList.add('closed'); movesBtn.setAttribute('aria-pressed', 'false'); };
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
      el('button', row, { text: 'What could this be?', id: 'whatcould' }).onclick = () => findWays(sel.id);
    }
    el('button', movesBox, { text: ed.movesBusy ? `Checking ${ed.movesBusy} with the simulator…` : 'Find ways to add the missing moves', id: 'findways', className: 'go' }).onclick = () => findWays();
    if (ed.movesBusy) (document.getElementById('findways') as HTMLButtonElement).disabled = true;
    if (ed.movesList) {
      el('strong', movesBox, { text: ed.movesList.label });
      if (!ed.movesList.items.length) el('div', movesBox, { className: 'muted', text: 'No single change gives a missing move here. Try other pieces, or scale one by hand.' });
      for (const sg of ed.movesList.items) {
        const row = el('div', movesBox, { className: 'sg' });
        el('div', row, { text: sg.words });
        const btns = el('div', row, { className: 'row' });
        // Show it keeps this list open, so the next suggestion is one click away; Apply is on the preview card once the simulator has checked it
        el('button', btns, { text: 'Show it', title: 'See where it would go before anything changes' }).onclick = () => { ed.leadText = ''; document.documentElement.dataset.dock = 'both'; showProposal(roleProposal(sg)); };
      }
    }
  }
  return { renderMoves };
}
