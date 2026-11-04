import { openCourseHref } from '../../ui/course-navigation';
import type { CourseData } from '../../course/course';
import { BUTTON_PLACE, buildGallery, currentWorld, DEMOS, modalAttrs, mountWorldGallery, worldHref } from '../../ui/world-picker';
import { browserStore, rememberCourse, tourDecision } from '../../ui/onboarding-flags';

// The first visit: the course chooser in a dialog (or the short tour instead), the Courses button in the corner and, on a coaster, the way back to the builder.
export function createWelcome(c: { course: CourseData; params: URLSearchParams; resume: boolean }) {
  const { course, params } = c;
  // demo courses: every course we have made, one choice away (the stock course, the lache demo, lanes from real objects, places from the map)
  const demos = DEMOS;
  const here = currentWorld(params, course.name);
  const rememberWorldWelcome = () => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch { /* the chooser can still be used */ } };
  // the first-visit chooser is the course gallery inside a dialog; after it, a "Courses" button in the corner opens the same gallery (CC-89)
  const welcome = document.createElement('section');
  welcome.id = 'choose-world';
  modalAttrs(welcome); welcome.setAttribute('aria-labelledby', 'choose-world-title');
  welcome.style.cssText = 'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:12px;box-sizing:border-box;background:#10182099;backdrop-filter:blur(4px)';
  const welcomeCard = document.createElement('div');
  welcomeCard.style.cssText = 'width:min(1000px,100%);max-height:100%;overflow:auto;box-sizing:border-box;padding:clamp(14px,3vw,28px);border-radius:20px;background:#fffdf7;color:#17201d;box-shadow:0 24px 80px #0006';
  const welcomeTitle = document.createElement('h1');
  welcomeTitle.id = 'choose-world-title'; welcomeTitle.textContent = 'Choose Your World';
  welcomeTitle.style.cssText = 'margin:0 0 6px;font:800 clamp(26px,5vw,40px)/1.05 system-ui,sans-serif;letter-spacing:-.04em';
  const welcomeCopy = document.createElement('p');
  welcomeCopy.textContent = `Welcome to ConquerCourse. Click a picture: ${demos.length} worlds, from obstacle courses to real places, or make your own.`;
  welcomeCopy.style.cssText = 'margin:0 0 12px;color:#58635d;font:500 16px/1.45 system-ui,sans-serif';
  welcome.append(welcomeCard);
  const courseButton = mountWorldGallery(document.body, { current: here, place: BUTTON_PLACE.course, onPick: (v) => { rememberWorldWelcome(); openCourseHref(worldHref(v)); } });
  const closeWelcome = () => { welcome.remove(); courseButton.button.focus({ preventScroll: true }); };
  const welcomeGallery = buildGallery({ current: here, heading: 'Courses', onClose: () => { rememberWorldWelcome(); closeWelcome(); }, onPick: (v) => { rememberWorldWelcome(); if (v === 'stay' || v === here.value) closeWelcome(); else openCourseHref(worldHref(v)); } });
  welcomeCard.append(welcomeTitle, welcomeCopy, welcomeGallery.el);
  let worldWelcomeSeen = false;
  try { worldWelcomeSeen = localStorage.getItem('cc.worldWelcome.seen') === '1'; } catch { /* use the one-time URL option when storage is unavailable */ }
  const mode = params.get('mode');
  rememberCourse(browserStore, params); // CC-100: a returning player comes back to their last course
  const tour = tourDecision({ params, store: browserStore, automated: navigator.webdriver, mode, resume: c.resume }); // CC-100: a first visit gets the short tour instead of the big chooser
  const showWorldWelcome = !c.resume && !worldWelcomeSeen && params.get('welcome') !== '0' && (!mode || mode === 'course') && !params.has('course') && !params.has('challenge') && !params.has('generate') && !params.has('coaster') && tour !== 'tour';
  if (showWorldWelcome) { document.body.append(welcome); welcomeGallery.focusStart(); }
  if (!showWorldWelcome) rememberWorldWelcome(); // direct course starts (including Community Play) count as the first play
  if (course.track) {
    const edit = document.createElement('a');
    edit.id = 'edit-coaster'; edit.textContent = '← Back to coaster builder'; edit.title = 'Return to the coaster builder with this track and push';
    const encodedTrack = (course.track.segments ?? [course.track.pts]).map((section) => section.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')).join('|');
    const values = new URLSearchParams({ coaster: encodedTrack, push: String(course.track.push ?? 1.5) });
    edit.href = `?mode=coaster&${values}`;
    edit.style.cssText = 'position:fixed;right:16px;top:232px;z-index:21;font:700 16px system-ui,sans-serif;border:3px solid #064e3b;background:#0f6b5c;color:#fff;border-radius:12px;padding:12px 16px;text-decoration:none;box-shadow:0 4px 14px #0004';
    document.body.append(edit);
  }
  return { courseButton, tour };
}
