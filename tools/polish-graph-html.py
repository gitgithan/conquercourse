"""Polish the drill-down graph.html: short plain node names and brighter edges (no model calls).

Run after tools/community-explorer.py:  python3 tools/polish-graph-html.py [graph.html ...]
Safe to run twice: the long names are kept as `fullName` in the page data and in each node's tooltip.
"""
import collections, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GENERIC = {'index', 'main', 'types', 'type', 'test', 'tests', 'check', 'util', 'utils', 'helpers', 'core', 'common', 'shared', 'constants', 'config', 'mjs', 'ts', 'py'}
SKIP_FOLDERS = {'src', 'scripts', 'tests', 'pipelines', 'tools', '', '.'}
KEEP_UPPER = {'ik', 'rl', 'osm', 'ui', 'ccpipe', 'sam', 'api', 'gpu', 'db', 'd1', 'url', 'cc'}


def stem_base(path):
    s = Path(path).stem
    s = re.sub(r'^test[_-]', '', s)
    s = re.sub(r'([_.-])(test|check|spec)$', '', s)
    return s


def words(stem):
    stem = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', stem)
    return [w for w in re.split(r'[\s_.-]+', stem) if w]


def pretty(stem):
    ws = [w.upper() if w.lower() in KEEP_UPPER else w.lower() for w in words(stem)]
    ws = [w for w in ws if w.lower() not in GENERIC] or ws
    out = ' '.join(ws[:3])
    return out[:1].upper() + out[1:]


def folder_word(path):
    parts = [p for p in Path(path).parent.parts if p not in SKIP_FOLDERS]
    return pretty(parts[-1]) if parts else ''


def short_names(communities):
    names, used = {}, collections.Counter()
    for c in communities:
        base = collections.Counter()
        first_path = {}
        for f in c['files']:
            b = stem_base(f['path'])
            if b.lower() in GENERIC:
                continue
            base[b] += f['count']
            first_path.setdefault(b, f['path'])
        if not base:
            names[c['id']] = 'Loose references'
        else:
            top = [b for b, _ in base.most_common(2)]
            label = pretty(top[0])
            if len(top) > 1 and len(label) + len(pretty(top[1])) + 3 <= 26 and base[top[1]] * 2 >= base[top[0]]:
                label = f'{label} + {pretty(top[1])}'
            names[c['id']] = label
        used[names[c['id']]] += 1
    # Same label twice: add the folder, then a number.
    seen = collections.Counter()
    for c in communities:
        n = names[c['id']]
        if used[n] > 1 and c['files']:
            fw = folder_word(c['files'][0]['path'])
            if fw and fw.lower() not in n.lower():
                n = f'{fw}: {n}'
        names[c['id']] = n
    final = collections.Counter(names.values())
    for c in communities:
        n = names[c['id']]
        if final[n] > 1:
            seen[n] += 1
            names[c['id']] = f'{n} {seen[n]}'
    return names


EDGE_CSS_VARS = ('--edge: #c9d7e8; --edge-hot: #ffd27a;', '--edge: #3d4f66; --edge-hot: #b45f06;')
EDGE_JS = """
  const edgeColor = getComputedStyle(root).getPropertyValue('--edge').trim();
  const edgeHot = getComputedStyle(root).getPropertyValue('--edge-hot').trim();
  if (edgeColor && edgeColor !== themeEdgeColor) {
    themeEdgeColor = edgeColor;
    edgesDS.update(edgesDS.get().map(e => ({ id: e.id, color: { color: edgeColor, highlight: edgeHot, hover: edgeHot, opacity: 0.38 } })));
  }
"""


