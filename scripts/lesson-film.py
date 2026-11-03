"""Draws a side-view clip and a contact sheet from a trace made by scripts/lesson-trace.ts (CC-133, docs/lessons-*.md).
One picture per trace frame, 30 per game second: a stepped clock, so the clip plays at true speed.
Use: python3 scripts/lesson-film.py <trace.json> <out.mp4> <sheet.png> [title]
This is the simulator's own state drawn as a plain side view (not the game's look): ground, holds, rungs, poles and the body."""
import json, subprocess, sys, tempfile, os
from PIL import Image, ImageDraw, ImageFont

trace, mp4, sheet = sys.argv[1:4]
title = sys.argv[4] if len(sys.argv) > 4 else ''
d = json.load(open(trace))
W, H = 960, 360
fr = d['frames']
xs = [f['x'] for f in fr]
X0, X1 = min(xs) - 3, max(xs) + 3
GROUND, YMAX = H - 60, 6.2
sx = lambda x: (x - X0) / (X1 - X0) * W
sy = lambda y: GROUND - (y + 0) / YMAX * (GROUND - 30)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
except OSError:
    font = ImageFont.load_default()
LABEL = {'polec': 'pole climb', 'hang': 'hanging on a bar', 'bars': 'monkey bars', 'run': 'run or flight'}
COLOR = {'run': (60, 60, 60), 'hang': (214, 39, 40), 'bars': (31, 119, 180), 'vault': (44, 160, 44), 'climb': (148, 103, 189), 'polec': (255, 127, 14)}

def draw(f, i):
    im = Image.new('RGB', (W, H), (205, 230, 245)); g = ImageDraw.Draw(im)
    for p in d['platforms']:
        g.rectangle([sx(p['x0']), sy(p['top']), sx(p['x1']), H], fill=(207, 174, 122))
    for p in d['poles']:
        g.line([sx(p['x']), sy(0), sx(p['x']), sy(p['top'])], fill=(120, 120, 120), width=5)
    for h in d['holds']:
        g.ellipse([sx(h['x']) - 5, sy(h['y']) - 5, sx(h['x']) + 5, sy(h['y']) + 5], outline=(31, 119, 180), width=3)
    for b in d['bars']:
        for k in range(b['n']):
            x = sx(b['x'] + k * b['gap']); y = sy(b['y'])
            g.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(31, 119, 180))
    mode = f['mode']; c = COLOR.get(mode, (60, 60, 60))
    x, y = sx(f['x']), sy(f['y'])
    top = sy(f['y'] + 1.6)
    g.line([x, y, x, top], fill=c, width=6)  # body, drawn 1.6 m tall from the simulator's point
    g.ellipse([x - 8, top - 16, x + 8, top], fill=c)
    g.text((10, 8), f"{title}   t = {f['t']:.2f} s   state: {LABEL.get(mode, mode)}", fill=(0, 0, 0), font=font)
    return im

if mp4 != '-':
    tmp = tempfile.mkdtemp()
    for i, f in enumerate(fr):
        draw(f, i).save(f'{tmp}/f{i:05d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{tmp}/f%05d.png', '-pix_fmt', 'yuv420p', '-crf', '30', mp4], check=True)
# contact sheet: first frame of each state change, up to 8
picks, last = [], None
for i, f in enumerate(fr):
    if f['mode'] != last: picks.append(i); last = f['mode']
picks = picks[:8] if len(picks) >= 4 else [int(k * (len(fr) - 1) / 7) for k in range(8)]
cols = 2; rows = (len(picks) + 1) // 2
sh = Image.new('RGB', (W // 2 * cols, H // 2 * rows), 'white')
for n, i in enumerate(picks):
    sh.paste(draw(fr[i], i).resize((W // 2, H // 2)), (n % cols * (W // 2), n // cols * (H // 2)))
sh.save(sheet, optimize=True)
print('frames', len(fr), 'sheet picks', picks)
