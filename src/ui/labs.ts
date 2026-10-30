import { pageSearch } from '../flags';
// The labs switch: features that are new and not for first-time players. ?labs=1 turns them on and the browser remembers it; ?labs=0 turns them off.
export function labsOn(search = pageSearch()): boolean {
  const m = /[?&]labs(?:=(\w+))?(?:&|$)/.exec(search);
  try {
    if (m) { const on = m[1] !== '0'; if (on) localStorage.setItem('cc.labs', '1'); else localStorage.removeItem('cc.labs'); return on; }
    return localStorage.getItem('cc.labs') === '1';
  } catch { return !!m && m[1] !== '0'; }
}
