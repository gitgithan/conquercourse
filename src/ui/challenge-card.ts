// The end-card block for a run on a course that is not one of the ranked ones (CC-108): why it is not on the ranked board, and the two ways on.
// Plain words a 13-year-old can follow; the buttons are the only controls; nothing here grades technique.
import { EXPIRES_DAYS } from '../share/challenge-client';

export interface ChallengeSpec {
  /** true when the page started on a ranked course and the player changed it; false for any other course (a World Editor or sliced course). */
  changed: boolean;
  /** Register the course; resolves with the id, or the words for why not. */
  publish: () => Promise<{ ok: boolean; id?: string; promoted?: boolean; error?: string; retryAfter?: number }>;
  /** The link to copy for a friend, once the course is registered. */
  link: (id: string) => Promise<string | null>;
  /** Leave this course for the official one. */
  official: () => void;
  copy?: (text: string) => Promise<void>;
}

export const CHANGED_WORDS = "You changed the course, so this run can't go on the ranked board. Publish it as a challenge course, or play the official course.";
export const OTHER_WORDS = "This course is not one of the ranked ones, so this run can't go on the ranked board. Publish it as a challenge course, or play the official course.";
export const PUBLISHED_WORDS = (promoted: boolean): string => promoted
  ? 'Challenge course published. It is in the Community list on the Courses screen.'
  : `Challenge course published. Send the link to a friend: it shows in the Community list once another player clears it, and it goes away after about ${EXPIRES_DAYS} days if nobody does.`;

const BTN = 'font:inherit;font-weight:800;border:1px solid #17201d;border-radius:8px;padding:6px 14px;cursor:pointer';

export function challengeStrip(spec: ChallengeSpec): HTMLElement {
  const row = document.createElement('div'); row.id = 'report-challenge';
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#fff6e0;border-left:4px solid #c27a00;border-radius:8px;padding:8px 10px';
  const say = document.createElement('div'); say.id = 'challenge-say'; say.style.cssText = 'flex-basis:100%;font-weight:700'; say.textContent = spec.changed ? CHANGED_WORDS : OTHER_WORDS;
  const make = document.createElement('button'); make.type = 'button'; make.id = 'publish-challenge'; make.textContent = 'Publish as challenge course'; make.style.cssText = `${BTN};background:#0f6b5c;color:#fff`;
  const off = document.createElement('button'); off.type = 'button'; off.id = 'play-official'; off.textContent = 'Play the official course'; off.style.cssText = `${BTN};background:#fff;color:#17201d`;
  const out = document.createElement('div'); out.id = 'challenge-result'; out.setAttribute('role', 'status'); out.style.cssText = 'flex-basis:100%;font-size:.9em;font-weight:600';
  off.onclick = () => spec.official();
  make.onclick = () => {
    make.disabled = true; out.textContent = 'The server is playing your run on this course…';
    void spec.publish().then(async (r) => {
      if (!r.ok || !r.id) { make.disabled = false; out.textContent = r.error ?? 'Not published.'; return; }
      make.textContent = 'Published ✓'; make.style.background = '#e6f4ee'; make.style.color = '#0f6b5c'; make.style.cursor = 'default';
      say.textContent = PUBLISHED_WORDS(r.promoted === true); out.textContent = '';
      const copy = document.createElement('button'); copy.type = 'button'; copy.id = 'copy-challenge'; copy.textContent = 'Copy challenge link'; copy.style.cssText = `${BTN};background:#fff;color:#17201d`;
      copy.onclick = () => {
        copy.disabled = true; out.textContent = 'Making the link…';
        void spec.link(r.id!).then(async (url) => {
          copy.disabled = false;
          if (!url) { out.textContent = 'The link could not be made. Try again in a moment.'; return; }
          try { await (spec.copy ?? ((t) => navigator.clipboard.writeText(t)))(url); out.textContent = 'Link copied.'; } catch { out.textContent = url; }
        });
      };
      make.after(copy);
    });
  };
  row.append(say, make, off, out);
  return row;
}
