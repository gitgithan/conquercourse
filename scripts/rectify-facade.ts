// CC-133: straighten one wall of a facade photo into a texture.
// Usage: npx tsx scripts/rectify-facade.ts <photo> <out.jpg> <x0,y0,x1,y1,x2,y2,x3,y3 (top-left, top-right, bottom-right, bottom-left, in photo pixels)> <wallWidthMetres> [outWidth=1280]
import sharp from 'sharp';
import { facadeAspect, rectifyMap, type Quad } from '../src/world/facade';

const [photo, out, corners, widthM, outW = '1280'] = process.argv.slice(2);
if (!photo || !out || !corners || !widthM) { console.error('usage: rectify-facade.ts <photo> <out.jpg> <8 numbers> <width m> [outWidth]'); process.exit(1); }
const n = corners.split(',').map(Number);
const q: Quad = [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
const W = Number(outW), aspect = facadeAspect(q), H = Math.round(W / aspect);
const { data, info } = await sharp(photo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const map = rectifyMap(q, W, H), res = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const [sx, sy] = map(x + 0.5, y + 0.5), x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5), fx = sx - 0.5 - x0, fy = sy - 0.5 - y0;
  for (let c = 0; c < 3; c++) {
    const g = (xx: number, yy: number) => data[(Math.min(info.height - 1, Math.max(0, yy)) * info.width + Math.min(info.width - 1, Math.max(0, xx))) * 3 + c];
    res[(y * W + x) * 3 + c] = Math.round((g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy);
  }
}
await sharp(res, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 78, mozjpeg: true }).toFile(out);
console.log(JSON.stringify({ out, width: W, height: H, aspect: Number(aspect.toFixed(3)), wallHeightMetres: Number((Number(widthM) / aspect).toFixed(2)) }));
