#!/usr/bin/env python3
"""CC-145: photo triage v2. Gates in front of the SAM 3D lift, scored against what the lift really gave.

Stages (each writes to data/eval/cc-145-triage-v2/):
  features  Method A: cheap numbers from the SAM 3 mask (no model call, no cost)
  renders   the images the model methods are shown (mask on plain background, raw photo with the mask outline)
  score     leave-one-out rules for Method A
  ask       Methods B, C, D: ask Muse Spark Open (Baseten) or Muse Wonder (Meta API) about the renders; keys are read from ~/.config/ninja/, never printed
  models    scores the saved model answers against what the lift gave

  ask usage:  triage_v2.py ask <spark|wonder> <plain|outline> [id ...]

Run from the repo root with the venv python:  /root/triage-venv/bin/python scripts/triage_v2.py features
"""
import json
import sys
from itertools import combinations
from pathlib import Path

import base64
import io
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path('data/eval/cc-145-triage-v2')
CC110, CC38 = Path('data/eval/cc-110-real-objects'), Path('data/eval/cc-38-photo-to-3d')

# Truth = what the lift gave, judged on its sheet (CC-110 and CC-38 READMEs).
# mural02 is "no" on the default pipeline (a table); padding the photo 1.5x made it "partly" (CC-38 r3), so it is flagged and scored with and without.
ROWS = [
    ('bollard-iron', 'cc110', 'good', ''), ('hydrant-red', 'cc110', 'good', ''), ('barrel-oak', 'cc110', 'good', ''),
    ('planter-concrete', 'cc110', 'good', ''), ('gabion-wall', 'cc110', 'good', 'fills the frame; its lift needed the photo padded 1.5x'),
    ('pipe-ring', 'cc110', 'good', ''), ('picnic-table', 'cc110', 'partly', 'thin legs'), ('bench-concrete-curve', 'cc110', 'good', ''),
    ('railing-red', 'cc110', 'partly', 'thin'), ('fence-split-rail', 'cc110', 'no', 'rails come out as one heap'),
    ('bar-green', 'cc110', 'good', ''), ('bar-black', 'cc110', 'good', ''), ('log-driftwood', 'cc110', 'partly', 'odd shape, but real'),
    ('stump-spruce', 'cc110', 'good', ''),
    ('park01', 'cc38', 'good', 'handrail'), ('park02', 'cc38', 'partly', 'the rail follows the stairs'), ('park03', 'cc38', 'good', ''),
    ('park06', 'cc38', 'no', 'the saved box was a thin shadow strip'), ('park07', 'cc38', 'no', 'steps come out flat'),
    ('rail01', 'cc38', 'partly', 'gate and fence merged'), ('mural01', 'cc38', 'good', ''),
    ('mural02', 'cc38', 'no', 'AMBIGUOUS: a table by default, partly after 1.5x padding'), ('bench01', 'cc38', 'good', ''),
]
AMBIGUOUS = {'mural02'}


def paths(pid: str, src: str) -> tuple[Path, Path]:
    base = CC110 if src == 'cc110' else CC38
    masks = list(base.glob(f'r*/{pid}/mask.png'))
    masks.sort(key=lambda p: p.parts[-3])  # r1 first: the unpadded run where there is one
    return base / 'inputs' / f'{pid}.jpg', masks[0]


def box_of(pid: str, src: str) -> list[int]:
    base = CC110 if src == 'cc110' else CC38
    return next(p['box'] for p in json.loads((base / 'photos.json').read_text()) if p['photo'] == pid)


def load(pid: str, src: str):
    img_p, mask_p = paths(pid, src)
    img = np.array(Image.open(img_p).convert('RGB'))
    mask = np.array(Image.open(mask_p).convert('L')) > 127
    return img, mask


