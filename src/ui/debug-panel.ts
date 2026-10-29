// The debug card (B): a short readout, then one section per kind of overlay, each overlay a switch with its colour swatch.
// Words are few: labels of two to five words; the longer explanation sits in a tooltip or in the closed "What is this?" row, one sentence per line.
export type LayerId = 'ground' | 'body' | 'jump' | 'roll' | 'vault' | 'contact' | 'climb' | 'machine';
export interface Row { label: string; value: string; tip?: string; colour?: string }

// the same drawings as the HUD strip in src/modes/course.ts
const ICON: Record<string, string> = {
  shapes: '<path d="M4 24 H12 V18 H20 V12 H28"/>',
  predictions: '<path d="M3 20 H11 V12 M21 20 H29 V12 M11 12 H3 M21 12 H29 M12 8 Q16 2 20 8"/>',
  contacts: '<path d="M6 28 V13 H19 V28 M13 10 V3 M10 6 L13 3 L16 6"/>',
  machines: '<path d="M5 5 V27 M5 16 H9 L11 9 L15 23 L19 9 L23 23 L25 16 H28"/>',
};
const SECTIONS: { id: string; title: string; layers: [LayerId, string, string, string][] }[] = [
  { id: 'shapes', title: 'Shapes', layers: [['ground', 'Ground', '#ffe14a', 'What you stand on and bump into'], ['body', 'Body', '#2de0ff', 'Your body box and your feet point']] },
  { id: 'predictions', title: 'Predictions', layers: [['jump', 'Path preview', '#38d26b', 'Where the next move goes. Green lands, red does not'], ['roll', 'Roll ring', '#ffb02e', 'Hold X from this ring on']] },
  { id: 'contacts', title: 'Contacts and windows', layers: [['vault', 'Vault path', '#d05cff', 'The vault path, with a tick where to plant'], ['contact', 'Hand contact', '#ff9d2e', 'Where the hands are pinned on the step'], ['climb', 'Climb edge', '#2de0ff', 'The wall edge the hands can take']] },
  { id: 'machines', title: 'Machines', layers: [['machine', 'Machine path', '#38d26b', 'Where a cart, throw, band or drone goes next']] },
];
const EXPLAIN = ['Yellow is what you stand on.', 'Blue is your body.', 'A green path lands.', 'A red path falls or is blocked.', 'Hold X from the orange ring.', 'Purple is the vault path.', 'The orange cross is the hand contact.', 'The cyan ring is the climb edge.'];
const KEY_LAYERS = 'cc.debug.layers', KEY_OPEN = 'cc.debug.open';
const load = <T,>(k: string, d: T): T => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) ?? '{}') }; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* the card works without storage */ } };

const CSS = `#debugpanel{--bg:#10141cf2;--fg:#f3f5f1;--dim:#a9b3aa;--line:#ffffff24;position:fixed;left:16px;top:48px;z-index:22;width:272px;box-sizing:border-box;max-height:calc(100vh - 250px);overflow:auto;background:var(--bg);color:var(--fg);border-radius:12px;padding:8px 10px;font:12px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px #0006}
#debugpanel *{box-sizing:border-box}
#debugpanel button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
#debugpanel button:focus-visible,#debugpanel input:focus-visible{outline:2px solid #ffe14a;outline-offset:2px;border-radius:4px}
#debugpanel .dp-head{display:flex;align-items:center;gap:6px;margin-bottom:4px}
#debugpanel .dp-head b{flex:1;font-size:13px}
#debugpanel .dp-head button{width:22px;height:22px;border-radius:6px;background:#ffffff18;line-height:1}
#debugpanel .dp-rows{display:grid;grid-template-columns:max-content 1fr;gap:1px 10px;padding:4px 0;border-top:1px solid var(--line)}
#debugpanel .dp-rows span{white-space:nowrap}
#debugpanel .dp-rows .k{color:var(--dim)}
#debugpanel .dp-rows .v{font-weight:700;font-variant-numeric:tabular-nums}
#debugpanel .dp-sec>button{display:flex;width:100%;align-items:center;gap:6px;padding:4px 0;border-top:1px solid var(--line);font-weight:700}
#debugpanel .dp-sec svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;color:#e8c04a}
#debugpanel .dp-sec .car{margin-left:auto;color:var(--dim)}
#debugpanel .dp-layer{display:flex;align-items:center;gap:6px;padding:2px 0 2px 22px;cursor:pointer;white-space:nowrap}
#debugpanel .dp-sw{width:12px;height:12px;border-radius:3px;flex:none}
#debugpanel .dp-layer input{margin:0 0 0 auto}
#debugpanel .dp-explain{padding:2px 0 2px 22px;color:var(--dim)}
#debugpanel .dp-foot{display:flex;gap:6px;border-top:1px solid var(--line);padding-top:6px;margin-top:2px}
#debugpanel .dp-foot button{padding:3px 8px;border-radius:6px;background:#ffffff18}`;

export interface DebugPanel {
  el: HTMLElement; layers: Record<LayerId, boolean>;
  show(on: boolean): void; setRows(readout: Row[], now: Row[]): void; text(): string;
  onLayer: (id: LayerId, on: boolean) => void; onClose: () => void;
}

