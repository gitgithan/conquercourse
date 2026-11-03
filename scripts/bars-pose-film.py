"""Bars pose film, step 2 (CC-133): draws the bars pose (a skeleton from scripts/bars-pose-trace.ts) as a side view, one picture per trace frame (30 per game second, a stepped clock),
and a contact sheet. Use: python3 scripts/bars-pose-film.py <trace.json> <out.mp4> <sheet.jpg> [title] [frames]
It is the pose's own skeleton on the rungs (not the game's look): far arm and leg are lighter. Left hand red, right hand blue."""
import json, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont
trace, mp4, sheet = sys.argv[1:4]
title = sys.argv[4] if len(sys.argv) > 4 else ''
d = json.load(open(trace)); fr = d['frames']; names = d['names']; par = d['parents']
W, H = 960, 420
xs = [f['at']['x'] for f in fr]; X0, X1 = min(xs) - 2.2, max(xs) + 2.2
GROUND = H - 30; S = (GROUND - 40) / 3.4  # px per metre; ground to 3.4 m
sx = lambda x: (x - X0) / (X1 - X0) * W
sy = lambda y: GROUND - y * S
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
def draw(f):
    im = Image.new('RGB', (W, H), (205, 230, 245)); g = ImageDraw.Draw(im)
    g.rectangle([0, GROUND, W, H], fill=(207, 174, 122))
    for b in d['bars']:
        for k in range(b['n']):
            x, y = sx(b['x'] + k * b['gap']), sy(b['y']); g.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(31, 119, 180))
    ox, oy = f['at']['x'], f['at']['y'] + 0.05
    P = lambda j: (sx(ox + j[2]), sy(oy + j[1]))
    J = f['joints']
    for i, p in enumerate(par):
        if p < 0 or any(k in names[i] for k in ('End', 'Eye', 'Jaw')): continue
        far = names[i].startswith('Right')
        g.line([P(J[p]), P(J[i])], fill=(120, 120, 120) if far else (40, 40, 40), width=5 if not far else 4)
    hd = P(J[names.index('Head')]); g.ellipse([hd[0] - 9, hd[1] - 9, hd[0] + 9, hd[1] + 9], outline=(40, 40, 40), width=3)
    for side, c in (('Left', (214, 39, 40)), ('Right', (31, 119, 180))):
        h = P(J[names.index(side + 'Hand')]); g.ellipse([h[0] - 6, h[1] - 6, h[0] + 6, h[1] + 6], fill=c)
    g.text((10, 8), f"{title}   t = {f['t']:.2f} s   red = left hand, blue = right hand   arm short by {f['short']*100:.0f} cm", fill=(0, 0, 0), font=font)
    return im
tmp = tempfile.mkdtemp()
for i, f in enumerate(fr): draw(f).save(f'{tmp}/f{i:05d}.png')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{tmp}/f%05d.png', '-pix_fmt', 'yuv420p', '-crf', '30', mp4], check=True)
picks = [int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else [int(k * (len(fr) - 1) / 7) for k in range(8)]  # optional 5th argument: frame numbers
sh = Image.new('RGB', (W // 2 * 2, H // 2 * 4), 'white')
for n, i in enumerate(picks): sh.paste(draw(fr[i]).resize((W // 2, H // 2)), (n % 2 * (W // 2), n // 2 * (H // 2)))
sh.save(sheet, quality=80, optimize=True)
print('frames', len(fr), 'picks', picks)
