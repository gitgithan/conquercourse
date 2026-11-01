// A lift receipt (CC-103): proof that a piece came from a photo lift that passed the checks (bot check, safety check, daily limit).
// The 3D step hands it back with the job id; sharing a piece to Community must show it, once. It is "jobid.expiry.signature",
// signed with a server secret that never leaves the server. Needs a table to remember used ones (migrations/0017_lift_receipts.sql).
export const RECEIPT_MS = 24 * 60 * 60_000;
export interface ReceiptEnv { CC_UPLOAD_TOKEN?: string; REQUIRE_LIFT_RECEIPT?: string }
interface Db { prepare(q: string): { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } } }

const sign = async (secret: string, text: string): Promise<string> => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)))].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const same = (a: string, b: string): boolean => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function makeReceipt(env: ReceiptEnv, jobId: string, now = Date.now()): Promise<string | undefined> {
  if (!env.CC_UPLOAD_TOKEN) return undefined;
  const exp = String(now + RECEIPT_MS);
  return `${jobId}.${exp}.${await sign(env.CC_UPLOAD_TOKEN, `lift:${jobId}:${exp}`)}`;
}
export async function receiptJob(env: ReceiptEnv, receipt: unknown, now = Date.now()): Promise<string | null> {
  if (!env.CC_UPLOAD_TOKEN || typeof receipt !== 'string' || receipt.length > 200) return null;
  const [job, exp, sig] = receipt.split('.');
  if (!job || !/^fc-[A-Za-z0-9]{10,40}$/.test(job) || !/^\d{10,15}$/.test(exp ?? '') || Number(exp) < now || !sig) return null;
  return same(await sign(env.CC_UPLOAD_TOKEN, `lift:${job}:${exp}`), sig) ? job : null;
}
/** Off by default (REQUIRE_LIFT_RECEIPT not "1") so pieces made before this existed can still be shared; then every share must show a fresh receipt. */
export async function spendReceipt(env: ReceiptEnv & { DB?: Db }, receipt: unknown, now = Date.now()): Promise<{ ok: true } | { ok: false; message: string }> {
  if (env.REQUIRE_LIFT_RECEIPT !== '1') return { ok: true };
  const no = { ok: false as const, message: 'Only pieces made from your own photo here can be shared. Make it from a photo, then share it.' };
  const job = await receiptJob(env, receipt, now);
  if (!job || !env.DB) return no;
  try {
    const r = await env.DB.prepare('INSERT OR IGNORE INTO lift_receipts (id, used_at) VALUES (?, ?)').bind(job, Math.floor(now / 1000)).run();
    return (r.meta?.changes ?? 0) === 1 ? { ok: true } : { ok: false, message: 'That piece was already shared once. Make a new one from a photo to share again.' };
  } catch { return no; } // fails closed
}
