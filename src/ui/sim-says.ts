import { ensureSaysStyle, saysOn, sayBadge } from './says';

// CC-243: the Simulator's live voice while a person edits (World Editor) or slices (World Slicer).
// One strip, always in view at the top of the side panel, saying in plain first-person words what the ideal-run check thinks right now.
// The state is never colour alone: each state has its own icon and its own opening word. Never shown over the track while the Course runs.
// ?says=0 turns it off (the older verdict lines stay as they were).

export type SimState = 'idle' | 'checking' | 'clear' | 'blocked' | 'stopped';

export const SIM_STATE: Record<SimState, { label: string; icon: string; edge: string; tint: string }> = {
  idle: { label: 'Waiting', edge: '#58635d', tint: '#f1f4f2', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.5"/>' },
  checking: { label: 'Checking', edge: '#1565c0', tint: '#e5effb', icon: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>' },
  clear: { label: 'Can clear', edge: '#0f6b5c', tint: '#e6f4ee', icon: '<path d="M5 12.5l4.5 4.5L19 7"/>' },
  blocked: { label: 'Cannot clear', edge: '#b3261e', tint: '#fbe9e7', icon: '<path d="M6 6l12 12M18 6L6 18"/>' },
  stopped: { label: 'Not checked', edge: '#8a6a00', tint: '#fbf3d6', icon: '<path d="M9 5v14M15 5v14"/>' },
};

/** The editor's verdict line (and the lane-check state) in the Simulator's first-person words. Pure, so the test can run it. */
export function editorWords(verdict: string, laneKind = 'idle'): { state: SimState; words: string } {
  const v = verdict.trim();
  if (laneKind === 'searching' || /^Checking this lane/.test(v)) return { state: 'checking', words: 'I am checking this lane. A ghost runs it with the real game physics.' };
  if (/^The simulator can clear/.test(v)) return { state: 'clear', words: v.replace(/^The simulator can clear this lane/, 'I can clear this lane') };
  if (/^The simulator cannot find a way/.test(v)) return { state: 'blocked', words: 'I cannot find a way to clear this lane. Widen a gap or lower a step, then I will check again.' };
  if (/^No lane the runner can clear/.test(v)) return { state: 'blocked', words: 'I found no lane I can clear. Try other pieces or other levels.' };
  if (/^Nothing is in the lane/.test(v)) return { state: 'idle', words: 'There is nothing in the lane for me to run on. Move the lane or the pieces.' };
  if (/^(Stopped|Timed out)/.test(v)) return { state: 'stopped', words: `I did not finish. ${v.replace(/^(Stopped|Timed out)[^:]*: ?/, '')}` };
  if (/could not finish/.test(v)) return { state: 'stopped', words: 'I could not finish this check. Try again after editing stops.' };
  if (!v) return { state: 'idle', words: 'I check the lane as soon as you stop editing. A ghost runs it with the real game physics.' };
  return { state: 'idle', words: v };
}

/** The slicer's live read (data-slice-lane: clearable, not-clearable, checking, working, none) in the Simulator's words.
 *  more.proven: a ghost already ran this exact line offline; more.closest: no clean line exists here and this is the closest; more.auto: the search is still trying other heights (CC-90). */
export function slicerWords(kind: string, lengthM = 0, cutM = '', more: { proven?: boolean; closest?: boolean; auto?: string | null } = {}): { state: SimState; words: string } {
  const at = cutM ? ` at ${cutM} m` : '';
  if (more.closest && (kind === 'not-clearable' || kind === 'none')) return { state: 'blocked', words: `No clean line found here: this is the closest${at}. I cannot clear it yet. Move the line or the height and I will check again.` };
  if (more.auto && (kind === 'not-clearable' || kind === 'none' || kind === 'working' || kind === 'checking')) return { state: 'checking', words: more.auto };
  switch (kind) {
    case 'clearable': return { state: 'clear', words: more.proven ? `I can clear this ${lengthM} m lane${at}. A ghost ran this exact line ahead of time on the real physics, and it cleared.` : `I can clear this ${lengthM} m lane${at}. A ghost ran it.` };
    case 'not-clearable': return { state: 'blocked', words: `I cannot clear this lane${at}. Try another height or move the line, and I will check again.` };
    case 'checking': return { state: 'checking', words: `I am checking this lane${at}. A ghost runs it. The dashed line is not proved yet.` };
    case 'working': return { state: 'checking', words: `I am looking for a lane${at}.` };
    case 'none': return { state: 'blocked', words: `I find no lane to run${at}. It is too short, too steep, or there is nothing to run on.` };
    default: return { state: 'idle', words: 'Pick a place and press Slice. I check each lane you cut.' };
  }
}

export interface SimSaysPanel { el: HTMLElement; set: (state: SimState, words: string) => void }

const CSS = `
.simsays[hidden]{display:none}
.simsays{position:sticky;top:0;z-index:5;display:grid;gap:6px;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:2px solid var(--e);border-left-width:8px;background:var(--t);color:#17201d;font-family:system-ui,sans-serif;box-shadow:0 2px 8px #0002}
.simsays .ss-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.simsays .says{animation:none;padding:3px 10px 3px 3px;border-width:1px}
.simsays .says .says-ico{width:26px;height:26px}.simsays .says .says-title{font-size:15px}.simsays .says .says-by{display:none}
.simsays .ss-state{display:inline-flex;align-items:center;gap:5px;font:800 13px system-ui,sans-serif;color:var(--e);margin-left:auto}
.simsays .ss-state svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.simsays .ss-words{font:600 14px/1.35 system-ui,sans-serif;margin:0}
.simsays .ss-by{font:600 11px system-ui,sans-serif;color:#44504a}
.simsays[data-state="checking"] .ss-state svg{animation:ss-spin 2s linear infinite}
@keyframes ss-spin{to{transform:rotate(180deg)}}
@media (prefers-reduced-motion:reduce){.simsays[data-state="checking"] .ss-state svg{animation:none}}
`;

/** The strip. Returns null with ?says=0. Put `el` first in the side panel; call `set` whenever the verdict changes. */
export function simSaysPanel(where: 'editor' | 'slicer', o: { doc?: Document; params?: URLSearchParams } = {}): SimSaysPanel | null {
  if (!saysOn(o.params)) return null;
  const doc = o.doc ?? document;
  ensureSaysStyle(doc);
  if (!doc.getElementById('simsays-style')) { const st = doc.createElement('style'); st.id = 'simsays-style'; st.textContent = CSS; doc.head.append(st); }
  const el = doc.createElement('div'); el.className = 'simsays'; el.id = `simsays-${where}`; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  const head = doc.createElement('div'); head.className = 'ss-head';
  const badge = sayBadge('simulator', { doc, sub: null });
  const st = doc.createElement('span'); st.className = 'ss-state';
  head.append(badge, st);
  const words = doc.createElement('p'); words.className = 'ss-words';
  const by = doc.createElement('div'); by.className = 'ss-by'; by.textContent = 'Not an AI: the real game physics, the same every time.';
  el.append(head, words, by);
  let last = '';
  const set = (state: SimState, text: string) => {
    if (last === `${state}|${text}`) return; // the editor watches its own panel, so a repeat must not touch the page
    last = `${state}|${text}`;
    const d = SIM_STATE[state];
    el.dataset.state = state; el.style.setProperty('--e', d.edge); el.style.setProperty('--t', d.tint);
    st.replaceChildren();
    const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = d.icon;
    st.append(s, doc.createTextNode(d.label));
    words.textContent = text;
  };
  set('idle', '');
  return { el, set };
}