export function createDebugPanel(parent: HTMLElement, on: boolean): DebugPanel {
  if (!document.getElementById('debug-panel-css')) { const s = document.createElement('style'); s.id = 'debug-panel-css'; s.textContent = CSS; document.head.append(s); }
  const layers = load<Record<LayerId, boolean>>(KEY_LAYERS, { ground: true, body: true, jump: true, roll: true, vault: true, contact: true, climb: true, machine: true });
  const open = load<Record<string, boolean>>(KEY_OPEN, {});
  const el = document.createElement('div'); el.id = 'debugpanel'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Debug');
  const api: DebugPanel = { el, layers, show: () => {}, setRows: () => {}, text: () => '', onLayer: () => {}, onClose: () => {} };
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  const head = mk('div', 'dp-head'); head.append(mk('b', '', 'Debug'));
  const body = mk('div'); let collapsed = false;
  const fold = mk('button', '', '–'); fold.title = 'Fold the card'; fold.setAttribute('aria-label', 'Fold the card');
  fold.onclick = () => { collapsed = !collapsed; body.style.display = collapsed ? 'none' : 'block'; fold.textContent = collapsed ? '+' : '–'; };
  const close = mk('button', '', '×'); close.title = 'Close (B)'; close.setAttribute('aria-label', 'Close the debug card'); close.onclick = () => api.onClose();
  head.append(fold, close);

  const readout = mk('div', 'dp-rows'), now = mk('div', 'dp-rows');
  body.append(readout, now);
  for (const s of SECTIONS) {
    const sec = mk('div', 'dp-sec'); const hd = mk('button'); hd.setAttribute('aria-expanded', String(!!open[s.id]));
    hd.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${ICON[s.id]}</svg><span>${s.title}</span><span class="car">${open[s.id] ? '▾' : '▸'}</span>`;
    const list = mk('div'); list.style.display = open[s.id] ? 'block' : 'none';
    hd.onclick = () => { open[s.id] = !open[s.id]; list.style.display = open[s.id] ? 'block' : 'none'; hd.setAttribute('aria-expanded', String(!!open[s.id])); (hd.lastElementChild as HTMLElement).textContent = open[s.id] ? '▾' : '▸'; save(KEY_OPEN, open); };
    for (const [id, label, colour, tip] of s.layers) {
      const row = mk('label', 'dp-layer'); row.title = tip;
      const sw = mk('span', 'dp-sw'); sw.style.background = colour;
      const cb = mk('input'); cb.type = 'checkbox'; cb.checked = layers[id];
      cb.onchange = () => { layers[id] = cb.checked; save(KEY_LAYERS, layers); api.onLayer(id, cb.checked); };
      row.append(sw, mk('span', '', label), cb); list.append(row);
    }
    sec.append(hd, list); body.append(sec);
  }
  const what = mk('div', 'dp-sec'); const whatBtn = mk('button'); whatBtn.setAttribute('aria-expanded', 'false');
  whatBtn.innerHTML = '<span>What is this?</span><span class="car">▸</span>';
  const explain = mk('div'); explain.style.display = 'none'; explain.dataset.tip = '1';
  for (const t of EXPLAIN) explain.append(mk('div', 'dp-explain', t));
  whatBtn.onclick = () => { const o = explain.style.display === 'none'; explain.style.display = o ? 'block' : 'none'; whatBtn.setAttribute('aria-expanded', String(o)); (whatBtn.lastElementChild as HTMLElement).textContent = o ? '▾' : '▸'; };
  what.append(whatBtn, explain); body.append(what);
  const foot = mk('div', 'dp-foot'); const copy = mk('button', '', 'Copy state'); copy.title = 'Copy the readout as text for a bug report';
  copy.onclick = () => { void navigator.clipboard?.writeText(api.text()).then(() => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy state'; }, 1500); }, () => {}); };
  foot.append(copy); body.append(foot);
  el.append(head, body); parent.append(el);

  let last = '', lines: string[] = [];
  const paint = (host: HTMLElement, rows: Row[]) => {
    host.replaceChildren(); host.style.display = rows.length ? 'grid' : 'none';
    for (const r of rows) { const k = mk('span', 'k', r.label), v = mk('span', 'v', r.value); if (r.colour) v.style.color = r.colour; if (r.tip) { k.title = r.tip; v.title = r.tip; } host.append(k, v); }
  };
  api.setRows = (a, b) => {
    const key = JSON.stringify([a, b]); if (key === last) return; last = key;
    paint(readout, a); paint(now, b); lines = [...a, ...b].map((r) => `${r.label}: ${r.value}`);
  };
  api.text = () => lines.join('\n');
  api.show = (v) => { el.style.display = v ? 'block' : 'none'; document.body.classList.toggle('cc-debug-on', v); };
  if (!document.getElementById('debug-panel-hide-keys')) { const s = document.createElement('style'); s.id = 'debug-panel-hide-keys'; s.textContent = 'body.cc-debug-on #keys{display:none !important}'; document.head.append(s); }
  api.show(on);
  return api;
}
