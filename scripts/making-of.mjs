#!/usr/bin/env node
// Builds the public "The Making Of" section in public/making-of/ (deterministic).
// Inputs:  docs/site-map.md (Part 1 only) and data/making-of/issues.snapshot.json.
// Outputs: index.html, site-map.html, course-map.html, course-map.json.
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
function dlPage(name){dl(name,'text/html;charset=utf-8','<!doctype html>\\n'+document.documentElement.outerHTML)}
`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function jsonIn(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));
}

function shell({ title, file, body, script = '', extraButtons = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<nav class="top" aria-label="The Making Of">
<a href="index.html">The Making Of</a>
<a href="site-map.html">Site map</a>
<a href="course-map.html">Course map</a>
<span class="sp"></span>
<span class="dl"><button type="button" id="dl-page">Download this page (.html)</button>${extraButtons}</span>
</nav>
${body}
</main>
<script>${DL_JS}
document.getElementById('dl-page').addEventListener('click',function(){dlPage('${file}')});
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
  return shell({ title: 'The Making Of', file: 'making-of.html', body });
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

function courseMapPage(cm) {
  const body = `<h1>Course map</h1>
<p class="sub">The whole build as a map of tasks, a snapshot of ${esc(cm.takenOn)}. Each card says what the task is for; chips show what it needs and what it feeds. Columns follow the plan, from the first skeleton to the demo.</p>
<div class="bar"><input type="search" id="q" placeholder="Search tasks (words or CC-number)" aria-label="Search tasks"><span id="states" role="group" aria-label="Filter by state"></span><span class="note" id="count"></span></div>
<div id="cols"></div>
<p class="note">Some tasks are left out of this public copy; links between the rest are kept. Task numbers are plain labels, not web links.</p>`;
  const extra = `<button type="button" id="dl-data">Download data (.json)</button>`;
  const script = `
var DATA=${jsonIn(cm)};
var STATES=['Done','In Progress','Backlog','Canceled'];
var COLS=[['M0','M0 Repo skeleton'],['M1','M1 Simulator'],['M2','M2 Course and Dojo'],['M3','M3 Characters and motion'],['M4','M4 Park'],['M5','M5 Demo capture'],['Later','After the plan']];
var on={'Done':true,'In Progress':true,'Backlog':true,'Canceled':true};
var byId={};DATA.issues.forEach(function(i){byId[i.id]=i;i.blocks=[]});
DATA.issues.forEach(function(i){i.dependsOn.forEach(function(d){if(byId[d])byId[d].blocks.push(i.id)})});
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
var colr={'Done':'var(--c-done)','In Progress':'var(--c-prog)','Backlog':'var(--c-back)','Canceled':'var(--c-can)'};
var mark={'Done':'\\u2713','In Progress':'\\u25d0','Backlog':'\\u25cb','Canceled':'\\u00d7'};
var q=document.getElementById('q'),cols=document.getElementById('cols'),sb=document.getElementById('states');
function chips(label,ids){if(!ids.length)return null;var p=el('div');p.style.cssText='font-size:13px;margin-top:4px';p.appendChild(el('b',null,label+': '));
 ids.forEach(function(id){var b=el('button',null,id);b.type='button';b.title=byId[id]?byId[id].title:'';b.style.cssText='padding:0 6px;margin:1px 3px 1px 0;font-size:12px';b.addEventListener('click',function(e){e.stopPropagation();jump(id)});p.appendChild(b)});return p}
