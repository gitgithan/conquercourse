"""Name every Graphify community from its member files (no model calls): the busiest folder and files give a plain label."""
import collections, json
from pathlib import Path

out = Path(__file__).resolve().parent.parent / 'graphify-out'
graph = json.loads((out / 'graph.json').read_text())
communities = json.loads((out / '.graphify_analysis.json').read_text())['communities']
by_id = {n['id']: n for n in graph['nodes']}
names, seen = [], collections.Counter()
for cid in sorted(communities, key=int):
    nodes = [by_id[i] for i in communities[cid] if i in by_id]
    files = collections.Counter(n['source_file'] for n in nodes if n.get('source_file'))
    if not files:
        label = 'External and unplaced references'
    else:
        top = [Path(f) for f, _ in files.most_common(2)]
        folder = top[0].parent.as_posix()
        stems = ' and '.join(dict.fromkeys(p.stem for p in top))
        label = f'{stems} ({folder})'
    seen[label] += 1
    names.append(label if seen[label] == 1 else f'{label} #{seen[label]}')
(out / 'community-names.txt').write_text('\n'.join(names) + '\n')
print('named', len(names), 'communities')
