// Comparing a secret the caller sent with the stored one.
const enc = new TextEncoder();
/** Equal strings, in time that does not depend on where they differ (both are hashed first, so the length does not leak either). */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let d = a.length === b.length ? 0 : 1;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
