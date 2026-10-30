// Fails when a tracked file holds a personal detail: a real email address, a home folder path, a public IPv4 or IPv6 address,
// or (in a picture) a GPS position or a camera serial number. Binary files are scanned as bytes.
// Run by tests/no-personal-details.test.ts; `node scripts/check-personal.mjs` prints file:line and the kind, never the text.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SKIP_FILE = /(^|\/)package-lock\.json$/;
const MAX_BINARY = 64 * 1024 * 1024;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
// In very long lines (masks, base64) and in binary bytes only an address that stands alone with a common ending counts.
const EMAIL_STRICT = /(?<![A-Za-z0-9+/=_.-])[A-Za-z][A-Za-z0-9._+-]{2,}@[A-Za-z0-9-]{2,}(\.[A-Za-z0-9-]+)*\.(com|net|org|edu|io|dev|me|us|uk|co|app|ai|gov|de|fr|sg|cn|in)(?![A-Za-z0-9])/g;
const EMAIL_OK = /(@users\.noreply\.github\.com|@example\.(com|org|invalid)|@anthropic\.com|@[a-z0-9-]*\.?(npm|jsr)$)/i;
const HOME = /(\/home\/[a-z][a-z0-9_-]*\/|\/Users\/[A-Za-z][A-Za-z0-9_-]*\/|C:\\Users\\[A-Za-z])/g;
const HOME_OK = /\/home\/(user|runner|node|root|you|name)\//;
const IPV4 = /(?<![\w.])((?:\d{1,3}\.){3}\d{1,3})(?![\d.])/g;

const H = '[0-9a-f]{1,4}';
const IPV6 = new RegExp(`(?<![\\w:])(?:(?:${H}:){7}${H}|(?:${H}:){1,6}:(?:${H}(?::${H}){0,5})?)(?![\\w:])`, 'gi');

function publicIp6(ip) {
  const g = ip.toLowerCase();
  if (g.split(':').filter((x) => x).length < 3) return false; // too short to be an address
  return !/^(2001:0?db8|fe[89ab]|f[cd]|ff)/.test(g);
}

function publicIp(ip) {
  const o = ip.split('.').map(Number);
  if (o.some((n) => n > 255) || o.length !== 4) return false;
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && o[2] === 2) return false; // documentation ranges
  if (a === 198 && b === 51 && o[2] === 100) return false;
  if (a === 203 && b === 0 && o[2] === 113) return false;
  if (o[0] <= 9 && o[1] <= 9 && o[2] <= 9) return false; // looks like a version number
  return true;
}

// Camera data that points at a person: a GPS position or a camera serial number in the EXIF of a JPEG.
export function exifFlags(buf) {
  const flags = [];
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return flags;
  let p = 2;
  while (p + 4 < buf.length && buf[p] === 0xff) {
    const marker = buf[p + 1];
    const len = buf.readUInt16BE(p + 2);
    if (marker === 0xe1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\0\0') {
      const t = p + 10;
      const le = buf.toString('latin1', t, t + 2) === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      const ifd = (off, found) => {
        if (off <= 0 || t + off + 2 > buf.length) return;
        const n = u16(t + off);
        for (let i = 0; i < n && t + off + 2 + i * 12 + 12 <= buf.length; i++) {
          const e = t + off + 2 + i * 12;
          const tag = u16(e);
          if (tag === 0x8825) flags.push('GPS position');
          if (tag === 0xa431 || tag === 0xa435) flags.push('camera serial number');
          if (tag === 0x8769 && found === 0) ifd(u32(e + 8), 1);
        }
      };
      ifd(u32(t + 4), 0);
      return flags;
    }
    if (marker === 0xda) break;
    p += 2 + len;
  }
  return flags;
}

export function findings(files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
  const out = [];
  for (const f of files) {
    if (SKIP_FILE.test(f) || f.startsWith('node_modules/')) continue;
    let buf;
    try { buf = readFileSync(f); } catch { continue; }
    if (buf.length > MAX_BINARY) continue;
    const binary = buf.includes(0);
    const text = buf.toString(binary ? 'latin1' : 'utf8');
    if (binary) for (const k of new Set(exifFlags(buf))) out.push(`${f} ${k} in the picture`);
    text.split(binary ? /[\n\0]/ : '\n').forEach((line, i) => {
      for (const m of line.matchAll(binary || line.length >= 300 ? EMAIL_STRICT : EMAIL)) if (!EMAIL_OK.test(m[0])) out.push(`${f}:${i + 1} email`);
      for (const m of line.matchAll(HOME)) if (!HOME_OK.test(m[0])) out.push(`${f}:${i + 1} home path`);
      if (binary) return;
      for (const m of line.matchAll(IPV4)) if (publicIp(m[1])) out.push(`${f}:${i + 1} public IP`);
      for (const m of line.matchAll(IPV6)) if (publicIp6(m[0])) out.push(`${f}:${i + 1} public IPv6`);
    });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('check-personal.mjs')) {
  const bad = findings();
  bad.forEach((b) => console.log(b));
  process.exit(bad.length ? 1 : 0);
}
