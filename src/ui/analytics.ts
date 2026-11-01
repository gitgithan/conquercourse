// CC-108: where a visit came from, and the funnel steps. No personal data, no address, no full link.
// The tag is read once per visit (?ref=, else the referrer's host as one word), kept in sessionStorage, and sent with course events.
// Switch: on by default; ?analytics=0 turns it off for one visit.
import { pickRef } from '../../functions/_lib/analytics';

export const analyticsOnPage = (params: URLSearchParams): boolean => params.get('analytics') !== '0';

export function visitRef(): string {
  try {
    const kept = sessionStorage.getItem('cc.ref');
    if (kept) return kept;
    const r = pickRef(location.search, document.referrer, navigator.webdriver === true, location.hostname);
    sessionStorage.setItem('cc.ref', r);
    return r;
  } catch { return 'direct'; }
}

const sent = new Set<string>();
/** One funnel step, at most once per page load; the server keeps one per visitor code, step and day. */
export function trackStep(step: string, sid: string): void {
  try {
    if (!analyticsOnPage(new URLSearchParams(location.search)) || sent.has(step)) return;
    sent.add(step);
    void fetch('/api/funnel-event', { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, body: JSON.stringify({ session: sid, step, ref: visitRef() }) }).catch(() => { /* never interrupt play */ });
  } catch { /* never interrupt play */ }
}

/** The step a screen counts as using. */
export const stepForMode = (mode: string): string | null =>
  mode === 'map' ? 'used_slicer' : mode === 'editor' || mode === 'coaster' ? 'used_editor' : mode === 'dojo' ? 'used_dojo' : mode.startsWith('lab-') ? 'used_lab' : null;
