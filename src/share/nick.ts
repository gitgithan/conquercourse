// The optional three-letter nickname in a challenge link (CC-134). Never a real name, never stored on a server.
import { cleanNick } from '../sim/replay';

// Three-letter words we do not put on a stranger's screen. Digits that look like letters are read as letters first.
const BLOCKED = new Set([
  'ass', 'fuk', 'fck', 'fuc', 'sex', 'cum', 'tit', 'dik', 'dck', 'cok', 'cnt', 'fag', 'nig', 'kkk', 'nzi', 'hoe', 'sht', 'pis', 'vag', 'wtf', 'wnk', 'twt', 'gay', 'xxx', 'bch', 'wop', 'jiz',
]);
const LOOKS_LIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '2': 'z' };

/** The nickname as it will travel: capital letters and digits, three at most. */
export const tidyNick = cleanNick;

/** True when the nickname is empty (the default) or is three letters we are happy to show. */
export function nickOk(raw: string): boolean {
  const nick = cleanNick(raw);
  if (!nick) return true;
  const read = nick.toLowerCase().replace(/[0-9]/g, (d) => LOOKS_LIKE[d] ?? d);
  return !BLOCKED.has(read) && !BLOCKED.has(nick.toLowerCase());
}

/** What a link may show: the nickname when it passes, otherwise nothing (the run still plays). */
export const shownNick = (raw: string): string => (nickOk(raw) ? cleanNick(raw) : '');
