import { startCourse } from './course';
import { session } from '../ui/feedback';
import { fitPrimitives, proveCourse, type ParkObject } from '../park/fit';

// The Community gallery: courses made from real obstacles in photos. The five starter photos are always there;
// the community's approved courses come from the server. Each course is rebuilt from its boxes in the browser
// (the same Park fit and simulator proof), then played in the Course mode.
const STARTERS = ['park01', 'park02', 'park03', 'park06', 'park07'];
interface Entry { key: string; id?: number; name: string; by: string; image: string; width: number; height: number; boxes: ParkObject[] }


export function startGallery(host: HTMLElement): { backend: 'webgl2' } {
  const style = document.createElement('style');
  style.textContent = `
    .gal{font:16px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:16px;display:grid;gap:12px;grid-auto-rows:min-content;align-content:start}
    .gal h1{margin:0;font-size:24px}.gal .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .gal a.btn,.gal button{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer;text-decoration:none}
    .gal .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}
    .gal .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .gal .card{background:#fff;border:1px solid #cfd6d0;border-radius:12px;overflow:hidden;display:grid;align-content:start}
    .gal .card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#dfe5e0;display:block}
    .gal .card .in{padding:10px;display:grid;gap:6px}.gal .chips{display:flex;flex-wrap:wrap;gap:4px}
    .gal .chip{font-size:12px;background:#eef1ec;border-radius:999px;padding:1px 8px}
    .gal .muted{color:#58635d;font-size:14px}.gal .bad{border-left:4px solid #c0392b;padding:6px 10px;background:#fbeeee}`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'gal';
  host.appendChild(root);
  const head = document.createElement('div');
  head.className = 'bar';
  head.innerHTML = '<h1>Community courses</h1><a class="btn go" href="?">Back to the Course</a><a class="btn" href="?mode=park" id="make">Make your own from a photo</a>';
  const intro = document.createElement('div');
  intro.className = 'muted';
  intro.textContent = 'Real obstacles, photographed and measured by people like you. Pick one to run it with the same physics as the main Course.';
  const status = document.createElement('div');
  status.className = 'muted';
  const grid = document.createElement('div');
  grid.className = 'grid'; grid.id = 'grid';
  root.append(head, intro, status, grid);

  const card = (e: Entry) => {
    const c = document.createElement('div');
    c.className = 'card'; c.dataset.key = e.key;
    const img = document.createElement('img'); img.src = e.image; img.alt = e.name; img.loading = 'lazy';
    const info = document.createElement('div'); info.className = 'in';
    const t = document.createElement('strong'); t.textContent = e.name;
    const by = document.createElement('div'); by.className = 'muted'; by.textContent = `by ${e.by}`;
    const chips = document.createElement('div'); chips.className = 'chips';
    for (const o of e.boxes) if (o.phrase !== 'person') { const ch = document.createElement('span'); ch.className = 'chip'; ch.textContent = o.heightM ? `${o.phrase} ${o.heightM} m` : o.phrase; chips.appendChild(ch); }
    const row = document.createElement('div'); row.className = 'bar';
    const play = document.createElement('button'); play.className = 'go'; play.textContent = 'Play this course';
    const msg = document.createElement('div'); msg.className = 'muted';
    play.onclick = () => {
      const proof = proveCourse(fitPrimitives(e.boxes), e.name, e.image); // the photo is painted on the obstacles
      if (!proof.cleared) { msg.textContent = 'The simulator could not find a way to clear this one.'; return; }
      root.remove(); style.remove();
      void startCourse(document.body, proof.course);
    };
    row.appendChild(play);
    if (e.id !== undefined) {
      const rep = document.createElement('button'); rep.textContent = 'Report'; rep.title = 'Tell us if this should not be here';
      rep.onclick = async () => {
        rep.disabled = true;
        try { await fetch('/api/community-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: e.id, session: session() }) }); msg.textContent = 'Thank you, we will take a look.'; } catch { msg.textContent = 'Could not send the report.'; rep.disabled = false; }
      };
      row.appendChild(rep);
    }
    info.append(t, by, chips, row, msg);
    c.append(img, info);
    return c;
  };

  void (async () => {
    for (const id of STARTERS) {
      try {
        const d = await (await fetch(`/assets/park/${id}.objects.json`)).json() as { file: string; width: number; height: number; credit: string; objects: ParkObject[] };
        const boxes = d.objects.map((o) => ({ ...o, box: [...o.box] as ParkObject['box'] }));
        grid.appendChild(card({ key: id, name: `Starter: ${d.credit.split(',')[0].slice(0, 50)}`, by: 'ConquerCourse (openly licensed photo)', image: `/assets/park/${d.file}`, width: d.width, height: d.height, boxes }));
      } catch { /* a missing starter is skipped */ }
    }
    try {
      const r = await fetch('/api/community', { cache: 'no-cache' });
      if (!r.ok) throw new Error(String(r.status));
      const body = await r.json() as { courses: { id: number; name: string; nick: string; width: number; height: number; boxes: ParkObject[] }[] };
      if (!body.courses.length) status.textContent = 'No community courses yet. Be the first: make one from a photo.';
      for (const c of body.courses) grid.prepend(card({ key: `c${c.id}`, id: c.id, name: c.name, by: c.nick, image: `/api/community-image?id=${c.id}`, width: c.width, height: c.height, boxes: c.boxes }));
    } catch { status.textContent = 'The community courses could not be loaded right now (they need the online site). The starters still work.'; }
    document.documentElement.dataset.galleryReady = 'true';
  })();
  return { backend: 'webgl2' };
}
