import { KINDS, OUR_REUSE, RESOURCE_NAMES, activeUnits, freshReuse, leakedUnits, switchReuse, type ResourceKind, type ReuseState, type ReuseTurn } from './reuse';

const NAMES = ['Hang bars', 'Stepping blocks'];
const details: Record<ResourceKind, string> = {
  renderer: 'The renderer owns the canvas and graphics device. Keep its ID through a switch to avoid rebuilding it.',
  assets: 'Models and motion are shared data. Each runner still needs an independent skeleton and materials.',
  scene: 'The course layout changes, so this scene is replaced even when the renderer survives.',
  controls: 'Old key handlers must close. Otherwise one key can reach several courses.',
  worker: 'This example includes an active search. An old search must be cancelled and its worker stopped, so it cannot work for a course you left.',
};
const mini = (course: number, x: number, y: number, faded = false): string => `<g transform="translate(${x} ${y})" opacity="${faded ? '.45' : '1'}"><rect width="310" height="100" rx="8" fill="#dbeef2"/><path d="M0 80H310" stroke="#68988c" stroke-width="10"/>${course === 0 ? '<path d="M45 79V25H140V79M185 79V40H265V79" fill="none" stroke="#256c64" stroke-width="6"/><path d="M75 25V44M112 25V44M215 40V56M245 40V56" stroke="#d49326" stroke-width="8"/>' : '<path d="M35 75H85V56H35ZM115 75H170V35H115ZM205 75H275V48H205Z" fill="#2f8a7a"/>'}<text x="12" y="18" fill="#17201d" font-size="13" font-weight="700">${NAMES[course]}</text></g>`;

