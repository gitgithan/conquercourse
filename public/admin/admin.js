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

async function call(method, body) {
  if (!token) {
    throw new Error('Paste your admin token in the box above, then press Show usage.');
  }
  const res = await fetch(API, { method, headers: { 'x-admin-token': token, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
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

async function load() {
  msg.textContent = '';
  try { render(await call('GET')); } catch (e) { msg.textContent = e.message; app.replaceChildren(); const b = el('button', 'Try again'); b.addEventListener('click', load); app.appendChild(b); }
}
const box = document.getElementById('tok');
document.getElementById('go').addEventListener('click', () => { token = box.value.trim(); box.value = ''; load(); });
box.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('go').click(); });
load();
