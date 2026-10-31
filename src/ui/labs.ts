import { pageSearch } from '../flags';
// The labs switch: the university Labs and the map card. On by default since 2026-11-01 (owner decision); ?labs=0 turns them off and the browser remembers it, ?labs=1 turns them back on.
export function labsOn(search = pageSearch()): boolean {
  const m = /[?&]labs(?:=(\w+))?(?:&|$)/.exec(search);
  try {
    if (m) { const on = m[1] !== '0'; if (on) localStorage.removeItem('cc.labs'); else localStorage.setItem('cc.labs', '0'); return on; }
    return localStorage.getItem('cc.labs') !== '0';
  } catch { return !m || m[1] !== '0'; }
}
