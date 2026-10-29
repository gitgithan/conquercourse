# CC-171: the obstacle strip keeps its gold icons

- So what: the icons under the time line look like before again (gold rounded boxes, a glowing wave, the next one biggest).
- Cause: CC-163 renamed the strip id to `zonestrip`, so the `#strip` styles stopped matching.
- Fix: the strip keeps the id `strip`; the narrow-screen rule uses `#strip` too.
- Check: `node scripts/strip-style-check.mjs` reports the gold fill and border at 1280 px (PASS).
- Picture: `strip-1280.png`.
- Phones are out of scope (owner, 2026-10-29), so only the desktop width is checked.
