#!/usr/bin/env python3
"""Promo v2 scene 2: proves the bottom overlay and the top-left chip cannot touch (CC-133).
usage: python3 scripts/promo-v2/layout-check.py [manifest.json]   -> exit 1 on any overlap or any box outside the 1920x1080 frame.
It measures the text with the same font and sizes the build step gives ffmpeg's drawtext (DejaVu Sans Bold, box border added)."""
import json, sys
from PIL import ImageFont
man = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '../conquercourse-assets/promo-v2b/manifest.json'))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
W, H = 1920, 1080
def box(text, L):
    f = ImageFont.truetype(FONT, L['size']); l, t, r, b = f.getbbox(text); tw = r - l; th = f.getmetrics()[0] + f.getmetrics()[1]
    x = eval(str(L['x']).replace('(w-text_w)/2', f'({W}-{tw})/2').replace('text_w', str(tw)).replace('w', str(W))) if isinstance(L['x'], str) else L['x']
    y = eval(str(L['y']).replace('h', str(H))) if isinstance(L['y'], str) else L['y']
    return (x - L['border'], y - L['border'], x + tw + L['border'], y + th + L['border'])
bad = 0
for c in man['clips']:
    ob = box(c['overlay']['text'], c['layout']['overlay']); cb = box(c['chip']['text'], c['layout']['chip']) if c.get('chip') else None
    inside = lambda b: b[0] >= 0 and b[1] >= 0 and b[2] <= W and b[3] <= H
    hit = cb and not (ob[2] <= cb[0] or cb[2] <= ob[0] or ob[3] <= cb[1] or cb[3] <= ob[1])
    ok = inside(ob) and (cb is None or inside(cb)) and not hit and ob[1] > H / 2 and (cb is None or cb[3] < H / 2)
    print(c['id'], 'overlay', [round(v) for v in ob], 'chip', [round(v) for v in cb] if cb else None, 'OK' if ok else 'FAIL'); bad += not ok
sys.exit(1 if bad else 0)
