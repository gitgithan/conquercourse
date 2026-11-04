import type { CourseData } from '../../course/course';
import { courseFromUrl } from '../../course/load';
import { pageQuery } from '../../flags';
import { registerCourseNavigation } from '../../ui/course-navigation';
import type { CourseGame } from '../course';

/** Gallery course selections keep the graphics device and immutable assets alive. */
export function installCourseRuntime(host: HTMLElement, initial: CourseGame, create: (host: HTMLElement, course?: CourseData, renderer?: CourseGame['renderer']) => Promise<CourseGame>): CourseGame {
  let game = initial, switching = false;
  const renderer = initial.renderer;
  const status = document.createElement('div');
  status.id = 'course-loading'; status.dataset.coursePersistent = ''; status.role = 'status';
  status.style.cssText = 'position:fixed;inset:0;z-index:90;display:none;place-content:center;background:#142d37cc;color:white;font:700 22px system-ui;text-align:center';
  host.append(status);
  const isCourse = (url: URL) => url.origin === location.origin && url.pathname === location.pathname && !url.searchParams.has('demo') && (url.searchParams.get('mode') ?? 'course') === 'course';
  async function switchTo(url: URL, pop: boolean): Promise<void> {
    switching = true; game.suspend(true);
    status.style.inset = '0'; status.style.padding = ''; status.style.fontSize = '22px'; status.onclick = null;
    status.textContent = 'Opening course…'; status.style.display = 'grid';
    document.documentElement.dataset.ready = 'false';
    try {
      const course = await courseFromUrl(url.searchParams);
      // A failed explicit course request must not quietly become the First Course.
      if (!course && ['course', 'cid', 'made', 'generate', 'coaster'].some((k) => url.searchParams.has(k))) throw new Error('Course unavailable');
      if (!pop) history.pushState(null, '', url);
      game.dispose();
      game = await create(host, course, renderer);
      document.documentElement.dataset.backend = game.backend;
      document.documentElement.dataset.courseSwitch = String(Number(document.documentElement.dataset.courseSwitch ?? 0) + 1);
      status.style.display = 'none';
    } catch {
      // Fetch errors leave the current course usable. A failed construction needs a fresh document.
      if (location.href === url.href) { location.reload(); return; }
      status.textContent = 'Could not open that course. Choose another or try again.';
      status.style.inset = 'auto 20px 20px'; status.style.padding = '12px'; status.style.fontSize = '16px';
      status.onclick = () => { status.style.display = 'none'; };
      game.suspend(false);
    } finally { switching = false; document.documentElement.dataset.ready = 'true'; }
  }
  registerCourseNavigation((href) => {
    const url = new URL(href, location.href);
    if (!isCourse(url) || pageQuery().get('courseswitch') === '0') return false;
    if (switching || game.busy()) return true; // retain the clip's renderer until recording ends
    // Remove the old gallery before starting the next session's DOM ownership.
    document.getElementById('world-gallery')?.remove();
    void switchTo(url, false); return true;
  });
  const onPop = () => {
    const url = new URL(location.href);
    if (!isCourse(url) || switching || game.busy()) { location.reload(); return; }
    void switchTo(url, true);
  };
  window.addEventListener('popstate', onPop);
  return {
    backend: initial.backend, renderer,
    world: () => game.world(), restart: () => game.restart(),
    busy: () => game.busy(), suspend: (on) => game.suspend(on),
    dispose: () => { registerCourseNavigation(() => false); window.removeEventListener('popstate', onPop); game.dispose(); status.remove(); },
  };
}
