// The optional nickname (CC-134): up to twelve letters, digits, _ or -, shown on the leaderboard and in a challenge link. Never a real name.
import { cleanNick } from '../sim/replay';

// Three-letter words we do not put on a stranger's screen. Digits that look like letters are read as letters first.
const BLOCKED = new Set([
  'ass', 'fuk', 'fck', 'fuc', 'sex', 'cum', 'tit', 'dik', 'dck', 'cok', 'cnt', 'fag', 'nig', 'kkk', 'nzi', 'hoe', 'sht', 'pis', 'vag', 'wtf', 'wnk', 'twt', 'gay', 'xxx', 'bch', 'wop', 'jiz',
]);
// Strong words that are refused anywhere inside a longer tag.
const INSIDE = ['fuck', 'shit', 'cunt', 'nigg', 'fagg', 'nazi', 'rape', 'porn', 'whore', 'slut', 'bitch', 'wank', 'hitler', 'kkk'];
const LOOKS_LIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '2': 'z' };

/** The nickname as it will travel: letters, digits, _ and -, twelve at most. */
export const tidyNick = cleanNick;

/** True when the nickname is empty (the default) and not on the blocked lists: a short word as a whole, or a strong word anywhere inside (digits that look like letters are read as letters). */
export function nickOk(raw: string): boolean {
  const nick = cleanNick(raw);
  if (!nick) return true;
  const plain = nick.toLowerCase().replace(/[_-]/g, '');
  const read = plain.replace(/[0-9]/g, (d) => LOOKS_LIKE[d] ?? d);
  if (BLOCKED.has(read) || BLOCKED.has(plain)) return false;
  return !INSIDE.some((w) => read.includes(w) || plain.includes(w));
}

/** What a link may show: the nickname when it passes, otherwise nothing (the run still plays). */
export const shownNick = (raw: string): string => (nickOk(raw) ? cleanNick(raw) : '');
