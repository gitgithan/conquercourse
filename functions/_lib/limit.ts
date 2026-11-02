// A small per-key rate limit kept in the memory of one worker; every route that calls a paid or rented service uses this one copy.
// It is a speed bump, not a guarantee: each worker counts on its own.
const hits = new Map<string, number[]>();
export function limited(ip: string, now = Date.now(), max = 20, windowMs = 600_000): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(ip, recent); return true; }
  recent.push(now); hits.set(ip, recent);
  return false;
}

/** Seconds until `limited` would let this key through again (0 when it already would). */
export function waitSeconds(ip: string, now = Date.now(), windowMs = 600_000): number {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  return recent.length ? Math.max(1, Math.ceil((Math.min(...recent) + windowMs - now) / 1000)) : 0;
}