function card(i){var c=el('article','task');c.id=i.id;c.dataset.state=i.state;c.dataset.text=(i.id+' '+i.title+' '+i.purpose).toLowerCase();
 c.style.cssText='background:var(--panel);border:1px solid var(--line);border-left:5px solid '+colr[i.state]+';border-radius:8px;padding:8px 10px';
 var h=el('div');h.style.cssText='display:flex;gap:8px;align-items:baseline;flex-wrap:wrap';
 var st=el('span',null,mark[i.state]+' '+i.state);st.style.cssText='font-size:12px;color:'+colr[i.state]+';font-weight:600';h.appendChild(el('b',null,i.id));h.appendChild(st);c.appendChild(h);
 var t=el('div',null,i.title);t.style.cssText='font-weight:600;margin:2px 0';c.appendChild(t);
 c.appendChild(el('div','note',i.purpose));
 [chips('Needs',i.dependsOn),chips('Feeds',i.affects),chips('Needed by',i.blocks)].forEach(function(x){if(x)c.appendChild(x)});return c}
function render(){cols.textContent='';sb.textContent='';
 STATES.forEach(function(s){var b=el('button',null,mark[s]+' '+s);b.type='button';b.setAttribute('aria-pressed',on[s]);b.addEventListener('click',function(){on[s]=!on[s];b.setAttribute('aria-pressed',on[s]);apply()});sb.appendChild(b);sb.appendChild(document.createTextNode(' '))});
 COLS.forEach(function(c){var list=DATA.issues.filter(function(i){return i.milestone===c[0]});if(!list.length)return;
  var sec=el('section','col');var h=el('h2',null,c[1]);var cnt=el('span','note','');cnt.style.marginLeft='8px';h.appendChild(cnt);sec.appendChild(h);
  var g=el('div','grid');g.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:10px';list.forEach(function(i){g.appendChild(card(i))});sec.appendChild(g);cols.appendChild(sec)});
 apply()}
function apply(){var t=q.value.trim().toLowerCase(),shown=0;
 document.querySelectorAll('.task').forEach(function(c){var ok=on[c.dataset.state]&&(!t||c.dataset.text.indexOf(t)>=0);c.classList.toggle('hidden',!ok);if(ok)shown++});
 document.querySelectorAll('section.col').forEach(function(s){var tot=s.querySelectorAll('.task').length,vis=s.querySelectorAll('.task:not(.hidden)').length,done=s.querySelectorAll('.task[data-state="Done"]').length;
  s.classList.toggle('hidden',vis===0);s.querySelector('span.note').textContent=vis+' of '+tot+' shown, '+done+' done'});
 document.getElementById('count').textContent=shown+' of '+DATA.issues.length+' tasks'}
function jump(id){q.value='';STATES.forEach(function(s){on[s]=true});render();var e=document.getElementById(id);if(!e)return;e.scrollIntoView({block:'center'});e.style.outline='3px solid #f0a020';setTimeout(function(){e.style.outline=''},1400)}
q.addEventListener('input',apply);
document.getElementById('dl-data').addEventListener('click',function(){var d=JSON.parse(JSON.stringify(DATA));d.issues.forEach(function(i){delete i.blocks});dl('course-map.json','application/json',JSON.stringify(d,null,2)+'\\n')});
render();`;
  return shell({ title: 'ConquerCourse Course Map', file: 'course-map.html', body, script, extraButtons: extra });
}

export function buildAll() {
  const snap = JSON.parse(readFileSync(join(ROOT, 'data/making-of/issues.snapshot.json'), 'utf8'));
  const cm = buildCourseMap(snap);
  const sm = parseSiteMap(readFileSync(join(ROOT, 'docs/site-map.md'), 'utf8'));
  return {
    'index.html': indexPage({ n: cm.issues.length }),
    'site-map.html': siteMapPage(sm),
    'course-map.html': courseMapPage(cm),
    'course-map.json': JSON.stringify(cm, null, 2) + '\n',
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT, { recursive: true });
  const files = buildAll();
  for (const [name, text] of Object.entries(files)) writeFileSync(join(OUT, name), text);
  const cm = JSON.parse(files['course-map.json']);
  console.log(`wrote ${Object.keys(files).length} files; ${cm.issues.length} issues kept, ${cm.droppedCount} dropped`);
}
