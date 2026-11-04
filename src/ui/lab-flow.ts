import { summaryHtml } from './labs-summary';
import { FINALE_USES, LAB_LIST, flowOf, groupOf, labName, seeAlsoOf, usedIn, usesOf } from './labs-series';

// CC-133: how the Labs hand over to each other. Pipeline Labs show "from" at the top, "uses: Lab N" chips for the Foundation Labs they rely on, and "next" at the end.
// Foundation Labs show "used in" chips for the pipeline stages that rely on them. Plain links: the browser closes the old Lab by itself.
const STYLE = `
  .lab-flow-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .lab-flow-chip{display:inline-flex;gap:6px;align-items:center;font:600 12px system-ui,sans-serif;color:#0f6b5c;background:#e6f2ee;border:1px solid #b9d6cd;border-radius:99px;padding:3px 10px;text-decoration:none}
  .lab-flow-chip.plain{color:#52605a;background:#eef1ee;border-color:#d5ddd6}
  .lab-flow-label{font:700 12px system-ui,sans-serif;color:#52605a}
  .lab-flow-next{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
  .lab-flow-next a{font:700 14px system-ui,sans-serif;color:#fff;background:#0f6b5c;border-radius:8px;padding:8px 14px;text-decoration:none}
  .lab-summary{background:#fff;border:1px solid #b9d6cd;border-left:4px solid #0f6b5c;border-radius:10px;padding:8px 12px;font:13px/1.4 system-ui,sans-serif;color:#17201d;display:grid;gap:2px}
  .lab-summary span+span::before{content:"\\2022";margin:0 8px;color:#0f6b5c;font-weight:700}
  .lab-summary b{color:#0f6b5c}
  .lab-flow-chip:focus-visible,.lab-flow-next a:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}`;
const href = (mode: string): string => `?mode=${mode}&labs=1&welcome=0`; // the same link the Labs bar uses
const lab = (mode: string): string => labName(mode); // by name only: Labs carry no numbers
const chip = (mode: string, text: string, id?: string): string => `<a class="lab-flow-chip" ${id ? `id="${id}" ` : ''}data-lab="${mode}" href="${href(mode)}">${text}</a>`;

const seeAlso = (mode: string): string => {
  const l = seeAlsoOf(mode);
  return l.length ? `<div class="lab-flow-row" id="lab-flow-see">${l.map((x) => chip(x.to, `${x.text}: ${lab(x.to)}`)).join('')}</div>` : '';
};

/** The two pieces for a Lab (pure: no page needed). `end` is empty for a Foundation Lab. */
export function flowPieces(mode: string): { top: string; end: string } | null {
  if (!LAB_LIST.some((l) => l.mode === mode)) return null;
  if (groupOf(mode)?.tier === 'finale') { // the last Lab: from the Lab before it, uses chips for the Labs it sums up, and a button back to the Courses screen
    const i = LAB_LIST.findIndex((l) => l.mode === mode), prev = LAB_LIST[i - 1]?.mode;
    const uses = FINALE_USES.filter((m) => LAB_LIST.some((l) => l.mode === m)).map((m) => chip(m, lab(m))).join('');
    const from = prev ? chip(prev, `from: ${lab(prev)}`, 'lab-flow-from') : '';
    return { top: `<div class="lab-flow-row" id="lab-flow-top">${from}<span class="lab-flow-label">uses:</span>${uses}</div>`, end: `<div class="lab-flow-next" id="lab-flow-next-box"><span style="color:#52605a;font-size:13px">The last Lab. You built the game; now go and play it.</span><a id="lab-flow-next" data-courses="1" href="/?welcome=0">Back to the game</a></div>` };
  }
  const f = flowOf(mode);
  if (!f) { // a Foundation Lab: where the pipelines use it
    const used = usedIn(mode);
    const chips = used.map((u) => (u.lab ? chip(u.lab, `${u.title}: ${u.stage}`) : `<span class="lab-flow-chip plain" title="No Lab for this stage yet">${u.title}: ${u.stage} (no Lab yet)</span>`)).join('');
    return { top: `<div class="lab-flow-row" id="lab-flow-top"><span class="lab-flow-label">used in:</span>${chips || '<span class="lab-flow-chip plain">a method behind the pipelines</span>'}</div>${seeAlso(mode)}`, end: '' };
  }
  const uses = usesOf(mode).map((m) => chip(m, lab(m))).join('');
  const from = f.from ? chip(f.from, `from: ${lab(f.from)}`, 'lab-flow-from') : `<span class="lab-flow-chip plain" id="lab-flow-from">start of ${f.group.title}</span>`;
  const top = `<div class="lab-flow-row" id="lab-flow-top">${from}${uses ? `<span class="lab-flow-label">uses:</span>${uses}` : ''}</div>${seeAlso(mode)}`;
  const gapText = f.gaps.map((g) => g.stage).join(', ');
  const end = f.next
    ? `<div class="lab-flow-next" id="lab-flow-next-box"><span style="color:#52605a;font-size:13px">${f.group.title}: what you made here feeds the next Lab.</span><a id="lab-flow-next" href="${href(f.next)}">next: ${lab(f.next)}</a></div>`
    : `<div class="lab-flow-next" id="lab-flow-next-box"><span style="color:#52605a;font-size:13px">${f.group.title}: last Lab so far.${gapText ? ` No Lab planned for: ${gapText}.` : ''}</span><a id="lab-flow-next" href="/?welcome=0">Back to the game</a></div>`;
  return { top, end };
}

/** Put the top row first and the end box last inside the Lab's content column (class "wrap"). Called once after the page is built. */
export function mountLabFlow(root: HTMLElement, mode: string): void {
  const wrap = root.querySelector<HTMLElement>('.wrap'), p = flowPieces(mode);
  if (!wrap || !p || wrap.querySelector('#lab-flow-top')) return;
  if (!document.getElementById('lab-flow-style')) { const s = document.createElement('style'); s.id = 'lab-flow-style'; s.textContent = STYLE; document.head.appendChild(s); }
  wrap.insertAdjacentHTML('afterbegin', summaryHtml(mode) + p.top); // the offset under the Labs strip is the Lab root's own top: var(--labs-nav-h)
  if (p.end) wrap.insertAdjacentHTML('beforeend', p.end);
  wrap.querySelector<HTMLAnchorElement>('a[data-courses]')?.addEventListener('click', (e) => { const c = document.getElementById('labs-courses'); if (c) { e.preventDefault(); c.click(); } }); // opens the Courses screen
}
