// Owner-only usage page. The token is asked for once and kept only in this tab's sessionStorage.
const API = '/api/admin-usage';
const msg = document.getElementById('msg'), app = document.getElementById('app');
// the banner says which site this page controls, taken from the address, so a switch is never flipped on the wrong one
const live = location.hostname === 'conquercourse.pages.dev' || location.hostname === 'www.conquercourse.pages.dev';
const site = document.getElementById('site');
site.textContent = live ? 'LIVE SITE: switches here affect every player' : `PREVIEW (${location.hostname}): the live site is not affected`;
site.className = live ? 'live' : 'preview';
document.title = `${live ? 'LIVE' : 'PREVIEW'}: Usage (owner only)`;
let token = '';
try { token = sessionStorage.getItem('cc-admin') || ''; } catch { /* no storage: ask each time */ }

const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const dollars = (c) => `$${(c / 100).toFixed(2)}`;

async function call(method, body, query = '') {
  if (!token) {
    throw new Error('Paste your admin token in the box above, then press Show usage.');
  }
  const res = await fetch(API + query, { method, headers: { 'x-admin-token': token, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (res.status === 401 || res.status === 404) { token = ''; try { sessionStorage.removeItem('cc-admin'); } catch { /* ignore */ } throw new Error('That token was not accepted.'); }
  if (!res.ok) throw new Error('The server could not answer right now.');
  try { sessionStorage.setItem('cc-admin', token); } catch { /* ignore */ }
  return res.json();
}

function table(day, flagsByName) {
  const t = el('table'), head = t.createTHead().insertRow();
  for (const [h, n] of [['What', 0], ['Calls', 1], ['Shared or created', 1], ['Rough cost', 1], ['Daily limit', 1]]) head.appendChild(el('th', h, n ? 'n' : ''));
  const body = t.createTBody();
  let total = 0;
  for (const c of day.categories) {
    total += c.est_cents;
    const r = body.insertRow();
    if (c.cap && c.calls >= 0.7 * c.cap) r.className = 'hot';
    r.appendChild(el('td', flagsByName[c.category]?.label || c.category));
    r.appendChild(el('td', String(c.calls), 'n'));
    r.appendChild(el('td', String(c.created), 'n'));
    r.appendChild(el('td', dollars(c.est_cents), 'n'));
    r.appendChild(el('td', c.cap ? String(c.cap) : 'none set', 'n'));
  }
  const f = body.insertRow();
  f.appendChild(el('td', 'Total (rough estimate)')); f.appendChild(el('td', '')); f.appendChild(el('td', '')); f.appendChild(el('td', dollars(total), 'n')); f.appendChild(el('td', ''));
  return t;
}

function render(data) {
  app.replaceChildren();
  const byName = Object.fromEntries(data.flags.map((f) => [f.name, f]));
  app.appendChild(el('h2', `Today (${data.days[0].day}, UTC)`));
  app.appendChild(table(data.days[0], byName));

  app.appendChild(el('h2', 'Switches'));
  const ul = el('ul');
  for (const f of data.flags) {
    const li = el('li', `${f.label}: ${f.on ? 'ON' : 'OFF'} `);
    const b = el('button', f.on ? 'Turn off' : 'Turn on');
    b.addEventListener('click', async () => {
      if (!confirm(`${live ? 'LIVE SITE: ' : 'PREVIEW: '}${f.on ? 'Turn OFF' : 'Turn ON'} "${f.label}" for every player here, right now?`)) return;
      try { await call('POST', { flag: f.name, on: !f.on }); await load(); } catch (e) { msg.textContent = e.message; }
    });
    li.appendChild(b); ul.appendChild(li);
  }
  app.appendChild(ul);

  app.appendChild(el('h2', 'Last 14 days'));
  for (const d of data.days.slice(1)) {
    const sum = d.categories.reduce((a, c) => a + c.est_cents, 0), calls = d.categories.reduce((a, c) => a + c.calls, 0);
    const det = el('details'); det.appendChild(el('summary', `${d.day}: ${calls} calls, about ${dollars(sum)}`));
    det.appendChild(table(d, byName)); app.appendChild(det);
  }
}

// Who made what: an anonymous player code (the same browser gives the same code), so you can see one person's pieces together.
function madeTable(rows, cols) {
  const t = el('table'), head = t.createTHead().insertRow();
  for (const [h] of cols) head.appendChild(el('th', h));
  const body = t.createTBody(), counts = {};
  for (const r of rows) counts[r.owner] = (counts[r.owner] || 0) + 1;
  for (const r of rows) {
    const tr = body.insertRow();
    if (counts[r.owner] >= 5) tr.className = 'hot';
    for (const [, f] of cols) tr.appendChild(el('td', f(r, counts)));
  }
  return t;
}
const when = (v) => (typeof v === 'number' ? new Date(v * 1000) : new Date(v)).toISOString().slice(0, 16).replace('T', ' ');
async function showMade() {
  const box2 = document.getElementById('made');
  try {
    const d = await call('GET', undefined, '?view=made');
    box2.replaceChildren(el('h2', `Shared to Community (${d.items.length}, newest first)`),
      madeTable(d.items, [['When (UTC)', (r) => when(r.at)], ['Player', (r) => r.owner], ['Their total', (r, c) => String(c[r.owner])], ['Kind', (r) => r.kind], ['Name', (r) => r.name], ['Status', (r) => r.status], ['Safety check', (r) => r.moderation]]),
      el('h2', `Photos the safety check stopped (${d.stops.length}, newest first, last 14 days)`),
      madeTable(d.stops, [['When (UTC)', (r) => when(r.at)], ['Player', (r) => r.owner], ['Their total', (r, c) => String(c[r.owner])], ['Step', (r) => r.route], ['Verdict', (r) => r.verdict], ['Reason', (r) => r.reason]]),
      el('h2', `Characters (${d.characters.length}, newest first)`),
      madeTable(d.characters, [['When (UTC)', (r) => when(r.at)], ['Player', (r) => r.owner], ['Their total', (r, c) => String(c[r.owner])], ['Name', (r) => r.name], ['Words they typed', (r) => r.prompt], ['Status', (r) => r.status], ['Reports', (r) => String(r.reports)]]));
  } catch (e) { msg.textContent = e.message; }
}
document.getElementById('showmade').addEventListener('click', showMade);

const sec = (ms) => (ms == null ? '-' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
function plainTable(heads, rows) {
  const t = el('table'), h = t.createTHead().insertRow();
  const num = heads.map((_, i) => rows.length > 0 && rows.every((r) => typeof r[i] === 'number')); // numbers line up on the right, under their heading; words stay on the left
  heads.forEach((x, i) => h.appendChild(el('th', x, num[i] ? 'n' : '')));
  const b = t.createTBody();
  for (const r of rows) { const tr = b.insertRow(); r.forEach((v, i) => { const td = tr.insertCell(); td.textContent = String(v); if (num[i]) td.className = 'n'; }); }
  return t;
}
async function showStats() {
  const out = document.getElementById('stats');
  try {
    const d = await call('GET', undefined, '?view=analytics');
    out.replaceChildren(
      el('h3', d.recording ? 'Recording is on' : 'Recording is off'),
      el('h3', 'Where visits came from'),
      el('p', 'Landed = browsers that opened the game. People who played = browsers that started a course. Runs = every start, so one person can add many. Clears = finished courses.'),
      plainTable(['Tag', 'Landed', 'People who played', 'Runs', 'Clears'], d.sources.map((r) => [r.ref, r.landed, r.players, r.runs, r.clears])),
      el('h3', 'Funnel (visitor-days that reached each step: one person counts once per step per day)'),
      plainTable(['Step', 'Total', 'By tag'], d.funnel.map((f) => [f.step, f.total, Object.entries(f.byRef).map(([k, v]) => `${k} ${v}`).join(', ')])),
      el('h3', 'How long the rented services took (the call the site makes)'),
      plainTable(['Service', 'Machine', 'Calls', 'Failed', 'Median', '90th percentile'], d.waits.map((w) => [w.service, w.cold ? 'cold' : 'warm', w.calls, w.failed, sec(w.median_ms), sec(w.p90_ms)])));
  } catch (e) { msg.textContent = e.message; }
}
document.getElementById('showstats').addEventListener('click', showStats);


async function load() {
  msg.textContent = '';
  try { render(await call('GET')); } catch (e) { msg.textContent = e.message; app.replaceChildren(); const b = el('button', 'Try again'); b.addEventListener('click', load); app.appendChild(b); }
}
const box = document.getElementById('tok');
document.getElementById('go').addEventListener('click', () => { token = box.value.trim(); box.value = ''; load(); });
box.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('go').click(); });
load();
