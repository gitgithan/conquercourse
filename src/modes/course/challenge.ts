import { courseLifetime } from './lifetime';
import type { CourseData } from '../../course/course';
import { startXOf } from '../../sim/replay';
import { lookOfParam } from '../../ui/ghost-look';
import { challengeWords, isOldLongLink, OLD_LINK_WORDS, offersIdeal, openChallenge, secondsWords, shareOn } from '../../share/challenge';
import { PHONE_WORDS, browserPointing, phoneMode } from '../../share/phone';
import { showBanner } from '../../share/share-ui';
import type { Ghost } from '../../ui/ghost';
import type { InputLog } from '../../sim/replay';
import type { createFeed } from './feed';
import type { CourseState } from './state';

export interface ChallengeDeps {
  course: CourseData;
  params: URLSearchParams;
  st: CourseState;
  resume: boolean;
  touchControls: boolean;
  botMode: boolean;
  feed: ReturnType<typeof createFeed>;
  ghostCtl: () => Ghost | null;
  restart: (x: number) => void;
  paintKeys: (open: boolean) => void;
  makeClip: (log: InputLog, ticks: number, from?: number) => Promise<unknown> | void;
}

// A challenge link (CC-128): the sender's keys are played in the simulator, and that run becomes the ghost to beat.
export function openChallengeLink(deps: ChallengeDeps): void {
  const { course, params, st, botMode, feed, ghostCtl } = deps;
  const life = courseLifetime();
  // A challenge link (CC-128): the sender's keys are played in the simulator, and that run becomes the ghost to beat.
  const copyHere = async () => { // the link of this page, so a phone can send it to a computer
    const btn = [...document.querySelectorAll<HTMLButtonElement>('#challenge-banner button')].find((x) => /Copy link|Link copied|Link ready/.test(x.textContent ?? ''));
    try { await navigator.clipboard.writeText(location.href); if (btn) btn.textContent = 'Link copied'; }
    catch { window.prompt('Copy this link', location.href); if (btn) btn.textContent = 'Link ready'; }
  };
  const challengeParam = shareOn(params) && !botMode && params.get('challenge') !== '0' ? params.get('challenge') : null; // ?challenge=0 is the switch for challenge courses, not a link (CC-108)
  if (challengeParam && isOldLongLink(params)) showBanner(OLD_LINK_WORDS, [], 20000); // CC-219: only short links are made and opened; an old long address says so in one line
  else if (challengeParam) {
    void openChallenge(course, challengeParam).then((c) => {
      if (life?.closed) return;
      if (document.documentElement.dataset.madeRefused) { showBanner(challengeWords('too-big'), [], 20000); return; } // the course in the link could not be opened (CC-136)
      if (!c.ok) {
        const offer = offersIdeal(c.why) && ghostCtl ? [{ label: 'Chase the ideal run instead', go: () => { ghostCtl()?.chaseIdeal(); document.getElementById('challenge-banner')?.remove(); } }] : [];
        showBanner(challengeWords(c.why), offer, 20000);
        return;
      }
      ghostCtl()?.setFriend(c.track, c.nick, lookOfParam(params.get('rk')), c.start > 0 ? startXOf(course, c.start) : null);
      if (c.start > 0 && !deps.resume) { st.retryX = startXOf(course, c.start); deps.restart(st.retryX); } // CC-242: begin where the friend began, standing still, so both bodies start together
      if (phoneMode(params, browserPointing) && !deps.touchControls) {
        // A phone has no keys (CC-138): the page plays the friend's run by itself and says how to play it for real.
        st.keysOpen = false; st.keysTouched = true; deps.paintKeys(false); st.frontOverride = false; // the small corner view would hide the runner on a narrow screen
        showBanner(PHONE_WORDS(secondsWords(c.ticks)), [{ label: 'Copy link', go: () => void copyHere() }], 0);
        st.phoneWatch = c.log; feed.play(c.log);
        return;
      }
      if (c.kind === 'fell') { // CC-181: a try that did not finish: a ghost that falls where the player fell; nothing is sent anywhere
        const at = c.track.xs[c.track.ticks].toFixed(0);
        showBanner(`${c.nick ? `${c.nick} fell` : 'A friend fell'} ${at} m along the course. Can you get further?`, [{ label: 'Download video of this try', go: () => void deps.makeClip(c.log, c.ticks) }]);
        if (params.get('autoplay') === '1') feed.play(c.log);
        return;
      }
      showBanner(c.nick ? `Beat ${c.nick}: ${secondsWords(c.ticks)}` : `Beat this time: ${secondsWords(c.ticks)}`, [{ label: 'Download video of this run', go: () => void deps.makeClip(c.log, c.ticks) }]);
      if (params.get('autoplay') === '1') feed.play(c.log); // for the browser check: play the friend's keys as if by hand
      if (params.get('clip') === 'auto') void deps.makeClip(c.log, c.ticks);
    });
  }
}
