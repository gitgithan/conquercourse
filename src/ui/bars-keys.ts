import { nextHand, canReach, DEFAULT_BARS } from '../sim/bars';
import type { WorldState } from '../sim/world';
import type { CourseData } from '../course/course';

// The two reach keys of the monkey bars, drawn while you hang: Q is the left hand, T the right. The key whose hand goes next lights up
// green when the swing lets it reach, and stays plain while you wait for the swing. It shows the rule; it never scores the player.
export function createBarsKeys(parent: HTMLElement): { update(w: WorldState, course: CourseData): void } {
  const box = document.createElement('div');
  box.id = 'bars-keys';
  box.style.cssText = 'position:fixed;left:50%;top:232px;transform:translateX(-50%);display:none;gap:14px;align-items:center;pointer-events:none;font:600 15px system-ui,sans-serif;color:#10141c;background:#fffd;border-radius:12px;padding:8px 14px;z-index:5';
  const cap = (k: string, who: string) => { const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:92px;border-radius:8px;padding:4px 10px;border:2px solid #10141c33'; const a = document.createElement('div'); a.textContent = k; a.style.cssText = 'font-size:26px;font-weight:800'; const b = document.createElement('div'); b.textContent = who; d.append(a, b); return d; };
  const q = cap('Q', 'left hand'), t = cap('T', 'right hand'), note = document.createElement('div');
  note.style.cssText = 'max-width:230px;font-weight:500;font-size:13px';
  box.append(q, note, t); parent.append(box);
  const paint = (d: HTMLElement, state: 'go' | 'wait' | 'other') => { d.style.background = state === 'go' ? '#38d26b' : '#0000'; d.style.opacity = state === 'other' ? '0.45' : '1'; };
  return {
    update(w, course) {
      const b = w.mode === 'bars' && w.bars && course.bars?.[w.bars.run] ? w.bars : null;
      box.style.display = b ? 'flex' : 'none';
      if (!b) return;
      const row = course.bars![b.run], next: 1 | 2 = nextHand(row, b) ?? 1, ok = canReach(row, b, next, DEFAULT_BARS).ok;
      paint(q, next === 1 ? (ok ? 'go' : 'wait') : 'other'); paint(t, next === 2 ? (ok ? 'go' : 'wait') : 'other');
      note.textContent = b.l >= row.n - 1 && b.r >= row.n - 1 ? 'Last rung: let go of E to fly off' : ok ? 'Reach now!' : 'Swing forward (→ ←), then reach with the other hand. Alternate Q, T, Q, T.';
    },
  };
}
