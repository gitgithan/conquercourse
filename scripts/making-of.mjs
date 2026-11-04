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

// ---------- classification: theme lanes and kind of work ----------
// Both tables are ordered, first match wins; the title is tried first, then the purpose line.
// Lane order here is the order on the board.
export const LANES = [
  { name: 'Foundation', caption: 'Rules, repo and the plain basics', re: /transfer knowledge|app skeleton|merge path|readme|document the decision|front door|design system|top bar on every page|mobile|\bphones?\b|touch controls|phone-width/i },
  { name: 'Tests and speed', caption: 'Keeping the build honest and fast', re: /\btests?\b|test suite|green|unformatted|format the|crash|verify today|demos-check|performance|draw call|machine speed|slower|\bworker\b|census|smoke/i },
  { name: 'Film and music', caption: 'The promo film, the sound and the music', re: /\bfilm|video clip|cinema|storyboard|spectacle|hook shot|demo wow|hero|backdrop|fly-?by|remotion|promotion|viral|share clip|clip shows|\bmusic|\bsounds?\b|audio|loops?\b|welcome screen|intro clips/i },
  { name: 'Meta AI tools', caption: 'Where Meta models help build and check', re: /muse |meta model|baseten|wonder|bonus prize|triage|clustering|move tips|bulk course/i },
  { name: 'Community and sharing', caption: 'Share runs and courses, hear what players think', re: /communit|share|\blink\b|challenge|leaderboard|upload|downloadable|plays, completions|feedback|^playtest|\bghost to chase/i },
  { name: 'Dojo and Labs', caption: 'Learning by predicting, testing and tuning', re: /dojo|\blabs?\b|university|atlas|notebook|graph studio|\bgraph\b|lesson|plank|sayings|stages?\b|predict/i },
  { name: 'Contraptions and physics toys', caption: 'Coasters, drones and slings that teach', re: /coaster|trebuchet|drone|elastic|recoil|contraptions|\bcups?\b|gauges?\b|cart rider|hidden limits/i },
  { name: 'Forks and routes', caption: 'Two ways through, risk against reward', re: /multi-?paths?|\bforks?\b|\broutes?\b|low way|high way|two ways/i },
  { name: 'World Slicer and maps', caption: 'Cut a real place and find the way through', re: /slic|\bmaps?\b|places?\b|terrain|skyline|mapillary|openstreetmap|\bpin\b|ready places|tour line|nearby photos|photos beside/i },
  { name: 'Course pieces and the editor', caption: 'Build your own course from pieces', re: /editor|\bpieces?\b|stacks|generator|course agent|\bwords\b|multi-select|segments to click/i },
  { name: 'Courses and run flow', caption: 'What a player sees and does on a run', re: /\btraining\b|first-time|first course|the course:|after a fall|fall panel|restart|toast|\bhud\b|\bgold\b|onboarding|report|courses gallery|gallery in every|debug panel|key strip|\bpanel\b|course cards|\bchip\b|\bpill\b|ghost looks|ghost and player|design partner|obstacle strip|preview before apply|new visit|course experience|merged courses|fewer, better courses|second v\b|hold-e numbers|front view|every run is|clip shows|timed balls/i },
  { name: 'Rookie motion', caption: 'Makes the runner look like a person', re: /motion|\bposes?\b|kimodo|character|arms engine|lache|vault|climb|pole|hold-e|ledge|rookies|clip set|contacts|\bmhr\b|player look|captured|roll clip|\bgrab\b|first lache/i },
  { name: 'Real world in', caption: 'Photos, videos and objects become courses', re: /photo|video ingest|filmed|strobe|\bSAM\b|3d object|real objects?|real-object|\blift|mesh|bake-off|partllm|wallpaper|street furniture|objects?\b/i },
  { name: 'Physics engine', caption: 'The truth every lesson rests on', re: /simulator|ideal-run|\bsearch\b|trampoline|\broll\b|shortcut|shift\+i|hazard|survivable|warped wall|\brope\b|pendulum|landing|ideal run/i },
];
export const KINDS = [
  { name: 'Demo', re: /\bfilm|video clip|demo|storyboard|hook shot|hero|spectacle|share clip|cinema|music|\bsounds?\b|promotion|backdrop|welcome screen|intro clips/i },
  { name: 'Research spike', re: /spike|bake-off|census|audit|honest|plan and|wonder|\bmeasure|clustering|design:|design doc|multiple paths design|what it does/i },
  { name: 'Tooling and setup', re: /transfer knowledge|app skeleton|smoke|merge path|\btests?\b|test suite|green|unformatted|format the|readme|crash|verify today|document|performance|draw call|machine speed|slower|\bworker\b|front door|design system/i },
  { name: 'Character motion', re: /motion|\bposes?\b|kimodo|character|\barms?\b|clips?\b|contacts|player look|mhr|rookies|first lache|hold-e|\broll\b/i },
  { name: 'Pipeline', re: /photo|video ingest|filmed|\bSAM\b|3d object|real objects?|real-object|\blift|mesh|partllm|triage|mapillary|openstreetmap|terrain|\bpin\b|generator|bulk|upload|pipeline|course agent|\bmap mode/i },
  { name: 'Physics law', re: /simulator|ideal-run|\bsearch\b|trampoline|pendulum|momentum|recoil|elastic|energy|drone|coaster|trebuchet|lache|vault|climb|pole|\bbar\b|rope|warped wall|landing|slope|shortcut|shift\+i|forks?\b|route/i },
  { name: 'Game feature', re: /./ },
];
const PHASES = [0, 1, 2, 4, 8, 11];
export const themeOf = (i) => {
  for (const text of [i.title, i.purpose]) for (const l of LANES) if (l.re.test(text)) return l.name;
  return 'Other';
};
export const kindOf = (i) => {
  for (const text of [i.title, i.purpose]) for (const k of KINDS) if (k.re.test(text)) return k.name;
  return 'Game feature';
};

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
      milestoneName: m ? m[2] : 'Added after the plan',
      dependsOn: i.dependsOn.filter((x) => keep.has(x)),
      affects: i.affects.filter((x) => keep.has(x)),
      purpose: firstSentences(i.purpose),
    };
  });
  for (const i of issues) { i.theme = themeOf(i); i.kind = kindOf(i); }
  // A second look at the cleaned text.
  issues = issues.filter((i) => !SENSITIVE.test(`${i.title} ${i.purpose}`) && !/(^|\W)(src|docs|scripts|tests)\//.test(`${i.title} ${i.purpose}`));
  const ids = new Set(issues.map((i) => i.id));
  for (const i of issues) {
    i.dependsOn = i.dependsOn.filter((x) => ids.has(x));
    i.affects = i.affects.filter((x) => ids.has(x));
  }
  // Column = how deep a task sits in the chain of "needed first" (longest path), grouped into six phases.
  const need = new Map(issues.map((i) => [i.id, new Set(i.dependsOn)]));
  for (const i of issues) for (const a of i.affects) need.get(a).add(i.id);
  const depth = new Map();
  const walk = (id, stack) => {
    if (depth.has(id)) return depth.get(id);
    if (stack.has(id)) return 0;
    stack.add(id);
    let d = 0;
    for (const p of need.get(id)) d = Math.max(d, walk(p, stack) + 1);
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const i of issues) i.col = PHASES.filter((t) => walk(i.id, new Set()) >= t).length - 1;
  return { takenOn: snapshot.takenOn, project: 'ConquerCourse', phases: ['START', 'BASE', 'CORE', 'LAWS', 'BUILD', 'SHOW'], lanes: LANES.map(({ name, caption }) => ({ name, caption })), droppedCount: snapshot.issues.length - issues.length, issues };
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
<a href="code-map.html">Code map</a>
<a href="timeline.html">The Grand Entrance</a>
<a href="/">Back to the game</a>
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
<a class="card" href="code-map.html"><h2>Code map</h2><p>The whole codebase as a graph of related files and symbols, grouped into communities you can open one by one.</p><p class="note">Click a group to see its files. Needs an internet connection to draw.</p></a>
<a class="card" href="timeline.html"><h2>The Grand Entrance</h2><p>Walk a tunnel of cards, from the first commit to today, then step out onto the Training course.</p><p class="note">Hold W or scroll to walk. Space walks for you.</p></a>
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
:root{--k-tool:#8a8f98;--k-phys:#2f6fd6;--k-feat:#7a4fc9;--k-pipe:#16938a;--k-res:#e0801a;--k-mot:#82921f;--k-demo:#d6453d;--card:#f1f0ec;--board:#fff;--lane:#faf9f6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--k-tool:#a3a9b3;--k-phys:#6da0ff;--k-feat:#b394ff;--k-pipe:#3fd0c3;--k-res:#ffa84d;--k-mot:#c4d44a;--k-demo:#ff7d73;--card:#27312c;--board:#1b2420;--lane:#202b26}}
:root[data-theme="dark"]{--k-tool:#a3a9b3;--k-phys:#6da0ff;--k-feat:#b394ff;--k-pipe:#3fd0c3;--k-res:#ffa84d;--k-mot:#c4d44a;--k-demo:#ff7d73;--card:#27312c;--board:#1b2420;--lane:#202b26}
main.wide{max-width:none}
h1.big{font-size:30px;margin:0 0 4px}
.counts{display:flex;gap:22px;flex-wrap:wrap;align-items:baseline;font-size:16px;margin:12px 0 8px}
.counts b{font-weight:700}
.dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;background:var(--c);border:2px solid var(--c)}
.dot.hollow{background:transparent}
.seg{display:flex;height:8px;border-radius:5px;overflow:hidden;background:var(--line);margin:0 0 14px;max-width:640px}
.seg i{display:block;height:100%}
.frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 8px}
.frow .lbl{width:112px;font-size:12px;letter-spacing:.06em;color:var(--mute);font-weight:700;text-transform:uppercase}
.pill{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:5px 13px;font-size:14px;background:var(--board);border:1px solid var(--line);color:var(--ink)}
.pill[aria-pressed=false]{opacity:.45;background:transparent}
.pill[aria-pressed=true]{background:var(--board);color:var(--ink);border-color:var(--mute)}
.sq{width:11px;height:11px;border-radius:3px;background:var(--c);display:inline-block}
.wrap{display:flex;gap:12px;align-items:flex-start;margin-top:12px}
.board{position:relative;flex:1;min-width:0;overflow-x:auto;border:1px solid var(--line);border-radius:16px;background:var(--board)}
.canvas{position:relative}
.ch{position:absolute;top:0;height:34px;line-height:34px;text-align:center;font-size:12px;font-weight:700;letter-spacing:.1em;color:var(--mute);border-bottom:1px solid var(--line)}
.lane{position:absolute;left:0;border-top:1px solid var(--line)}
.lane.alt{background:var(--lane)}
.lane .lab{position:sticky;left:0;display:block;width:196px;padding:10px 12px 8px 16px;z-index:3;background:var(--board);border-radius:0 0 10px 0}
.lane.alt .lab{background:var(--lane)}
.lane .lab b{display:block;font-size:16px;line-height:1.2}
.lane .lab span{display:block;color:var(--mute);font-size:13px;line-height:1.3;margin-top:3px}
.lane .lab small{display:block;color:var(--mute);font-size:12px;margin-top:6px}
svg.links{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
svg.links path{fill:none;stroke:var(--mute);stroke-width:1.3;opacity:.4}
svg.links path.aff{stroke-dasharray:5 4}
svg.links path.hot{stroke:var(--accent);stroke-width:2.6;opacity:1}
svg.links.sel path:not(.hot){opacity:.07}
.tk{position:absolute;width:188px;height:96px;text-align:left;padding:6px 8px 5px 10px;border-radius:9px;border:1px solid var(--line);border-left:7px solid var(--kc);background:var(--card);overflow:hidden;font-size:13px;line-height:1.3;display:block;color:var(--ink)}
.tk .id{font:700 13px ui-monospace,Menlo,Consolas,monospace}
.tk .tag{color:var(--mute);font-size:11px;margin-left:6px}
.tk .nx{position:absolute;top:5px;right:6px;background:#d8f2e0;color:#1c7a45;font-size:11px;font-weight:700;border-radius:5px;padding:0 6px;letter-spacing:.04em}
.tk .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:700;font-size:13px;line-height:1.25;margin-top:2px}
.tk .s{position:absolute;left:10px;bottom:5px;font-size:12.5px;color:var(--mute)}
.tk.dim{opacity:.22}
.tk.rel{outline:2px solid var(--accent);outline-offset:0}
.tk.on{outline:3px solid #f0a020;outline-offset:0}
.panel{width:340px;flex:none;position:sticky;top:12px;background:var(--board);border:1px solid var(--line);border-radius:14px;padding:14px;max-height:calc(100vh - 40px);overflow:auto}
.panel h3{margin:6px 0;font-size:17px;line-height:1.3}
.panel .chip{display:inline-block;font-size:12px;font-weight:700;border:1px solid var(--c);color:var(--ink);border-radius:999px;padding:1px 10px;margin:0 6px 4px 0}
.panel .row{margin:10px 0}
.panel .row b{display:block;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.panel ul{margin:0;padding:0;list-style:none}
.panel li button{width:100%;text-align:left;margin:2px 0;padding:3px 8px;font-size:13px}
.panel .x{float:right;padding:1px 9px}
.legend{font-size:13px;color:var(--mute);margin:8px 0 0}
`;

function courseMapPage(cm) {
  const body = `<h1 class="big">ConquerCourse issue map</h1>
<p class="sub">What each issue is, what it needs first, what it unlocks, and why it is worth the time. Click any card. Arrows point from "needs this first" to "can start after". A snapshot of ${esc(cm.takenOn)}.</p>
<div class="counts" id="counts"></div>
<div class="seg" id="seg" aria-hidden="true"></div>
<div class="frow"><span class="lbl">Kind of work</span><span id="kf" class="frow" style="margin:0"></span></div>
<div class="frow"><span class="lbl">Status</span><span id="sf" class="frow" style="margin:0"></span><input type="search" id="q" placeholder="Search (words or CC-number)" aria-label="Search tasks" style="max-width:260px;margin-left:12px"><span class="note" id="count"></span></div>
<div class="wrap"><div class="board" id="board"><div class="canvas" id="canvas"></div></div><aside class="panel hidden" id="panel" aria-live="polite"></aside></div>
<p class="legend">Cards are grouped in lanes by theme; the stripe colour is the kind of work. NEXT means it is not started and everything it needs is done. Solid arrows: needs first. Dashed arrows: affects.</p>
<p class="note">Some tasks are left out of this public copy; links between the rest are kept. Task numbers are plain labels, not web links.</p>`;
  const script = `
var DATA=${jsonIn(cm)};
var STATES=[['Done','Done'],['In Progress','In progress'],['Backlog','Not started'],['Canceled','Canceled']];
var SC={'Done':'#2f9e5b','In Progress':'#e0a020','Backlog':'#9a9a94','Canceled':'#b07070'};
var KC={'Tooling and setup':'var(--k-tool)','Physics law':'var(--k-phys)','Game feature':'var(--k-feat)','Pipeline':'var(--k-pipe)','Research spike':'var(--k-res)','Character motion':'var(--k-mot)','Demo':'var(--k-demo)'};
var KORDER=['Tooling and setup','Physics law','Game feature','Pipeline','Research spike','Character motion','Demo'];
var onS={'Done':true,'In Progress':true,'Backlog':true,'Canceled':true},onK={};KORDER.forEach(function(k){onK[k]=true});
var SVGNS='http:'+'//www.w3.org/2000/svg';
var CW=188,CH=96,GX=10,GY=10,LW=212,HH=34,PADB=14,SLOTS=3,ROWCAP=5;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
var byId={},inc={},out={},E=[],seen={},sel=null;
DATA.issues.forEach(function(i){byId[i.id]=i;inc[i.id]=[];out[i.id]=[]});
function edge(a,b,aff){if(!byId[a]||!byId[b]||a===b)return;var k=a+'>'+b;if(seen[k]){if(!aff)seen[k][2]=false;return}seen[k]=[a,b,aff];E.push(seen[k]);out[a].push(b);inc[b].push(a)}
DATA.issues.forEach(function(i){i.dependsOn.forEach(function(d){edge(d,i.id,false)})});
DATA.issues.forEach(function(i){i.affects.forEach(function(a){edge(i.id,a,true)})});
function isNext(i){return i.state==='Backlog'&&inc[i.id].every(function(p){return byId[p].state==='Done'||byId[p].state==='Canceled'})}
// ----- counts -----
var cnt={};DATA.issues.forEach(function(i){cnt[i.state]=(cnt[i.state]||0)+1});
var cd=document.getElementById('counts');
[['Done','done'],['In Progress','in progress'],['Backlog','not started'],['Canceled','canceled']].forEach(function(s){if(!cnt[s[0]])return;var sp=el('span');var d=el('span','dot'+(s[0]==='Backlog'?' hollow':''));d.style.setProperty('--c',SC[s[0]]);sp.appendChild(d);sp.appendChild(el('b',null,cnt[s[0]]));sp.appendChild(document.createTextNode(' '+s[1]));cd.appendChild(sp)});
cd.appendChild(el('span',null,DATA.issues.length+' issues'));
var sg=document.getElementById('seg');['Done','In Progress','Backlog','Canceled'].forEach(function(s){if(!cnt[s])return;var b=el('i');b.style.width=(100*cnt[s]/DATA.issues.length)+'%';b.style.background=SC[s];sg.appendChild(b)});
// ----- layout: lanes by theme, columns by phase, cards wrap inside a cell -----
var LANES=DATA.lanes.map(function(l){return {name:l.name,caption:l.caption,items:DATA.issues.filter(function(i){return i.theme===l.name}).sort(function(a,b){return parseInt(a.id.slice(3))-parseInt(b.id.slice(3))})}}).filter(function(l){return l.items.length});
var NC=DATA.phases.length,slots=[];for(var c=0;c<NC;c++)slots[c]=1;
LANES.forEach(function(L){L.cell={};L.items.forEach(function(i){(L.cell[i.col]=L.cell[i.col]||[]).push(i)});Object.keys(L.cell).forEach(function(c){slots[c]=Math.max(slots[c],Math.min(SLOTS,Math.ceil(L.cell[c].length/ROWCAP)))})});
var colX=[],colW=[],W=LW;for(var c=0;c<NC;c++){colX[c]=W;colW[c]=slots[c]*(CW+GX)+GX+14;W+=colW[c]}
var H=HH,pos={};
LANES.forEach(function(L){var rows=1;Object.keys(L.cell).forEach(function(c){rows=Math.max(rows,Math.ceil(L.cell[c].length/slots[c]))});L.y=H;L.h=Math.max(rows*(CH+GY)+GY+PADB,112);H+=L.h;
 Object.keys(L.cell).forEach(function(c){L.cell[c].forEach(function(i,k){pos[i.id]={x:colX[c]+GX+(k%slots[c])*(CW+GX),y:L.y+GY+Math.floor(k/slots[c])*(CH+GY)}})})});
var q=document.getElementById('q'),canvas=document.getElementById('canvas'),panel=document.getElementById('panel'),board=document.getElementById('board');
var svg;
function card(i){var b=el('button','tk');b.type='button';b.dataset.id=i.id;b.style.setProperty('--kc',KC[i.kind]);b.title=i.id+': '+i.title;
 var h=el('div');h.appendChild(el('span','id',i.id));if(i.milestone!=='Later')h.appendChild(el('span','tag',i.milestone));b.appendChild(h);
 if(isNext(i))b.appendChild(el('span','nx','NEXT'));
 b.appendChild(el('div','t',i.title));
 var s=el('div','s');var d=el('span','dot'+(i.state==='Backlog'?' hollow':''));d.style.setProperty('--c',SC[i.state]);s.appendChild(d);s.appendChild(document.createTextNode(stName(i.state)));b.appendChild(s);
 b.addEventListener('click',function(){choose(sel===i.id?null:i.id)});return b}
function stName(s){return s==='Backlog'?'Not started':s==='In Progress'?'In progress':s}
function build(){canvas.textContent='';canvas.style.width=W+'px';canvas.style.height=H+'px';
 DATA.phases.forEach(function(p,c){var h=el('div','ch',p);h.style.left=colX[c]+'px';h.style.width=colW[c]+'px';canvas.appendChild(h)});
 LANES.forEach(function(L,n){var d=el('div','lane'+(n%2?' alt':''));d.style.top=L.y+'px';d.style.height=L.h+'px';d.style.width=W+'px';var lab=el('div','lab');lab.appendChild(el('b',null,L.name));lab.appendChild(el('span',null,L.caption));lab.appendChild(el('small',null,L.items.length+' issues, '+L.items.filter(function(i){return i.state==='Done'}).length+' done'));d.appendChild(lab);canvas.appendChild(d)});
 svg=document.createElementNS(SVGNS,'svg');svg.setAttribute('class','links');svg.setAttribute('width',W);svg.setAttribute('height',H);
 var defs=document.createElementNS(SVGNS,'defs');[['a','#8d908c'],['h','#0f6b5c']].forEach(function(m){var mk=document.createElementNS(SVGNS,'marker');mk.setAttribute('id','ar-'+m[0]);mk.setAttribute('viewBox','0 0 8 8');mk.setAttribute('refX','7');mk.setAttribute('refY','4');mk.setAttribute('markerWidth','7');mk.setAttribute('markerHeight','7');mk.setAttribute('orient','auto');var p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M0 0L8 4L0 8z');p.style.fill=m[1];p.style.stroke='none';p.style.opacity=1;mk.appendChild(p);defs.appendChild(mk)});svg.appendChild(defs);
 E.forEach(function(e){var a=pos[e[0]],b=pos[e[1]];if(!a||!b)return;var x1=a.x+CW,y1=a.y+CH/2,x2=b.x-2,y2=b.y+CH/2,dx=Math.max(30,Math.abs(x2-x1)/2);
  var p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M'+x1+' '+y1+' C'+(x1+dx)+' '+y1+' '+(x2-dx)+' '+y2+' '+x2+' '+y2);p.setAttribute('marker-end','url(#ar-a)');if(e[2])p.setAttribute('class','aff');p.dataset.a=e[0];p.dataset.b=e[1];svg.appendChild(p)});
 canvas.appendChild(svg);
 DATA.issues.forEach(function(i){var c=card(i);c.style.left=pos[i.id].x+'px';c.style.top=pos[i.id].y+'px';canvas.appendChild(c)})}
function list(label,ids){var r=el('div','row');r.appendChild(el('b',null,label));if(!ids.length){r.appendChild(el('span','note','Nothing.'));return r}var u=el('ul');ids.forEach(function(id){var li=el('li');var b=el('button',null,id+'  '+byId[id].title+'  ('+stName(byId[id].state)+')');b.type='button';b.addEventListener('click',function(){choose(id,true)});li.appendChild(b);u.appendChild(li)});r.appendChild(u);return r}
function showPanel(){panel.textContent='';if(!sel){panel.classList.add('hidden');return}var i=byId[sel];panel.classList.remove('hidden');
 var x=el('button','x','Close');x.type='button';x.addEventListener('click',function(){choose(null)});panel.appendChild(x);
 panel.appendChild(el('b',null,i.id));panel.appendChild(el('h3',null,i.title));
 var r=el('div','row');var c1=el('span','chip',stName(i.state)+(isNext(i)?', can start now':''));c1.style.setProperty('--c',SC[i.state]);r.appendChild(c1);var c2=el('span','chip',i.kind);c2.style.setProperty('--c',KC[i.kind]);r.appendChild(c2);panel.appendChild(r);
 var m=el('div','row');m.appendChild(el('b',null,'Lane and stage of the plan'));m.appendChild(document.createTextNode(i.theme+' | '+(i.milestone==='Later'?'Added after the plan':i.milestone+' '+i.milestoneName)));panel.appendChild(m);
 var p=el('div','row');p.appendChild(el('b',null,'What it is for'));p.appendChild(document.createTextNode(i.purpose||'No purpose line was saved for this task.'));panel.appendChild(p);
 panel.appendChild(list('Needs first',inc[i.id]));panel.appendChild(list('Feeds',out[i.id]))}
function choose(id,scroll){sel=id;showPanel();paint();if(id&&scroll&&pos[id]){var p=pos[id];board.scrollTo({left:Math.max(0,p.x-260),behavior:'smooth'});window.scrollTo({top:board.getBoundingClientRect().top+window.scrollY+p.y-120,behavior:'smooth'})}}
function paint(){var t=q.value.trim().toLowerCase(),shown=0,rel={};
 if(sel){rel[sel]=1;inc[sel].forEach(function(a){rel[a]=1});out[sel].forEach(function(a){rel[a]=1})}
 document.querySelectorAll('.tk').forEach(function(c){var i=byId[c.dataset.id];var ok=onS[i.state]&&onK[i.kind]&&(!t||(i.id+' '+i.title+' '+i.purpose).toLowerCase().indexOf(t)>=0);c.classList.toggle('dim',!ok||(!!sel&&!rel[i.id]));c.classList.toggle('on',sel===i.id);c.classList.toggle('rel',!!sel&&sel!==i.id&&!!rel[i.id]);if(ok)shown++});
 document.querySelectorAll('svg.links path[data-a]').forEach(function(p){var h=!!sel&&(p.dataset.a===sel||p.dataset.b===sel);p.classList.toggle('hot',h);p.setAttribute('marker-end',h?'url(#ar-h)':'url(#ar-a)')});
 if(svg)svg.classList.toggle('sel',!!sel);
 document.getElementById('count').textContent=shown+' of '+DATA.issues.length+' shown'}
function pill(host,label,color,hollow,state,key){var b=el('button','pill');b.type='button';b.setAttribute('aria-pressed',true);var s=el('span',hollow?'dot hollow':'sq');s.style.setProperty('--c',color);b.appendChild(s);b.appendChild(document.createTextNode(label));b.addEventListener('click',function(){state[key]=!state[key];b.setAttribute('aria-pressed',state[key]);paint()});host.appendChild(b)}
KORDER.forEach(function(k){pill(document.getElementById('kf'),k,KC[k],false,onK,k)});
STATES.forEach(function(s){if(s[0]==='Canceled'&&!cnt[s[0]])return;pill(document.getElementById('sf'),s[1],SC[s[0]],s[0]==='Backlog',onS,s[0])});
q.addEventListener('input',paint);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sel)choose(null)});
build();paint();
`;
  return shell({ title: 'ConquerCourse Course Map', file: 'course-map.html', body, script, css: CM_CSS, wide: true, cleanIds: ['counts', 'seg', 'kf', 'sf', 'canvas', 'panel'] });
}

// The copy for the claude.ai artifact: same page, nav links to other pages turned into plain labels.
export function artifactCopy(html) {
  // The artifact viewer cannot save files, so the download control goes too.
  return html
    .replace(/<a href="(index|site-map|course-map|code-map|timeline)\.html">([^<]*)<\/a>/g, '<span>$2</span>')
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