PANEL_OLD = '    color.opacity = prominent ? (focusedCommunity == null ? 0.14 : 0.32) : 0.018;\n    color.highlight = color.color;\n    color.hover = color.color;\n    return {id:e.id,color,width:focusedCommunity != null && prominent ? 0.8 : 0.5};\n'
PANEL_NEW = '    // Bright lines (owner, 2026-11-04: "way too dim in dark mode"): the colour comes from the theme, so Light and Dark both read.\n    const rootStyle = getComputedStyle(document.documentElement);\n    color.color = rootStyle.getPropertyValue(\'--edge\').trim() || color.color;\n    color.highlight = color.hover = rootStyle.getPropertyValue(\'--edge-hot\').trim() || color.color;\n    color.opacity = prominent ? (focusedCommunity == null ? 0.8 : 1) : 0.07;\n    return {id:e.id,color,width:focusedCommunity != null && prominent ? 2.6 : (focusedCommunity == null ? 1.4 : 0.6)};\n'


def polish(path):
    t = path.read_text()
    t = t.replace(PANEL_OLD, PANEL_NEW)  # pages built before the panel source changed
    m = re.search(r'(<script type="application/json" id="community-data">)(.*?)(</script>)', t, re.S)
    if not m:
        raise SystemExit(f'{path}: no community-data (run tools/community-explorer.py first)')
    comms = json.loads(m[2].replace('\\u003c', '<'))
    for c in comms:  # keep the long name once
        c.setdefault('fullName', c['name'])
    names = short_names(comms)
    full = {c['id']: c['fullName'] for c in comms}
    for c in comms:
        c['name'] = names[c['id']]
    t = t[:m.start(2)] + json.dumps(comms).replace('<', '\\u003c') + t[m.end(2):]
    # Node labels on the canvas.
    nm = re.search(r'const RAW_NODES = (\[.*\]);\n', t)
    nodes = json.loads(nm[1])
    for n in nodes:
        cid = str(n.get('community'))
        if not n.get('file_type') and not n.get('source_file') and cid in names:
            n['label'] = names[cid]
            n['font'] = dict(n.get('font') or {}, size=22)
            n['community_name'] = names[cid]
            n['title'] = f"{names[cid]} ({n.get('member_count', '?')} items)\n{full[cid]}"
    t = t[:nm.start(1)] + json.dumps(nodes) + t[nm.end(1):]
    # Edges: brighter, a little thicker, theme aware (whole page, both themes).
    t = re.sub(r'"width": 1, "color": \{"opacity": 0\.35\}', '"width": 1, "color": {"opacity": 0.38}', t)
    if '--edge:' not in t:
        t = t.replace('--neighbor-border: #333; --node-label: #ffffff;', '--neighbor-border: #333; --node-label: #ffffff; ' + EDGE_CSS_VARS[0], 1)
        t = t.replace('--neighbor-border: #ccc; --node-label: #222222;', '--neighbor-border: #ccc; --node-label: #222222; ' + EDGE_CSS_VARS[1], 1)
        t = t.replace("let themeLabelColor = '#ffffff';", "let themeLabelColor = '#ffffff';\nlet themeEdgeColor = '';", 1)
        t = t.replace("    nodesDS.update(nodesDS.get().map(n => ({ id: n.id, font: Object.assign({}, n.font, { color: labelColor }) })));\n  }\n", "    nodesDS.update(nodesDS.get().map(n => ({ id: n.id, font: Object.assign({}, n.font, { color: labelColor }) })));\n  }" + EDGE_JS, 1)
        assert 'themeEdgeColor' in t and EDGE_JS in t, 'graph.html changed shape: update EDGE_JS anchors'
    # Labels must stay visible when the whole map is in view (vis hides them below a size threshold by default).
    t = t.replace("nodes: { shape: 'dot', borderWidth: 1.5 },", "nodes: { shape: 'dot', borderWidth: 1.5, scaling: { label: { enabled: false } } },", 1)
    path.write_text(t)
    print(f'{path}: {len(names)} short names, e.g. ' + ', '.join(list(names.values())[:6]))


if __name__ == '__main__':
    for p in (sys.argv[1:] or [str(ROOT / 'graphify-out' / 'graph.html')]):
        polish(Path(p))
