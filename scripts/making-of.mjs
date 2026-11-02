#!/usr/bin/env node
// Builds the public "The Making Of" section in public/making-of/ (deterministic).
// Inputs:  docs/site-map.md (Part 1 only) and data/making-of/issues.snapshot.json.
// Outputs: index.html, site-map.html, course-map.html (the map data is embedded in the page).
// Run: node scripts/making-of.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'making-of');

// ---------- scrubbing: what the public never sees ----------
// Issues about these themes are dropped whole.
const SENSITIVE = new RegExp(
  [
    'anti-?cheat', 'cheat', 'abuse', 'identity', 'bypass', 'admin', 'token', 'secret', 'password',
    'credential', 'moderat', 'blocklist', 'quota', 'cloudflare', 'wrangler',
    'migration', 'database', 'D1\\b', 'production', 'e-?mail', 'tamper', 'replay check',
    'server replay', 'rate limit', 'who is messing', 'owner-controlled', 'data model',
  ].join('|'),
  'i',
);
// Explicit drops: leaderboard and run-trust work, community safety, upload checks, deploy and data-limit issues.
const DROP_IDS = new Set([
  'CC-107', 'CC-108', 'CC-112', 'CC-120', 'CC-134', 'CC-169', 'CC-174', 'CC-218', 'CC-242', 'CC-33', 'CC-176',
]);

