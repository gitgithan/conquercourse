# CC-246: turns the four screenshots from scripts/welcome-tiles.mjs into the small .webp pictures the welcome screen ships (400x340).
import sys
from pathlib import Path
from PIL import Image
src = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/welcome-tiles')
dst = Path('public/assets/welcome'); dst.mkdir(parents=True, exist_ok=True)
for name in ['courses', 'editor', 'slicer', 'community']:
    im = Image.open(src / f'{name}.png').convert('RGB').resize((400, 340), Image.LANCZOS)
    im.save(dst / f'{name}.webp', quality=82, method=6)
    print(name, (dst / f'{name}.webp').stat().st_size // 1024, 'KB')