def features(img: np.ndarray, mask: np.ndarray, box: list[int]) -> dict:
    h, w = mask.shape
    area = int(mask.sum())
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = int(x1 - x0 + 1), int(y1 - y0 + 1)
    # border contact: share of each image edge's pixels (an edge strip 2 px wide) that are mask
    strip = 2
    sides = {'top': mask[:strip].mean(), 'bottom': mask[-strip:].mean(), 'left': mask[:, :strip].mean(), 'right': mask[:, -strip:].mean()}
    touch = {k: float(v) for k, v in sides.items()}
    # components and holes, ignoring specks under 0.2 % of the mask
    lab, n = ndi.label(mask)
    sizes = ndi.sum(mask, lab, range(1, n + 1)) if n else np.array([])
    big = [s for s in sizes if s >= 0.002 * area]
    holes_lab, hn = ndi.label(~mask)
    border_ids = set(np.unique(np.concatenate([holes_lab[0], holes_lab[-1], holes_lab[:, 0], holes_lab[:, -1]])))
    hsz = [int((holes_lab == i).sum()) for i in range(1, hn + 1) if i not in border_ids]
    holes = [s for s in hsz if s >= 0.002 * area]
    # solidity and thinness
    cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull_area = sum(cv2.contourArea(cv2.convexHull(c)) for c in [np.vstack(cnts)]) if cnts else 1
    dist = ndi.distance_transform_edt(mask)
    perim = sum(cv2.arcLength(c, True) for c in cnts)
    # edge sharpness: image gradient on the mask outline against the median gradient of the whole photo
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx, gy = cv2.Sobel(gray, cv2.CV_32F, 1, 0), cv2.Sobel(gray, cv2.CV_32F, 0, 1)
    grad = np.hypot(gx, gy)
    edge = mask ^ ndi.binary_erosion(mask, iterations=2)
    edge[:strip] = edge[-strip:] = False
    edge[:, :strip] = edge[:, -strip:] = False
    edge_grad = float(grad[edge].mean()) if edge.any() else 0.0
    bx0, by0, bx1, by1 = box
    inbox = float(mask[by0:by1, bx0:bx1].sum() / area)
    return {
        'area_share': area / (h * w),
        'bbox_share': bw * bh / (h * w),
        'bbox_fill': area / (bw * bh),
        'bbox_aspect': bw / bh,
        'border_max': max(touch.values()),
        'border_sides': sum(v > 0.0 for v in touch.values()),
        'border_touch': float(max(touch.values()) > 0.0),
        'components': len(big),
        'largest_share': float(max(sizes) / area) if len(sizes) else 0.0,
        'holes': len(holes),
        'hole_share': float(sum(holes) / area),
        'solidity': float(area / hull_area) if hull_area else 0.0,
        'thin_max_width_share': float(2 * dist.max() / max(bw, bh)),
        'mean_width_share': float(2 * area / max(perim, 1) / max(bw, bh)),
        'edge_sharpness': edge_grad / (float(np.median(grad)) + 1e-6),
        'in_box_share': inbox,
        'sides': {k: round(v, 3) for k, v in touch.items()},
    }


def cmd_features() -> None:
    out = {}
    for pid, src, outcome, note in ROWS:
        img, mask = load(pid, src)
        f = features(img, mask, box_of(pid, src))
        out[pid] = {'source': src, 'outcome': outcome, 'note': note, 'ambiguous': pid in AMBIGUOUS, 'image': [mask.shape[1], mask.shape[0]], **f}
    (ROOT / 'outputs').mkdir(parents=True, exist_ok=True)
    (ROOT / 'outputs' / 'features.json').write_text(json.dumps(out, indent=2) + '\n')
    cols = ['area_share', 'bbox_fill', 'border_max', 'components', 'holes', 'hole_share', 'solidity', 'thin_max_width_share', 'mean_width_share', 'edge_sharpness']
    print('id'.ljust(22), 'out'.ljust(7), *[c[:9].rjust(9) for c in cols])
    for pid, r in out.items():
        print(pid.ljust(22), r['outcome'].ljust(7), *[f'{r[c]:9.3f}' for c in cols])


# ---------- scoring ----------
def auc(vals: np.ndarray, bad: np.ndarray) -> float:
    """Chance that a bad row has a higher value than a good one (ties half). 0.5 = no signal."""
    pos, neg = vals[bad], vals[~bad]
    if not len(pos) or not len(neg):
        return float('nan')
    gt = (pos[:, None] > neg[None, :]).mean()
    eq = (pos[:, None] == neg[None, :]).mean()
    return float(gt + 0.5 * eq)