function neutralise(text) {
  return text
    .replace(/\b(the |product )*owner(['’]s)?\b/gi, (m, _a, poss) => `the product owner${poss ? "'s" : ''}`)
    .replace(/\bLinear\b/g, 'the tracker')
    .replace(/\b(src|docs|scripts|tests)\/[\w./-]*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\(?\b[\w./-]*\/[\w./-]+\.(md|ts|mjs|json|py|sh|html|css)\b\)?/g, '')
    .replace(/\b[\w-]+\.(md|ts|mjs|json|py|sh)\b/g, '')
    .replace(/\?[a-z]+=[\w,-]+/gi, '')
    .replace(/\(\s*[,;]?\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function firstSentences(text, max = 170) {
  const t = neutralise(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return stop > 60 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '...';
}

export function buildCourseMap(snapshot) {
  const keptRaw = snapshot.issues.filter((i) => !DROP_IDS.has(i.id) && !SENSITIVE.test(`${i.title} ${i.purpose}`));
  const keep = new Set(keptRaw.map((i) => i.id));
  let issues = keptRaw.map((i) => {
    const m = (i.milestone || '').match(/^(M\d)\s+(.*)$/);
    return {
      id: i.id,
      title: neutralise(i.title),
      state: i.state,
      milestone: m ? m[1] : 'Later',
      milestoneName: m ? m[2] : 'After the plan',
      dependsOn: i.dependsOn.filter((x) => keep.has(x)),
      affects: i.affects.filter((x) => keep.has(x)),
      purpose: firstSentences(i.purpose),
    };
  });
  // A second look at the cleaned text.
  issues = issues.filter((i) => !SENSITIVE.test(`${i.title} ${i.purpose}`) && !/(^|\W)(src|docs|scripts|tests)\//.test(`${i.title} ${i.purpose}`));
  const ids = new Set(issues.map((i) => i.id));
  for (const i of issues) {
    i.dependsOn = i.dependsOn.filter((x) => ids.has(x));
    i.affects = i.affects.filter((x) => ids.has(x));
  }
  return { takenOn: snapshot.takenOn, project: 'ConquerCourse', droppedCount: snapshot.issues.length - issues.length, issues };
}

// ---------- site map: Part 1 of docs/site-map.md ----------
export function parseSiteMap(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## The screens'));
  const jstart = lines.findIndex((l) => l.startsWith('## Journeys'));
  const end = lines.findIndex((l) => l.startsWith('## Where things live'));
  const tree = [];
  const stack = [];
  for (const l of lines.slice(start + 1, jstart)) {
    const m = l.match(/^(\s*)- \*\*(.+)\*\*\s*$/);
    if (m) {
      const depth = m[1].length / 2;
      const node = { name: m[2], doText: '', how: '', leads: [], children: [] };
      stack.length = depth;
      (depth === 0 ? tree : stack[depth - 1].children).push(node);
      stack[depth] = node;
      continue;
    }
    const a = l.match(/^\s+- (You do|How to get there|Leads to): (.*)$/);
    if (a && stack.length) {
      const node = stack[stack.length - 1];
      if (a[1] === 'You do') node.doText = a[2];
      else if (a[1] === 'How to get there') node.how = a[2];
      else node.leads = a[2].split(/,\s*/).filter(Boolean);
    }
  }
  const journeys = [];
  for (const l of lines.slice(jstart + 1, end)) {
    const h = l.match(/^### (.+)$/);
    if (h) { journeys.push({ name: h[1], steps: [] }); continue; }
    const s = l.match(/^\d+\.\s+(.+)$/);
    if (s && journeys.length) { journeys[journeys.length - 1].steps.push({ name: s[1], text: '' }); continue; }
    const t = l.match(/^\s+- (.+)$/);
    if (t && journeys.length) {
      const st = journeys[journeys.length - 1].steps;
      if (st.length) st[st.length - 1].text = t[1];
    }
  }
  return { tree, journeys };
}

// ---------- page shell ----------
const CSS = `
:root{--bg:#f6f4ee;--panel:#fffdf7;--ink:#17201d;--mute:#56625b;--line:#cfd6d0;--accent:#0f6b5c;--hi:#ffe38a;--hiink:#4a3600;--c-done:#2f7d4f;--c-prog:#b86e00;--c-back:#6a6f8a;--c-can:#8a5a5a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121715;--panel:#1b2420;--ink:#e8eee9;--mute:#a3b4aa;--line:#33413a;--accent:#4cc3ac;--hi:#5a4710;--hiink:#ffe9a8;--c-done:#62c98a;--c-prog:#f0b45a;--c-back:#a3a8c8;--c-can:#d09a9a}}
:root[data-theme="dark"]{--bg:#121715;--panel:#1b2420;--ink:#e8eee9;--mute:#a3b4aa;--line:#33413a;--accent:#4cc3ac;--hi:#5a4710;--hiink:#ffe9a8;--c-done:#62c98a;--c-prog:#f0b45a;--c-back:#a3a8c8;--c-can:#d09a9a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}
nav.top{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:18px;font-size:14px}
nav.top a{color:var(--accent);text-decoration:none;font-weight:600}
nav.top a:hover{text-decoration:underline}
nav.top .sp{flex:1}
h1{margin:0 0 4px;font-size:28px}
h2{font-size:19px;margin:26px 0 8px}
.sub{color:var(--mute);margin:0 0 16px}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
input[type=search],select,button,.btn{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 11px}
input[type=search]{flex:1;min-width:220px}
button,.btn{cursor:pointer;text-decoration:none;display:inline-block}
button:hover,.btn:hover{border-color:var(--accent)}
button[aria-pressed=true]{background:var(--accent);color:var(--bg);border-color:var(--accent)}
:focus-visible{outline:3px solid #f0a020;outline-offset:1px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:18px 0}
.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;color:inherit;text-decoration:none}
.card:hover{border-color:var(--accent)}
.card h2{margin:0 0 6px}
.slogan{font-size:20px;font-weight:700;color:var(--accent);margin:20px 0}
.dl{display:flex;gap:8px;flex-wrap:wrap}
.hidden{display:none!important}
.note{color:var(--mute);font-size:13px}
`;

const DL_JS = `
function dl(name,type,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},1000)}
function dlPage(name,clean){var c=document.documentElement.cloneNode(true);(clean||[]).forEach(function(i){var e=c.querySelector('#'+i);if(e)e.textContent=''});dl(name,'text/html;charset=utf-8','<!doctype html>\\n'+c.outerHTML)}
`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function jsonIn(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));
}

function shell({ title, file, body, script = '', css = '', wide = false, cleanIds = [], download = true }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}${css}</style>
</head>
<body>
<main${wide ? ' class="wide"' : ''}>
<nav class="top" aria-label="The Making Of">
<a href="index.html">The Making Of</a>
<a href="site-map.html">Site map</a>
<a href="course-map.html">Course map</a>
<span class="sp"></span>
${download ? '<span class="dl"><button type="button" id="dl-page">Download this page (.html)</button></span>' : ''}
</nav>
${body}
</main>
<script>${DL_JS}
${download ? `document.getElementById('dl-page').addEventListener('click',function(){dlPage('${file}',${JSON.stringify(cleanIds)})});` : ''}
${script}
</script>
</body>
</html>
`;
}

// ---------- the three pages ----------
function indexPage(stats) {
  const body = `<h1>The Making Of</h1>
<p class="sub">ConquerCourse is a game where real parks and real moves become a ninja-warrior course, and the physics is real too. We built it in about nine days for a hackathon. These pages show what the game is and how it was built, and you can download the maps.</p>
<p class="slogan">Train slow. Run fast.</p>
<div class="cards">
<a class="card" href="site-map.html"><h2>Site map</h2><p>Every screen a player can see, how to get there and where it leads, with six short journeys such as making your own course.</p><p class="note">Search, open and close branches, follow a journey.</p></a>
<a class="card" href="course-map.html"><h2>Course map</h2><p>${stats.n} building tasks of the project in plan order, with what each one is for and which ones wait on which.</p><p class="note">Search, filter by state, jump between linked tasks.</p></a>
<a class="card" href="../?mode=parts"><h2>How a course is made</h2><p>See the real pieces of a course play live, and how they snap together into a run.</p><p class="note">Opens the game, on the Parts gallery.</p></a>
</div>`;
  return shell({ title: 'The Making Of', file: 'making-of.html', body, download: false });
}

function siteMapPage(sm) {
  const body = `<h1>Site map</h1>
<p class="sub">Every player screen, how you get there and where it leads. Open a branch to see what is inside it.</p>
<div class="bar"><input type="search" id="q" placeholder="Search screens and journeys" aria-label="Search"><button type="button" id="expand">Open all</button><button type="button" id="collapse">Close all</button></div>
<h2>The screens</h2>
<div id="tree"></div>
<h2>Journeys</h2>
<div id="journeys"></div>`;
  const script = `
var DATA=${jsonIn(sm)};
var tree=document.getElementById('tree'),jr=document.getElementById('journeys'),q=document.getElementById('q');
function slug(s){return 'n-'+s.toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function find(n){var f=null;(function w(a){a.forEach(function(x){if(!f&&x.name.toLowerCase()===n.toLowerCase())f=x;w(x.children)})})(DATA.tree);return f}
function go(name){var n=find(name);if(!n)return;var e=document.getElementById(slug(n.name));if(!e)return;q.value='';filter();
 var p=e;while(p&&p!==tree){if(p.tagName==='DETAILS')p.open=true;p=p.parentNode}
 e.scrollIntoView({block:'center'});e.style.outline='3px solid #f0a020';setTimeout(function(){e.style.outline=''},1400)}
function link(name){var b=el('button','lk',name);b.type='button';b.style.cssText='padding:1px 8px;margin:2px 4px 2px 0;font-size:13px';b.addEventListener('click',function(){go(name)});return b}
function node(n,depth){var d=el('details','node');d.id=slug(n.name);d.style.cssText='margin:4px 0 4px '+(depth?16:0)+'px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 10px';
 d.dataset.text=(n.name+' '+n.doText+' '+n.how+' '+n.leads.join(' ')).toLowerCase();
 var s=el('summary',null,n.name);s.style.cssText='cursor:pointer;font-weight:600';d.appendChild(s);
 var b=el('div');b.style.cssText='padding:4px 0 2px';
 [['You do',n.doText],['How to get there',n.how]].forEach(function(r){if(r[1]){var p=el('div');p.appendChild(el('b',null,r[0]+': '));p.appendChild(document.createTextNode(r[1]));b.appendChild(p)}});
 if(n.leads.length){var p=el('div');p.appendChild(el('b',null,'Leads to: '));n.leads.forEach(function(l){p.appendChild(find(l)?link(l):el('span',null,l+' '))});b.appendChild(p)}
 d.appendChild(b);n.children.forEach(function(c){d.appendChild(node(c,1))});return d}
function render(){tree.textContent='';jr.textContent='';DATA.tree.forEach(function(n){tree.appendChild(node(n,0))});
 DATA.journeys.forEach(function(j){var c=el('details','jny');c.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 14px;margin:8px 0';
  c.dataset.text=(j.name+' '+j.steps.map(function(s){return s.name+' '+s.text}).join(' ')).toLowerCase();
  var s=el('summary',null,j.name);s.style.cssText='cursor:pointer;font-weight:600';c.appendChild(s);
  var ol=el('ol');j.steps.forEach(function(st){var li=el('li');if(find(st.name)){li.appendChild(link(st.name))}else{li.appendChild(el('b',null,st.name))}
   if(st.text){li.appendChild(document.createTextNode(' '+st.text))}ol.appendChild(li)});c.appendChild(ol);jr.appendChild(c)})}
function filter(){var t=q.value.trim().toLowerCase();
 document.querySelectorAll('details.node').forEach(function(d){d.classList.remove('hidden')});
 document.querySelectorAll('details.jny').forEach(function(d){d.classList.toggle('hidden',!!t&&d.dataset.text.indexOf(t)<0)});
 if(!t)return;
 [].slice.call(document.querySelectorAll('details.node')).forEach(function(d){var own=d.dataset.text.indexOf(t)>=0;var kid=[].slice.call(d.querySelectorAll('details.node')).some(function(k){return k.dataset.text.indexOf(t)>=0});
  d.classList.toggle('hidden',!own&&!kid);if(kid)d.open=true})}
q.addEventListener('input',filter);
document.getElementById('expand').addEventListener('click',function(){document.querySelectorAll('#tree details').forEach(function(d){d.open=true})});
document.getElementById('collapse').addEventListener('click',function(){document.querySelectorAll('#tree details').forEach(function(d){d.open=false})});
render();`;
  return shell({ title: 'ConquerCourse Site Map', file: 'site-map.html', body, script });
}

const CM_CSS = `
main.wide{max-width:none}
.view{display:flex;gap:6px}
.wrap{display:flex;gap:12px;align-items:flex-start}
.board{position:relative;flex:1;min-width:0;height:calc(100vh - 300px);min-height:480px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:var(--bg)}
.canvas{position:relative}
.lane{position:absolute;left:0;border-bottom:1px solid var(--line);background:var(--panel)}
.lane:nth-child(even){background:color-mix(in srgb,var(--panel) 80%,var(--bg))}
.lane .lab{position:sticky;left:10px;display:inline-block;margin:6px 0 0 10px;font-weight:700;font-size:14px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 10px;z-index:3}
.lane .lab small{color:var(--mute);font-weight:400;margin-left:8px}
svg.links{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
svg.links path{fill:none;stroke:var(--mute);stroke-width:1.2;opacity:.28}
svg.links path.hot{stroke:var(--accent);stroke-width:2.4;opacity:1}
svg.links.sel path:not(.hot){opacity:.07}
.tk{position:absolute;width:164px;height:58px;text-align:left;padding:4px 7px 4px 8px;border-radius:7px;border:1px solid var(--line);border-left:6px solid var(--st);background:var(--panel);overflow:hidden;font-size:12px;line-height:1.25;display:block}
.tk b{font-size:12px}
.tk .m{color:var(--st);font-weight:700;margin-left:6px;font-size:11px}
.tk .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:1px}
.tk.s{width:124px;height:40px;font-size:10px;line-height:1.2;padding:2px 5px 2px 6px;border-left-width:5px}
.tk.s b{font-size:11px}.tk.s .m{display:none}.tk.s .t{margin-top:0}
.tk.dim{opacity:.22}
.tk.rel{outline:2px solid var(--accent);outline-offset:0}
.tk.on{outline:3px solid #f0a020;outline-offset:0}
.panel{width:330px;flex:none;position:sticky;top:12px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;max-height:calc(100vh - 40px);overflow:auto}
.panel h3{margin:6px 0;font-size:17px;line-height:1.3}
.panel .chip{display:inline-block;font-size:12px;font-weight:700;border:1px solid var(--st);color:var(--st);border-radius:999px;padding:1px 9px}
.panel .row{margin:10px 0}
.panel .row b{display:block;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.panel ul{margin:0;padding:0;list-style:none}
.panel li button{width:100%;text-align:left;margin:2px 0;padding:3px 8px;font-size:13px}
.panel .x{float:right;padding:1px 9px}
.stage{position:relative;flex:1;min-width:0;height:calc(100vh - 300px);min-height:480px;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--bg);perspective:1800px;cursor:grab;touch-action:none;user-select:none}
.stage.drag{cursor:grabbing}
.world{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
.scene{position:absolute;transform-style:preserve-3d}
.layer{position:absolute;left:0;top:0;transform-style:preserve-3d;border:2px solid var(--line);background:color-mix(in srgb,var(--panel) 72%,transparent);border-radius:6px}
.layer .lab{position:absolute;left:12px;top:-34px;font-weight:700;font-size:26px;color:var(--ink);white-space:nowrap}
.layer .lab small{font-size:16px;color:var(--mute);font-weight:400;margin-left:10px}
.ln{position:absolute;left:0;top:0;height:2px;transform-origin:0 50%;background:var(--mute);opacity:.35}
.ln.hot{background:var(--accent);opacity:1;height:4px}
.hint{position:absolute;right:10px;bottom:8px;font-size:12px;color:var(--mute);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:2px 8px;pointer-events:none}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--mute);margin:0 0 10px}
.legend i{font-style:normal;font-weight:700}
`;

function courseMapPage(cm) {
  const body = `<h1>Course map</h1>
<p class="sub">The whole build as a map of tasks, a snapshot of ${esc(cm.takenOn)}. Each row is a stage of the plan, each card is a task, and an arrow means "needed first". Click a card to see what it is for.</p>
<div class="bar"><input type="search" id="q" placeholder="Search tasks (words or CC-number)" aria-label="Search tasks"><span id="states" role="group" aria-label="Filter by state"></span><span class="view" id="views" role="group" aria-label="View"><button type="button" id="v-lane" aria-pressed="true">Swimlanes</button><button type="button" id="v-3d" aria-pressed="false">3D</button></span><button type="button" id="reset" class="hidden">Reset view</button><span class="note" id="count"></span></div>
<div class="legend" id="legend"></div>
<div class="wrap"><div class="board" id="board"><div class="canvas" id="canvas"></div></div><div class="stage hidden" id="stage"><div class="world" id="world"><div class="scene" id="scene"></div></div><div class="hint">Drag to turn. Shift-drag to move. Wheel to zoom.</div></div><aside class="panel hidden" id="panel" aria-live="polite"></aside></div>
<p class="note">Some tasks are left out of this public copy; links between the rest are kept. Task numbers are plain labels, not web links.</p>`;
  const script = `
var DATA=${jsonIn(cm)};
var STATES=['Done','In Progress','Backlog','Canceled'];
var on={'Done':true,'In Progress':true,'Backlog':true,'Canceled':true};
var colr={'Done':'var(--c-done)','In Progress':'var(--c-prog)','Backlog':'var(--c-back)','Canceled':'var(--c-can)'};
var mark={'Done':'\\u2713','In Progress':'\\u25d0','Backlog':'\\u25cb','Canceled':'\\u00d7'};
var SVGNS='http:'+'//www.w3.org/2000/svg';
var CW=164,CH=58,GX=46,GY=8,HEAD=40,PAD=12,ROWS=6;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
var byId={},inc={},out={},E=[],seen={},sel=null,view='lane';
DATA.issues.forEach(function(i){byId[i.id]=i;inc[i.id]=[];out[i.id]=[]});
function edge(a,b){if(!byId[a]||!byId[b]||a===b||seen[a+'>'+b])return;seen[a+'>'+b]=1;E.push([a,b]);out[a].push(b);inc[b].push(a)}
DATA.issues.forEach(function(i){i.dependsOn.forEach(function(d){edge(d,i.id)});i.affects.forEach(function(a){edge(i.id,a)})});
var depth={},busy={};
function dep(id){if(depth[id]!=null)return depth[id];if(busy[id])return 0;busy[id]=1;var m=0;inc[id].forEach(function(p){m=Math.max(m,dep(p)+1)});busy[id]=0;return depth[id]=m}
DATA.issues.forEach(function(i){dep(i.id)});
var LANES=[];['M0','M1','M2','M3','M4','M5','Later'].forEach(function(k){var l=DATA.issues.filter(function(i){return i.milestone===k});if(l.length)LANES.push({key:k,name:k==='Later'?'After the plan':k+' '+l[0].milestoneName,items:l})});
// layout: columns follow the order of work; rows stack inside a lane
var maxD=0;DATA.issues.forEach(function(i){maxD=Math.max(maxD,depth[i.id])});
var sub=[];for(var d=0;d<=maxD;d++){sub[d]=0}
LANES.forEach(function(L){L.by={};var mc=0;L.items.forEach(function(i){var k=depth[i.id];L.by[k]=1+(L.by[k]||0);mc=Math.max(mc,L.by[k])});L.R=mc<=6?mc:Math.ceil(mc/2);L.by={};L.items.forEach(function(i){(L.by[depth[i.id]]=L.by[depth[i.id]]||[]).push(i)});
 Object.keys(L.by).forEach(function(d){L.by[d].sort(function(a,b){return parseInt(a.id.slice(3))-parseInt(b.id.slice(3))});sub[d]=Math.max(sub[d],Math.ceil(L.by[d].length/L.R))})});
var colX=[],W=PAD;for(var d=0;d<=maxD;d++){colX[d]=W;W+=sub[d]*(CW+GX*0.5)+GX*0.5}
var y=0;var pos={};
LANES.forEach(function(L){var rows=1;Object.keys(L.by).forEach(function(d){rows=Math.max(rows,Math.min(L.R,L.by[d].length))});
 L.y=y;L.h=HEAD+rows*(CH+GY)+PAD;y+=L.h;
 Object.keys(L.by).forEach(function(d){L.by[d].forEach(function(i,k){var c=Math.floor(k/L.R),r=k%L.R;pos[i.id]={x:colX[d]+c*(CW+GX*0.5),y:L.y+HEAD+r*(CH+GY),ly:HEAD+r*(CH+GY),lane:L}})})});
var H=y,W=W+PAD;
var q=document.getElementById('q'),sb=document.getElementById('states'),canvas=document.getElementById('canvas'),panel=document.getElementById('panel');
var stage=document.getElementById('stage'),world=document.getElementById('world'),scene=document.getElementById('scene'),board=document.getElementById('board');
function tcard(i,cls){var b=el('button','tk '+(cls||''));b.type='button';b.dataset.id=i.id;b.style.setProperty('--st',colr[i.state]);
 b.title=i.id+': '+i.title;var h=el('div');h.appendChild(el('b',null,i.id));h.appendChild(el('span','m',mark[i.state]+' '+i.state));b.appendChild(h);b.appendChild(el('div','t',i.title));
 b.addEventListener('click',function(){if(window.__moved)return;choose(sel===i.id&&view==='lane'?null:i.id)});return b}
// ----- swimlanes -----
var svg;
function buildLanes(){canvas.textContent='';canvas.style.width=W+'px';canvas.style.height=H+'px';
 LANES.forEach(function(L){var d=el('div','lane');d.style.top=L.y+'px';d.style.height=L.h+'px';d.style.width=W+'px';var lab=el('span','lab',L.name);lab.appendChild(el('small',null,L.items.length+' tasks, '+L.items.filter(function(i){return i.state==='Done'}).length+' done'));d.appendChild(lab);canvas.appendChild(d)});
 svg=document.createElementNS(SVGNS,'svg');svg.setAttribute('class','links');svg.setAttribute('width',W);svg.setAttribute('height',H);
 var defs=document.createElementNS(SVGNS,'defs');[['a','var(--mute)'],['h','var(--accent)']].forEach(function(m){var mk=document.createElementNS(SVGNS,'marker');mk.setAttribute('id','ar-'+m[0]);mk.setAttribute('viewBox','0 0 8 8');mk.setAttribute('refX','7');mk.setAttribute('refY','4');mk.setAttribute('markerWidth','7');mk.setAttribute('markerHeight','7');mk.setAttribute('orient','auto');var p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M0 0L8 4L0 8z');p.style.fill=m[1];p.style.stroke='none';p.style.opacity=1;mk.appendChild(p);defs.appendChild(mk)});svg.appendChild(defs);
 E.forEach(function(e){var a=pos[e[0]],b=pos[e[1]],x1=a.x+CW,y1=a.y+CH/2,x2=b.x-2,y2=b.y+CH/2,dx=Math.max(24,(x2-x1)/2);
  var p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M'+x1+' '+y1+' C'+(x1+dx)+' '+y1+' '+(x2-dx)+' '+y2+' '+x2+' '+y2);p.setAttribute('marker-end','url(#ar-a)');p.dataset.a=e[0];p.dataset.b=e[1];svg.appendChild(p)});
 canvas.appendChild(svg);
 DATA.issues.forEach(function(i){var c=tcard(i);c.style.left=pos[i.id].x+'px';c.style.top=pos[i.id].y+'px';canvas.appendChild(c)})}
// ----- 3D -----
var rx=60,rz=-18,zoom=1,tx=0,ty=0,GAPZ=110,built3=false;
var C3W=124,C3H=40,C3X=14,C3Y=14,COLS=12,H3=46,W3=COLS*(C3W+C3X)+C3X,P3={},L3={},Hmax3=0;
LANES.forEach(function(L){var its=L.items.slice().sort(function(a,b){return depth[a.id]-depth[b.id]||parseInt(a.id.slice(3))-parseInt(b.id.slice(3))});
 its.forEach(function(i,k){P3[i.id]={x:C3X+(k%COLS)*(C3W+C3X),y:H3+Math.floor(k/COLS)*(C3H+C3Y),lane:L}});
 L3[L.key]=H3+Math.ceil(its.length/COLS)*(C3H+C3Y)+C3Y;Hmax3=Math.max(Hmax3,L3[L.key])});
function build3(){scene.textContent='';
 scene.style.left=(-W3/2)+'px';scene.style.top=(-Hmax3/2)+'px';var zOf={};
 LANES.forEach(function(L,k){zOf[L.key]=(LANES.length-1-k)*GAPZ;var l=el('div','layer');l.style.width=W3+'px';l.style.height=L3[L.key]+'px';l.style.transform='translateZ('+zOf[L.key]+'px)';
  var lab=el('div','lab',L.name);lab.appendChild(el('small',null,L.items.length+' tasks'));l.appendChild(lab);
  L.items.forEach(function(i){var c=tcard(i,'s');c.style.left=P3[i.id].x+'px';c.style.top=P3[i.id].y+'px';l.appendChild(c)});scene.appendChild(l)});
 E.forEach(function(e){var a=P3[e[0]],b=P3[e[1]];var x1=a.x+C3W/2,y1=a.y+C3H/2,z1=zOf[a.lane.key]+1,x2=b.x+C3W/2,y2=b.y+C3H/2,z2=zOf[b.lane.key]+1;
  var dx=x2-x1,dy=y2-y1,dz=z2-z1,hyp=Math.sqrt(dx*dx+dy*dy),len=Math.sqrt(hyp*hyp+dz*dz);if(len<1)return;
  var l=el('div','ln');l.style.width=len+'px';l.style.transform='translate3d('+x1+'px,'+y1+'px,'+z1+'px) rotateZ('+Math.atan2(dy,dx)+'rad) rotateY('+(-Math.atan2(dz,hyp))+'rad)';l.dataset.a=e[0];l.dataset.b=e[1];scene.appendChild(l)});
 built3=true}
function xf(){world.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+zoom+') rotateX('+rx+'deg) rotateZ('+rz+'deg)'}
function fit(){rx=60;rz=-18;var w=stage.clientWidth,h=stage.clientHeight,r=Math.PI/180,sh=(LANES.length-1)*GAPZ*Math.sin(rx*r)+Hmax3*Math.cos(rx*r)+W3*Math.sin(Math.abs(rz)*r)*Math.cos(rx*r);zoom=Math.max(0.2,Math.min(1.3,Math.min(w/(W3*1.12),h/(sh*1.3))));tx=0;ty=(LANES.length-1)*GAPZ*Math.sin(rx*r)*zoom*0.12;xf()}
(function(){var d=null;
 stage.addEventListener('pointerdown',function(e){if(e.button!==0)return;d={x:e.clientX,y:e.clientY,sh:e.shiftKey};window.__moved=false;stage.classList.add('drag')});
 window.addEventListener('pointermove',function(e){if(!d)return;var dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>4)window.__moved=true;if(!window.__moved)return;d.x=e.clientX;d.y=e.clientY;
  if(d.sh){tx+=dx;ty+=dy}else{rz+=dx*0.35;rx=Math.max(8,Math.min(90,rx-dy*0.3))}xf()});
 window.addEventListener('pointerup',function(){d=null;stage.classList.remove('drag');setTimeout(function(){window.__moved=false},0)});
 stage.addEventListener('wheel',function(e){e.preventDefault();zoom=Math.max(0.12,Math.min(3,zoom*Math.exp(-e.deltaY*0.0012)));xf()},{passive:false});
})();
// ----- shared -----
function nameOf(id){return byId[id]?id+': '+byId[id].title:id}
function list(label,ids){var r=el('div','row');r.appendChild(el('b',null,label));if(!ids.length){r.appendChild(el('span','note','Nothing.'));return r}var u=el('ul');ids.forEach(function(id){var li=el('li');var b=el('button',null,mark[byId[id].state]+' '+id+'  '+byId[id].title);b.type='button';b.addEventListener('click',function(){choose(id,true)});li.appendChild(b);u.appendChild(li)});r.appendChild(u);return r}
function showPanel(){panel.textContent='';if(!sel){panel.classList.add('hidden');return}var i=byId[sel];panel.classList.remove('hidden');panel.style.setProperty('--st',colr[i.state]);
 var x=el('button','x','Close');x.type='button';x.addEventListener('click',function(){choose(null)});panel.appendChild(x);
 panel.appendChild(el('b',null,i.id));panel.appendChild(el('h3',null,i.title));
 var r=el('div','row');r.appendChild(el('span','chip',mark[i.state]+' '+i.state));panel.appendChild(r);
 var m=el('div','row');m.appendChild(el('b',null,'Stage of the plan'));m.appendChild(document.createTextNode(i.milestone==='Later'?'After the plan':i.milestone+' '+i.milestoneName));panel.appendChild(m);
 var p=el('div','row');p.appendChild(el('b',null,'What it is for'));p.appendChild(document.createTextNode(i.purpose||'No purpose line was saved for this task.'));panel.appendChild(p);
 panel.appendChild(list('Needs first',inc[i.id]));panel.appendChild(list('Feeds',out[i.id]))}
function choose(id,scroll){sel=id;showPanel();paint();if(id&&scroll&&view==='lane'){var p=pos[id];board.scrollTo({left:Math.max(0,p.x-200),top:Math.max(0,p.y-150),behavior:'smooth'})}}
function paint(){var t=q.value.trim().toLowerCase(),shown=0,rel={};
 if(sel){rel[sel]=1;inc[sel].forEach(function(a){rel[a]=1});out[sel].forEach(function(a){rel[a]=1})}
 document.querySelectorAll('.tk').forEach(function(c){var i=byId[c.dataset.id];var ok=on[i.state]&&(!t||(i.id+' '+i.title+' '+i.purpose).toLowerCase().indexOf(t)>=0);c.classList.toggle('dim',!ok||(!!sel&&!rel[i.id]));c.classList.toggle('on',sel===i.id);c.classList.toggle('rel',!!sel&&sel!==i.id&&!!rel[i.id]);if(ok&&canvas.contains(c))shown++});
 document.querySelectorAll('svg.links path[data-a], .ln').forEach(function(p){p.classList.toggle('hot',!!sel&&(p.dataset.a===sel||p.dataset.b===sel));if(p.tagName==='path')p.setAttribute('marker-end',p.classList.contains('hot')?'url(#ar-h)':'url(#ar-a)')});
 if(svg)svg.classList.toggle('sel',!!sel);
 document.getElementById('count').textContent=shown+' of '+DATA.issues.length+' tasks'}
function setView(v){view=v;document.getElementById('v-lane').setAttribute('aria-pressed',v==='lane');document.getElementById('v-3d').setAttribute('aria-pressed',v==='3d');
 board.classList.toggle('hidden',v!=='lane');stage.classList.toggle('hidden',v!=='3d');document.getElementById('reset').classList.toggle('hidden',v!=='3d');
 if(v==='lane'){if(!svg)buildLanes()}else{if(!built3){build3()}fit()}paint()}
STATES.forEach(function(s){var b=el('button',null,mark[s]+' '+s);b.type='button';b.setAttribute('aria-pressed',true);b.addEventListener('click',function(){on[s]=!on[s];b.setAttribute('aria-pressed',on[s]);paint()});sb.appendChild(b);sb.appendChild(document.createTextNode(' '))});
var lg=document.getElementById('legend');STATES.forEach(function(s){var sp=el('span');var i=el('i',null,mark[s]);i.style.color=colr[s];sp.appendChild(i);sp.appendChild(document.createTextNode(' '+s));lg.appendChild(sp)});
lg.appendChild(el('span',null,'Arrow: the task on the left is needed before the task on the right.'));
q.addEventListener('input',paint);
document.getElementById('v-lane').addEventListener('click',function(){setView('lane')});
document.getElementById('v-3d').addEventListener('click',function(){setView('3d')});
document.getElementById('reset').addEventListener('click',fit);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sel)choose(null)});
var ok3=false;try{ok3=!!(window.CSS&&CSS.supports('transform-style','preserve-3d')&&CSS.supports('perspective','1px'))&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
if(!ok3)document.getElementById('v-3d').classList.add('hidden');
setView('lane');
if(/[?&]view=3d/.test(location.search)&&ok3)setView('3d');
`;
  return shell({ title: 'ConquerCourse Course Map', file: 'course-map.html', body, script, css: CM_CSS, wide: true, cleanIds: ['canvas', 'scene', 'panel', 'states', 'legend'] });
}

// The copy for the claude.ai artifact: same page, nav links to other pages turned into plain labels.
export function artifactCopy(html) {
  // The artifact viewer cannot save files, so the download control goes too.
  return html
    .replace(/<a href="(index|site-map|course-map)\.html">([^<]*)<\/a>/g, '<span>$2</span>')
    .replace(/<span class="dl">.*?<\/span>/, '')
    .replace(/document\.getElementById\('dl-page'\)\.addEventListener\([^\n]*\n/, '');
}

export function buildAll() {
  const snap = JSON.parse(readFileSync(join(ROOT, 'data/making-of/issues.snapshot.json'), 'utf8'));
  const cm = buildCourseMap(snap);
  const sm = parseSiteMap(readFileSync(join(ROOT, 'docs/site-map.md'), 'utf8'));
  return {
    'index.html': indexPage({ n: cm.issues.length }),
    'site-map.html': siteMapPage(sm),
    'course-map.html': courseMapPage(cm),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--artifact') {
    writeFileSync(process.argv[3], artifactCopy(buildAll()['course-map.html']));
    process.exit(0);
  }
  mkdirSync(OUT, { recursive: true });
  const files = buildAll();
  for (const [name, text] of Object.entries(files)) writeFileSync(join(OUT, name), text);
  console.log(`wrote ${Object.keys(files).length} files`);
}
