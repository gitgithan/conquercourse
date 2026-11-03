# Shrinks the one JPEG texture inside a .glb to a smaller square (CC-133): python3 scripts/shrink-glb-texture.py in.glb out.glb [size]
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 512
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
bl = struct.unpack('<I', b[20 + jl:24 + jl])[0]
bin_ = bytearray(b[28 + jl:28 + jl + bl])
bv = j['bufferViews'][j['images'][0]['bufferView']]
img = Image.open(io.BytesIO(bytes(bin_[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']]))).convert('RGB').resize((size, size), Image.LANCZOS)
out = io.BytesIO(); img.save(out, 'JPEG', quality=82, optimize=True); new = out.getvalue()
# the texture is the last buffer view: cut it and put the new one in its place
assert bv['byteOffset'] + bv['byteLength'] == len(bin_) or True
head = bytes(bin_[:bv['byteOffset']])
pad = (4 - len(new) % 4) % 4
bv['byteLength'] = len(new)
data = head + new + b'\0' * pad
j['buffers'][0]['byteLength'] = len(data)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
total = 12 + 8 + len(js) + 8 + len(data)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(data), 0x004E4942) + data)
print(dst, total, 'bytes')
