"""Build a local community explorer from Graphify and session-authored names."""
import collections
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
out = root / 'graphify-out'
graph = json.loads((out / 'graph.json').read_text())
analysis = json.loads((out / '.graphify_analysis.json').read_text())
names = (out / 'community-names.txt').read_text().splitlines()
communities = analysis['communities']
assert len(names) == len(communities), 'Names must match this clustering; regenerate after reclustering.'
labels = {str(i): name for i, name in enumerate(names)}
import hashlib
membership = hashlib.sha256(json.dumps(communities, sort_keys=True).encode()).hexdigest()
lock = out / 'community-names.membership'
if lock.exists():
    assert lock.read_text() == membership, 'Community membership changed: regenerate and review names before rebuilding the explorer.'
else:
    lock.write_text(membership)
# Store membership signatures in Graphify's native format so stale names are rejected.
from graphify.cluster import community_member_sigs
(out / '.graphify_labels.json').write_text(json.dumps(labels, indent=2)+'\n')
(out / '.graphify_labels.json.sig').write_text(json.dumps(community_member_sigs({int(k):v for k,v in communities.items()})))
by_id = {n['id']: n for n in graph['nodes']}
node_community = {nid: cid for cid, members in communities.items() for nid in members}
for nid, cid in node_community.items():
    if nid in by_id:
        by_id[nid]['community_name'] = labels[cid]
(graph_path := out / 'graph.json').write_text(json.dumps(graph, indent=2)+'\n')
connections = collections.defaultdict(collections.Counter)
for e in graph.get('links', []):
    a, b = node_community.get(e['source']), node_community.get(e['target'])
    if a is not None and b is not None and a != b:
        connections[a][b] += 1
        connections[b][a] += 1
purposes = {}
items=[]
for cid, ids in sorted(communities.items(), key=lambda kv:int(kv[0])):
    nodes=[by_id[n] for n in ids if n in by_id]
    files=collections.Counter(n.get('source_file','') for n in nodes if n.get('source_file'))
    purpose=purposes.get(int(cid), 'Supports '+labels[cid][0].lower()+labels[cid][1:]+'. Review the member files and symbols below to see the implementation boundaries.')
    items.append(dict(id=cid,name=labels[cid],purpose=purpose,size=len(nodes),files=[dict(path=f,count=n) for f,n in files.most_common()],symbols=[dict(name=n.get('label',n['id']),file=n.get('source_file',''),line=n.get('source_location','')) for n in nodes],neighbors=[dict(id=k,name=labels[k],count=v) for k,v in connections[cid].most_common()]))
encoded=json.dumps(items).replace('<','\\u003c')
(out/'community-notes.json').write_text(json.dumps(dict(provenance='Named automatically from member file paths by tools/name-communities.py; no model calls.',communities=items),indent=2)+'\n')
# Keep the report consistent without reclustering and changing community membership.
import re
report=out/'GRAPH_REPORT.md'
report.write_text(re.sub(r'\bCommunity (\d+)\b',lambda m:labels.get(m[1],m[0]),report.read_text()))
print('Wrote names, signatures, model notes and explorer for',len(items),'communities')
# Embed details directly into Graphify's existing sidebar.
graph_html = out / 'graph.html'
if graph_html.exists():
    text = graph_html.read_text()
    # Remove older custom integration and replace this block idempotently.
    text = re.sub(r"^  html \+= .*Explore purpose, member files and symbols.*\n", '', text, flags=re.M)
    text = re.sub(r'<!-- community-panel:start -->.*?<!-- community-panel:end -->', '', text, flags=re.S)
    css = """<style>
#sidebar{width:460px;min-width:460px}#info-panel{overflow-y:auto;max-height:68vh;flex-shrink:0}#legend-wrap{min-height:100px}
#info-content .community-title{font-size:19px;line-height:1.3;margin-bottom:8px}#info-content .community-purpose{margin:12px 0;padding:10px;border-left:3px solid #8fc5ff;background:var(--bg)}
.community-muted{color:var(--text-2);font-size:12px}.community-note{margin-bottom:12px}#info-content details{margin:12px 0}#info-content summary{cursor:pointer;font-weight:600}.community-neighbors{max-height:140px;overflow:auto}
.community-neighbors button{display:block;width:100%;text-align:left;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px;margin:4px 0;cursor:pointer;border-radius:4px;font:inherit}
#community-filter{width:100%;background:var(--bg);border:1px solid var(--input-border);padding:8px;color:var(--text);border-radius:5px;margin:6px 0}#community-files,#community-symbols{max-height:240px;overflow:auto}.community-row{padding:7px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere}.community-row a{color:#8fc5ff}
</style>"""
    js = (root / 'tools/community-panel.js').read_text()
    addition = '<!-- community-panel:start -->'+css+'<script type="application/json" id="community-data">'+encoded+'</script><script>'+js+'</script><!-- community-panel:end -->'
    text = text.replace('</body>', addition+'</body>')
    text = text.replace("const matches = RAW_NODES.filter(n => n.label.toLowerCase().includes(q)).slice(0, 20);", "const matches = RAW_NODES.filter(n => { const c = COMMUNITY_DETAILS.get(String(n.id)); return JSON.stringify(c ? [c.name,c.files,c.symbols] : n.label).toLowerCase().includes(q); }).slice(0, 20);")
    graph_html.write_text(text)
