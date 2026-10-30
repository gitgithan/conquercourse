// Fails when a tracked file holds a personal detail: a real email address, a home folder path or a public IPv4 address.
// Run by tests/no-personal-details.test.ts; `node scripts/check-personal.mjs` prints file:line and the kind, never the text.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SKIP_FILE = /(^|\/)(package-lock\.json|.*\.(png|jpe?g|webp|gif|glb|mp4|webm|ogg|mp3|wav|woff2?|npz|bin|svg|pdf|zip))$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const EMAIL_OK = /(@users\.noreply\.github\.com|@example\.(com|org|invalid)|@anthropic\.com|@[a-z0-9-]*\.?(npm|jsr)$)/i;
const HOME = /(\/home\/[a-z][a-z0-9_-]*\/|\/Users\/[A-Za-z][A-Za-z0-9_-]*\/|C:\\Users\\[A-Za-z])/g;
const HOME_OK = /\/home\/(user|runner|node|root|you|name)\//;
const IPV4 = /(?<![\w.])((?:\d{1,3}\.){3}\d{1,3})(?![\d.])/g;

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

export function findings(files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
  const out = [];
  for (const f of files) {
    if (SKIP_FILE.test(f) || f.startsWith('node_modules/')) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    text.split('\n').forEach((line, i) => {
      if (line.length < 300) for (const m of line.matchAll(EMAIL)) if (!EMAIL_OK.test(m[0])) out.push(`${f}:${i + 1} email`);
      for (const m of line.matchAll(HOME)) if (!HOME_OK.test(m[0])) out.push(`${f}:${i + 1} home path`);
      for (const m of line.matchAll(IPV4)) if (publicIp(m[1])) out.push(`${f}:${i + 1} public IP`);
    });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('check-personal.mjs')) {
  const bad = findings();
  bad.forEach((b) => console.log(b));
  process.exit(bad.length ? 1 : 0);
}