def best_threshold(vals: np.ndarray, bad: np.ndarray) -> tuple[float, int, float]:
    """The single cut (value, direction +1 means bad when value >= cut) with most rows right; ties go to fewer misses."""
    best = (None, 1, -1.0, 99)
    for cut in np.unique(vals):
        for d in (1, -1):
            pred = (vals * d >= cut * d)
            acc = (pred == bad).mean()
            miss = int((~pred & bad).sum())
            if acc > best[2] or (acc == best[2] and miss < best[3]):
                best = (float(cut), d, float(acc), miss)
    return best[0], best[1], best[2]


def loo_stump(X: np.ndarray, bad: np.ndarray) -> np.ndarray:
    """Leave one row out, choose cut on the rest, predict the held-out row."""
    pred = np.zeros(len(bad), bool)
    for i in range(len(bad)):
        keep = np.arange(len(bad)) != i
        cut, d, _ = best_threshold(X[keep], bad[keep])
        pred[i] = X[i] * d >= cut * d
    return pred


def confusion(pred: np.ndarray, bad: np.ndarray) -> dict:
    return {'agree': int((pred == bad).sum()), 'of': int(len(bad)), 'false_alarms': int((pred & ~bad).sum()), 'misses': int((~pred & bad).sum())}


def cmd_score() -> None:
    feats = json.loads((ROOT / 'outputs' / 'features.json').read_text())
    names = [k for k in next(iter(feats.values())) if isinstance(next(iter(feats.values()))[k], (int, float)) and k not in ('ambiguous',)]
    ids = list(feats)
    outcome = np.array([feats[i]['outcome'] for i in ids])
    result = {}
    for target_name, bad_set in (('strict (lift gives "no")', {'no'}), ('loose (lift gives "partly" or "no")', {'partly', 'no'})):
        for drop_amb in (False, True):
            sel = [k for k, i in enumerate(ids) if not (drop_amb and feats[i]['ambiguous'])]
            bad = np.array([outcome[k] in bad_set for k in sel])
            tag = f'{target_name}{", ambiguous row left out" if drop_amb else ""}'
            table = {}
            for f in names:
                v = np.array([feats[ids[k]][f] for k in sel], float)
                a = auc(v, bad)
                cut, d, acc = best_threshold(v, bad)
                pred = loo_stump(v, bad)
                table[f] = {'auc': round(a, 3), 'cut': round(cut, 4), 'bad_when': '>=' if d == 1 else '<=', 'fit_acc': round(acc, 3), 'loo': confusion(pred, bad)}
            # best pair: "bad when either feature fires", cuts chosen leave-one-out
            pairs = {}
            for f, g in combinations(names, 2):
                vf = np.array([feats[ids[k]][f] for k in sel], float)
                vg = np.array([feats[ids[k]][g] for k in sel], float)
                pf, pg = loo_stump(vf, bad), loo_stump(vg, bad)
                pairs[f'{f} OR {g}'] = confusion(pf | pg, bad)
            top = sorted(pairs.items(), key=lambda kv: (-kv[1]['agree'], kv[1]['misses']))[:5]
            result[tag] = {'rows': len(sel), 'bad_rows': int(bad.sum()), 'single': table, 'top_pairs_loo': dict(top)}
    (ROOT / 'outputs' / 'method_a_scores.json').write_text(json.dumps(result, indent=2) + '\n')
    for tag, r in result.items():
        print(f'\n## {tag}: {r["rows"]} rows, {r["bad_rows"]} bad')
        ranked = sorted(r['single'].items(), key=lambda kv: -abs(kv[1]['auc'] - 0.5))
        for f, t in ranked[:8]:
            print(f'{f:24} auc {t["auc"]:.2f}  bad when {t["bad_when"]} {t["cut"]:<8}  leave-one-out right {t["loo"]["agree"]}/{t["loo"]["of"]}  false alarms {t["loo"]["false_alarms"]}  misses {t["loo"]["misses"]}')
        for p, c in list(r['top_pairs_loo'].items())[:3]:
            print('  pair', p, c)



