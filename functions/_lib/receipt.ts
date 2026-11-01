// A lift receipt (CC-103): proof that a piece came from a photo lift that passed the checks (bot check, safety check, daily limit).
// When a lift finishes, the server fingerprints the finished piece and signs it with the job id; sharing a piece to Community must show that receipt, once,
// and the piece it carries must have the same fingerprint, so the receipt cannot publish anything else. It is "jobid.expiry.fingerprint.signature",
// signed with a server secret that never leaves the server. Needs a table to remember used ones (migrations/0017_lift_receipts.sql).
export const RECEIPT_MS = 30 * 24 * 60 * 60_000; // a piece may be made today and shared weeks later; each receipt works once
export interface ReceiptEnv { CC_UPLOAD_TOKEN?: string; REQUIRE_LIFT_RECEIPT?: string }
interface Db { prepare(q: string): { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } } }

const sign = async (secret: string, text: string): Promise<string> => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)))].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const same = (a: string, b: string): boolean => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** The fingerprint of a piece: SHA-256 of its bytes, from the base64 text the page and the server both hold. */
export async function fingerprint(glbBase64: string): Promise<string> {
  const bin = atob(glbBase64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function makeReceipt(env: ReceiptEnv, jobId: string, glbBase64: string, now = Date.now()): Promise<string | undefined> {
  if (!env.CC_UPLOAD_TOKEN) return undefined;
  const exp = String(now + RECEIPT_MS), fp = (await fingerprint(glbBase64)).slice(0, 32);
  return `${jobId}.${exp}.${fp}.${await sign(env.CC_UPLOAD_TOKEN, `lift:${jobId}:${exp}:${fp}`)}`;
}
/** The job id when the receipt is genuine, fresh, and was made for exactly this piece; otherwise null. */
export async function receiptJob(env: ReceiptEnv, receipt: unknown, glbBase64: unknown, now = Date.now()): Promise<string | null> {
  if (!env.CC_UPLOAD_TOKEN || typeof receipt !== 'string' || receipt.length > 260 || typeof glbBase64 !== 'string' || !glbBase64) return null;
  const [job, exp, fp, sig] = receipt.split('.');
  if (!job || !/^fc-[A-Za-z0-9]{10,40}$/.test(job) || !/^\d{10,15}$/.test(exp ?? '') || Number(exp) < now || !/^[0-9a-f]{32}$/.test(fp ?? '') || !sig) return null;
  if (!same(await sign(env.CC_UPLOAD_TOKEN, `lift:${job}:${exp}:${fp}`), sig)) return null;
  try { return (await fingerprint(glbBase64)).slice(0, 32) === fp ? job : null; } catch { return null; }
}
/** Off by default (REQUIRE_LIFT_RECEIPT not "1") so pieces made before this existed can still be shared; then every share must show a fresh receipt. */
export async function spendReceipt(env: ReceiptEnv & { DB?: Db }, receipt: unknown, glbBase64: unknown, now = Date.now()): Promise<{ ok: true } | { ok: false; message: string }> {
  if (env.REQUIRE_LIFT_RECEIPT !== '1') return { ok: true };
  const no = { ok: false as const, message: 'Only pieces made from your own photo here can be shared. Make it from a photo, then share it.' };
  const job = await receiptJob(env, receipt, glbBase64, now);
  if (!job || !env.DB) return no;
  try {
    const r = await env.DB.prepare('INSERT OR IGNORE INTO lift_receipts (id, used_at) VALUES (?, ?)').bind(job, Math.floor(now / 1000)).run();
    return (r.meta?.changes ?? 0) === 1 ? { ok: true } : { ok: false, message: 'That piece was already shared once. Make a new one from a photo to share again.' };
  } catch { return no; } // fails closed
}