/** The animation illustrates the pure model; it never leaks real workers or blocks the host page. */
export function mountReuseExperiment(parent: HTMLElement): { pause(): void } {
  const root = document.createElement('section'); root.id = 'lw-reuse'; parent.append(root);
  const style = document.createElement('style');
  style.textContent = `
    #lw-reuse .reuse-grid{display:grid;grid-template-columns:270px minmax(0,1fr);gap:14px;align-items:start}
    #lw-reuse .reuse-main{display:grid;gap:12px;min-width:0}#lw-reuse .choices{display:grid;gap:12px}
    #lw-reuse .choice{padding:9px;border:1px solid #cad7cf;border-radius:8px;background:#f8fbf8}
    #lw-reuse .choice span{display:block;margin-left:26px;font-size:12px;color:#52605a}
    #lw-reuse .choice label{font-weight:700}#lw-reuse .actions{display:flex;gap:7px;flex-wrap:wrap}
    #lw-reuse button{cursor:pointer}#lw-reuse .actions button{margin:0}
    #lw-reuse .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #lw-reuse .metrics b{display:block;font-size:23px;color:#0f6b5c}#lw-reuse .metrics .leaking b{color:#b91c1c}
    #lw-reuse .metrics span{font-size:12px;color:#52605a}#lw-reuse svg{display:block;width:100%;height:auto;font:13px system-ui}
    #lw-reuse .resources button{padding:5px 8px;font:600 12px system-ui;background:#fff;color:#0f6b5c;border:1px solid #b9d6cd;border-radius:6px;margin:0 4px 4px 0}
    #lw-reuse .resources button[aria-pressed=true]{background:#e6f2ee;border-color:#0f6b5c}
    #lw-reuse .lesson{padding:9px 12px;border-left:4px solid #0f6b5c;background:#e6f2ee;border-radius:6px;font-size:13px}
    #lw-reuse .warning{border-color:#b91c1c;background:#fff0ed}#lw-reuse .timeline{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;align-items:stretch;min-height:45px}
    #lw-reuse .step{padding:5px;box-sizing:border-box;background:#dbe7f0;border-radius:5px;font-size:12px;min-width:0;overflow-wrap:normal}
    #lw-reuse .step.now{outline:3px solid #e8b12c;outline-offset:1px}#lw-reuse .kept{color:#0f6b5c;background:#e6f2ee}
    #lw-reuse .timeline-rest{grid-column:1/-1;display:flex;height:14px;gap:1px;border-radius:4px;background:#edf2ee;overflow:hidden}#lw-reuse .timeline-rest i{display:block;background:#5b7fa6}#lw-reuse .step.skipped{background:#fde4df;color:#a52b17}#lw-reuse .stage-meter{height:4px;background:#cbd8de;margin-top:5px;border-radius:3px}#lw-reuse .stage-meter i{display:block;height:4px;background:#5b7fa6;border-radius:3px}
    #lw-reuse .scrubber{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}
    #lw-reuse .scrubber input{margin:0}#lw-reuse .recorded{font-size:12px;border-top:1px solid #d5ddd6;padding-top:8px;color:#52605a}
    #lw-reuse button:focus-visible,#lw-reuse input:focus-visible{outline:3px solid #e8b12c;outline-offset:2px}
  `;root.append(style);
  root.insertAdjacentHTML('beforeend', `
    <div class="reuse-grid">
      <div class="choices card"><div><h2>Reuse or rebuild?</h2><p class="small" style="margin:0">Make the next course cheaper to open without leaving the old course alive.</p></div>
        <div class="choice"><label class="chk"><input id="lr-renderer" type="checkbox" checked> Keep the renderer</label><span>Keep the canvas and graphics device.</span></div>
        <div class="choice"><label class="chk"><input id="lr-assets" type="checkbox" checked> Keep models and motion</label><span>Share the loaded data, with a fresh pose for each runner.</span></div>
        <div class="choice"><label class="chk"><input id="lr-cleanup" type="checkbox" checked> Clean up this course</label><span>Close its scene, key controls and search worker when leaving.</span></div>
        <div class="actions"><button class="go" id="lr-switch">Switch course</button><button class="preset" id="lr-reset">Reset</button></div>
        <div class="actions"><button class="preset" id="lr-rebuild">Rebuild everything</button><button class="preset" id="lr-ours">Our setting</button></div>
        <div class="small" id="lr-task">Try switching three times with cleanup off. Which old resources stay alive?</div>
      </div>
      <div class="reuse-main">
        <div class="card"><div style="display:flex;justify-content:space-between;gap:12px"><h2 id="lr-heading">Next switch preview</h2><span class="small">Teaching model • work/resource units</span></div>
          <div id="lr-diagram"></div>
          <div class="resources" aria-label="Inspect a resource">${KINDS.map((k) => `<button data-resource="${k}" aria-pressed="${k === 'renderer'}">${RESOURCE_NAMES[k]}</button>`).join('')}</div>
          <p class="small" id="lr-detail" style="margin:4px 0">${details.renderer}</p>
        </div>
        <div class="metrics" id="lr-metrics" aria-live="polite"></div>
        <div class="card"><h2>What blocks the first frame?</h2><div class="timeline" id="lr-timeline"></div>
          <p id="lr-stage" class="small" style="min-height:34px;margin:8px 0"></p>
          <div class="scrubber"><button class="preset" id="lr-play">Replay switch</button><input aria-label="Step through the switch" id="lr-scrub" type="range" min="0" max="100" value="100"><span id="lr-progress">100%</span></div>
        </div>
        <div class="card"><h2>After repeated switches</h2><div id="lr-memory"></div><div class="lesson" id="lr-lesson"></div>
          <details class="recorded"><summary>What happened in our real game?</summary><p>On the recorded software-GPU VM, full reloads took 17–22 s. Reusing the runtime took 1–11 s; the return from Montmartre was still slow. These are recorded observations, not predictions from this model.</p><p>The weights above are illustrative units, not milliseconds or measured memory. Cleanup affects future switches; Reset clears any older leftovers. <a class="lnk" href="?mode=lab-systemdesign&labs=1&welcome=0">Use this lesson in System design</a>.</p></details>
        </div>
      </div>
    </div>`);
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  let state = freshReuse(), choices = { ...OUR_REUSE }, turn: ReuseTurn = switchReuse(state, choices);
  let history: ReuseState[] = [state], fraction = 1, timer = 0, selected: ResourceKind = 'renderer', completed = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause = () => { clearInterval(timer); timer = 0; $('lr-play').textContent = 'Replay switch'; };
  const resourceDiagram = () => {
    const before = turn.before, after = turn.after;
    $('lr-diagram').innerHTML = `<svg viewBox="0 0 760 298" role="img" aria-label="Outgoing and incoming courses, with reused, replaced and leftover resources">
      ${mini(before.course, 10, 6, true)}<path d="M335 56H415M402 43L415 56L402 69" fill="none" stroke="#0f6b5c" stroke-width="4"/>${mini(after.course, 440, 6)}
      <text x="10" y="126" fill="#52605a">Outgoing course</text><text x="440" y="126" fill="#0f6b5c">${completed ? 'After switch' : 'Preview after switch'}</text>
      ${KINDS.map((kind, i) => {
        const old = before.active.find((r) => r.kind === kind)!, next = after.active.find((r) => r.kind === kind)!;
        const kept = old.id === next.id, closed = turn.retired.includes(old), x = 8 + i * 150;
        const fill = kept ? '#e0f1e9' : closed ? '#f0f2f0' : '#fde4df';
        return `<g><rect x="${x}" y="140" width="140" height="46" rx="6" fill="${fill}" stroke="${kept ? '#0f6b5c' : closed ? '#b9c4bb' : '#b91c1c'}"/><text x="${x + 8}" y="158" font-size="12">${RESOURCE_NAMES[kind]}</text><text x="${x + 8}" y="176" font-size="12">#${old.id} · ${kept ? 'keep' : closed ? 'close' : 'LEFT ALIVE'}</text><path d="M${x + 70} 190V216M${x + 64} 208L${x + 70} 216L${x + 76} 208" fill="none" stroke="${kept ? '#0f6b5c' : '#d49326'}" stroke-width="2"/><rect x="${x}" y="223" width="140" height="46" rx="6" fill="${kept ? '#e0f1e9' : '#fff1d4'}" stroke="${kept ? '#0f6b5c' : '#d49326'}"/><text x="${x + 8}" y="241" font-size="12">${RESOURCE_NAMES[kind]}</text><text x="${x + 8}" y="259" font-size="12">#${next.id} · ${kept ? 'reused' : 'new'}</text></g>`;
      }).join('')}
      <text x="8" y="291" font-size="12" fill="#52605a">Teal: reused · Gold: new · Grey: closed · Red: left alive</text>
    </svg>`;
  };
  function paintProgress() {
    let end = 0, current = turn.stages.length - 1;
    for (let i = 0; i < turn.stages.length; i++) { end += turn.stages[i].work; if (end > fraction * turn.work) { current = i; break; } }
    $('lr-timeline').querySelectorAll<HTMLElement>('.step').forEach((e, i) => e.classList.toggle('now', i === current));
    $('lr-stage').textContent = `${turn.stages[current].label}: ${turn.stages[current].why}`;
    ($('lr-scrub') as HTMLInputElement).value = String(Math.round(fraction * 100)); $('lr-progress').textContent = `${Math.round(fraction * 100)}%`;
    // The incoming course appears as the scrubber reaches its first frame; no real renderer is being rebuilt.
    $('lr-diagram').dataset.progress = String(Math.round(fraction * 100));
    const incoming = $('lr-diagram').querySelectorAll<SVGGElement>('svg > g')[1];
    if (incoming) incoming.style.opacity = String(.25 + .75 * fraction);
    const kind = current === 2 ? 0 : current === 3 ? 1 : current === 4 ? 2 : -1;
    $('lr-diagram').querySelectorAll<SVGGElement>('svg > g').forEach((g, i) => { if (i >= 2) g.style.filter = i === kind + 2 && kind >= 0 ? 'drop-shadow(0 0 3px #e8b12c)' : ''; });
  }
  function paint() {
    resourceDiagram();
    const target = turn.after, extra = leakedUnits(target), active = activeUnits(target);
    const added = extra - leakedUnits(turn.before);
    $('lr-heading').textContent = completed ? `Switch ${state.switches}: ${NAMES[turn.before.course]} → ${NAMES[target.course]}` : `Next switch: ${NAMES[state.course]} → ${NAMES[target.course]}`;
    $('lr-metrics').innerHTML = `<div class="card"><b>${turn.work} / 31</b><span>Work units for this switch</span></div><div class="card"><b>${turn.kept.length} / 5</b><span>Resources reused</span></div><div class="card ${extra ? 'leaking' : ''}"><b>${active + extra}</b><span>Resource units after switch (${extra} left over)</span></div>`;
    $('lr-timeline').innerHTML = turn.stages.map((s) => `<div class="step ${s.work ? '' : s.label.startsWith('Keep') ? 'kept' : 'skipped'}" title="${s.why}">${s.label}<br><b>${s.work ? s.work + ' units' : s.label.startsWith('Keep') ? 'reused' : 'skipped'}</b><div class="stage-meter"><i style="width:${s.work / 12 * 100}%"></i></div></div>`).join('')
      + `<div class="timeline-rest" aria-label="${turn.work} of 31 illustrative work units remain">${turn.stages.filter((s) => s.work > 0).map((s) => `<i style="width:${s.work / 31 * 100}%" title="${s.label}: ${s.work} work units"></i>`).join('')}</div>`;
    const shown = history.slice(-7), max = Math.max(40, ...shown.map((s) => activeUnits(s) + leakedUnits(s)));
    $('lr-memory').innerHTML = `<svg viewBox="0 0 760 108" role="img" aria-label="Active and leftover resource units after each completed course switch">${shown.map((s, i) => {
      const x = 16 + i * 102, a = activeUnits(s) / max * 70, l = leakedUnits(s) / max * 70;
      return `<rect x="${x}" y="${82 - a}" width="60" height="${a}" fill="#0f6b5c"/><rect x="${x}" y="${82 - a - l}" width="60" height="${l}" fill="#cf6553"/><text x="${x + 30}" y="${76 - a - l}" text-anchor="middle" font-size="12">${activeUnits(s) + leakedUnits(s)}</text><text x="${x + 30}" y="100" text-anchor="middle" font-size="12">${s.switches ? 'Switch ' + s.switches : 'Start'}</text>`;
    }).join('')}<text x="736" y="18" text-anchor="end" fill="#0f6b5c" font-size="12">Teal: active</text><text x="736" y="35" text-anchor="end" fill="#b91c1c" font-size="12">Red: left over</text></svg>`;
    $('lr-lesson').classList.toggle('warning', extra > 0);
    $('lr-lesson').textContent = extra > 0 ? `This switch leaves ${added} more resource units behind (${extra} total). Old controls and workers are work too; cleanup prevents new leftovers, while Reset clears the earlier ones.` : turn.kept.length === 2 ? 'Same renderer and loaded assets; fresh course, controls and worker. Memory stays flat when the outgoing course is closed.' : 'Cleanup keeps memory flat, but rebuilding the renderer or assets adds work before the first frame.';
    root.dataset.switches = String(state.switches); root.dataset.leaked = String(leakedUnits(state)); root.dataset.work = String(turn.work); root.dataset.ready = 'true';
    $('lr-detail').textContent = details[selected];
    paintProgress();
  }
  function play() {
    pause(); fraction = 0; paintProgress();
    if (reduce) { fraction = 1; paintProgress(); return; }
    const start = performance.now(); $('lr-play').textContent = 'Pause';
    timer = window.setInterval(() => { fraction = Math.min(1, (performance.now() - start) / 1800); paintProgress(); if (fraction === 1) pause(); }, 30);
  }
  function preview() { pause(); completed = false; turn = switchReuse(state, choices); fraction = 1; paint(); }
  function sync() { for (const k of ['renderer', 'assets', 'cleanup'] as const) ($('lr-' + k) as HTMLInputElement).checked = choices[k]; }
  for (const k of ['renderer', 'assets', 'cleanup'] as const) $('lr-' + k).addEventListener('change', () => { choices = { ...choices, [k]: ($('lr-' + k) as HTMLInputElement).checked }; preview(); });
  $('lr-switch').onclick = () => { pause(); turn = switchReuse(state, choices); state = turn.after; history = [...history.slice(-6), state]; completed = true; paint(); play(); };
  $('lr-reset').onclick = () => { state = freshReuse(); history = [state]; preview(); };
  $('lr-rebuild').onclick = () => { choices = { renderer: false, assets: false, cleanup: true }; sync(); preview(); };
  $('lr-ours').onclick = () => { choices = { ...OUR_REUSE }; sync(); preview(); };
  $('lr-play').onclick = () => { if (timer) pause(); else play(); };
  $('lr-scrub').addEventListener('input', () => { pause(); fraction = Number(($('lr-scrub') as HTMLInputElement).value) / 100; paintProgress(); });
  root.querySelectorAll<HTMLButtonElement>('[data-resource]').forEach((b) => { b.onclick = () => { selected = b.dataset.resource as ResourceKind; $('lr-detail').textContent = details[selected]; root.querySelectorAll('[data-resource]').forEach((n) => n.setAttribute('aria-pressed', String(n === b))); }; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  paint(); return { pause };
}
