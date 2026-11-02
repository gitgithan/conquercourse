// Shared by the editor browser checks: the editor opens with a demo of pieces and the first-visit Person piece lands a moment later (async),
// so a check must not wait for a fixed count. This waits until the count (html[data-pieces]) is at least `min` and has not changed for `quietMs`, and returns it.
export async function settledPieces(page, { min = 3, quietMs = 1500, timeout = 60000 } = {}) {
  const read = () => page.evaluate(() => Number(document.documentElement.dataset.pieces));
  const end = Date.now() + timeout;
  let last = -1, since = Date.now();
  while (Date.now() < end) {
    const n = await read().catch(() => NaN);
    if (n !== last) { last = n; since = Date.now(); }
    else if (n >= min && Date.now() - since >= quietMs) return n;
    await page.waitForTimeout(150);
  }
  throw new Error(`the piece count did not settle (last ${last})`);
}
