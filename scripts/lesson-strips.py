"""Builds two teaching pictures for docs/lessons-obstacle-creation.md from the tracked demo-lift evidence (CC-133).
Only the already blurred pictures are used; nothing here reads or writes an unblurred person.
Use: python3 scripts/lesson-strips.py"""
from PIL import Image, ImageDraw, ImageFont

EV = 'data/eval/demo-lifts/evidence/'
OUT = 'docs/evidence/lessons/'
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)

def fit(im, w, h):
    im = im.copy(); im.thumbnail((w, h)); c = Image.new('RGB', (w, h), 'white'); c.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); return c

# 1. the strip: photo, Segment Objects, lift, editor piece
t = Image.open(EV + 'lifts_turntables.jpg').convert('RGB')
fork = Image.open('docs/evidence/cc-133-verify-course-fork.png').convert('RGB')
panels = [
    ('1. Photo (people blurred)', Image.open(EV + 'photo1_privacy_after.jpg').convert('RGB')),
    ('2. Segment Objects outlines things', Image.open(EV + 'photo1_segment_objects.jpg').convert('RGB')),
    ('3. Lift: a 3D bench', t.crop((0, 0, 900, 190))),
    ('4. Piece placed in the course', fork.crop((380, 80, 1280, 560))),
]
PW, PH = 520, 300
strip = Image.new('RGB', (PW * 2, (PH + 36) * 2), 'white'); g = ImageDraw.Draw(strip)
for i, (cap, im) in enumerate(panels):
    x, y = i % 2 * PW, i // 2 * (PH + 36)
    g.text((x + 8, y + 6), cap, fill='black', font=font)
    strip.paste(fit(im, PW - 8, PH), (x + 4, y + 34))
strip.save(OUT + 'photo-to-piece-strip.jpg', quality=78, optimize=True)

# 2. good lifts against weak lifts
good = [t.crop((0, 0, 900, 190)), t.crop((0, 395, 420, 675)), t.crop((0, 865, 700, 1150))]
weak = [t.crop((0, 695, 900, 785)), t.crop((0, 795, 900, 845))]
W = 900
def col(ims, title, sub):
    h = sum(fit(i, W, 250 if i.height > 150 else 110).height for i in ims) + 60
    c = Image.new('RGB', (W, h), 'white'); d = ImageDraw.Draw(c); d.text((6, 4), title, fill='black', font=font); d.text((6, 30), sub, fill=(90, 90, 90), font=small)
    y = 56
    for i in ims:
        f = fit(i, W, 250 if i.height > 150 else 110); c.paste(f, (0, y)); y += f.height
    return c
a = col(good, 'Good lifts: bench, pole, pull-up bar', 'solid shapes; a simple box or capsule is enough for collision')
b = col(weak, 'Weak lifts: bulb string, monkey bars', 'thin and flat; the mesh cannot be a collider, so use a primitive or leave it out')
H = max(a.height, b.height)
cmp_ = Image.new('RGB', (W * 2 + 20, H), 'white'); cmp_.paste(a, (0, 0)); cmp_.paste(b, (W + 20, 0))
cmp_.thumbnail((1400, 1400)); cmp_.save(OUT + 'good-vs-weak-lifts.jpg', quality=78, optimize=True)