# ---------- renders and model questions ----------
PLAIN = ('A photo of one real object was cut out of its background (the flat grey around it is empty background). '
         'A 3D model will now turn this single cut-out into a 3D object for a game. It works well on one solid, compact object with its whole shape visible. '
         'It fails when the cut-out is very thin, is in several separate pieces, has parts missing or cut off by the edge of the photo, has other things stuck to it, or is not one object. '
         'Judge only whether the 3D lift will give a usable object. '
         'Reply with only JSON: {"verdict":"ok" or "review" or "block","reason":"<one short sentence>"}. '
         'ok = likely usable. review = may be flawed. block = will almost certainly fail.')
OUTLINE = ('The magenta line outlines the object chosen for a 3D lift in this photo. '
           'Question: is the whole object inside the photo, with no part of it cut off by the edge of the photo? '
           'Reply with only JSON: {"whole_object_in_frame":"yes" or "no" or "unsure","reason":"<one short sentence>"}.')
PROMPTS = {'plain': PLAIN, 'outline': OUTLINE}


def to_data_url(im: Image.Image, long_side: int = 768) -> str:
    im = im.copy()
    im.thumbnail((long_side, long_side))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def render(pid: str, src: str, kind: str) -> Image.Image:
    img, mask = load(pid, src)
    if kind == 'plain':
        ys, xs = np.nonzero(mask)
        m = int(0.08 * max(xs.max() - xs.min(), ys.max() - ys.min()))
        x0, x1 = max(xs.min() - m, 0), min(xs.max() + m + 1, mask.shape[1])
        y0, y1 = max(ys.min() - m, 0), min(ys.max() + m + 1, mask.shape[0])
        out = np.full(img.shape, 200, np.uint8)  # flat mid-grey, so a white or black object still shows
        out[mask] = img[mask]
        return Image.fromarray(out[y0:y1, x0:x1])
    out = img.copy()
    cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(out, cnts, -1, (255, 0, 255), max(3, mask.shape[1] // 300))
    return Image.fromarray(out)


def env_value(file: str, name: str) -> str:
    for line in open(os.path.expanduser(f'~/.config/ninja/{file}')):
        if line.startswith(name + '='):
            return line.split('=', 1)[1].strip().strip('"\'')
    raise SystemExit(f'no {name} in ~/.config/ninja/{file}')


def post(model: str, content: list, max_tokens: int) -> dict:
    import requests
    if model == 'spark':
        r = requests.post('https://inference.baseten.co/v1/chat/completions', timeout=300,
                          headers={'authorization': 'Api-Key ' + env_value('baseten.env', 'BASETEN_API_KEY')},
                          json={'model': 'meta-models/muse-spark-open-1026', 'max_tokens': max_tokens, 'temperature': 0, 'messages': [{'role': 'user', 'content': content}]})
    else:
        r = requests.post('https://api.meta.ai/v1/chat/completions', timeout=300,
                          headers={'authorization': 'Bearer ' + env_value('meta.env', 'META_API_KEY')},
                          json={'model': 'muse-wonder-1.0', 'max_tokens': max_tokens, 'reasoning_effort': 'low', 'messages': [{'role': 'user', 'content': content}]})
    return {'status': r.status_code, 'body': r.json() if r.headers.get('content-type', '').startswith('application/json') else {'text': r.text[:500]}}


def parse_json(text: str):
    m = re.search(r'\{.*\}', text or '', re.S)
    try:
        return json.loads(m.group(0)) if m else None
    except json.JSONDecodeError:
        return None


def cmd_ask(model: str, kind: str, only: list[str]) -> None:
    out_dir = ROOT / 'outputs' / f'{model}-{kind}'
    img_dir = ROOT / 'inputs' / kind
    out_dir.mkdir(parents=True, exist_ok=True)
    img_dir.mkdir(parents=True, exist_ok=True)
    rows = [r for r in ROWS if not only or r[0] in only]

    def one(row):
        pid, src = row[0], row[1]
        f = out_dir / f'{pid}.json'
        if f.exists():
            return json.loads(f.read_text())
        im = render(pid, src, kind)
        small = to_data_url(im)
        (img_dir / f'{pid}.jpg').write_bytes(base64.b64decode(small.split(',', 1)[1]))
        content = [{'type': 'text', 'text': PROMPTS[kind]}, {'type': 'image_url', 'image_url': {'url': small}}]
        t0 = time.time()
        for max_tokens in (4000, 8000):
            res = post(model, content, max_tokens)
            text = (res['body'].get('choices') or [{}])[0].get('message', {}).get('content') or ''
            if res['status'] != 200 or text.strip():
                break
        usage = res['body'].get('usage') or {}
        rec = {'id': pid, 'model': model, 'kind': kind, 'status': res['status'], 'seconds': round(time.time() - t0, 1),
               'prompt_tokens': usage.get('prompt_tokens', 0), 'completion_tokens': usage.get('completion_tokens', 0),
               'raw': text.strip(), 'answer': parse_json(text), 'error': None if res['status'] == 200 else res['body']}
        f.write_text(json.dumps(rec, indent=2) + '\n')
        print(pid, rec['status'], rec['answer'], f"{rec['seconds']}s")
        return rec

    with ThreadPoolExecutor(4) as pool:
        list(pool.map(one, rows))


PRICES = {'spark': (1.25, 4.25), 'wonder': (4.0, 20.0)}  # USD per 1M tokens (input, output)


def cmd_models() -> None:
    feats = json.loads((ROOT / 'outputs' / 'features.json').read_text())
    truth = {r[0]: r[2] for r in ROWS}
    cut_off = {i: feats[i]['border_max'] >= 0.02 for i in feats}  # the mask runs into the photo edge: a different truth, for the "whole object in frame" question
    report = {}
    for d in sorted((ROOT / 'outputs').glob('*-*')):
        if not d.is_dir():
            continue
        model, kind = d.name.split('-', 1)
        recs = [json.loads(f.read_text()) for f in sorted(d.glob('*.json'))]
        if not recs:
            continue
        tin = sum(r['prompt_tokens'] for r in recs)
        tout = sum(r['completion_tokens'] for r in recs)
        usd = (tin * PRICES[model][0] + tout * PRICES[model][1]) / 1e6
        errors = [r['id'] for r in recs if r['status'] != 200 or not r['answer']]
        policies = {}
        for r in recs:
            a = r['answer'] or {}
            v = a.get('verdict') or a.get('whole_object_in_frame')
            policies.setdefault('answers', {}).setdefault(v, []).append(r['id'])
        def reject(r, level):
            a = r['answer'] or {}
            if kind == 'plain':
                return a.get('verdict') in (('block',) if level == 'strict' else ('review', 'block'))
            return a.get('whole_object_in_frame') in (('no',) if level == 'strict' else ('no', 'unsure'))
        scored = {}
        for target, bad_set in (('lift gave "no"', {'no'}), ('lift gave "partly" or "no"', {'partly', 'no'})):
            for level in ('strict', 'lenient'):
                pred = np.array([reject(r, level) for r in recs])
                bad = np.array([truth[r['id']] in bad_set for r in recs])
                scored[f'rejects when {"model says the worst" if level == "strict" else "model says anything but ok"} | target {target}'] = confusion(pred, bad)
        if kind == 'outline':
            for level in ('strict', 'lenient'):
                pred = np.array([reject(r, level) for r in recs])
                co = np.array([cut_off[r['id']] for r in recs])
                scored[f'{level}: against "mask runs into the photo edge" (cut-off truth)'] = confusion(pred, co)
        report[d.name] = {'rows': len(recs), 'errors_or_unreadable': errors, 'tokens_in': tin, 'tokens_out': tout, 'usd': round(usd, 4),
                          'usd_per_photo': round(usd / len(recs), 5), 'answers': policies['answers'], 'scores': scored}
    (ROOT / 'outputs' / 'model_scores.json').write_text(json.dumps(report, indent=2) + '\n')
    for k, v in report.items():
        print(f'\n## {k}: {v["rows"]} rows, ${v["usd"]} (${v["usd_per_photo"]}/photo), unreadable {v["errors_or_unreadable"]}')
        print('  answers:', {a: len(ids) for a, ids in v['answers'].items()})
        for s, c in v['scores'].items():
            print(f'  {s}: right {c["agree"]}/{c["of"]}, false alarms {c["false_alarms"]}, misses {c["misses"]}')



def a_rule(r: dict) -> bool:
    """Hand-made from the Method A table (so tuned on these rows: optimistic). A thin strip, several pieces or a run into the photo edge."""
    return r['bbox_aspect'] >= 5 or r['components'] >= 3 or r['border_max'] >= 0.15


def cmd_table() -> None:
    feats = json.loads((ROOT / 'outputs' / 'features.json').read_text())
    ids = list(feats)

    def ans(model, kind, i):
        a = json.loads((ROOT / 'outputs' / f'{model}-{kind}' / f'{i}.json').read_text())['answer'] or {}
        return a.get('verdict') or a.get('whole_object_in_frame') or '?'

    cols = {'A-rule': lambda i: a_rule(feats[i]),
            'Spark plain=block': lambda i: ans('spark', 'plain', i) == 'block',
            'Wonder plain=block': lambda i: ans('wonder', 'plain', i) == 'block',
            'Spark frame=no': lambda i: ans('spark', 'outline', i) == 'no',
            'Wonder frame=no': lambda i: ans('wonder', 'outline', i) == 'no'}
    cols['A or Spark-plain'] = lambda i: cols['A-rule'](i) or cols['Spark plain=block'](i)
    cols['A and Spark-plain'] = lambda i: cols['A-rule'](i) and cols['Spark plain=block'](i)
    cols['A or Spark-frame'] = lambda i: cols['A-rule'](i) or cols['Spark frame=no'](i)
    cols['2 of 3: A, Spark-plain, Wonder-plain'] = lambda i: sum([cols['A-rule'](i), cols['Spark plain=block'](i), cols['Wonder plain=block'](i)]) >= 2
    cols['2 of 3: A, Spark-frame, Wonder-frame'] = lambda i: sum([cols['A-rule'](i), cols['Spark frame=no'](i), cols['Wonder frame=no'](i)]) >= 2
    lines = ['| photo | lift gave | ' + ' | '.join(['A-rule', 'Spark plain', 'Wonder plain', 'Spark frame', 'Wonder frame']) + ' |', '|---|---|' + '---|' * 5]
    for i in ids:
        lines.append(f'| {i} | {feats[i]["outcome"]} | ' + ' | '.join([('REJECT' if cols["A-rule"](i) else 'ok'), ans('spark', 'plain', i), ans('wonder', 'plain', i), ans('spark', 'outline', i), ans('wonder', 'outline', i)]) + ' |')
    (ROOT / 'outputs' / 'per_photo.md').write_text('\n'.join(lines) + '\n')
    out = {}
    for target, bad_set in (('lift gave "no"', {'no'}), ('lift gave "partly" or "no"', {'partly', 'no'})):
        bad = np.array([feats[i]['outcome'] in bad_set for i in ids])
        for name, fn in cols.items():
            pred = np.array([bool(fn(i)) for i in ids])
            c = confusion(pred, bad)
            c['good_rejected'] = [i for i in ids if fn(i) and feats[i]['outcome'] == 'good']
            c['bad_missed'] = [i for i in ids if not fn(i) and feats[i]['outcome'] in bad_set]
            out.setdefault(target, {})[name] = c
    (ROOT / 'outputs' / 'combined_scores.json').write_text(json.dumps(out, indent=2) + '\n')
    print('\n'.join(lines))
    for t, d in out.items():
        print('\n##', t)
        for n, c in d.items():
            print(f'{n:40} right {c["agree"]}/{c["of"]}  false alarms {c["false_alarms"]}  misses {c["misses"]}   good rejected: {c["good_rejected"]}  missed: {c["bad_missed"]}')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'ask':
        cmd_ask(sys.argv[2], sys.argv[3], sys.argv[4:])
    else:
        {'features': cmd_features, 'score': cmd_score, 'models': cmd_models, 'table': cmd_table}[cmd]()
